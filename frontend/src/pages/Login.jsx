import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import config, { getApiUrl, isFeatureEnabled } from "../config.js";

export default function Login({ onLogin, setView }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  const hasValidGoogleClientId = () =>
    typeof config.auth.googleClientId === "string" &&
    config.auth.googleClientId.includes(".apps.googleusercontent.com");

  // Google Sign-In callback
  const handleCredentialResponse = async (response) => {
    if (!response.credential) {
      setError("Google sign-in failed: No credential received.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.post(getApiUrl("/auth/google"), {
        credential: response.credential,
      });

      localStorage.setItem(config.auth.tokenKey, res.data.token);

      onLogin?.(res.data.user);
      setView?.("chat");
    } catch (err) {
      setError(err.response?.data?.error || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  // Load Google script + render button
  useEffect(() => {
    if (!isFeatureEnabled("googleAuth") || !hasValidGoogleClientId()) return;

    const existing = document.getElementById("google-gsi-script");

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: config.auth.googleClientId,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: 300,
      });
    };

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.id = "google-gsi-script";
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
  }, []);

  // Email/password login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(getApiUrl("/auth/login"), {
        email,
        password,
      });

      localStorage.setItem(config.auth.tokenKey, res.data.token);
      onLogin?.(res.data.user);
      setView?.("chat");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
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
          <h2 className="text-2xl font-bold mt-3">Welcome back</h2>
          <p className="text-sm text-gray-600">
            Sign in to continue to TalkSphere AI
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
              required
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
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none pr-12"
                required
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

          {/* ERROR */}
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-sm text-gray-500">or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Google Button */}
        {isFeatureEnabled("googleAuth") && hasValidGoogleClientId() ? (
          <div className="flex justify-center mt-4">
            <div ref={googleBtnRef}></div>
          </div>
        ) : null}

        {/* Switch to Signup */}
        <div className="text-sm text-gray-600 mt-4 text-center">
          Don't have an account?{" "}
          <span
            className="text-indigo-600 cursor-pointer"
            onClick={() => setView?.("signup")}
          >
            Create one
          </span>
        </div>
      </div>
    </div>
  );
}
