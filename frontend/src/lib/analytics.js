// Google Analytics helper functions

/**
 * Track custom events in Google Analytics
 * @param {string} eventName - Name of the event
 * @param {object} parameters - Additional parameters for the event
 */
export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

/**
 * Track page views
 * @param {string} pagePath - Path of the page
 * @param {string} pageTitle - Title of the page
 */
export const trackPageView = (pagePath, pageTitle) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle
    });
  }
};

/**
 * Track user signup
 * @param {string} method - Signup method (email, google, etc.)
 */
export const trackSignup = (method) => {
  trackEvent('sign_up', { method });
};

/**
 * Track user login
 * @param {string} method - Login method (email, google, etc.)
 */
export const trackLogin = (method) => {
  trackEvent('login', { method });
};

/**
 * Track chat message sent
 * @param {string} model - AI model used
 * @param {boolean} isPremium - Whether user is premium
 */
export const trackChatMessage = (model, isPremium = false) => {
  trackEvent('chat_message', {
    model_name: model,
    user_type: isPremium ? 'premium' : 'free'
  });
};

/**
 * Track upgrade to premium
 * @param {string} plan - Plan type
 */
export const trackUpgrade = (plan) => {
  trackEvent('begin_checkout', {
    plan_name: plan,
    value: plan === 'pro' ? 19 : 0
  });
};

/**
 * Track premium purchase
 * @param {string} plan - Plan purchased
 */
export const trackPurchase = (plan, value) => {
  trackEvent('purchase', {
    plan_name: plan,
    value: value,
    currency: 'USD'
  });
};
