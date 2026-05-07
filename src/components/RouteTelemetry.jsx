import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/telemetry";

const PAGE_TITLES = {
  "/": "Home",
  "/home": "Home",
  "/auth": "Auth",
  "/user-home": "User Gallery",
  "/user-profile": "User Profile",
};

export default function RouteTelemetry() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    const title =
      PAGE_TITLES[location.pathname] ||
      (location.pathname.startsWith("/shared/") ? "Shared Image" : "App");

    trackPageView({ path, title });
  }, [location.pathname, location.search]);

  return null;
}
