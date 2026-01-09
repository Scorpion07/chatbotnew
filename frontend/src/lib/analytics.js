// Google Analytics helper functions

const MEASUREMENT_ID = import.meta.env?.VITE_GA_MEASUREMENT_ID;
const isProd = import.meta.env?.MODE === 'production';
let gtagInitialized = false;

/**
 * Ensure gtag.js is loaded and configured.
 * Returns true when a measurement ID is present and the gtag stub is ready.
 */
export const initAnalytics = () => {
  if (typeof window === 'undefined') return false;
  if (!MEASUREMENT_ID) {
    if (!isProd) {
      console.warn('GA measurement ID (VITE_GA_MEASUREMENT_ID) is missing; analytics disabled.');
    }
    return false;
  }

  if (window.gtag && gtagInitialized) return true;

  // Create dataLayer and gtag stub before loading the script
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);

  // Inject gtag script once
  if (!gtagInitialized) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.onload = () => { gtagInitialized = true; };
    script.onerror = () => { gtagInitialized = false; };
    document.head.appendChild(script);
    gtagInitialized = true;
  }

  return true;
};

/**
 * Track custom events in Google Analytics
 * @param {string} eventName - Name of the event
 * @param {object} parameters - Additional parameters for the event
 */
export const trackEvent = (eventName, parameters = {}) => {
  if (!initAnalytics()) return;
  window.gtag('event', eventName, parameters);
};

/**
 * Track page views
 * @param {string} pagePath - Path of the page
 * @param {string} pageTitle - Title of the page
 */
export const trackPageView = (pagePath, pageTitle) => {
  if (!initAnalytics()) return;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle
  });
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
