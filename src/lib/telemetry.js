import {
  initializeAnalytics,
  isSupported as analyticsIsSupported,
  logEvent as firebaseLogEvent,
  setUserId as firebaseSetUserId,
  setUserProperties as firebaseSetUserProperties,
} from "firebase/analytics";
import {
  getPerformance,
  trace as firebaseTrace,
} from "firebase/performance";
import { app } from "./firebase";

const MEASUREMENT_ID = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
const IS_BROWSER = typeof window !== "undefined";
const DEBUG_TELEMETRY = import.meta.env.DEV && import.meta.env.VITE_TELEMETRY_DEBUG === "true";

let analyticsPromise = null;
let performanceInstance = null;
let performanceInitAttempted = false;

function debugWarn(message, err) {
  if (DEBUG_TELEMETRY) {
    console.warn(message, err);
  }
}

function cleanTraceAttribute(value) {
  if (value === undefined || value === null) return "";
  return String(value).slice(0, 100);
}

function safeTraceMetric(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0;
}

function cleanEventParams(params = {}) {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    if (typeof value === "string") {
      acc[key] = value.slice(0, 100);
      return acc;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) acc[key] = value;
      return acc;
    }
    if (typeof value === "boolean") {
      acc[key] = value;
      return acc;
    }
    acc[key] = String(value).slice(0, 100);
    return acc;
  }, {});
}

async function getAnalyticsInstance() {
  if (!IS_BROWSER || !MEASUREMENT_ID) return null;

  if (!analyticsPromise) {
    analyticsPromise = analyticsIsSupported()
      .then((supported) => {
        if (!supported) return null;
        return initializeAnalytics(app, {
          config: { send_page_view: false },
        });
      })
      .catch((err) => {
        debugWarn("Firebase Analytics unavailable", err);
        return null;
      });
  }

  return analyticsPromise;
}

function getPerformanceInstance() {
  if (!IS_BROWSER) return null;
  if (performanceInitAttempted) return performanceInstance;

  performanceInitAttempted = true;
  try {
    performanceInstance = getPerformance(app);
  } catch (err) {
    debugWarn("Firebase Performance unavailable", err);
    performanceInstance = null;
  }

  return performanceInstance;
}

function applyTraceData(activeTrace, attributes = {}, metrics = {}) {
  if (!activeTrace) return;

  Object.entries(attributes).forEach(([key, value]) => {
    try {
      activeTrace.putAttribute(key, cleanTraceAttribute(value));
    } catch (err) {
      debugWarn(`Failed to set trace attribute ${key}`, err);
    }
  });

  Object.entries(metrics).forEach(([key, value]) => {
    try {
      activeTrace.putMetric(key, safeTraceMetric(value));
    } catch (err) {
      debugWarn(`Failed to set trace metric ${key}`, err);
    }
  });
}

export function initTelemetry() {
  getPerformanceInstance();
  getAnalyticsInstance();
}

export function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  getAnalyticsInstance()
    .then((analytics) => {
      if (!analytics) return;
      firebaseLogEvent(analytics, eventName, cleanEventParams(params));
    })
    .catch((err) => {
      debugWarn(`Failed to log event ${eventName}`, err);
    });
}

export function trackException(error, params = {}) {
  trackEvent("exception", {
    fatal: false,
    description: error?.code || error?.message || "unknown_error",
    ...params,
  });
}

export function trackPageView({ path, title } = {}) {
  if (!IS_BROWSER) return;

  trackEvent("page_view", {
    page_path: path || `${window.location.pathname}${window.location.search}`,
    page_location: window.location.href,
    page_title: title || document.title,
  });
}

export function setTelemetryUser(user) {
  getAnalyticsInstance()
    .then((analytics) => {
      if (!analytics) return;
      firebaseSetUserId(analytics, user?.uid || null);
      firebaseSetUserProperties(analytics, {
        signed_in: user ? "true" : "false",
        provider: user?.providerData?.[0]?.providerId || "none",
      });
    })
    .catch((err) => {
      debugWarn("Failed to set telemetry user", err);
    });
}

export function startTrace(name, { attributes = {}, metrics = {} } = {}) {
  const perf = getPerformanceInstance();
  if (!perf || !name) return null;

  try {
    const activeTrace = firebaseTrace(perf, name);
    applyTraceData(activeTrace, attributes, metrics);
    activeTrace.start();

    return {
      putAttribute(key, value) {
        applyTraceData(activeTrace, { [key]: value });
      },
      putMetric(key, value) {
        applyTraceData(activeTrace, {}, { [key]: value });
      },
      incrementMetric(key, value = 1) {
        try {
          activeTrace.incrementMetric(key, safeTraceMetric(value));
        } catch (err) {
          debugWarn(`Failed to increment trace metric ${key}`, err);
        }
      },
      stop({ attributes: stopAttributes = {}, metrics: stopMetrics = {} } = {}) {
        try {
          applyTraceData(activeTrace, stopAttributes, stopMetrics);
          activeTrace.stop();
        } catch (err) {
          debugWarn(`Failed to stop trace ${name}`, err);
        }
      },
    };
  } catch (err) {
    debugWarn(`Failed to start trace ${name}`, err);
    return null;
  }
}

export async function measureTrace(name, callback, options = {}) {
  const startedAt = IS_BROWSER && window.performance ? window.performance.now() : Date.now();
  const activeTrace = startTrace(name, options);

  try {
    const result = await callback(activeTrace);
    activeTrace?.putAttribute("status", "success");
    return result;
  } catch (err) {
    activeTrace?.putAttribute("status", "error");
    activeTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    trackException(err, { trace_name: name });
    throw err;
  } finally {
    const endedAt = IS_BROWSER && window.performance ? window.performance.now() : Date.now();
    activeTrace?.stop({
      metrics: {
        duration_ms: endedAt - startedAt,
      },
    });
  }
}
