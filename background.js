/**
 * YouTabs Tabs Extension - Background Script
 * Handles extension lifecycle and background tasks
 */

// Constants for popup window dimensions
const POPUP_MAX_WIDTH = 450;
const POPUP_MARGIN = 50;

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
    const settingsManager = new SettingsManager();
    const settings = await settingsManager.getAll();
    return { success: true, settings };
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


// Context menu for adding selected text to indexing
const CONTEXT_MENU_ID = 'add-to-indexing';

// Create context menu on extension install
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Add to indexing',
    contexts: ['selection']
  });
});

console.log('YouTabs background script loaded');

// Handle messages from content scripts and sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle incremental index updates from content script (MutationObserver)
  if (message.action === 'incrementalIndexUpdate' && message.url && message.changes) {
    handleIncrementalIndexUpdate(message.url, message.changes).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Incremental index update error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle full page index update from content script (saves to IndexedDB)
  if (message.action === 'updatePageIndexInDB' && message.url && message.headings) {
    handleFullIndexUpdate(message.url, message.headings).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Full index update error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  // Handle adding selected text to index from content script
  if (message.action === 'addTextToIndex' && message.url && message.text) {
    handleAddTextToIndex(message.url, message.text).then(result => {
      sendResponse(result);
    }).catch(error => {
      console.error('Add text to index error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
});

// Handle incremental index updates from content script
async function handleIncrementalIndexUpdate(url, changes) {
  try {
    // Check if YouTabsDB is available
    if (!window.YouTabsDB || !window.YouTabsDB.isIndexedDBAvailable()) {
      console.error('handleIncrementalIndexUpdate: YouTabsDB is not available');
      return { success: false, error: 'Database not available' };
    }

    // Ensure database is opened
    await window.YouTabsDB.openDatabase();
    
    // Normalize URL for consistent matching
    const urlKey = getUrlKey(url);
    
    // Get the tab that sent the update - try both full URL and normalized URL
    // This handles pages with query strings where full URL may not match exactly
    let tabs = await browser.tabs.query({ url: url });
    if (!tabs || tabs.length === 0) {
      // Try with normalized URL (origin + pathname without trailing slash)
      const normalizedUrl = urlKey;
      tabs = await browser.tabs.query({ url: normalizedUrl });
    }
    if (!tabs || tabs.length === 0) {
      console.log('handleIncrementalIndexUpdate: No tab found for URL:', url, 'normalized:', urlKey);
      return { success: false, error: 'No tab found' };
    }
    const tabId = tabs[0].id;

    // Get current page headings from IndexedDB
    const pageIndexData = await window.YouTabsDB.getPagesIndexByUrl(urlKey);
    let pageHeadings = pageIndexData?.headings;

    // Validate pageHeadings is an array
    if (!Array.isArray(pageHeadings)) {
      pageHeadings = [];
    }

    // Create a map for quick lookup
    const headingsMap = new Map();
    pageHeadings.forEach(h => {
      const key = h.type + '-' + h.id;
      headingsMap.set(key, h);
    });

    // Apply changes
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    // Add new headings
    for (const heading of changes.added) {
      const key = heading.type + '-' + heading.id;
      if (!headingsMap.has(key)) {
        headingsMap.set(key, heading);
        addedCount++;
      }
    }

    // Modify existing headings
    for (const heading of changes.modified) {
      const key = heading.type + '-' + heading.id;
      if (headingsMap.has(key)) {
        headingsMap.set(key, heading);
        modifiedCount++;
      }
    }

    // Remove deleted headings
    for (const heading of changes.removed) {
      const key = heading.type + '-' + heading.id;
      if (headingsMap.has(key)) {
        headingsMap.delete(key);
        removedCount++;
      }
    }

    // Convert map back to array
    const updatedHeadings = Array.from(headingsMap.values());

    // Save updated headings to IndexedDB
    await window.YouTabsDB.savePageHeadingsByUrl(url, tabId, updatedHeadings, true);

    // Update in-memory cache if available
    if (window.YouTabsCore && window.YouTabsCore.pageHeadings) {
      window.YouTabsCore.pageHeadings[urlKey] = updatedHeadings;
    }

    console.log('Incremental index updated:', addedCount, 'added,', modifiedCount, 'modified,', removedCount, 'removed');
    return { 
      success: true, 
      added: addedCount, 
      modified: modifiedCount, 
      removed: removedCount,
      total: updatedHeadings.length
    };
  } catch (error) {
    console.error('handleIncrementalIndexUpdate error:', error);
    return { success: false, error: error.message };
  }
}

// Handle full page index update from content script (saves to IndexedDB)
async function handleFullIndexUpdate(url, headings) {
  try {
    // Check if YouTabsDB is available
    if (!window.YouTabsDB || !window.YouTabsDB.isIndexedDBAvailable()) {
      console.error('handleFullIndexUpdate: YouTabsDB is not available');
      return { success: false, error: 'Database not available' };
    }

    // Ensure database is opened
    await window.YouTabsDB.openDatabase();
    
    // Get URL key for indexing
    const urlKey = getUrlKey(url);
    
    // Get the tab that sent the update
    let tabs = await browser.tabs.query({ url: url });
    if (!tabs || tabs.length === 0) {
      const normalizedUrl = urlKey;
      tabs = await browser.tabs.query({ url: normalizedUrl });
    }
    
    let tabId = null;
    if (tabs && tabs.length > 0) {
      tabId = tabs[0].id;
    }
    
    // Save updated headings to IndexedDB
    await window.YouTabsDB.savePageHeadingsByUrl(url, tabId, headings);
    
    // Update in-memory cache if available
    if (window.YouTabsCore && window.YouTabsCore.pageHeadings) {
      window.YouTabsCore.pageHeadings[urlKey] = headings;
    }
    
    console.log('Full index updated:', headings.length, 'headings');
    return { 
      success: true, 
      count: headings.length
    };
  } catch (error) {
    console.error('handleFullIndexUpdate error:', error);
    return { success: false, error: error.message };
  }
}

// Handle adding selected text to index from content script
async function handleAddTextToIndex(url, text) {
  try {
    // Check if YouTabsDB is available
    if (!window.YouTabsDB || !window.YouTabsDB.isIndexedDBAvailable()) {
      console.error('handleAddTextToIndex: YouTabsDB is not available');
      return { success: false, error: 'Database not available' };
    }

    // Ensure database is opened
    await window.YouTabsDB.openDatabase();
    
    // Get URL key for indexing
    const urlKey = getUrlKey(url);
    
    // Get current page headings from IndexedDB
    const pageIndexData = await window.YouTabsDB.getPagesIndexByUrl(urlKey);
    let headings = pageIndexData?.headings;
    
    // Validate headings is an array
    if (!Array.isArray(headings)) {
      headings = [];
    }
    
    // Add the selected text as a custom heading
    const customHeading = {
      id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      text: text,
      level: 0, // 0 indicates custom indexed text
      isCustom: true
    };
    
    headings.push(customHeading);
    
    // Get the tab for this URL
    let tabs = await browser.tabs.query({ url: url });
    if (!tabs || tabs.length === 0) {
      const normalizedUrl = urlKey;
      tabs = await browser.tabs.query({ url: normalizedUrl });
    }
    
    let tabId = null;
    if (tabs && tabs.length > 0) {
      tabId = tabs[0].id;
    }
    
    // Save to IndexedDB
    await window.YouTabsDB.savePageHeadingsByUrl(url, tabId, headings);
    
    // Update in-memory cache if available
    if (window.YouTabsCore && window.YouTabsCore.pageHeadings) {
      window.YouTabsCore.pageHeadings[urlKey] = headings;
    }
    
    console.log('Added text to index:', text.substring(0, 50));
    return { success: true, message: 'Text added to indexing' };
  } catch (error) {
    console.error('handleAddTextToIndex error:', error);
    return { success: false, error: error.message };
  }
}

// Get URL key for indexing (normalizes URL)
function getUrlKey(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
  } catch (e) {
    console.log('getUrlKey: failed to parse URL:', url, e);
    return url;
  }
}
