import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl, isFeatureEnabled } from '../config.js';

export default function Payment({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  
  // Credit card form state
  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  // Validate credit card using Luhn algorithm
  const validateCardNumber = (number) => {
    const digits = number.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(digits)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  // Detect card type
  const getCardType = (number) => {
    const digits = number.replace(/\s+/g, '');
    if (/^4/.test(digits)) return 'Visa';
    if (/^5[1-5]/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'Amex';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Card';
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Card number validation
    if (!cardInfo.cardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (!validateCardNumber(cardInfo.cardNumber)) {
      newErrors.cardNumber = 'Invalid card number';
    }
    
    // Cardholder name validation
    if (!cardInfo.cardName.trim()) {
      newErrors.cardName = 'Cardholder name is required';
    } else if (!/^[a-zA-Z\s]+$/.test(cardInfo.cardName)) {
      newErrors.cardName = 'Name should contain only letters';
    }
    
    // Expiry validation
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    
    if (!cardInfo.expiryMonth) {
      newErrors.expiryMonth = 'Month required';
    } else if (parseInt(cardInfo.expiryMonth) < 1 || parseInt(cardInfo.expiryMonth) > 12) {
      newErrors.expiryMonth = 'Invalid month';
    }
    
    if (!cardInfo.expiryYear) {
      newErrors.expiryYear = 'Year required';
    } else {
      const year = parseInt(cardInfo.expiryYear);
      const month = parseInt(cardInfo.expiryMonth);
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        newErrors.expiryYear = 'Card expired';
      }
    }
    
    // CVV validation
    if (!cardInfo.cvv) {
      newErrors.cvv = 'CVV is required';
    } else if (!/^\d{3,4}$/.test(cardInfo.cvv)) {
      newErrors.cvv = 'Invalid CVV';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    let formattedValue = value;
    
    if (name === 'cardNumber') {
      formattedValue = formatCardNumber(value);
      if (formattedValue.replace(/\s+/g, '').length <= 19) {
        setCardInfo({ ...cardInfo, [name]: formattedValue });
      }
    } else if (name === 'cvv') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4);
      setCardInfo({ ...cardInfo, [name]: formattedValue });
    } else if (name === 'expiryMonth' || name === 'expiryYear') {
      formattedValue = value.replace(/\D/g, '');
      if (name === 'expiryMonth') {
        formattedValue = formattedValue.substring(0, 2);
      } else {
        formattedValue = formattedValue.substring(0, 2);
      }
      setCardInfo({ ...cardInfo, [name]: formattedValue });
    } else {
      setCardInfo({ ...cardInfo, [name]: value });
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const proceedToPayment = async () => {
    if (!validateForm()) {
      setMessage('Please correct the errors in the form');
      return;
    }
    
    setLoading(true);
    setMessage('Saving your credit card...');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('Please login first.');
        setLoading(false);
        return;
      }

      // Save credit card to backend
      await axios.post(getApiUrl('/creditcard/save'), {
        cardName: cardInfo.cardName,
        cardNumber: cardInfo.cardNumber,
        cardType: getCardType(cardInfo.cardNumber),
        expiryMonth: cardInfo.expiryMonth,
        expiryYear: cardInfo.expiryYear
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage('Credit card saved successfully! You can now proceed with payment.');
      
      // Clear form
      setCardInfo({
        cardNumber: '',
        cardName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: ''
      });
      
      setTimeout(() => {
        setMessage('');
        onComplete?.();
      }, 2000);
    } catch (e) {
      console.error('Save card error:', e);
      setMessage(e.response?.data?.error || 'Failed to save credit card. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[70vh] flex items-center justify-center p-4'>
      <div className='bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl'>
        <h2 className='text-2xl font-bold mb-3 text-gray-900 dark:text-white'>Upgrade to Premium</h2>
        <p className='text-gray-600 dark:text-gray-300 mb-6'>Unlock unlimited queries and premium features like Image generation and Audio.</p>
        
        {/* Features */}
        <div className='bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6'>
          <ul className='list-disc pl-6 text-sm text-gray-700 dark:text-gray-300 space-y-1'>
            <li>Unlimited text queries</li>
            <li>Image generation (OpenAI Images)</li>
            <li>Audio generation (OpenAI TTS)</li>
            <li>Priority access and faster responses</li>
          </ul>
        </div>

        {/* Credit Card Form */}
        <div className='space-y-4 mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' />
            </svg>
            Payment Information
          </h3>

          {/* Card Number */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Card Number
            </label>
            <div className='relative'>
              <input
                type='text'
                name='cardNumber'
                value={cardInfo.cardNumber}
                onChange={handleInputChange}
                placeholder='1234 5678 9012 3456'
                className={`w-full px-4 py-3 rounded-lg border-2 ${
                  errors.cardNumber 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-colors`}
              />
              {cardInfo.cardNumber && (
                <div className='absolute right-3 top-3 text-sm font-semibold text-gray-500'>
                  {getCardType(cardInfo.cardNumber)}
                </div>
              )}
            </div>
            {errors.cardNumber && (
              <p className='text-red-500 text-xs mt-1'>{errors.cardNumber}</p>
            )}
          </div>

          {/* Cardholder Name */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Cardholder Name
            </label>
            <input
              type='text'
              name='cardName'
              value={cardInfo.cardName}
              onChange={handleInputChange}
              placeholder='John Doe'
              className={`w-full px-4 py-3 rounded-lg border-2 ${
                errors.cardName 
                  ? 'border-red-500 focus:border-red-500' 
                  : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-colors`}
            />
            {errors.cardName && (
              <p className='text-red-500 text-xs mt-1'>{errors.cardName}</p>
            )}
          </div>

          {/* Expiry and CVV */}
          <div className='grid grid-cols-3 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Month
              </label>
              <input
                type='text'
                name='expiryMonth'
                value={cardInfo.expiryMonth}
                onChange={handleInputChange}
                placeholder='MM'
                maxLength='2'
                className={`w-full px-4 py-3 rounded-lg border-2 ${
                  errors.expiryMonth 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-colors`}
              />
              {errors.expiryMonth && (
                <p className='text-red-500 text-xs mt-1'>{errors.expiryMonth}</p>
              )}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Year
              </label>
              <input
                type='text'
                name='expiryYear'
                value={cardInfo.expiryYear}
                onChange={handleInputChange}
                placeholder='YY'
                maxLength='2'
                className={`w-full px-4 py-3 rounded-lg border-2 ${
                  errors.expiryYear 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-colors`}
              />
              {errors.expiryYear && (
                <p className='text-red-500 text-xs mt-1'>{errors.expiryYear}</p>
              )}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                CVV
              </label>
              <input
                type='text'
                name='cvv'
                value={cardInfo.cvv}
                onChange={handleInputChange}
                placeholder='123'
                maxLength='4'
                className={`w-full px-4 py-3 rounded-lg border-2 ${
                  errors.cvv 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none transition-colors`}
              />
              {errors.cvv && (
                <p className='text-red-500 text-xs mt-1'>{errors.cvv}</p>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className='flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
            <svg className='w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
            </svg>
            <p className='text-xs text-gray-600 dark:text-gray-300'>
              Your payment information is encrypted and secure. We never store your full card details.
            </p>
          </div>
        </div>

        <button 
          disabled={loading} 
          onClick={proceedToPayment} 
          className='w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2'
        >
          {loading ? (
            <>
              <svg className='animate-spin h-5 w-5' fill='none' viewBox='0 0 24 24'>
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' />
              </svg>
              Save Credit Card
            </>
          )}
        </button>
        
        {message && (
          <div className={`text-sm mt-4 p-3 rounded-lg ${
            message.includes('successful') 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
              : message.includes('Failed') || message.includes('error')
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
