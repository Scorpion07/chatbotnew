import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  GOOGLE_CLIENT_ID,
  getApiUrl,
  isFeatureEnabled
} from "../config.js";

export default function Signup({ onSignup, setView }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasValidGoogleClientId = () =>
    typeof GOOGLE_CLIENT_ID === "string" &&
    GOOGLE_CLIENT_ID.includes(".apps.googleusercontent.com");

  // Load Google Login Script
  useEffect(() => {
    if (!hasValidGoogleClientId() || !isFeatureEnabled("googleAuth")) return;

    // Wait for Google script
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback
        });
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Handle Google Credential Response
  const handleGoogleCallback = async (response) => {
    try {
      setLoading(true);
      setError("");

      // Only send credential, no redirect
      const res = await axios.post(getApiUrl("/auth/google"), {
        credential: response.credential
      });

      localStorage.setItem("token", res.data.token);

      setSuccess(true);
      onSignup?.(res.data.user);

      setTimeout(() => setView?.("chat"), 600);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.error || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonClick = () => {
    if (!hasValidGoogleClientId()) {
      setError("Google Sign-In is not configured correctly.");
      return;
    }

    if (!window.google?.accounts?.id) {
      setError("Google Sign-In failed to load. Refresh the page.");
      return;
    }

    window.google.accounts.id.prompt();
  };

  // Standard Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(getApiUrl("/auth/signup"), {
        email,
        password
      });

      // Auto-login after signup
      const loginRes = await axios.post(getApiUrl("/auth/login"), {
        email,
        password
      });

      localStorage.setItem("token", loginRes.data.token);

      setSuccess(true);
      onSignup?.(loginRes.data.user);

      setTimeout(() => setView?.("chat"), 800);
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mt-3">Create your account</h2>
          <p className="text-sm text-gray-600">Join TalkSphere AI in seconds</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* ERROR + SUCCESS */}
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {success && (
            <div className="text-green-600 text-sm">
              Signup successful! Redirecting...
            </div>
          )}

          {/* SIGNUP BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-sm text-gray-500">or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* GOOGLE SIGN-IN BUTTON */}
        <button
          onClick={handleGoogleButtonClick}
          disabled={loading}
          className="w-full py-2.5 bg-white border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            className="w-5 h-5"
          />
          Continue with Google
        </button>

        {/* SWITCH TO LOGIN */}
        <div className="text-sm text-gray-600 mt-4 text-center">
          Already have an account?{" "}
          <span
            className="text-indigo-600 cursor-pointer"
            onClick={() => setView?.("login")}
          >
            Sign in
          </span>
        </div>
      </div>
    </div>
  );
}
