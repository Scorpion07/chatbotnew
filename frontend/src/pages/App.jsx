
import React, { useEffect, useState } from 'react';
import config, { getApiUrl } from '../config.js';
import axios from 'axios';
import Home from './Home.jsx';
import Admin from './Admin.jsx';
import Chat from './Chat.jsx';
import ProtectedRoute, { isLoggedIn } from '../components/ProtectedRoute.jsx';
import Pricing from './Pricing.jsx';
import Login from './Login.jsx';
import Signup from './Signup.jsx';
import Payment from './Payment.jsx';
import Settings from './Settings.jsx';

export default function App() {
  const [view, setView] = useState('home');
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null); // { email, isPremium }
  const [menuOpen, setMenuOpen] = useState(false);
  const [bots, setBots] = useState([]);
  const [showBotsMenu, setShowBotsMenu] = useState(false);
  // Global theme state (centralized)
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {}
    return !!prefersDark;
  });

  useEffect(() => {
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, [isDark]);

  const toggleDark = () => setIsDark(d => !d);

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthed(false);
      setUser(null);
      // Do not return; allow anonymous chat access
    }
    try {
      const res = await axios.get(getApiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuthed(true);
      setUser(res.data?.user || null);
    } catch {
      setAuthed(false);
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    let mounted = true;
    axios.get(getApiUrl('/bots'))
      .then(r => { if (mounted) setBots(r.data || []); })
      .catch(() => setBots([]));
    return () => { mounted = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthed(false);
    setUser(null);
    setView('home');
  };
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 dark:from-gray-900 dark:to-gray-950 dark:text-gray-100'>
  <header className='bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800'>
        <div className='max-w-7xl mx-auto px-2 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-y-2'>
          <div
            className='flex flex-row items-center gap-2 sm:gap-2 cursor-pointer min-w-0 flex-shrink flex-grow md:flex-grow-0'
            style={{ minHeight: 40 }}
            onClick={() => setView('home')}
          >
            <img
              src={config.app.logo.small}
              alt={config.app.name}
              className='w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0'
              style={{ display: 'block' }}
            />
            <span className='truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none'>
              <h1 className='text-base sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap'>
                {config.app.name}
              </h1>
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <nav className='hidden md:flex items-center gap-4 relative'>
            <button onClick={() => setView('home')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'home' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Home
            </button>
            <button onClick={() => setView('pricing')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'pricing' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Pricing
            </button>
            {/* Bots Dropdown */}
            <div className='relative'>
              <button onClick={() => setShowBotsMenu(v => !v)} className='px-4 py-2 rounded-lg font-medium transition-all text-gray-600 hover:bg-gray-100 flex items-center gap-2'>
                Bots
                <svg className={`w-4 h-4 transition-transform ${showBotsMenu ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                </svg>
              </button>
              {showBotsMenu && (
                <div className='absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50'>
                  <div className='px-2 py-1 text-xs text-gray-500'>All Bots</div>
                  <div className='divide-y divide-gray-100'>
                    {bots.map(bot => (
                      <button
                        key={bot.id}
                        onClick={() => {
                          try { localStorage.setItem('selectedBotName', bot.name); } catch {}
                          setShowBotsMenu(false);
                          if (!isLoggedIn()) {
                            setView('login');
                          } else {
                            setView('chat');
                          }
                        }}
                        className='w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left'
                      >
                        <div className='w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden'>
                          {typeof bot.icon === 'string' && /(\.(png|jpe?g|svg|gif|webp)$|^https?:\/\/|^\/)/i.test(bot.icon)
                            ? <img src={bot.icon} alt={bot.model || bot.name} className='w-full h-full object-cover' />
                            : <span className='text-lg'>{bot.icon || '🤖'}</span>}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='font-medium text-gray-900 truncate'>{bot.model || bot.name}</div>
                          <div className='text-xs text-gray-500 truncate'>{bot.tagline || bot.description}</div>
                        </div>
                        <span className='text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200'>{bot.provider}</span>
                      </button>
                    ))}
                    {bots.length === 0 && (
                      <div className='px-3 py-2 text-sm text-gray-500'>No bots available.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (!isLoggedIn()) {
                  setView('login');
                } else {
                  setView('chat');
                }
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              Start Chat
            </button>
            {!authed ? (
              <>
                <button onClick={() => setView('login')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'login' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Login
                </button>
                <button onClick={() => setView('signup')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'signup' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Signup
                </button>
              </>
            ) : (
              <div className='relative'>
                <button onClick={() => setMenuOpen(v => !v)} className='px-3 py-2 rounded-lg font-medium transition-all bg-gray-100 hover:bg-gray-200 flex items-center gap-2'>
                  <div className='w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-sm'>
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className='text-gray-800'>{user?.email?.split('@')[0] || 'Account'}</span>
                  <svg className={`w-4 h-4 text-gray-600 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                  </svg>
                </button>
                {menuOpen && (
                  <div className='absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50'>
                    <div className='px-3 py-2 text-sm text-gray-600'>Signed in as<br /><span className='font-medium text-gray-900'>{user?.email}</span></div>
                    <button onClick={() => { setView('settings'); setMenuOpen(false); }} className='w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-800 flex items-center gap-2'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /></svg>
                      Settings
                    </button>
                    {!user?.isPremium && (
                      <button onClick={() => { setView('payment'); setMenuOpen(false); }} className='w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-indigo-700 font-medium flex items-center gap-2'>
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8c-1.657 0-3 1.343-3 3v6h6v-6c0-1.657-1.343-3-3-3z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 10h14M7 21h10a2 2 0 002-2v-9a2 2 0 00-2-2H7a2 2 0 00-2 2v9a2 2 0 002 2z' /></svg>
                        Upgrade to Premium
                      </button>
                    )}
                    <button onClick={() => { handleLogout(); setMenuOpen(false); }} className='w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-red-600 flex items-center gap-2'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 16l4-4m0 0l-4-4m4 4H7' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 8v8a2 2 0 002 2h3' /></svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setView('admin')} className={`px-3 py-2 rounded-lg font-medium transition-all ${view === 'admin' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            </button>
          </nav>


          {/* Mobile: Hamburger and Dark Mode Button Aligned */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            <button
              onClick={() => setIsDark((d) => !d)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3m16.66 5.66l-.71-.71M4.05 4.93l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
                </svg>
              )}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className='p-2 rounded-lg hover:bg-gray-100 transition-colors' aria-label="Open menu">
              <svg className='w-6 h-6 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {menuOpen && (
            <div className='md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40'>
              <div className='px-4 py-3 space-y-2'>
                <button onClick={() => { setView('home'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'home' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Home
                </button>
                <button onClick={() => { setView('pricing'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'pricing' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Pricing
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (!isLoggedIn()) {
                      setView('login');
                    } else {
                      setView('chat');
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'chat' ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  Start Chat
                </button>
                {!authed ? (
                  <>
                    <button onClick={() => { setView('login'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'login' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                      Login
                    </button>
                    <button onClick={() => { setView('signup'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'signup' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                      Signup
                    </button>
                  </>
                ) : (
                  <>
                    <div className='px-4 py-2 text-sm text-gray-600 border-b border-gray-100'>
                      Signed in as <span className='font-medium text-gray-900'>{user?.email}</span>
                    </div>
                    <button onClick={() => { setView('settings'); setMenuOpen(false); }} className='w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-800 flex items-center gap-2'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /></svg>
                      Settings
                    </button>
                    {!user?.isPremium && (
                      <button onClick={() => { setView('payment'); setMenuOpen(false); }} className='w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-indigo-700 font-medium flex items-center gap-2'>
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8c-1.657 0-3 1.343-3 3v6h6v-6c0-1.657-1.343-3-3-3z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 10h14M7 21h10a2 2 0 002-2v-9a2 2 0 00-2-2H7a2 2 0 00-2 2v9a2 2 0 002 2z' /></svg>
                        Upgrade to Premium
                      </button>
                    )}
                    <button onClick={() => { handleLogout(); setMenuOpen(false); }} className='w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-red-600 flex items-center gap-2'>
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 16l4-4m0 0l-4-4m4 4H7' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 8v8a2 2 0 002 2h3' /></svg>
                      Logout
                    </button>
                  </>
                )}
                <button onClick={() => { setView('admin'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'admin' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'} flex items-center gap-2`}>
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                  </svg>
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      {view === 'home' && <Home setView={setView} />}
      {view === 'pricing' && <Pricing setView={setView} />}
      {view === 'chat' && (
        <ProtectedRoute setView={setView}>
          <Chat setView={setView} isDark={isDark} toggleDark={toggleDark} />
        </ProtectedRoute>
      )}
      {view === 'settings' && <Settings user={user} onLogout={handleLogout} onUpgrade={() => setView('payment')} />}
      {view === 'payment' && <Payment onComplete={() => { loadUser(); setView('chat'); }} />}
      {view === 'login' && <Login onLogin={() => { loadUser(); setView('chat'); }} setView={setView} />}
      {view === 'signup' && <Signup onSignup={() => setView('login')} setView={setView} />}
      {view === 'admin' && <Admin />}
    </div>
  );
}
