import React, { useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { ThemeToggle } from "../ThemeContext";
import { measureTrace, trackEvent } from "../lib/telemetry";


function friendlyAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const nextPath = searchParams.get("next");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const inputClass =
    "h-14 w-full rounded-[20px] border border-slate-200 dark:border-slate-400 bg-white dark:bg-slate-800 px-14 pr-12 text-[16px] text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500";

  const resetVisibility = () => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const goToLogin = () => {
    setSearchParams({});
    resetVisibility();
  };

  const goToSignup = () => {
    setSearchParams({ mode: "signup" });
    resetVisibility();
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      alert("Please enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      trackEvent("login_attempt", { method: "password" });
      await measureTrace("auth_login", async () => {
        await signInWithEmailAndPassword(
          auth,
          loginEmail.trim(),
          loginPassword,
        );
      }, {
        attributes: { method: "password" },
      });
      trackEvent("login", { method: "password" });
      navigate(nextPath || "/user-home");
    } catch (err) {
      trackEvent("login_failed", {
        method: "password",
        error_code: err?.code || "unknown",
      });
      alert(friendlyAuthError(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!signupEmail || !signupPassword || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }

    if (signupPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      trackEvent("sign_up_attempt", { method: "password" });
      await measureTrace("auth_sign_up", async () => {
        await createUserWithEmailAndPassword(
          auth,
          signupEmail.trim(),
          signupPassword,
        );
      }, {
        attributes: { method: "password" },
      });
      trackEvent("sign_up", { method: "password" });
      navigate(nextPath || "/user-home");
    } catch (err) {
      trackEvent("sign_up_failed", {
        method: "password",
        error_code: err?.code || "unknown",
      });
      alert(friendlyAuthError(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f3f3f3] dark:bg-[#1a2035] px-6">
      {/* Theme toggle fixed top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-130 rounded-4xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-[#222b45] p-10 shadow-xl">
        <div className="mb-10 flex w-full rounded-[18px] bg-[#e9edf2] dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={goToLogin}
            className={`h-13.5 w-1/2 rounded-2xl font-semibold transition ${
              mode === "login"
                ? "bg-white dark:bg-slate-700 text-[#0f172f] dark:text-white shadow"
                : "text-[#64748b] dark:text-slate-400"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={goToSignup}
            className={`h-13.5 w-1/2 rounded-2xl font-semibold transition ${
              mode === "signup"
                ? "bg-white dark:bg-slate-700 text-[#0f172f] dark:text-white shadow"
                : "text-[#64748b] dark:text-slate-400"
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === "login" && (
          <>
            <h1 className="text-center text-[40px] font-bold text-[#0f172f] dark:text-white">
              Welcome back
            </h1>
            <p className="mt-3 text-center text-[#7183a0] dark:text-slate-400">
              Log in to access your image gallery dashboard.
            </p>

            <form className="mt-10 space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="mb-2 block font-medium text-[#324767] dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className={inputClass}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium text-[#324767] dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className={inputClass}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[#4f6485]">
                  <input type="checkbox" />
                  Remember me
                </label>
                <button type="button" className="font-semibold text-indigo-600">
                  Forgot password?
                </button>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="h-14 w-1/2 rounded-[22px] border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 w-1/2 rounded-[22px] bg-[#000d33] font-semibold text-white hover:bg-[#00154d] disabled:opacity-60"
                >
                  {submitting ? "Logging in..." : "Log In"}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === "signup" && (
          <>
            <h1 className="text-center text-[40px] font-bold text-[#0f172f] dark:text-white">
              Create account
            </h1>
            <p className="mt-3 text-center text-[#7183a0] dark:text-slate-400">
              Sign up to create your gallery account.
            </p>

            <form className="mt-10 space-y-6" onSubmit={handleSignup}>
              <div>
                <label className="mb-2 block font-medium text-[#324767] dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className={inputClass}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium text-[#324767] dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create password"
                    className={inputClass}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium text-[#324767] dark:text-slate-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className={inputClass}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="h-14 w-1/2 rounded-[22px] border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 w-1/2 rounded-[22px] bg-[#000d33] font-semibold text-white hover:bg-[#00154d] disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Sign Up"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
