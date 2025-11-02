import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import BotGrid from '../components/BotGrid.jsx';
import { getApiUrl } from '../config.js';

export default function Chat({ setView }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      model: 'GPT-4'
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('GPT-4');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bots, setBots] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showBotsPanel, setShowBotsPanel] = useState(false);
  const [conversations, setConversations] = useState([
    { id: 1, title: 'New Conversation', date: 'Today' }
  ]);
  const [activeConversation, setActiveConversation] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  // Track hovered bot for popup
  const [hoveredBot, setHoveredBot] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  
  // Check if user is premium
  const [isPremium, setIsPremium] = useState(false);
  const [queryCount, setQueryCount] = useState({});
  const FREE_USER_LIMIT = 5;
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setIsPremium(res.data.isPremium)).catch(() => {});
    }
    // Load query count from localStorage
    const savedCount = localStorage.getItem('queryCount');
    if (savedCount) {
      setQueryCount(JSON.parse(savedCount));
    }
  }, []);

  // Get currently selected bot
  const selectedBot = bots.find(b => b.name === selectedModel);

  // Default bots (fallback when API is unreachable or empty)
  const defaultBots = [
    {
      id: 101,
      name: 'GPT-4',
      provider: 'openai',
      status: 'online',
      description: 'Most capable model',
      tagline: 'General purpose reasoning',
      icon: '🤖',
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      isNew: false
    },
    {
      id: 102,
      name: 'Claude',
      provider: 'anthropic',
      status: 'online',
      description: 'Best for analysis',
      tagline: 'Long context & analysis',
      icon: '🧠',
      color: 'bg-gradient-to-br from-orange-500 to-red-600',
      isNew: false
    },
    {
      id: 103,
      name: 'Gemini',
      provider: 'google',
      status: 'online',
      description: "Google's latest",
      tagline: 'Great for factual tasks',
      icon: '✨',
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      isNew: false
    },
    {
      id: 104,
      name: 'Llama',
      provider: 'meta',
      status: 'online',
      description: 'Open source',
      tagline: 'Fast and inexpensive',
      icon: '🦙',
      color: 'bg-gradient-to-br from-purple-500 to-pink-600',
      isNew: false
    }
  ];

  // Handle image upload for image processing bots
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMessages(prev => [...prev, {
          role: 'user',
          content: `![Uploaded Image](${e.target?.result})`,
          model: selectedModel,
          type: 'image'
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle sending message based on bot type
  const handleSend = async () => {
    if (!input.trim() && !selectedImage && !searchQuery) return;

    // Check query limit for free users
    if (!isPremium) {
      const currentCount = queryCount[selectedModel] || 0;
      if (currentCount >= FREE_USER_LIMIT) {
        setShowUpgrade(true);
        return;
      }
    }

    let userMessage;
    let botType = 'text';
    if (selectedBot?.provider === 'imageai') {
      // Check if premium for image feature
      if (!isPremium) {
        alert('Image generation is a premium feature. Please upgrade to continue.');
        return;
      }
      if (!selectedImage) return;
      userMessage = {
        role: 'user',
        content: input || 'Please process this image',
        model: selectedModel,
        type: 'image'
      };
      botType = 'image';
    } else if (selectedBot?.provider === 'searchai') {
      userMessage = {
        role: 'user',
        content: searchQuery || input,
        model: selectedModel,
        type: 'search'
      };
      botType = 'search';
    } else if (selectedBot?.provider === 'openai-audio') {
      // Check if premium for audio feature
      if (!isPremium) {
        alert('Audio generation is a premium feature. Please upgrade to continue.');
        return;
      }
      userMessage = {
        role: 'user',
        content: input,
        model: selectedModel,
        type: 'audio'
      };
      botType = 'audio';
    } else {
      userMessage = {
        role: 'user',
        content: input,
        model: selectedModel,
        type: 'text'
      };
      botType = 'text';
    }

    setMessages([...messages, userMessage]);
    setInput('');
    setSearchQuery('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      let response;
      if (botType === 'image') {
        // Call backend image endpoint
        const token = localStorage.getItem('token');
        const res = await axios.post(getApiUrl('/api/openai/image'), { prompt: userMessage.content }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        response = {
          role: 'assistant',
          content: res.data.url ? `![Generated Image](${res.data.url})` : 'Image generation failed.',
          model: selectedModel,
          type: 'image'
        };
      } else if (botType === 'search') {
        // For now, keep demo search response
        response = {
          role: 'assistant',
          content: 'Search API integration coming soon.',
          model: selectedModel,
          type: 'search',
          results: []
        };
      } else if (botType === 'audio') {
        // Call backend audio endpoint and play audio
        const token = localStorage.getItem('token');
        const audioRes = await fetch(getApiUrl('/api/openai/audio'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ text: userMessage.content })
        });
        if (audioRes.ok) {
          const audioBlob = await audioRes.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          response = {
            role: 'assistant',
            content: '[Audio generated]',
            model: selectedModel,
            type: 'audio',
            audioUrl
          };
        } else {
          const errorText = await audioRes.text().catch(() => '');
          response = {
            role: 'assistant',
            content: 'Error: Unable to generate audio.' + (errorText ? ` (${errorText})` : ''),
            model: selectedModel,
            type: 'audio'
          };
        }
      } else {
        // Call backend chat endpoint
        const token = localStorage.getItem('token');
        const res = await axios.post(getApiUrl('/api/openai/chat'), {
          message: userMessage.content,
          botName: selectedModel
        }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        response = {
          role: 'assistant',
          content: res.data.response,
          model: selectedModel,
          type: 'text'
        };
      }
      setMessages(prev => [...prev, response]);
      
      // Increment query count for free users
      if (!isPremium) {
        const newCount = { ...queryCount, [selectedModel]: (queryCount[selectedModel] || 0) + 1 };
        setQueryCount(newCount);
        localStorage.setItem('queryCount', JSON.stringify(newCount));
      }
    } catch (err) {
      // If server enforced limit, show upgrade modal
      if (err?.response?.status === 402) {
        setShowUpgrade(true);
      } else if (err?.response?.status === 401) {
        // Not authenticated -> navigate to login
        setView?.('login');
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Unable to get response from API.',
        model: selectedModel,
        type: botType
      }]);
    }
    setIsTyping(false);
  };

  const UpgradeModal = () => (
    <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
      <div className='bg-white rounded-2xl p-6 w-[420px] shadow-2xl border border-gray-200'>
        <h3 className='text-lg font-semibold mb-2'>Upgrade to Premium</h3>
        <p className='text-sm text-gray-600 mb-4'>You've reached your free limit of {FREE_USER_LIMIT} queries for {selectedModel}. Upgrade to unlock unlimited text and premium features like Image and Audio generation.</p>
        <div className='flex justify-end gap-2'>
          <button className='px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50' onClick={() => setShowUpgrade(false)}>Later</button>
          <button className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700' onClick={() => { setShowUpgrade(false); setView?.('payment'); }}>Upgrade</button>
        </div>
      </div>
    </div>
  );

  const messagesEndRef = useRef(null);
  const models = [
    { name: 'GPT-4', icon: '🤖', color: 'from-green-500 to-emerald-600', description: 'Most capable model' },
    { name: 'Claude', icon: '🧠', color: 'from-orange-500 to-red-600', description: 'Best for analysis' },
    { name: 'Gemini', icon: '✨', color: 'from-blue-500 to-indigo-600', description: 'Google\'s latest' },
    { name: 'Llama', icon: '🦙', color: 'from-purple-500 to-pink-600', description: 'Open source' }
  ];
  const selectedModelData = models.find(m => m.name === selectedModel);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const newConversation = () => {
    const newId = conversations.length + 1;
    setConversations([
      { id: newId, title: `Conversation ${newId}`, date: 'Today' },
      ...conversations
    ]);
    setActiveConversation(newId);
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant. How can I help you today?',
        model: selectedModel
      }
    ]);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let mounted = true;
    axios.get(getApiUrl('/api/bots'))
      .then(r => {
        if (!mounted) return;
        const data = Array.isArray(r.data) ? r.data : [];
        setBots(data.length ? data : defaultBots);
      })
      .catch((err) => {
        console.error('Error fetching bots:', err);
        setBots(defaultBots);
      });
    return () => { mounted = false; };
  }, []);

  const startRecording = () => {
    setIsRecording(true);
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        handleSendAudio(blob);
      };
      mediaRecorder.start();
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendAudio = async (blob) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('audio', blob, 'voice.webm');
      formData.append('model', selectedModel);
      const res = await axios.post('/api/openai/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      setMessages(prev => [...prev, {
        role: 'user',
        content: '[Voice message]',
        model: selectedModel,
        type: 'audio',
        audioUrl: URL.createObjectURL(blob)
      }, {
        role: 'assistant',
        content: res.data.transcript || '[Audio response]',
        model: selectedModel,
        type: 'text'
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Unable to transcribe audio.',
        model: selectedModel,
        type: 'text'
      }]);
    }
  };

  return (
  <div className='flex h-[calc(100vh-73px)] bg-[#f9f9fb]'>
      {showUpgrade && <UpgradeModal />}
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64 md:w-64' : 'w-0'} ${showSidebar ? 'fixed md:relative' : ''} ${showSidebar ? 'inset-y-0 left-0 z-30 md:z-auto' : ''} bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className='p-4 border-b border-gray-200'>
          <button onClick={newConversation} className='w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            New Chat
          </button>
        </div>
        <div className='flex-1 overflow-y-auto p-3'>
          <div className='text-xs font-semibold text-gray-500 mb-2 px-2'>Recent Conversations</div>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`p-3 rounded-lg mb-2 cursor-pointer transition-all ${
                activeConversation === conv.id
                  ? 'bg-indigo-50 border-2 border-indigo-200'
                  : 'hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div className='flex items-start gap-2'>
                <svg className='w-4 h-4 text-gray-400 mt-1 flex-shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
                </svg>
                <div className='flex-1 min-w-0'>
                  <div className='text-sm font-medium text-gray-900 truncate'>{conv.title}</div>
                  <div className='text-xs text-gray-500'>{conv.date}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

  {/* Main Chat Area */}
  <div className='flex-1 flex flex-col relative'>
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div className='md:hidden fixed inset-0 bg-black bg-opacity-50 z-20' onClick={() => setShowSidebar(false)}></div>
        )}

        {/* Top Bar */}
        <div className='bg-white border-b border-gray-200 px-4 sm:px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <button onClick={() => setShowSidebar(!showSidebar)} className='p-2 hover:bg-gray-100 rounded-lg transition-colors'>
                <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              </button>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Chat with AI</h2>
                <p className='text-sm text-gray-500'>
                  Powered by {selectedModel}
                  {!isPremium && ` • ${queryCount[selectedModel] || 0}/${FREE_USER_LIMIT} free queries used`}
                </p>
              </div>
            </div>
            
            {/* Bot Selector Dropdown */}
            <div className='flex gap-2 items-center relative'>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className='px-4 py-2 rounded-lg font-medium bg-white border-2 border-gray-200 hover:border-indigo-500 focus:border-indigo-600 focus:outline-none transition-all'
                onMouseMove={e => {
                  const rect = e.target.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                }}
              >
                {bots.map((bot) => (
                  <option
                    key={bot.id}
                    value={bot.name}
                    onMouseEnter={() => setHoveredBot(bot)}
                    onMouseLeave={() => setHoveredBot(null)}
                  >
                    {bot.icon} {bot.name}
                  </option>
                ))}
              </select>
              {/* Floating popup for hovered bot */}
              {hoveredBot && (
                <div
                  style={{
                    position: 'fixed',
                    top: dropdownPos.top + 8,
                    left: dropdownPos.left,
                    zIndex: 1000,
                    minWidth: 260,
                    background: 'white',
                    borderRadius: 12,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    border: '1px solid #e5e7eb',
                    padding: '16px',
                  }}
                  onMouseEnter={() => setHoveredBot(hoveredBot)}
                  onMouseLeave={() => setHoveredBot(null)}
                >
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='text-xl'>{hoveredBot.icon}</span>
                    <span className='font-semibold text-gray-900'>{hoveredBot.name}</span>
                  </div>
                  <div className='text-sm text-gray-700 mb-1'>{hoveredBot.tagline}</div>
                  <div className='text-xs text-gray-500'>{hoveredBot.description}</div>
                </div>
              )}
              {selectedBot?.provider === 'imageai' && (
                <label className={`flex items-center gap-2 px-4 py-2 bg-white rounded-lg border-2 border-gray-200 cursor-pointer hover:border-indigo-500 transition-all ${!isPremium ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                  </svg>
                  <input type='file' accept='image/*' onChange={handleImageUpload} className='hidden' disabled={!isPremium} />
                  <span className='text-sm font-medium text-gray-700'>Upload Image {!isPremium && '🔒'}</span>
                </label>
              )}
              {selectedBot?.provider === 'searchai' && (
                <div className='flex-1 max-w-xl'>
                  <input
                    type='text'
                    placeholder='Enter URL or search query...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-indigo-600 focus:outline-none'
                  />
                </div>
              )}
              {selectedBot?.provider === 'openai-audio' && (
                <button
                  className={`flex items-center gap-2 px-4 py-2 bg-white rounded-lg border-2 border-gray-200 hover:border-indigo-500 transition-all ${!isPremium ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onMouseDown={isPremium ? startRecording : () => alert('Audio features are premium only. Please upgrade.')}
                  onMouseUp={stopRecording}
                  onTouchStart={isPremium ? startRecording : () => alert('Audio features are premium only. Please upgrade.')}
                  onTouchEnd={stopRecording}
                  style={{ position: 'relative' }}
                  disabled={!isPremium}
                >
                  <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 18v-6m0 0a4 4 0 10-8 0v6a4 4 0 008 0zm0 0a4 4 0 008 0v-6a4 4 0 00-8 0z' />
                  </svg>
                  <span className='text-sm font-medium text-gray-700'>{isRecording ? 'Recording...' : 'Hold to Record'} {!isPremium && '🔒'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bots Panel (top-right) */}
        {showBotsPanel && (
          <div className='absolute right-2 sm:right-6 top-16 sm:top-20 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='text-sm font-semibold'>Popular Bots</h4>
              <button onClick={() => setShowBotsPanel(false)} className='text-xs text-gray-500 p-1'>Close</button>
            </div>
            <div className='max-h-80 sm:max-h-96 overflow-y-auto'>
              <BotGrid bots={bots} onBotSelect={(bot) => { setSelectedModel(bot.name); setShowBotsPanel(false); }} />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className='flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6'>
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-2 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${selectedModelData?.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <span className='text-lg sm:text-xl'>{selectedModelData?.icon}</span>
                </div>
              )}
              <div className={`max-w-xs sm:max-w-md md:max-w-3xl ${message.role === 'user' ? 'order-first' : ''}`}>
                <div className={`px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                }`}>
                  {message.type === 'image' ? (
                    <div className='space-y-2 sm:space-y-3'>
                      {message.content.startsWith('![') ? (
                        <img src={message.content.match(/\((.*?)\)/)?.[1]} alt="Uploaded" className='max-w-full sm:max-w-sm rounded-lg' />
                      ) : (
                        <p className='whitespace-pre-wrap leading-relaxed'>{message.content}</p>
                      )}
                    </div>
                  ) : message.type === 'search' ? (
                    <div className='space-y-2 sm:space-y-3'>
                      <p className='whitespace-pre-wrap leading-relaxed'>{message.content}</p>
                      {message.results && (
                        <div className='mt-2 space-y-2'>
                          {message.results.map((result, i) => (
                            <div key={i} className='p-2 bg-gray-50 rounded text-xs sm:text-sm'>
                              <a href={result.url} className='text-indigo-600 hover:underline block truncate'>{result.title}</a>
                              <p className='text-gray-600 text-xs line-clamp-2'>{result.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : message.type === 'audio' ? (
                    <div className='space-y-2 sm:space-y-3'>
                      <p className='whitespace-pre-wrap leading-relaxed'>{message.content}</p>
                      {message.audioUrl && (
                        <audio controls src={message.audioUrl} className='mt-2 w-full' />
                      )}
                    </div>
                  ) : (
                    <p className='whitespace-pre-wrap leading-relaxed'>{message.content}</p>
                  )}
                </div>
                <div className={`text-xs text-gray-500 mt-1 px-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.role === 'assistant' && `${message.model} • `}
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {message.role === 'user' && (
                <div className='w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg'>
                  <svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
                  </svg>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className='flex gap-4 justify-start'>
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedModelData?.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <span className='text-xl'>{selectedModelData?.icon}</span>
              </div>
              <div className='bg-white border border-gray-200 rounded-2xl rounded-tl-none px-5 py-3 shadow-sm'>
                <div className='flex gap-1'>
                  <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }}></div>
                  <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }}></div>
                  <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className='bg-white border-t border-gray-200 px-4 sm:px-6 py-4'>
          <div className='max-w-4xl mx-auto'>
            <div className='flex gap-2 sm:gap-3 items-end'>
              <div className='flex-1 relative'>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='Type your message... (Shift+Enter for new line)'
                  className='w-full px-3 sm:px-5 py-3 sm:py-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:border-indigo-600 focus:outline-none resize-none pr-8 sm:pr-12 shadow-sm text-sm sm:text-base'
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                />
                <div className='absolute right-2 sm:right-3 bottom-3 sm:bottom-4 text-xs text-gray-400'>
                  {input.length} chars
                </div>
              </div>
              {/* Voice Prompt Button Only */}
              <div className='flex flex-col gap-2 pb-2'>
                <button
                  type='button'
                  className='bg-indigo-600 text-white rounded-full p-2 sm:p-3 shadow hover:bg-indigo-700 transition-colors flex items-center'
                  title='Voice Input'
                  onClick={() => {
                    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                      alert('Speech recognition not supported in this browser.');
                      return;
                    }
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;
                    recognition.maxAlternatives = 1;
                    recognition.onresult = (event) => {
                      const transcript = event.results[0][0].transcript;
                      setInput(prev => prev ? prev + ' ' + transcript : transcript);
                    };
                    recognition.onerror = (event) => {
                      alert('Voice input error: ' + event.error);
                    };
                    recognition.start();
                  }}
                >
                  <svg className='w-4 h-4 sm:w-5 sm:h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 18v-6m0 0a4 4 0 10-8 0v6a4 4 0 008 0zm0 0a4 4 0 008 0v-6a4 4 0 00-8 0z' />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className={`p-3 sm:p-4 rounded-xl font-medium transition-all flex items-center justify-center shadow-lg text-sm sm:text-base ${
                  input.trim() && !isTyping
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                </svg>
              </button>
            </div>
            <div className='mt-3 text-xs text-gray-500 text-center'>
              AI can make mistakes. Consider checking important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

