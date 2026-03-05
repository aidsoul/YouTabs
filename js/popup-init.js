// Initialize popup when the page loads
function initPopup() {
  console.log('popup-init.js: initPopup called');
  
  // Check if the popup is already initialized
  if (typeof YouTabsPopup !== 'undefined') {
    console.log('popup-init.js: Popup already initialized');
    return;
  }
  
  // Initialize the popup
  const popup = new YouTabsPopup();
  window.popup = popup;
  
  console.log('popup-init.js: Popup initialized');
}

// Handle both cases: DOM not ready vs already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  // DOM is already loaded, initialize immediately
  initPopup();
}