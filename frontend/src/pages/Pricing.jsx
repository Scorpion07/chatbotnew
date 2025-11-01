
import React, { useState } from 'react';

export default function Pricing({ setView }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: 'Free',
      description: 'Perfect for trying out TalkSphere AI',
      price: { monthly: 0, annual: 0 },
      features: [
        '50 messages per month',
        'Access to GPT-3.5',
        'Basic support',
        'Message history (7 days)',
        'Standard response time',
      ],
      limitations: [
        'No file uploads',
        'No priority support',
        'Limited models'
      ],
      cta: 'Get Started',
      popular: false,
      color: 'gray'
    },
    {
      name: 'Pro',
      description: 'For professionals and power users',
      price: { monthly: 19, annual: 15 },
      features: [
        'Unlimited messages',
        'Access to all AI models',
        'GPT-4, Claude, Gemini, Llama',
        'Priority support',
        'Message history (unlimited)',
        'File upload support',
        'Advanced features',
        'API access',
      ],
      limitations: [],
      cta: 'Start Free Trial',
      popular: true,
      color: 'indigo'
    },
    {
      name: 'Team',
      description: 'For teams and organizations',
      price: { monthly: 49, annual: 39 },
      features: [
        'Everything in Pro',
        'Up to 10 team members',
        'Shared conversation history',
        'Team management dashboard',
        'Custom AI model fine-tuning',
        'Dedicated account manager',
        'Advanced analytics',
        'SSO & Security features',
        'Custom integrations',
      ],
      limitations: [],
      cta: 'Contact Sales',
      popular: false,
      color: 'purple'
    },
    {
      name: 'Enterprise',
      description: 'For large organizations',
      price: { monthly: 'Custom', annual: 'Custom' },
      features: [
        'Everything in Team',
        'Unlimited team members',
        'On-premise deployment option',
        'Custom AI model training',
        'SLA guarantee',
        '24/7 premium support',
        'Advanced security & compliance',
        'Custom contracts',
        'Dedicated infrastructure',
      ],
      limitations: [],
      cta: 'Contact Sales',
      popular: false,
      color: 'gradient'
    }
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-20'>
      {/* Header */}
      <div className='max-w-7xl mx-auto px-6 text-center mb-16'>
        <div className='inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full text-sm font-medium text-indigo-700 mb-6 border border-indigo-200'>
          <span className='w-2 h-2 bg-indigo-500 rounded-full animate-pulse'></span>
          Simple, Transparent Pricing
        </div>
        <h1 className='text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent'>
          Choose Your Plan
        </h1>
        <p className='text-xl text-gray-600 mb-10 max-w-3xl mx-auto'>
          Start free, upgrade when you need more. All plans include access to our cutting-edge AI models.
        </p>

        {/* Billing Toggle */}
        <div className='inline-flex items-center bg-white rounded-full p-1 shadow-lg border border-gray-200'>
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className='ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full'>Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className='max-w-7xl mx-auto px-6'>
        <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'>
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-2xl shadow-xl border-2 transition-all hover:scale-105 ${
                plan.popular
                  ? 'border-indigo-600 shadow-2xl shadow-indigo-200'
                  : 'border-gray-200 hover:border-indigo-300'
              }`}
            >
              {plan.popular && (
                <div className='absolute -top-4 left-1/2 transform -translate-x-1/2'>
                  <div className='bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg'>
                    Most Popular
                  </div>
                </div>
              )}

              <div className='p-8'>
                {/* Plan Header */}
                <div className='mb-6'>
                  <h3 className='text-2xl font-bold text-gray-900 mb-2'>{plan.name}</h3>
                  <p className='text-gray-600 text-sm'>{plan.description}</p>
                </div>

                {/* Price */}
                <div className='mb-6'>
                  <div className='flex items-baseline'>
                    {typeof plan.price[billingCycle] === 'number' ? (
                      <>
                        <span className='text-5xl font-bold text-gray-900'>
                          ${plan.price[billingCycle]}
                        </span>
                        <span className='text-gray-600 ml-2'>
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </>
                    ) : (
                      <span className='text-4xl font-bold text-gray-900'>
                        {plan.price[billingCycle]}
                      </span>
                    )}
                  </div>
                  {billingCycle === 'annual' && typeof plan.price.annual === 'number' && plan.price.annual > 0 && (
                    <p className='text-sm text-gray-500 mt-1'>
                      ${plan.price.annual * 12} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => setView('chat')}
                  className={`w-full py-3 rounded-xl font-semibold mb-6 transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>

                {/* Features List */}
                <div className='space-y-3'>
                  <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                    What's included:
                  </p>
                  {plan.features.map((feature, i) => (
                    <div key={i} className='flex items-start gap-3'>
                      <svg
                        className='w-5 h-5 text-green-500 flex-shrink-0 mt-0.5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      <span className='text-gray-700 text-sm'>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className='max-w-4xl mx-auto px-6 mt-24'>
        <h2 className='text-3xl font-bold text-center mb-12'>Frequently Asked Questions</h2>
        <div className='space-y-6'>
          {[
            {
              question: 'Can I change plans later?',
              answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.'
            },
            {
              question: 'What payment methods do you accept?',
              answer: 'We accept all major credit cards, PayPal, and wire transfers for enterprise customers.'
            },
            {
              question: 'Is there a free trial?',
              answer: 'Yes! Pro and Team plans come with a 14-day free trial. No credit card required.'
            },
            {
              question: 'What happens when I hit my message limit?',
              answer: 'On the Free plan, you\'ll need to wait until next month or upgrade. Paid plans have unlimited messages.'
            },
            {
              question: 'Can I cancel anytime?',
              answer: 'Absolutely! You can cancel your subscription at any time. No long-term contracts.'
            },
            {
              question: 'Do you offer student or nonprofit discounts?',
              answer: 'Yes! We offer 50% discounts for students and nonprofit organizations. Contact us for details.'
            }
          ].map((faq, i) => (
            <div key={i} className='bg-white rounded-xl p-6 shadow-sm border border-gray-200'>
              <h3 className='font-semibold text-lg text-gray-900 mb-2'>{faq.question}</h3>
              <p className='text-gray-600'>{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className='max-w-7xl mx-auto px-6 mt-24'>
        <h2 className='text-3xl font-bold text-center mb-12'>Compare Plans</h2>
        <div className='bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead className='bg-gradient-to-r from-gray-50 to-gray-100'>
                <tr>
                  <th className='px-6 py-4 text-left text-sm font-semibold text-gray-900'>Feature</th>
                  <th className='px-6 py-4 text-center text-sm font-semibold text-gray-900'>Free</th>
                  <th className='px-6 py-4 text-center text-sm font-semibold text-indigo-600'>Pro</th>
                  <th className='px-6 py-4 text-center text-sm font-semibold text-gray-900'>Team</th>
                  <th className='px-6 py-4 text-center text-sm font-semibold text-gray-900'>Enterprise</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200'>
                {[
                  { feature: 'Messages per month', free: '50', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
                  { feature: 'AI Models', free: 'GPT-3.5', pro: 'All models', team: 'All models', enterprise: 'All + Custom' },
                  { feature: 'Message history', free: '7 days', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
                  { feature: 'File uploads', free: '✗', pro: '✓', team: '✓', enterprise: '✓' },
                  { feature: 'API access', free: '✗', pro: '✓', team: '✓', enterprise: '✓' },
                  { feature: 'Team members', free: '1', pro: '1', team: '10', enterprise: 'Unlimited' },
                  { feature: 'Priority support', free: '✗', pro: '✓', team: '✓', enterprise: '24/7' },
                  { feature: 'Custom training', free: '✗', pro: '✗', team: '✓', enterprise: '✓' },
                  { feature: 'SLA guarantee', free: '✗', pro: '✗', team: '✗', enterprise: '✓' },
                ].map((row, i) => (
                  <tr key={i} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 text-sm text-gray-900'>{row.feature}</td>
                    <td className='px-6 py-4 text-sm text-gray-600 text-center'>{row.free}</td>
                    <td className='px-6 py-4 text-sm text-gray-600 text-center font-medium'>{row.pro}</td>
                    <td className='px-6 py-4 text-sm text-gray-600 text-center'>{row.team}</td>
                    <td className='px-6 py-4 text-sm text-gray-600 text-center'>{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className='max-w-4xl mx-auto px-6 mt-24 text-center'>
        <div className='bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 shadow-2xl'>
          <h2 className='text-4xl font-bold text-white mb-4'>Still have questions?</h2>
          <p className='text-xl text-indigo-100 mb-8'>
            Our team is here to help you find the perfect plan
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            <button
              onClick={() => setView('chat')}
              className='px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl'
            >
              Start Free Trial
            </button>
            <button className='px-8 py-4 bg-indigo-700 text-white rounded-xl font-semibold hover:bg-indigo-800 transition-all border-2 border-indigo-400'>
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

