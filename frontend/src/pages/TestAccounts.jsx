import React from 'react';

export default function TestAccounts({ setView }) {
  const testAccounts = [
    { email: 'premium1@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium2@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium3@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium4@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium5@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium6@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium7@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium8@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium9@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'premium10@test.com', type: 'Premium', color: 'bg-amber-100 text-amber-800' },
    { email: 'normal1@test.com', type: 'Free', color: 'bg-gray-100 text-gray-800' },
    { email: 'normal2@test.com', type: 'Free', color: 'bg-gray-100 text-gray-800' },
  ];

  const handleQuickLogin = (email) => {
    // Pre-fill login form
    setView('login');
    // This is a hack for demonstration - in real app you'd pass email to login component
    setTimeout(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      if (emailInput) emailInput.value = email;
      if (passwordInput) passwordInput.value = 'password123';
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 Test Accounts</h1>
            <p className="text-gray-600">Quick access to test accounts for development</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <h2 className="text-xl font-semibold text-amber-700 mb-4 flex items-center gap-2">
                ⭐ Premium Accounts (10)
                <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded-full">All Features</span>
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {testAccounts.filter(acc => acc.type === 'Premium').map((account, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div>
                      <div className="font-medium text-gray-900">{account.email}</div>
                      <div className="text-sm text-gray-600">password123</div>
                    </div>
                    <button
                      onClick={() => handleQuickLogin(account.email)}
                      className="px-3 py-1 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
                    >
                      Quick Login
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
                🆓 Free Accounts (2)
                <span className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Limited Features</span>
              </h2>
              <div className="space-y-2">
                {testAccounts.filter(acc => acc.type === 'Free').map((account, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <div className="font-medium text-gray-900">{account.email}</div>
                      <div className="text-sm text-gray-600">password123</div>
                    </div>
                    <button
                      onClick={() => handleQuickLogin(account.email)}
                      className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                    >
                      Quick Login
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">🔧 Developer Notes:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• All test accounts use password: <code className="bg-blue-100 px-1 rounded">password123</code></li>
              <li>• Premium accounts have unlimited access to all AI models</li>
              <li>• Free accounts have limited queries per model (5 per day)</li>
              <li>• Test accounts are recreated on each deployment</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setView('login')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Manual Login
            </button>
            <button
              onClick={() => setView('signup')}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              Create New Account
            </button>
            <button
              onClick={() => setView('home')}
              className="px-6 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}