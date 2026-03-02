// Initialize sidebar when the page loads
function initSidebar() {
  console.log('sidebar-init.js: initSidebar called');
  
  // Check if the sidebar is already initialized
  if (typeof YouTabsSidebar !== 'undefined') {
    console.log('sidebar-init.js: Sidebar already initialized');
    return;
  }
  
  // Initialize the sidebar
  const sidebar = new YouTabsSidebar();
  window.sidebar = sidebar;
  
  console.log('sidebar-init.js: Sidebar initialized');
}

// Handle both cases: DOM not ready vs already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  // DOM is already loaded, initialize immediately
  initSidebar();
}