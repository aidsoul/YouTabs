/**
 * TabManager.js - YouTabs Extension
 * Manages browser tabs: loading, activation, closing, creating, and bulk operations
 * 
 * This module is designed to work as a standalone manager that can be used by YouTabsCore
 * or operate independently for simpler tab management tasks.
 */

class TabManager {
  /**
   * @param {Object} options - Configuration options
   * @param {boolean} options.shouldCloseWindow - Whether to close window after certain operations
   * @param {Function} options.onTabsLoaded - Callback when tabs are loaded
   * @param {Function} options.onTabActivated - Callback when a tab is activated
   * @param {Function} options.onTabClosed - Callback when a tab is closed
   * @param {Function} options.onTabCreated - Callback when a tab is created
   * @param {Function} options.onError - Callback for errors
   */
  constructor(options = {}) {
    this.options = {
      shouldCloseWindow: false,
      ...options
    };
    
    // State
    this.tabs = [];
    this.activeTabId = null;
    
    // Event listeners storage
    this._listeners = new Map();
    
  }

  // ==================== Event System ====================

  /**
   * Subscribe to tab events
   * @param {string} event - Event name: 'tabsLoaded', 'tabActivated', 'tabClosed', 'tabCreated', 'tabUpdated', 'error'
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback); // Return unsubscribe function
  }

  /**
   * Unsubscribe from tab events
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this._listeners.has(event)) return;
    const callbacks = this._listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all subscribers
   * @private
   */
  _emit(event, data) {
    if (!this._listeners.has(event)) return;
    this._listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in TabManager ${event} handler:`, error);
      }
    });
  }

  // ==================== Tab Loading & Queries ====================

  /**
   * Load all tabs from the current window
   * @returns {Promise<Array>} Array of tab objects
   */
  async loadTabs() {
    try {
      const currentWindow = await browser.windows.getCurrent();
      this.tabs = await browser.tabs.query({
        windowId: currentWindow.id,
        windowType: 'normal'
      });
      this.activeTabId = this.tabs.find(tab => tab.active)?.id || null;
      this._emit('tabsLoaded', { tabs: this.tabs, activeTabId: this.activeTabId });
      return this.tabs;
    } catch (error) {
      console.error('TabManager: Error loading tabs:', error);
      this._emit('error', { action: 'loadTabs', error });
      return [];
    }
  }

  /**
   * Get the currently cached tabs
   * @returns {Array} Array of tab objects
   */
  getTabs() {
    return this.tabs;
  }

  /**
   * Get the active tab ID
   * @returns {number|null} Active tab ID
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Get the active tab object
   * @returns {Object|undefined} Active tab object
   */
  getActiveTab() {
    return this.tabs.find(tab => tab.id === this.activeTabId);
  }

  /**
   * Get a specific tab by ID
   * @param {number} tabId - Tab ID
   * @returns {Object|undefined} Tab object or undefined
   */
  getTabById(tabId) {
    return this.tabs.find(tab => tab.id === Number(tabId));
  }

  /**
   * Get a tab by URL
   * @param {string} url - Tab URL
   * @returns {Object|undefined} Tab object or undefined
   */
  getTabByUrl(url) {
    return this.tabs.find(tab => tab.url === url);
  }

  /**
   * Query tabs with filters
   * @param {Object} queryInfo - Query parameters (same as browser.tabs.query)
   * @returns {Promise<Array>} Matching tabs
   */
  async queryTabs(queryInfo = {}) {
    try {
      return await browser.tabs.query(queryInfo);
    } catch (error) {
      console.error('TabManager: Error querying tabs:', error);
      return [];
    }
  }

  /**
   * Get tab count
   * @returns {number} Number of cached tabs
   */
  getTabCount() {
    return this.tabs.length;
  }

  // ==================== Tab Activation ====================

  /**
   * Activate a tab by ID and optionally focus its window
   * @param {number} tabId - Tab ID to activate
   * @param {Object} options - Options
   * @param {boolean} options.focusWindow - Whether to focus the window (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async activateTab(tabId, options = {}) {
    const { focusWindow = true } = options;
    
    try {
      const numericTabId = Number(tabId);
      const tab = await browser.tabs.update(numericTabId, { active: true });
      
      if (focusWindow && tab.windowId) {
        await browser.windows.update(tab.windowId, { focused: true });
      }
      
      this.activeTabId = numericTabId;
      this._emit('tabActivated', { tabId: numericTabId, tab });
      return true;
    } catch (error) {
      console.error('TabManager: Error activating tab:', error);
      this._emit('error', { action: 'activateTab', tabId, error });
      return false;
    }
  }

  /**
   * Handle tab click - activate tab and optionally close window
   * @param {Event} e - Click event
   * @param {Object} tab - Tab object
   * @param {Object} options - Options
   * @param {boolean} options.closeOnSelect - Whether to close window after selection
   * @param {boolean} options.shouldCloseWindow - Whether window should be closed
   * @returns {Promise<boolean>} Success status
   */
  async handleTabClick(e, tab, options = {}) {
    // Don't activate if close button was clicked
    if (e.target.closest('.tab-close')) {
      return false;
    }
    
    const success = await this.activateTab(tab.id);
    
    if (success && options.closeOnSelect && options.shouldCloseWindow) {
      window.close();
    }
    
    return success;
  }

  // ==================== Tab Closing ====================

  /**
   * Close a tab by ID
   * @param {number} tabId - Tab ID to close
   * @returns {Promise<boolean>} Success status
   */
  async closeTab(tabId) {
    try {
      await browser.tabs.remove(Number(tabId));
      this._emit('tabClosed', { tabId: Number(tabId) });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing tab:', error);
      this._emit('error', { action: 'closeTab', tabId, error });
      return false;
    }
  }

  /**
   * Alias for closeTab - for compatibility with existing code
   * @param {number} tabId - Tab ID to close
   * @returns {Promise<boolean>} Success status
   */
  async closeTabById(tabId) {
    return this.closeTab(tabId);
  }

  /**
   * Handle tab close button click
   * @param {Event} e - Click event
   * @param {Object} tab - Tab object
   * @returns {Promise<boolean>} Success status
   */
  async handleTabClose(e, tab) {
    e.stopPropagation();
    return this.closeTab(tab.id);
  }

  /**
   * Close multiple tabs by ID
   * @param {Array<number>} tabIds - Array of tab IDs to close
   * @returns {Promise<boolean>} Success status
   */
  async closeTabs(tabIds) {
    if (!tabIds || tabIds.length === 0) return true;
    
    try {
      await browser.tabs.remove(tabIds);
      this._emit('tabsClosed', { tabIds, count: tabIds.length });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing tabs:', error);
      this._emit('error', { action: 'closeTabs', tabIds, error });
      return false;
    }
  }

  /**
   * Close all tabs in the current window
   * @returns {Promise<boolean>} Success status
   */
  async closeAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const tabIds = tabs.map(tab => tab.id);
      if (tabIds.length > 0) {
        await browser.tabs.remove(tabIds);
      }
      this._emit('tabsClosed', { action: 'closeAll', count: tabIds.length });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing all tabs:', error);
      this._emit('error', { action: 'closeAllTabs', error });
      return false;
    }
  }

  /**
   * Close all tabs except the active one
   * @returns {Promise<boolean>} Success status
   */
  async closeOtherTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const otherTabIds = tabs
          .filter(tab => tab.id !== activeTab.id)
          .map(tab => tab.id);
        if (otherTabIds.length > 0) {
          await browser.tabs.remove(otherTabIds);
        }
      }
      this._emit('tabsClosed', { action: 'closeOther', count: tabs.length - 1 });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing other tabs:', error);
      this._emit('error', { action: 'closeOtherTabs', error });
      return false;
    }
  }

  /**
   * Close tabs to the left of the active tab (excluding pinned)
   * @returns {Promise<boolean>} Success status
   */
  async closeTabsToLeft() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const tabsToClose = tabs
          .filter(tab => tab.index < activeTab.index && !tab.pinned)
          .map(tab => tab.id);
        if (tabsToClose.length > 0) {
          await browser.tabs.remove(tabsToClose);
        }
      }
      this._emit('tabsClosed', { action: 'closeToLeft' });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing tabs to left:', error);
      this._emit('error', { action: 'closeTabsToLeft', error });
      return false;
    }
  }

  /**
   * Close tabs to the right of the active tab (excluding pinned)
   * @returns {Promise<boolean>} Success status
   */
  async closeTabsToRight() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const tabsToClose = tabs
          .filter(tab => tab.index > activeTab.index && !tab.pinned)
          .map(tab => tab.id);
        if (tabsToClose.length > 0) {
          await browser.tabs.remove(tabsToClose);
        }
      }
      this._emit('tabsClosed', { action: 'closeToRight' });
      return true;
    } catch (error) {
      console.error('TabManager: Error closing tabs to right:', error);
      this._emit('error', { action: 'closeTabsToRight', error });
      return false;
    }
  }

  // ==================== Tab Creation ====================

  /**
   * Create a new tab
   * @param {Object} options - Tab creation options
   * @param {string} options.url - URL to open
   * @param {boolean} options.active - Whether to activate the tab (default: true)
   * @param {number} options.index - Position index
   * @param {boolean} options.closeWindow - Whether to close current window after creation
   * @returns {Promise<Object|null>} Created tab or null
   */
  async createTab(options = {}) {
    try {
      const currentWindow = await browser.windows.getCurrent();
      const tabOptions = {
        windowId: currentWindow.id,
        active: options.active !== false
      };
      
      if (options.url) tabOptions.url = options.url;
      if (typeof options.index === 'number') tabOptions.index = options.index;
      
      const newTab = await browser.tabs.create(tabOptions);
      this._emit('tabCreated', { tab: newTab });
      
      if (options.closeWindow || this.options.shouldCloseWindow) {
        window.close();
      }
      
      return newTab;
    } catch (error) {
      console.error('TabManager: Error creating tab:', error);
      this._emit('error', { action: 'createTab', options, error });
      return null;
    }
  }

  /**
   * Create a new empty tab
   * @param {Object} options - Options
   * @param {boolean} options.closeWindow - Whether to close window after
   * @returns {Promise<Object|null>} Created tab or null
   */
  async createNewTab(options = {}) {
    return this.createTab({ active: true, ...options });
  }

  /**
   * Open settings page in a new tab
   * @param {Object} options - Options
   * @param {boolean} options.closeWindow - Whether to close current window
   * @returns {Promise<Object|null>} Created tab or null
   */
  async openSettings(options = {}) {
    return this.createTab({
      url: 'settings.html',
      active: true,
      closeWindow: options.closeWindow ?? this.options.shouldCloseWindow
    });
  }

  // ==================== Tab Reloading ====================

  /**
   * Reload a tab by ID
   * @param {number} tabId - Tab ID to reload
   * @returns {Promise<boolean>} Success status
   */
  async reloadTab(tabId) {
    try {
      await browser.tabs.reload(Number(tabId));
      this._emit('tabReloaded', { tabId: Number(tabId) });
      return true;
    } catch (error) {
      console.error('TabManager: Error reloading tab:', error);
      this._emit('error', { action: 'reloadTab', tabId, error });
      return false;
    }
  }

  /**
   * Refresh all non-pinned tabs
   * @returns {Promise<boolean>} Success status
   */
  async refreshAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      for (const tab of tabs) {
        if (!tab.pinned) {
          await browser.tabs.reload(tab.id);
        }
      }
      this._emit('tabsRefreshed', { count: tabs.filter(t => !t.pinned).length });
      return true;
    } catch (error) {
      console.error('TabManager: Error refreshing tabs:', error);
      this._emit('error', { action: 'refreshAllTabs', error });
      return false;
    }
  }

  // ==================== Tab Discarding ====================

  /**
   * Discard a tab (unload from memory, cannot discard active tab)
   * @param {number} tabId - Tab ID to discard
   * @returns {Promise<boolean>} Success status
   */
  async discardTab(tabId) {
    const numericTabId = Number(tabId);
    
    // Cannot discard the active tab
    if (numericTabId === this.activeTabId) {
      console.warn('TabManager: Cannot discard the active tab');
      return false;
    }
    
    try {
      await browser.tabs.discard(numericTabId);
      this._emit('tabDiscarded', { tabId: numericTabId });
      return true;
    } catch (error) {
      console.error('TabManager: Error discarding tab:', error);
      this._emit('error', { action: 'discardTab', tabId, error });
      return false;
    }
  }

  /**
   * Check if a tab is discarded
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if discarded
   */
  isTabDiscarded(tabId) {
    const tab = this.getTabById(tabId);
    return tab ? tab.discarded : false;
  }

  // ==================== Tab Muting ====================

  /**
   * Toggle mute status for a tab
   * @param {number|Object} tabOrId - Tab ID or tab object
   * @param {boolean} muted - Desired mute status (toggle if not provided)
   * @returns {Promise<boolean>} Success status
   */
  async toggleMute(tabOrId, muted) {
    try {
      const tabId = typeof tabOrId === 'object' ? tabOrId.id : tabOrId;
      const tab = typeof tabOrId === 'object' ? tabOrId : this.getTabById(tabId);
      
      if (!tab) return false;
      
      const newMutedState = muted !== undefined ? muted : !(tab.mutedInfo?.muted);
      await browser.tabs.update(Number(tabId), { muted: newMutedState });
      
      this._emit('tabMuteToggled', { tabId: Number(tabId), muted: newMutedState });
      return true;
    } catch (error) {
      console.error('TabManager: Error toggling mute:', error);
      this._emit('error', { action: 'toggleMute', tabId: tabOrId, error });
      return false;
    }
  }

  /**
   * Set mute status for a tab
   * @param {number} tabId - Tab ID
   * @param {boolean} muted - Mute status
   * @returns {Promise<boolean>} Success status
   */
  async setMuted(tabId, muted) {
    return this.toggleMute(tabId, muted);
  }

  /**
   * Check if a tab is muted
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if muted
   */
  isTabMuted(tabId) {
    const tab = this.getTabById(tabId);
    return tab ? tab.mutedInfo?.muted : false;
  }

  // ==================== Tab Pinning ====================

  /**
   * Toggle pin status for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Success status
   */
  async togglePin(tabId) {
    try {
      const tab = this.getTabById(tabId);
      if (!tab) return false;
      
      await browser.tabs.update(Number(tabId), { pinned: !tab.pinned });
      this._emit('tabPinToggled', { tabId: Number(tabId), pinned: !tab.pinned });
      return true;
    } catch (error) {
      console.error('TabManager: Error toggling pin:', error);
      this._emit('error', { action: 'togglePin', tabId, error });
      return false;
    }
  }

  /**
   * Set pin status for a tab
   * @param {number} tabId - Tab ID
   * @param {boolean} pinned - Pin status
   * @returns {Promise<boolean>} Success status
   */
  async setPinned(tabId, pinned) {
    try {
      await browser.tabs.update(Number(tabId), { pinned });
      this._emit('tabPinToggled', { tabId: Number(tabId), pinned });
      return true;
    } catch (error) {
      console.error('TabManager: Error setting pin:', error);
      return false;
    }
  }

  /**
   * Check if a tab is pinned
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if pinned
   */
  isTabPinned(tabId) {
    const tab = this.getTabById(tabId);
    return tab ? tab.pinned : false;
  }

  // ==================== Tab Duplication & Moving ====================

  /**
   * Duplicate a tab
   * @param {number} tabId - Tab ID to duplicate
   * @returns {Promise<Object|null>} Created tab or null
   */
  async duplicateTab(tabId) {
    try {
      const tab = this.getTabById(tabId);
      if (!tab) return null;
      
      const newTab = await this.createTab({
        url: tab.url,
        active: false,
        index: tab.index + 1
      });
      
      if (newTab) {
        this._emit('tabDuplicated', { originalTabId: Number(tabId), newTab });
      }
      return newTab;
    } catch (error) {
      console.error('TabManager: Error duplicating tab:', error);
      this._emit('error', { action: 'duplicateTab', tabId, error });
      return null;
    }
  }

  /**
   * Move a tab to a new position
   * @param {number} tabId - Tab ID to move
   * @param {number} index - New index position
   * @returns {Promise<boolean>} Success status
   */
  async moveTab(tabId, index) {
    try {
      const tab = this.getTabById(tabId);
      if (!tab) return false;
      
      await browser.tabs.move(Number(tabId), {
        windowId: tab.windowId,
        index: index
      });
      
      this._emit('tabMoved', { tabId: Number(tabId), index });
      return true;
    } catch (error) {
      console.error('TabManager: Error moving tab:', error);
      this._emit('error', { action: 'moveTab', tabId, index, error });
      return false;
    }
  }

  // ==================== Tab Filtering ====================

  /**
   * Get tabs filtered by domain
   * @param {string} domain - Domain to filter by
   * @returns {Array} Filtered tabs
   */
  getTabsByDomain(domain) {
    return this.tabs.filter(tab => {
      try {
        const url = new URL(tab.url);
        return url.hostname === domain;
      } catch {
        return false;
      }
    });
  }

  /**
   * Get unique domains from all tabs
   * @returns {Array} Array of domain strings
   */
  getUniqueDomains() {
    const domains = new Set();
    this.tabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        domains.add(url.hostname);
      } catch {
        // Invalid URL, skip
      }
    });
    return Array.from(domains).sort();
  }

  /**
   * Filter tabs by search query
   * @param {string} query - Search query
   * @param {Array} tabs - Tabs to filter (defaults to cached tabs)
   * @returns {Array} Filtered tabs
   */
  filterTabsByQuery(query, tabs = this.tabs) {
    if (!query || query.trim() === '') {
      return tabs;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    return tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      return title.includes(lowerQuery) || url.includes(lowerQuery);
    });
  }

  // ==================== Communication ====================

  /**
   * Send a message to a specific tab's content script
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<any>} Response from content script
   */
  async sendMessage(tabId, message) {
    try {
      return await browser.tabs.sendMessage(Number(tabId), message);
    } catch (error) {
      // Tab may not have content script loaded
      return null;
    }
  }

  /**
   * Execute script in a specific tab
   * @param {number} tabId - Tab ID
   * @param {Object} details - Script execution details
   * @returns {Promise<Array>} Injection results
   */
  async executeScript(tabId, details) {
    try {
      return await browser.tabs.executeScript(Number(tabId), details);
    } catch (error) {
      console.error('TabManager: Error executing script in tab:', error);
      return [];
    }
  }

  /**
   * Get a tab from the browser API (bypasses cache)
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object|null>} Tab object or null
   */
  async getTab(tabId) {
    try {
      return await browser.tabs.get(Number(tabId));
    } catch (error) {
      return null;
    }
  }

  // ==================== Utility ====================

  /**
   * Clear internal tab cache
   */
  clearCache() {
    this.tabs = [];
    this.activeTabId = null;
  }

  /**
   * Update options
   * @param {Object} options - New options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Destroy the manager - cleanup listeners
   */
  destroy() {
    this._listeners.clear();
    this.clearCache();
  }
}

// ==================== Exports ====================

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabManager;
}

// AMD
if (typeof define === 'function' && define.amd) {
  define([], function() {
    return TabManager;
  });
}

// Browser global
if (typeof window !== 'undefined') {
  window.TabManager = TabManager;
}