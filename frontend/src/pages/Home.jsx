
import React from 'react';

export default function Home({ setView }) {
  return (
    <div className='min-h-screen'>
      {/* Hero Section */}
      <section className='max-w-7xl mx-auto px-6 py-20'>
        <div className='text-center max-w-4xl mx-auto'>
          <div className='inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full text-sm font-medium text-indigo-700 mb-6 border border-indigo-200'>
            <span className='w-2 h-2 bg-indigo-500 rounded-full animate-pulse'></span>
            New: Multi-Model AI Chat Interface
          </div>
          <h1 className='text-6xl md:text-7xl font-bold leading-tight mb-6 bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent'>
            All Your AI Models
            <br />
            <span className='bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'>In One Place</span>
          </h1>
          <p className='text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed'>
            Access GPT-4, Claude, Gemini, and more from a single, beautiful interface. Switch between models instantly and unlock the full potential of AI.
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            <button onClick={() => setView('chat')} className='px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 transition-all transform hover:scale-105'>
              Start Chatting Now
              <svg className='inline-block w-5 h-5 ml-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 7l5 5m0 0l-5 5m5-5H6' />
              </svg>
            </button>
            <button onClick={() => setView('pricing')} className='px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-indigo-600 hover:text-indigo-600 transition-all'>
              View Pricing
            </button>
          </div>
        </div>

        {/* Preview Window */}
        <div className='mt-20 max-w-5xl mx-auto'>
          <div className='bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden'>
            <div className='bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center gap-2'>
              <div className='flex gap-2'>
                <div className='w-3 h-3 bg-red-500 rounded-full'></div>
                <div className='w-3 h-3 bg-yellow-500 rounded-full'></div>
                <div className='w-3 h-3 bg-green-500 rounded-full'></div>
              </div>
              <div className='flex-1 text-center text-gray-400 text-sm font-medium'>TalkSphere AI</div>
            </div>
            <div className='p-8 bg-gradient-to-br from-gray-50 to-white'>
              <div className='flex gap-3 mb-6'>
                {['GPT-4', 'Claude', 'Gemini', 'Llama'].map((model, i) => (
                  <div key={model} className={`px-4 py-2 rounded-lg text-sm font-medium ${i === 0 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'}`}>
                    {model}
                  </div>
                ))}
              </div>
              <div className='space-y-4'>
                <div className='flex gap-3'>
                  <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex-shrink-0'></div>
                  <div className='flex-1 bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3'>
                    <p className='text-gray-700'>Hello! How can I assist you today?</p>
                  </div>
                </div>
                <div className='flex gap-3 justify-end'>
                  <div className='flex-1 max-w-md bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3'>
                    <p>Help me with my coding project</p>
                  </div>
                  <div className='w-8 h-8 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-full flex-shrink-0'></div>
                </div>
              </div>
              <div className='mt-6 flex gap-2 items-center'>
                <input type='text' placeholder='Type your message...' className='flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none' />
                <button className='p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors'>
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='bg-white py-20'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='text-center mb-16'>
            <h2 className='text-4xl font-bold mb-4'>Powerful Features</h2>
            <p className='text-xl text-gray-600'>Everything you need for AI-powered conversations</p>
          </div>
          <div className='grid md:grid-cols-3 gap-8'>
            {[
              {
                icon: '🤖',
                title: 'Multiple AI Models',
                description: 'Access GPT-4, Claude, Gemini, and more. Switch between models with a single click.'
              },
              {
                icon: '⚡',
                title: 'Lightning Fast',
                description: 'Optimized for speed. Get responses in milliseconds with our advanced infrastructure.'
              },
              {
                icon: '💬',
                title: 'Smart Conversations',
                description: 'Context-aware chats that remember your conversation history and preferences.'
              },
              {
                icon: '🎨',
                title: 'Beautiful Interface',
                description: 'Modern, intuitive design that makes chatting with AI a delightful experience.'
              },
              {
                icon: '🔒',
                title: 'Secure & Private',
                description: 'Your conversations are encrypted and private. We never share your data.'
              },
              {
                icon: '📱',
                title: 'Works Everywhere',
                description: 'Responsive design works perfectly on desktop, tablet, and mobile devices.'
              }
            ].map((feature, i) => (
              <div key={i} className='p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50'>
                <div className='text-4xl mb-4'>{feature.icon}</div>
                <h3 className='text-xl font-bold mb-2'>{feature.title}</h3>
                <p className='text-gray-600'>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='py-20'>
        <div className='max-w-4xl mx-auto px-6 text-center'>
          <div className='bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 shadow-2xl'>
            <h2 className='text-4xl font-bold text-white mb-4'>Ready to get started?</h2>
            <p className='text-xl text-indigo-100 mb-8'>Join thousands of users already chatting with AI</p>
            <button onClick={() => setView('chat')} className='px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl'>
              Start Your First Chat
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-gray-900 text-gray-400 py-12'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='grid md:grid-cols-4 gap-8 mb-8'>
            <div>
              <h3 className='text-white font-bold mb-4'>TalkSphere AI</h3>
              <p className='text-sm'>Your gateway to the world of AI conversations.</p>
            </div>
            <div>
              <h4 className='text-white font-semibold mb-4'>Product</h4>
              <ul className='space-y-2 text-sm'>
                <li><button onClick={() => setView('home')} className='hover:text-white transition-colors'>Features</button></li>
                <li><button onClick={() => setView('pricing')} className='hover:text-white transition-colors'>Pricing</button></li>
                <li><a href='#' className='hover:text-white transition-colors'>API</a></li>
              </ul>
            </div>
            <div>
              <h4 className='text-white font-semibold mb-4'>Company</h4>
              <ul className='space-y-2 text-sm'>
                <li><a href='#' className='hover:text-white transition-colors'>About</a></li>
                <li><a href='#' className='hover:text-white transition-colors'>Blog</a></li>
                <li><a href='#' className='hover:text-white transition-colors'>Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className='text-white font-semibold mb-4'>Support</h4>
              <ul className='space-y-2 text-sm'>
                <li><a href='#' className='hover:text-white transition-colors'>Help Center</a></li>
                <li><a href='#' className='hover:text-white transition-colors'>Contact</a></li>
                <li><a href='#' className='hover:text-white transition-colors'>Status</a></li>
              </ul>
            </div>
          </div>
          <div className='border-t border-gray-800 pt-8 text-center text-sm'>
            <p>© 2025 TalkSphere AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
