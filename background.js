/**
 * YouTabs Tabs Extension - Background Script
 * Handles extension lifecycle and background tasks
 */

// Constants for popup window dimensions
const POPUP_MAX_WIDTH = 450;
const POPUP_MARGIN = 50;

// Store reference to the popup window
let popupWindowId = null;

// Handle toolbar button click to toggle sidebar
browser.action.onClicked.addListener(async () => {
  try {
    // Check if sidebar is currently open
    const isOpen = await browser.sidebarAction.isOpen({});
    
    if (isOpen) {
      // If open, close it
      await browser.sidebarAction.close();
    } else {
      // If closed, open it
      await browser.sidebarAction.open();
    }
  } catch (error) {
    console.error('Error toggling sidebar:', error);
  }
});

// Extension installation handler
browser.runtime.onInstalled.addListener((details) => {
  console.log('YouTabs extension installed:', details.reason);
  
  // Set default preferences if needed
  if (details.reason === 'install') {
    // First install - could set default settings here
  } else if (details.reason === 'update') {
    // Extension was updated - could migrate settings here
  }
});

// Extension startup handler
browser.runtime.onStartup.addListener(() => {
  console.log('YouTabs extension started');
});

// Handle messages from popup or other scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getTabs') {
    // Handle request to get tabs from background
    getAllTabs().then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'getActiveWindowTabs') {
    // Handle request to get tabs from current window
    getCurrentWindowTabs().then(sendResponse);
    return true;
  }
  
  if (message.type === 'groupTabs') {
    // Handle request to group tabs
    const groupedTabs = groupTabsByType(message.tabs, message.groupingType);
    sendResponse({ success: true, groups: groupedTabs });
    return true;
  }
  
  if (message.type === 'getSettings') {
    // Handle request to get settings
    getSettings().then(sendResponse);
    return true;
  }
});

// Helper function to get all tabs across all windows
async function getAllTabs() {
  try {
    const windows = await browser.windows.getAll({ populate: true });
    const allTabs = [];
    
    for (const window of windows) {
      if (window.tabs) {
        allTabs.push(...window.tabs);
      }
    }
    
    return { success: true, tabs: allTabs };
  } catch (error) {
    console.error('Error getting all tabs:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to get tabs from current window
async function getCurrentWindowTabs() {
  try {
    const currentWindow = await browser.windows.getCurrent();
    const tabs = await browser.tabs.query({
      windowId: currentWindow.id,
      windowType: 'normal'
    });
    
    return { success: true, tabs: tabs };
  } catch (error) {
    console.error('Error getting current window tabs:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to get settings
async function getSettings() {
  try {
    const stored = await browser.storage.local.get('settings');
    return { success: true, settings: stored.settings || {} };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { success: false, error: error.message, settings: {} };
  }
}

// Helper function to group tabs by type
function groupTabsByType(tabs, groupingType) {
  const groups = {};
  
  if (groupingType === 'domain') {
    tabs.forEach(tab => {
      let domain = 'Other';
      try {
        if (tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('chrome:') && !tab.url.startsWith('moz-extension:')) {
          const url = new URL(tab.url);
          domain = url.hostname;
        }
      } catch (e) {
        // Keep default domain
      }
      
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab);
    });
    
    // Sort groups alphabetically
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    return sortedGroups;
  } else if (groupingType === 'color') {
    // Color grouping logic - aligned with tabs-core.js
    groups['gray'] = [];
    
    tabs.forEach(tab => {
      let colorKey = 'gray';
      try {
        if (tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('chrome:') && !tab.url.startsWith('moz-extension:')) {
          const url = new URL(tab.url);
          const hostname = url.hostname.toLowerCase();
          
          if (hostname.includes('youtube') || hostname.includes('video')) {
            colorKey = 'red';
          } else if (hostname.includes('facebook') || hostname.includes('social')) {
            colorKey = 'blue';
          } else if (hostname.includes('twitter') || hostname.includes('x.com')) {
            colorKey = 'blue';
          } else if (hostname.includes('github') || hostname.includes('gitlab')) {
            colorKey = 'purple';
          } else if (hostname.includes('google') || hostname.includes('gmail')) {
            colorKey = 'green';
          } else if (hostname.includes('reddit')) {
            colorKey = 'orange';
          } else {
            const hash = hostname.split('').reduce((acc, char) => {
              return ((acc << 5) - acc) + char.charCodeAt(0);
            }, 0);
            const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
            colorKey = colors[Math.abs(hash) % colors.length];
          }
        }
      } catch (e) {
        // Keep default gray
      }
      
      if (!groups[colorKey]) {
        groups[colorKey] = [];
      }
      groups[colorKey].push(tab);
    });
    
    // Sort by color order
    const sortedGroups = {};
    const colorOrder = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
    colorOrder.forEach(color => {
      if (groups[color] && groups[color].length > 0) {
        sortedGroups[color] = groups[color];
      }
    });
    
    return sortedGroups;
  } else if (groupingType === 'time') {
    const now = Date.now();
    const hourMs = 3600000;
    
    const timeGroups = {
      'today': [],
      'yesterday': [],
      'thisWeek': [],
      'older': []
    };
    
    tabs.forEach(tab => {
      const tabTime = (tab.lastAccessed || tab.created) * 1000;
      const hoursAgo = (now - tabTime) / hourMs;
      
      let groupKey;
      if (hoursAgo <= 24) {
        groupKey = 'today';
      } else if (hoursAgo <= 48) {
        groupKey = 'yesterday';
      } else if (hoursAgo <= 168) {
        groupKey = 'thisWeek';
      } else {
        groupKey = 'older';
      }
      
      timeGroups[groupKey].push(tab);
    });
    
    // Sort by time order
    const sortedGroups = {};
    const timeOrder = ['today', 'yesterday', 'thisWeek', 'older'];
    timeOrder.forEach(time => {
      if (timeGroups[time] && timeGroups[time].length > 0) {
        sortedGroups[time] = timeGroups[time];
      }
    });
    
    return sortedGroups;
  }
  
  return groups;
}

// Tab event listeners for background tracking
browser.tabs.onCreated.addListener((tab) => {
  // Could track new tab creation here
  console.log('Tab created:', tab.id);
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Could track tab removal here
  console.log('Tab removed:', tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Could track tab updates here (title, url, etc.)
  if (changeInfo.title || changeInfo.url) {
    console.log('Tab updated:', tabId, changeInfo);
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  // Could track active tab changes here
  console.log('Tab activated:', activeInfo.tabId);
});

// Window event listeners
browser.windows.onCreated.addListener((window) => {
  console.log('Window created:', window.id);
});

browser.windows.onRemoved.addListener((windowId) => {
  console.log('Window removed:', windowId);
});

// Listen for tab moves (for reordering across windows)
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  console.log('Tab moved:', tabId, moveInfo);
});

// Listen for storage changes to broadcast to all scripts
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    // Broadcast settings change to all extension pages
    browser.runtime.sendMessage({
      type: 'settingsChanged',
      settings: changes.settings.newValue
    }).catch(() => {
      // Ignore errors for pages that don't have listeners
    });
  }
});

// Helper function to get icon URL with proper fallback
function getIconUrl() {
  return browser.runtime.getManifest().icons?.['48'];
}

// Helper function to show notification with error handling
function showNotification(message) {
  try {
    browser.notifications.create({
      type: 'basic',
      iconUrl: getIconUrl(),
      title: 'YouTabs',
      message: message
    });
  } catch (error) {
    console.warn('Notification API not available:', error);
  }
}

// Helper function to update page index and show notification
async function updatePageIndex(tab) {
  if (!tab || !tab.id) {
    showNotification('Invalid tab selected');
    return { success: false, error: 'Invalid tab' };
  }

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'updateIndex',
      url: tab.url
    });

    if (response && response.success) {
      console.log('Index updated:', response.count, 'items indexed');
      showNotification('Index updated: ' + response.count + ' items indexed');
    } else {
      console.error('Failed to update index:', response?.error);
      showNotification('Failed to update index: ' + (response?.error || 'Unknown error'));
    }

    return response;
  } catch (error) {
    console.error('Error updating index:', error);
    showNotification('Failed to update index. Make sure the page is fully loaded.');
    return { success: false, error: error.message };
  }
}

// Context menu for adding selected text to indexing
const CONTEXT_MENU_ID = 'add-to-indexing';
const UPDATE_INDEX_MENU_ID = 'update-index';

// Create context menu on extension install
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Add to indexing',
    contexts: ['selection']
  });
  
  browser.contextMenus.create({
    id: UPDATE_INDEX_MENU_ID,
    title: 'Update index',
    contexts: ['tab']
  });
});

// Handle context menu click
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (selectedText && tab && tab.id) {
      try {
        // Send message to content script to add text to indexing
        const response = await browser.tabs.sendMessage(tab.id, {
          action: 'addToIndexing',
          text: selectedText,
          url: tab.url
        });
        
        if (response && response.success) {
          console.log('Added to indexing:', selectedText.substring(0, 50) + '...');
        } else {
          console.error('Failed to add to indexing:', response?.error);
          // Show notification to user
          browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getManifest().icons?.['48'] || '',
            title: 'YouTabs',
            message: 'Failed to add text to indexing: ' + (response?.error || 'Unknown error')
          });
        }
      } catch (error) {
        console.error('Error adding to indexing:', error);
        // Show notification to user
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getManifest().icons?.['48'] || '',
          title: 'YouTabs',
          message: 'Failed to add text to indexing. Make sure the page is fully loaded.'
        });
      }
    }
  }
  
  // Handle Update index context menu click
  if (info.menuItemId === UPDATE_INDEX_MENU_ID && tab && tab.id) {
    await updatePageIndex(tab);
  }
});

console.log('YouTabs background script loaded');

// Handle messages from content scripts and sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updatePageIndex' && message.tabId) {
    browser.tabs.get(message.tabId).then(tab => {
      updatePageIndex(tab).then(sendResponse);
    }).catch(error => {
      showNotification('Invalid tab selected');
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
});
