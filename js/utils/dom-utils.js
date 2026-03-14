/**
 * DOM Utils - YouTabs Extension
 * Shared DOM utilities for safe HTML rendering and element creation
 */

/**
 * Escape HTML special characters
 * Uses textContent to safely escape HTML - prevents XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for innerHTML
 */
const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Create a text node safely (prevents XSS)
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
const createSafeText = (text) => {
  return document.createTextNode(text || '');
};

/**
 * Create an element with text content safely
 * @param {string} tagName - HTML tag name
 * @param {string} text - Text content
 * @param {Object} attributes - Element attributes
 * @returns {HTMLElement} Created element
 */
const createElementWithText = (tagName, text, attributes = {}) => {
  const element = document.createElement(tagName);
  element.textContent = text || '';
  
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key.startsWith('data')) {
      element.setAttribute(key, value);
    } else {
      element.setAttribute(key, value);
    }
  }
  
  return element;
};

/**
 * Set element HTML safely using textContent
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML string (will be escaped)
 */
const setSafeHTML = (element, html) => {
  if (!element) return;
  element.textContent = html;
};

/**
 * Create an option element for select dropdowns
 * @param {string} value - Option value
 * @param {string} text - Display text
 * @param {boolean} selected - Whether option is selected
 * @returns {HTMLOptionElement} Created option element
 */
const createOptionElement = (value, text, selected = false) => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  option.selected = selected;
  return option;
};

/**
 * Clear all child elements from an element
 * @param {HTMLElement} element - Element to clear
 */
const clearElement = (element) => {
  if (!element) return;
  element.textContent = '';
};

/**
 * Check if a string contains HTML tags
 * @param {string} str - String to check
 * @returns {boolean} True if string contains HTML
 */
const containsHTML = (str) => {
  if (!str) return false;
  return /<[^>]*>/.test(str);
};

// Export to global scope for browser extension
window.DOMUtils = {
  escapeHtml,
  createSafeText,
  createElementWithText,
  setSafeHTML,
  createOptionElement,
  clearElement,
  containsHTML
};
