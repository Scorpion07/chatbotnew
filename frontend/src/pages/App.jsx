
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Home from './Home.jsx';
import Admin from './Admin.jsx';
import Chat from './Chat.jsx';
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

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthed(false);
      setUser(null);
      return;
    }
    try {
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuthed(true);
      setUser(res.data);
    } catch {
      setAuthed(false);
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthed(false);
    setUser(null);
    setView('home');
  };
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900'>
      <header className='bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center'>
          <div className='flex items-center gap-2 cursor-pointer' onClick={() => setView('home')}>
            <img src='/logos/logo.png' alt='TalkSphere AI' className='w-8 h-8 sm:w-10 sm:h-10' />
            <h1 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'>TalkSphere AI</h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className='hidden md:flex items-center gap-4 relative'>
            <button onClick={() => setView('home')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'home' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Home
            </button>
            <button onClick={() => setView('pricing')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'pricing' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Pricing
            </button>
            <button onClick={() => setView('chat')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
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

          {/* Mobile Menu Button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className='md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors'>
            <svg className='w-6 h-6 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
            </svg>
          </button>

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
                <button onClick={() => { setView('chat'); setMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${view === 'chat' ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
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
      {view === 'chat' && <Chat setView={setView} />}
      {view === 'settings' && <Settings user={user} onLogout={handleLogout} onUpgrade={() => setView('payment')} />}
      {view === 'payment' && <Payment onComplete={() => { loadUser(); setView('chat'); }} />}
      {view === 'login' && <Login onLogin={() => { loadUser(); setView('chat'); }} setView={setView} />}
      {view === 'signup' && <Signup onSignup={() => setView('login')} setView={setView} />}
      {view === 'admin' && <Admin />}
    </div>
  );
}
