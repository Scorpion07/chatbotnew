import React, { useState, useRef, useEffect } from 'react';
import botSquareIcon from '../../../boticon/talksphere-bot-square-40x40.png';
import axios from 'axios';
import { getApiUrl } from '../config.js';
import BotGrid from '../components/BotGrid.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import remarkEmoji from 'remark-emoji';
import 'katex/dist/katex.min.css';

export default function Chat({ setView, isDark, toggleDark }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      model: 'GPT-4'
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('selectedBotName') || 'GPT-4');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bots, setBots] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showBotsPanel, setShowBotsPanel] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
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
      axios.get(getApiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setIsPremium(!!res.data?.user?.isPremium)).catch(() => {});
    }
    // Clear any stale local counts (we now rely on server usage)
    try { localStorage.removeItem('queryCount'); } catch {}
  }, []);

  // Load per-bot usage counts for the authenticated user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.get(getApiUrl('/usage'), {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const records = res.data?.usage || [];
      const map = {};
      records.forEach(u => { map[u.botName] = u.count || 0; });
      setQueryCount(map);
    }).catch(() => {});
  }, []);

  // Get currently selected bot and display label (prefer official model name)
  const selectedBot = bots.find(b => b.name === selectedModel);
  const modelLabel = selectedBot?.model || selectedModel;
  const provider = selectedBot?.provider || 'default';
  // Provider-specific themes (approximate native feels)
  const providerThemes = {
    openai: {
      bgLight: 'bg-gray-50',
      bgDark: 'dark:bg-[#212327]',
      borderLight: 'border-gray-200',
      borderDark: 'dark:border-gray-700',
      chip: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
    },
    google: {
      bgLight: 'bg-sky-50',
      bgDark: 'dark:bg-sky-900/20',
      borderLight: 'border-sky-100',
      borderDark: 'dark:border-sky-800/40',
      chip: 'bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40',
    },
    anthropic: {
      bgLight: 'bg-orange-50',
      bgDark: 'dark:bg-orange-900/20',
      borderLight: 'border-orange-100',
      borderDark: 'dark:border-orange-800/40',
      chip: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40',
    },
    deepai: {
      bgLight: 'bg-cyan-50',
      bgDark: 'dark:bg-cyan-900/20',
      borderLight: 'border-cyan-100',
      borderDark: 'dark:border-cyan-800/40',
      chip: 'bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/40',
    },
    x: {
      bgLight: 'bg-gray-100',
      bgDark: 'dark:bg-gray-900/40',
      borderLight: 'border-gray-200',
      borderDark: 'dark:border-gray-800',
      chip: 'bg-gray-200 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    },
    imageai: {
      bgLight: 'bg-rose-50',
      bgDark: 'dark:bg-rose-900/20',
      borderLight: 'border-rose-100',
      borderDark: 'dark:border-rose-800/40',
      chip: 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
    },
    'openai-audio': {
      bgLight: 'bg-gray-50',
      bgDark: 'dark:bg-[#212327]',
      borderLight: 'border-gray-200',
      borderDark: 'dark:border-gray-700',
      chip: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
    },
    default: {
      bgLight: 'bg-white',
      bgDark: 'dark:bg-gray-800',
      borderLight: 'border-gray-200',
      borderDark: 'dark:border-gray-700',
      chip: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    }
  };
  const PT = providerThemes[provider] || providerThemes.default;

  // Utils: copy to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {}
    }
  };

  // Handle image upload (available for all models; preview and attach on send)
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSelectedImagePreview(ev.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle sending message based on bot type
  const handleSend = async () => {
    if (!input.trim() && !selectedImage && !searchQuery) return;

    // Check client-side limit for non-premium users before sending
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
      // Image generation bot (OpenAI images). Premium only.
      if (!isPremium) {
        alert('Image generation is a premium feature. Please upgrade to continue.');
        return;
      }
      userMessage = {
        role: 'user',
        content: input || 'Generate an image',
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
        model: modelLabel,
        type: 'audio'
      };
      botType = 'audio';
    } else {
      userMessage = {
        role: 'user',
        content: input,
        model: modelLabel,
        type: 'text'
      };
      botType = 'text';
    }

    setMessages([...messages, userMessage]);
    setInput('');
    setSearchQuery('');
  setSelectedImage(null);
  setSelectedImagePreview(null);
    setIsTyping(true);

    try {
      let response;
      if (botType === 'image') {
        const token = localStorage.getItem('token');

        const res = await axios.post(
          getApiUrl('/openai/image'),
          { prompt: userMessage.content },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        const data = res.data.image;

        // ✅ Backend polite safety fallback message
        if (data && data.politeError) {
          response = {
            role: 'assistant',
            content: data.message || "The system could not generate this image safely.",
            model: modelLabel,
            type: 'text'
          };
        }

        // ✅ Valid base64 image (Vertex/OpenAI)
        else if (typeof data === 'string' && data.startsWith('data:image')) {
          response = {
            role: 'assistant',
            content: data,   // already base64
            model: modelLabel,
            type: 'image'
          };
        }

        // ✅ Direct URL fallback from backend
        else if (res.data.image && typeof res.data.image === "string" && res.data.image.startsWith("data:image")) {
          response = {
            role: 'assistant',
            content: res.data.image,
            model: modelLabel,
            type: 'image'
          };
        }

        // ✅ Catch-all failure
        else {
          response = {
            role: 'assistant',
            content: "Image generation failed. Please try a different prompt.",
            model: modelLabel,
            type: 'text'
          };
        }
      } else if (botType === 'search') {
        // For now, keep demo search response
        response = {
          role: 'assistant',
          content: 'Search API integration coming soon.',
          model: modelLabel,
          type: 'search',
          results: []
        };
      } else if (botType === 'audio') {
        // Call backend audio endpoint and play audio
        const token = localStorage.getItem('token');
        const audioRes = await fetch(getApiUrl('/openai/audio'), {
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
            model: modelLabel,
            type: 'audio',
            audioUrl
          };
        } else {
          const errorText = await audioRes.text().catch(() => '');
          response = {
            role: 'assistant',
            content: 'Error: Unable to generate audio.' + (errorText ? ` (${errorText})` : ''),
            model: modelLabel,
            type: 'audio'
          };
        }
      } else {
        // Call backend chat endpoint with streaming
        const token = localStorage.getItem('token');
        // Ensure we have a conversation id
        let convId = activeConversation;
        if (!convId) {
          try {
            const created = await axios.post(getApiUrl('/conversations'), { botName: selectedModel }, { headers: { Authorization: `Bearer ${token}` } });
            convId = created.data.id;
            const entry = { id: convId, title: created.data.title || `Chat ${convId}`, date: new Date(created.data.updatedAt || created.data.createdAt).toLocaleDateString() };
            setConversations(prev => [entry, ...prev]);
            setActiveConversation(convId);
          } catch {}
        }
        // Insert a placeholder assistant message we will stream-update
        const placeholder = { role: 'assistant', content: '', model: modelLabel, type: 'text' };
        setMessages(prev => [...prev, placeholder]);

        // Start streaming
        const contentWithImage = selectedImagePreview ? `${userMessage.content}\n\n![Uploaded Image](${selectedImagePreview})` : userMessage.content;
        const streamRes = await fetch(getApiUrl('/openai/chat/stream'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ message: contentWithImage, botName: selectedModel, conversationId: convId })
        });

        if (!streamRes.ok) {
          // Check for 402 Payment Required (quota exceeded)
          if (streamRes.status === 402) {
            setShowUpgrade(true);
            setMessages(prev => prev.slice(0, -1)); // Remove placeholder
            setIsTyping(false);
            return;
          }
          throw new Error('Stream failed');
        }
        
        if (!streamRes.body) {
          throw new Error('Stream failed');
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let acc = '';
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            acc += decoder.decode(value, { stream: true });
            let nlIndex;
            while ((nlIndex = acc.indexOf('\n')) >= 0) {
              const line = acc.slice(0, nlIndex).trim();
              acc = acc.slice(nlIndex + 1);
              if (!line) continue;
              try {
                const evt = JSON.parse(line);
                if (evt.type === 'delta' && evt.text) {
                  setMessages(prev => {
                    const updated = [...prev];
                    // find last assistant placeholder
                    for (let i = updated.length - 1; i >= 0; i--) {
                      if (updated[i].role === 'assistant' && updated[i].type === 'text') {
                        updated[i] = { ...updated[i], content: (updated[i].content || '') + evt.text };
                        break;
                      }
                    }
                    return updated;
                  });
                } else if (evt.type === 'done') {
                  // Optionally handle sources if provided later
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }
        // No additional response push; placeholder has been filled progressively
        response = null;
      }
      if (response) {
        setMessages(prev => [...prev, response]);
      }
      
      // Increment local display count for free users (server is source of truth)
      if (!isPremium) {
        setQueryCount(prev => ({ ...prev, [selectedModel]: (prev[selectedModel] || 0) + 1 }));
      }
    } catch (err) {
      // If server enforced limit, show upgrade modal
      if (err?.response?.status === 402 || err?.response?.status === 403) {
        setShowUpgrade(true);
      } else if (err?.response?.status === 401) {
        // Not authenticated -> navigate to login
        setView?.('login');
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Unable to get response from API.',
        model: modelLabel,
        type: botType
      }]);
    }
    setIsTyping(false);
  };

  const UpgradeModal = () => (
    <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
      <div className='bg-white rounded-2xl p-6 w-[420px] shadow-2xl border border-gray-200'>
        <h3 className='text-lg font-semibold mb-2'>Upgrade to Premium</h3>
  <p className='text-sm text-gray-600 mb-4'>You've reached your free limit of {FREE_USER_LIMIT} queries for {modelLabel}. Upgrade to unlock unlimited text and premium features like Image and Audio generation.</p>
        <div className='flex justify-end gap-2'>
          <button className='px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50' onClick={() => setShowUpgrade(false)}>Later</button>
          <button className='px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700' onClick={() => { setShowUpgrade(false); setView?.('payment'); }}>Upgrade</button>
        </div>
      </div>
    </div>
  );

  const messagesEndRef = useRef(null);
  const models = [
    { name: 'GPT-4', icon: <img src={botSquareIcon} alt="Bot" style={{ width: 24, height: 24, borderRadius: 6 }} />, color: 'from-green-500 to-emerald-600', description: 'Most capable model' },
    { name: 'Claude', icon: <img src={botSquareIcon} alt="Bot" style={{ width: 24, height: 24, borderRadius: 6 }} />, color: 'from-orange-500 to-red-600', description: 'Best for analysis' },
    { name: 'Gemini', icon: <img src={botSquareIcon} alt="Bot" style={{ width: 24, height: 24, borderRadius: 6 }} />, color: 'from-blue-500 to-indigo-600', description: 'Google\'s latest' },
    { name: 'Llama', icon: <img src={botSquareIcon} alt="Bot" style={{ width: 24, height: 24, borderRadius: 6 }} />, color: 'from-purple-500 to-pink-600', description: 'Open source' }
  ];
  // Prefer bot-provided icon/color; fallback to defaults map above
  const extractedGradient = selectedBot?.color ? (selectedBot.color.match(/from-[^\s]+\s+to-[^\s]+/)?.[0] || '') : '';
  const selectedModelData = selectedBot
    ? { icon: selectedBot.icon || '🤖', color: extractedGradient || 'from-indigo-500 to-purple-600' }
    : models.find(m => m.name === selectedModel);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const newConversation = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setView?.('login'); return; }
    try {
      const res = await axios.post(getApiUrl('/conversations'), { botName: selectedModel }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const conv = res.data;
      const entry = { id: conv.id, title: conv.title || `Chat ${conv.id}`, date: new Date(conv.updatedAt || conv.createdAt).toLocaleDateString() };
      setConversations(prev => [entry, ...prev]);
      setActiveConversation(conv.id);
      setMessages([{ role: 'assistant', content: "Hello! I'm your AI assistant. How can I help you today?", model: modelLabel }]);
    } catch (e) {
      // fallback local new chat (non-persistent)
      const tempId = Date.now();
      setConversations(prev => [{ id: tempId, title: 'Conversation', date: new Date().toLocaleDateString() }, ...prev]);
      setActiveConversation(tempId);
      setMessages([{ role: 'assistant', content: "Hello! I'm your AI assistant. How can I help you today?", model: modelLabel }]);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.get(getApiUrl('/conversations'), {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const list = (res.data || []).map(c => ({
        id: c.id,
        title: c.title || `Chat ${c.id}`,
        date: new Date(c.updatedAt || c.createdAt).toLocaleDateString()
      }));
      setConversations(list);
      if (list.length && !activeConversation) setActiveConversation(list[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) return;
    const token = localStorage.getItem('token');
    if (!token) return;
      axios.get(getApiUrl(`/conversations/${activeConversation}`), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
      const msgs = (res.data?.messages || []).map(m => ({
        role: m.role,
        content: m.content,
        model: m.model || modelLabel,
        type: m.type || 'text'
      }));
      if (msgs.length === 0) {
        setMessages([{ role: 'assistant', content: "Hello! I'm your AI assistant. How can I help you today?", model: modelLabel }]);
      } else {
        setMessages(msgs);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation]);

  // Persist selected bot across pages
  useEffect(() => {
    try { localStorage.setItem('selectedBotName', selectedModel); } catch {}
  }, [selectedModel]);

  useEffect(() => {
    let mounted = true;
    axios.get(getApiUrl('/bots'))
      .then(r => { if (mounted) setBots(r.data); })
      .catch((err) => {
        console.error('Error fetching bots:', err);
        setBots([]);
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
      const res = await axios.post(getApiUrl('/openai/transcribe'), formData, {
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
    <div className='flex flex-col md:flex-row h-screen md:h-[calc(100vh-73px)] bg-brand backdrop-blur-xl rounded-3xl shadow-2xl'>
      {showUpgrade && <UpgradeModal />}
      {/* Sidebar */}
      <div className={`
        ${showSidebar ? 'w-64 md:w-64' : 'w-0'}
        ${showSidebar ? 'fixed md:relative' : ''}
        ${showSidebar ? 'inset-y-0 left-0 z-30 md:z-auto' : ''}
        surface-brand glassy border-r border-gray-200/60 dark:border-gray-800/60 transition-all duration-300 overflow-hidden flex flex-col
        max-h-[60vh] md:max-h-none
        absolute md:static top-0 left-0
        ${showSidebar ? 'block' : 'hidden md:block'}
        rounded-2xl shadow-xl
      `}>
        <div className='p-4 border-b border-gray-200 dark:border-gray-800'>
          <button onClick={newConversation} className='w-full px-4 py-3 btn-brand flex items-center justify-center gap-2 text-sm sm:text-base'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
            </svg>
            New Chat
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto p-1 custom-scrollbar transition-all duration-200 ${showRecent ? '' : 'h-0 overflow-hidden'} rounded-2xl shadow-lg`}
          style={{ background: 'var(--brand-bg)', backgroundColor: 'var(--brand-bg)', margin: '8px 6px', boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)' }}>
          <div className='flex flex-row items-center px-2 py-1 mb-1 relative'>
            <span className='text-xs font-semibold text-brand-primary flex-1'>Recent Conversations</span>
            <button
              className='text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300 ml-auto md:ml-0 md:static absolute right-2 top-1 md:right-0 md:top-0'
              onClick={() => setShowRecent(v => !v)}
              title={showRecent ? 'Hide' : 'Show'}
              style={{ zIndex: 10 }}
            >
              {showRecent ? (
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                </svg>
              ) : (
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 15l7-7 7 7' />
                </svg>
              )}
            </button>
          </div>

          {showRecent && (
            <>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={`px-2 py-2 rounded-md mb-1 cursor-pointer transition-all text-sm flex items-center gap-2 ${
                    activeConversation === conv.id
                      ? 'bg-indigo-100 dark:bg-gray-700 border border-indigo-200 dark:border-gray-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                  }`}
                  style={{ minHeight: '36px' }}
                >
                  <svg className='w-4 h-4 text-gray-400 flex-shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' />
                  </svg>
                  <div className='flex-1 min-w-0'>
                    <input
                      className={`text-xs font-medium bg-transparent border-none outline-none w-full truncate text-brand-primary ${activeConversation === conv.id ? '' : 'pointer-events-none'}`}
                      value={conv.title}
                      onChange={e => {
                        const newTitle = e.target.value;
                        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, title: newTitle } : c));
                        // Optionally persist to backend
                        const token = localStorage.getItem('token');
                        if (token) {
                          axios.patch(getApiUrl(`/conversations/${conv.id}`), { title: newTitle }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                        }
                      }}
                      onClick={e => e.stopPropagation()}
                      onBlur={e => e.target.blur()}
                      readOnly={activeConversation !== conv.id}
                      title={conv.title}
                      style={{ padding: 0, margin: 0 }}
                    />
                    <div className='text-2xs text-gray-500 dark:text-gray-400'>{conv.date}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const token = localStorage.getItem('token');
                      if (!token) return;
                      axios.delete(getApiUrl(`/conversations/${conv.id}`), { headers: { Authorization: `Bearer ${token}` } })
                        .then(() => {
                          setConversations(prev => prev.filter(c => c.id !== conv.id));
                          if (activeConversation === conv.id) {
                            const next = conversations.find(c => c.id !== conv.id);
                            setActiveConversation(next ? next.id : null);
                            setMessages([{ role: 'assistant', content: "Hello! I'm your AI assistant. How can I help you today?", model: modelLabel }]);
                          }
                        }).catch(() => {});
                    }}
                    className='px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600'
                    title='Delete conversation'
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
        </div>

      {/* Main Chat Area */}
  <div className='flex-1 flex flex-col relative min-h-0 surface-brand glassy rounded-3xl glossy border border-white/30 dark:border-gray-700/40 shadow-2xl'>
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div className='md:hidden fixed inset-0 bg-black bg-opacity-50 z-20' onClick={() => setShowSidebar(false)}></div>
        )}
        {/* Mobile sidebar toggle button */}
        <button
          className='md:hidden fixed top-4 left-4 z-40 p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg'
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <svg className='w-6 h-6 text-gray-700 dark:text-gray-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
          </svg>
        </button>

        {/* Top Bar */}
  <div className='surface-brand glassy border-b border-gray-200/60 dark:border-gray-800/60 px-2 sm:px-6 py-3 sm:py-4 glossy'>
          <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0'>
            <div className='flex items-center gap-2 sm:gap-4'>
              <button onClick={() => setShowSidebar(!showSidebar)} className='p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'>
                <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              </button>
              <div>
                <h2 className='text-lg font-semibold text-brand-primary'>Chat with AI</h2>
                <p className='text-sm text-brand-accent'>
                  Powered by {modelLabel}
                  {!isPremium && ` • ${queryCount[selectedModel] || 0}/${FREE_USER_LIMIT} free queries used`}
                </p>
              </div>
            </div>
            
            {/* Bot Selector Dropdown */}
            <div className='flex gap-2 items-center relative'>
              {/* Recent Conversations button (mobile only) */}
              <button
                className='sm:hidden flex items-center gap-1 px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-brand-primary hover:border-indigo-500 transition-colors ml-[-8px]'
                style={{ whiteSpace: 'nowrap', marginLeft: '-8px' }}
                onClick={() => setShowRecent(v => !v)}
                title={showRecent ? 'Hide Recent Conversations' : 'Show Recent Conversations'}
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d={showRecent ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                </svg>
                Recent
              </button>
              {/* Dark mode toggle */}
              <button
                type='button'
                aria-label='Toggle dark mode'
                onClick={toggleDark}
                className='p-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-500 transition-colors'
                title={isDark ? 'Switch to light' : 'Switch to dark'}
              >
                {isDark ? (
                  <svg className='w-5 h-5 text-yellow-300' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.03a1 1 0 011.415 0l.708.707a1 1 0 11-1.414 1.415l-.709-.708a1 1 0 010-1.414zM17 9a1 1 0 110 2h-1a1 1 0 110-2h1zM4 10a1 1 0 100 2H3a1 1 0 100-2h1zm1.657-5.657a1 1 0 010 1.414l-.708.709A1 1 0 012.535 4.95l.708-.708a1 1 0 011.414 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm6.364-2.95a1 1 0 010 1.415l-.708.708a1 1 0 11-1.414-1.414l.708-.709a1 1 0 011.414 0zM6.343 15.657a1 1 0 010-1.414l.708-.709a1 1 0 111.415 1.415l-.709.708a1 1 0 01-1.414 0z'/>
                  </svg>
                ) : (
                  <svg className='w-5 h-5 text-gray-600' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M17.293 13.293A8 8 0 116.707 2.707 8.001 8.001 0 0017.293 13.293z' />
                  </svg>
                )}
              </button>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className='px-4 py-2 rounded-lg font-medium bg-white dark:bg-gray-800 dark:text-white border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 focus:border-indigo-600 focus:outline-none transition-all'
                style={{ color: isDark ? 'white' : undefined }}
                onMouseMove={e => {
                  const rect = e.target.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                }}
              >
                {bots.map((bot) => (
                  <option
                    key={bot.id}
                    value={bot.name}
                    style={isDark ? { color: 'white', background: '#1f2937' } : {}}
                    onMouseEnter={() => setHoveredBot(bot)}
                    onMouseLeave={() => setHoveredBot(null)}
                  >
                    {bot.icon} {bot.model || bot.name}
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
                    <span className='font-semibold text-gray-900 dark:text-gray-100'>{hoveredBot.model || hoveredBot.name}</span>
                  </div>
                  <div className='text-sm text-gray-700 dark:text-gray-300 mb-1'>{hoveredBot.tagline}</div>
                  <div className='text-xs text-gray-500 dark:text-gray-400'>{hoveredBot.description}</div>
                </div>
              )}
              {/* Removed topbar image upload (moved near send) */}
              {selectedBot?.provider === 'searchai' && (
                <div className='flex-1 max-w-xl'>
                  <input
                    type='text'
                    placeholder='Enter URL or search query...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:border-indigo-600 focus:outline-none'
                  />
                </div>
              )}
              {selectedBot?.provider === 'openai-audio' && (
                <button
                  className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-all ${!isPremium ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>{isRecording ? 'Recording...' : 'Hold to Record'} {!isPremium && '🔒'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bots Panel (top-right) */}
        {showBotsPanel && (
          <div className='absolute right-2 sm:right-6 top-16 sm:top-20 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 z-50'>
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
        <div className='flex-1 overflow-y-auto px-2 sm:px-6 py-2 sm:py-6 space-y-4 sm:space-y-6 custom-scrollbar'>
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-2 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-center'}`}>
              {message.role === 'assistant' && (
                <div className='flex items-center justify-center flex-shrink-0' style={{ width: 40, height: 40 }}>
                  {selectedModelData?.icon}
                </div>
              )}
              <div className={`w-full max-w-3xl ${message.role === 'user' ? 'order-first' : ''}`}>
                <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none'
                    : `${PT.bgLight} ${PT.bgDark} border ${PT.borderLight} ${PT.borderDark} text-gray-800 dark:text-gray-100 rounded-tl-none shadow-sm provider-${provider}`
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
                    <>
                      {/* Provider/model chip header to mimic native UIs */}
                      {message.role === 'assistant' && (
                        <div className='mb-2 -mt-1 flex items-center gap-2 text-xs'>
                          <span className='chip-brand'>{message.model || modelLabel}</span>
                        </div>
                      )}
                      <div className='prose prose-slate dark:prose-invert max-w-none'>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, [remarkEmoji, { emoticon: true }]]}
                        rehypePlugins={[rehypeKatex, rehypeHighlight]}
                        components={{
                          code({node, inline, className, children, ...props}) {
                            const match = /language-(\w+)/.exec(className || '');
                            const raw = String(children || '').replace(/\n$/, '');
                            return !inline ? (
                              <div className='relative group'>
                                {match && match[1] && (
                                  <div className='absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded bg-gray-700/80 text-gray-100'>
                                    {match[1]}
                                  </div>
                                )}
                                <button
                                  onClick={() => copyToClipboard(raw)}
                                  className='absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-700/80 text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity'
                                  title='Copy code'
                                >
                                  Copy
                                </button>
                                <pre className='bg-gray-900 text-gray-100 rounded-lg p-3 overflow-auto text-sm hljs'>
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                              </div>
                            ) : (
                              <code className='bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5' {...props}>{children}</code>
                            );
                          },
                          table({children}) {
                            return (
                              <div className='overflow-x-auto'>
                                <table className='table-auto'>{children}</table>
                              </div>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {/* Inline citations/cards (Gemini-like) */}
                      {Array.isArray(message.sources) && message.sources.length > 0 && (
                        <div className='mt-3 border-t border-gray-200 dark:border-gray-700 pt-2'>
                          <div className='text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2'>Sources</div>
                          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                            {message.sources.map((src, i) => (
                              <a key={i} href={src.url} target='_blank' rel='noreferrer' className='block p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors'>
                                <div className='text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate'>{src.title || src.url}</div>
                                {src.snippet && <div className='text-xs text-gray-600 dark:text-gray-400 line-clamp-2'>{src.snippet}</div>}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>
                    </>
                  )}
                </div>
                <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 px-2 flex items-center gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-between'} max-w-3xl`}>        
                  {message.role === 'assistant' ? (
                    <>
                      <span className='truncate'>{message.model} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className='flex items-center gap-1'>
                        <button onClick={() => copyToClipboard(message.content)} className='px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[11px]' title='Copy'>Copy</button>
                        <button className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800' title='Like' aria-label='Like'>
                          <svg className='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M14 9l-2 6-2-6m-2 0h8l-4-4-4 4z'/></svg>
                        </button>
                        <button className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800' title='Dislike' aria-label='Dislike'>
                          <svg className='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 15l2-6 2 6m2 0H8l4 4 4-4z'/></svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
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
              <div className='flex items-center justify-center flex-shrink-0' style={{ width: 40, height: 40 }}>
                {selectedModelData?.icon}
              </div>
              <div className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-none px-5 py-3 shadow-sm'>
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
  <div className='surface-brand glassy border-t border-gray-200/60 dark:border-gray-800/60 px-2 sm:px-6 py-3 sm:py-4 pb-[env(safe-area-inset-bottom)] glossy shadow-2xl rounded-b-3xl'>
          <div className='max-w-2xl sm:max-w-4xl mx-auto'>
            {/* Image preview (if any) */}
            {selectedImagePreview && (
              <div className='mb-2 flex items-center gap-3'>
                <img src={selectedImagePreview} alt='Attachment preview' className='w-12 h-12 rounded object-cover border border-gray-200 dark:border-gray-700'/>
                <button
                  className='text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  onClick={() => { setSelectedImage(null); setSelectedImagePreview(null); }}
                >
                  Remove
                </button>
              </div>
            )}
            <div className='flex flex-row gap-2 sm:gap-3 items-end w-full'>
              <div className='flex-1 relative'>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='Type your message... (Shift+Enter for new line)'
                  className={`w-full px-3 sm:px-5 py-3 sm:py-4 border-2 rounded-xl sm:rounded-2xl focus:border-brand-accent focus:outline-none resize-none shadow-lg text-sm sm:text-base transition-colors
                    ${isDark
                      ? 'bg-black text-white border-white/30 placeholder-gray-400'
                      : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'}
                  `}
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '200px', fontWeight: 500, boxShadow: isDark ? '0 2px 12px 0 rgba(0,0,0,0.5)' : '0 2px 12px 0 rgba(0,0,0,0.08)' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                />
                <div className='absolute right-2 sm:right-3 bottom-3 sm:bottom-4 text-xs text-gray-400 dark:text-gray-500'>
                  {input.length} chars
                </div>
              </div>
              <div className='flex flex-row gap-2 items-end'>
                <label className='bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow border-2 border-gray-200 dark:border-gray-700 hover:border-brand-accent transition-colors cursor-pointer flex items-center justify-center' style={{ minWidth: '48px', minHeight: '48px' }} title='Attach image'>
                  <input type='file' accept='image/*' onChange={handleImageUpload} className='hidden' />
                  <svg className='w-6 h-6 text-gray-600 dark:text-gray-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L19 8.828a4 4 0 10-5.656-5.656L5.757 10.757' />
                  </svg>
                </label>
                <button
                  type='button'
                  className='bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow border-2 border-gray-200 dark:border-gray-700 hover:border-brand-accent transition-colors flex items-center justify-center'
                  style={{ minWidth: '48px', minHeight: '48px' }}
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
                  <svg className='w-6 h-6' fill='none' stroke='#ef4444' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 18v-6m0 0a4 4 0 10-8 0v6a4 4 0 008 0zm0 0a4 4 0 008 0v-6a4 4 0 00-8 0z' />
                  </svg>
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className={`p-3 sm:p-4 rounded-xl font-medium transition-all flex items-center justify-center shadow-lg text-sm sm:text-base w-full sm:w-auto btn-brand ${
                    !(input.trim() && !isTyping) ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  style={{ minWidth: '48px', minHeight: '48px' }}
                >
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                  </svg>
                </button>
              </div>
            </div>
            <div className='mt-3 text-xs text-gray-500 dark:text-gray-400 text-center'>
              AI can make mistakes. Consider checking important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

