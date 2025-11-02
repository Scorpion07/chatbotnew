
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

  useEffect(() => {
    load();
    const socket = io(config.api.baseUrl);
    socket.on('bots:update', setBots);
    socket.on('stats:update', setStats);
    return () => socket.disconnect();
  }, []);

  async function load() {
    const [b, s] = await Promise.all([
      axios.get(getApiUrl('/api/bots')),
      axios.get(getApiUrl('/api/stats'))
    ]);
    setBots(b.data); setStats(s.data);
  }

  async function addBot(e){
    e.preventDefault();
    await axios.post(getApiUrl('/api/bots'), form);
    setForm({name:'',provider:''});
  }

  async function delBot(id){
    await axios.delete(getApiUrl(`/api/bots/${id}`));
  }

  async function saveStats(){
    await axios.post(getApiUrl('/api/stats'), stats);
  }

  async function setPremium(e){
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return alert('Login required');
    try {
      await axios.post(getApiUrl('/api/admin/users/premium'), { email: userEmail, isPremium: !!userPremium }, {
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
            <div className='text-gray-500'>{k}</div>
          </div>
        ))}
      </div>
      <div className='grid md:grid-cols-2 gap-6'>
        <div>
          <h3 className='text-lg font-semibold mb-3'>Bots</h3>
          {bots.map(b=>(
            <div key={b.id} className='bg-white p-4 rounded-md shadow flex justify-between items-center mb-2'>
              <div>
                <div className='font-medium'>{b.name}</div>
                <div className='text-xs text-gray-500'>{b.provider} • {b.status}</div>
              </div>
              <button onClick={()=>delBot(b.id)} className='bg-red-500 text-white px-3 py-1 rounded-md text-sm'>Remove</button>
            </div>
          ))}
        </div>
        <div>
          <h3 className='text-lg font-semibold mb-3'>Add Bot</h3>
          <form onSubmit={addBot} className='bg-white p-4 rounded-md shadow'>
            <input placeholder='Bot name' value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className='w-full border p-2 mb-3 rounded' required/>
            <input placeholder='Provider' value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})} className='w-full border p-2 mb-3 rounded'/>
            <button className='bg-indigo-600 text-white px-4 py-2 rounded-md'>Add</button>
          </form>
          <h3 className='text-lg font-semibold mt-6 mb-3'>Update Stats</h3>
          {Object.keys(stats).map(k=>(
            <input key={k} type='number' value={stats[k]} onChange={e=>setStats({...stats,[k]:parseInt(e.target.value||0)})} className='w-full border p-2 mb-2 rounded' placeholder={k}/>
          ))}
          <button onClick={saveStats} className='bg-indigo-600 text-white px-4 py-2 rounded-md mt-2'>Save Stats</button>

          <h3 className='text-lg font-semibold mt-8 mb-3'>User Premium Control</h3>
          <form onSubmit={setPremium} className='bg-white p-4 rounded-md shadow'>
            <input type='email' required placeholder='user@example.com' value={userEmail} onChange={e=>setUserEmail(e.target.value)} className='w-full border p-2 mb-3 rounded'/>
            <label className='flex items-center gap-2 mb-3'>
              <input type='checkbox' checked={userPremium} onChange={e=>setUserPremium(e.target.checked)} />
              <span>Set as Premium</span>
            </label>
            <button className='bg-green-600 text-white px-4 py-2 rounded-md'>Update</button>
          </form>
        </div>
      </div>
    </div>
  );
}
