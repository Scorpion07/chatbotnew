import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config.js';

export default function Login({ onLogin, setView }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    if (window.google && config.GOOGLE_CLIENT_ID !== "1077821208623-csoqpoks6lv8jjpgq4a19pgjmunvfg5k.apps.googleusercontent.com") {
      window.google.accounts.id.initialize({
        client_id: config.GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
      });
    }
  }, []);

  const handleGoogleSignIn = async (response) => {
    try {
      setLoading(true);
      setError('');
      
      const res = await axios.post('/api/auth/google', {
        credential: response.credential
      });
      
      localStorage.setItem('token', res.data.token);
      onLogin?.(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonClick = () => {
    if (config.GOOGLE_CLIENT_ID === "1077821208623-csoqpoks6lv8jjpgq4a19pgjmunvfg5k.apps.googleusercontent.com") {
      setError('Google Sign-In not configured. Please contact administrator.');
      return;
    }
    
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In not loaded. Please refresh the page.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
  const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      onLogin?.(res.data.isPremium);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mt-3">Welcome back</h2>
          <p className="text-sm text-gray-600">Sign in to continue to TalkSphere AI</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none pr-12" required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.044.159-2.05.455-3M6.343 6.343A9.956 9.956 0 0112 5c5.523 0 10 4.477 10 10 0 1.537-.346 2.992-.964 4.29M3 3l18 18M9.88 9.88a3 3 0 104.24 4.24' /></svg>
                ) : (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4.5C7.305 4.5 3.29 7.362 1.5 12c1.79 4.638 5.805 7.5 10.5 7.5s8.71-2.862 10.5-7.5C20.71 7.362 16.695 4.5 12 4.5z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' /></svg>
                )}
              </button>
            </div>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-3 text-sm text-gray-500">or</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleButtonClick}
          disabled={loading}
          className="w-full py-2.5 bg-white border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="text-sm text-gray-600 mt-4 text-center">
          Don't have an account? <span className="text-indigo-600 cursor-pointer" onClick={() => setView?.('signup')}>Create one</span>
        </div>
      </div>
    </div>
  );
}
