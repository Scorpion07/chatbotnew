import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config.js';

export default function Payment({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const proceedToPayment = async () => {
    setLoading(true);
    setMessage('Redirecting to payment gateway...');
    try {
      // TODO: Integrate real payment gateway (Stripe, Razorpay, etc.)
      // Example flow:
      // 1. Create checkout session: const session = await axios.post('/api/payment/create-session', { plan: 'premium' });
      // 2. Redirect user to gateway: window.location.href = session.data.url;
      // 3. Payment gateway calls your webhook on success: POST /api/payment/webhook
      // 4. Webhook handler verifies payment and marks user premium via /api/auth/subscribe

      // For now, this is a placeholder that directly calls /subscribe (as if payment succeeded)
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('Please login first.');
        setLoading(false);
        return;
      }

      // In production, remove this direct call and let the payment gateway webhook handle it
      await axios.post(getApiUrl('/api/auth/subscribe'), {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Payment successful! Premium unlocked.');
      setTimeout(() => onComplete?.(), 1500);
    } catch (e) {
      setMessage('Failed to upgrade. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[70vh] flex items-center justify-center'>
      <div className='bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-[520px]'>
        <h2 className='text-2xl font-bold mb-3'>Upgrade to Premium</h2>
        <p className='text-gray-600 mb-6'>Unlock unlimited queries and premium features like Image generation and Audio.</p>
        <div className='bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 mb-6'>
          <ul className='list-disc pl-6 text-sm text-gray-700 space-y-1'>
            <li>Unlimited text queries</li>
            <li>Image generation (OpenAI Images)</li>
            <li>Audio generation (OpenAI TTS)</li>
            <li>Priority access and faster responses</li>
          </ul>
        </div>
        <button disabled={loading} onClick={proceedToPayment} className='w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold'>
          {loading ? 'Processing...' : 'Proceed to Payment'}
        </button>
        {message && <div className='text-sm text-gray-700 mt-4'>{message}</div>}
      </div>
    </div>
  );
}
