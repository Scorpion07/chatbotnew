import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config.js';

export default function Settings({ user: initialUser, onLogout, onUpgrade }) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState([]);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(getApiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      // Also fetch usage
      const usageRes = await axios.get(getApiUrl('/api/usage'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsage(usageRes.data.usage || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) refresh();
    else {
      // Load usage on mount
      const token = localStorage.getItem('token');
      if (!token) return;
      axios.get(getApiUrl('/api/usage'), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setUsage(res.data.usage || [])).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearUsage = () => {
    try {
      localStorage.removeItem('queryCount');
      setMessage('Cleared local usage counters.');
      setTimeout(() => setMessage(''), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className='max-w-3xl mx-auto p-6'>
      <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6'>
        <h2 className='text-xl font-semibold mb-4'>Account Settings</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <div className='text-sm text-gray-500'>Email</div>
            <div className='text-gray-900 font-medium'>{user?.email || '—'}</div>
          </div>
          <div>
            <div className='text-sm text-gray-500'>Plan</div>
            <div className='text-gray-900 font-medium'>
              {user?.isPremium ? (
                <span className='inline-flex items-center gap-2 text-emerald-700'>
                  <span className='w-2 h-2 bg-emerald-500 rounded-full'></span>
                  Premium
                </span>
              ) : (
                <span className='inline-flex items-center gap-2 text-gray-700'>
                  <span className='w-2 h-2 bg-gray-400 rounded-full'></span>
                  Free
                </span>
              )}
            </div>
          </div>
        </div>
        <div className='mt-6 flex flex-wrap gap-3'>
          {!user?.isPremium && (
            <button onClick={onUpgrade} className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700'>
              Upgrade to Premium
            </button>
          )}
          <button onClick={refresh} disabled={loading} className='px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50'>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={onLogout} className='px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50'>
            Logout
          </button>
        </div>
        {message && <div className='mt-3 text-sm text-emerald-600'>{message}</div>}
      </div>

      {/* Usage tracking section */}
      <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6'>
        <h3 className='text-lg font-semibold mb-3'>Usage</h3>
        {user?.isPremium ? (
          <div className='text-sm text-gray-500'>You have unlimited queries on all bots with Premium.</div>
        ) : (
          <div className='space-y-2'>
            {usage.length === 0 ? (
              <div className='text-sm text-gray-500'>No usage yet. Start chatting to see your query counts here.</div>
            ) : (
              usage.map((u, i) => (
                <div key={i} className='flex items-center justify-between py-2 border-b border-gray-100'>
                  <div className='text-sm font-medium text-gray-900'>{u.botName || 'default'}</div>
                  <div className='text-sm text-gray-600'>{u.count} / 5 free queries</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6'>
        <h3 className='text-lg font-semibold mb-3'>Preferences</h3>
        <div className='space-y-3 text-sm text-gray-700'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium'>Theme</div>
              <div className='text-gray-500'>Light/Dark (coming soon)</div>
            </div>
            <button className='px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50'>System</button>
          </div>
          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium'>Voice input</div>
              <div className='text-gray-500'>Language and mic options (coming soon)</div>
            </div>
            <button className='px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50'>English</button>
          </div>
        </div>
      </div>
    </div>
  );
}
