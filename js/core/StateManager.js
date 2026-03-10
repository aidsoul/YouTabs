/**
 * StateManager.js - YouTabs Extension
 * Centralized state management with EventEmitter pattern
 * 
 * This module provides a unified state management solution that:
 * - Acts as a single source of truth for application state
 * - Uses EventEmitter pattern for reactive updates
 * - Manages state from TabManager, GroupManager, and SearchEngine
 * - Provides debugging and state persistence capabilities
 */

class StateManager {
  /**
   * Singleton instance
   * @type {StateManager|null}
   * @static
   */
  static _instance = null;

  /**
   * Get singleton instance
   * @returns {StateManager} StateManager instance
   */
  static getInstance() {
    if (!StateManager._instance) {
      StateManager._instance = new StateManager();
    }
    return StateManager._instance;
  }

  /**
   * Create a new StateManager (use getInstance for singleton)
   */
  constructor() {
    if (StateManager._instance) {
      return StateManager._instance;
    }

    // Centralized state object
    this._state = {
      // Tab state
      tabs: [],
      activeTabId: null,
      
      // Group state
      customGroups: [],
      groupTabMetadata: {},
      
      // Search state
      searchQuery: '',
      filteredTabs: [],
      headingSearchResults: [],
      isSearching: false,
      
      // UI state
      selectedGroupId: null,
      selectedTabIds: [],
      sidebarCollapsed: false,
      currentView: 'tabs', // 'tabs', 'groups', 'search'
      
      // Settings
      settings: {},
      
      // Loading states
      isLoading: {
        tabs: false,
        groups: false,
        settings: false
      }
    };

    // Event listeners storage (EventEmitter pattern)
    this._listeners = new Map();
    
    // State change history for debugging (limited to last 50 changes)
    this._history = [];
    this._maxHistorySize = 50;
    
    // Namespaces for manager-specific event prefixes
    this._namespaces = ['tabs', 'groups', 'search', 'ui', 'settings'];
    
    // Middleware functions for state changes
    this._middleware = [];
    
    // Initialize listener for all events (wildcard)
    this._listeners.set('*', []);
  }

  // ==================== EventEmitter Methods ====================

  /**
   * Subscribe to state changes
   * @param {string} event - Event name (e.g., 'tabs', 'groups', 'search', 'ui', or '*' for all)
   * @param {Function} callback - Event handler receiving (data, eventName, state)
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event only once
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe from state changes
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
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  _emit(event, data = {}) {
    // Add timestamp to event data
    const eventData = {
      ...data,
      timestamp: Date.now()
    };

    // Emit to wildcard listeners first
    if (this._listeners.has('*')) {
      this._listeners.get('*').forEach(callback => {
        try {
          callback(eventData, event, this._state);
        } catch (error) {
          console.error(`StateManager: Error in wildcard handler for ${event}:`, error);
        }
      });
    }

    // Emit to specific event listeners
    if (this._listeners.has(event)) {
      this._listeners.get(event).forEach(callback => {
        try {
          callback(eventData, event, this._state);
        } catch (error) {
          console.error(`StateManager: Error in ${event} handler:`, error);
        }
      });
    }

    // Record in history for debugging
    this._recordHistory(event, eventData);
  }

  // ==================== State Access Methods ====================

  /**
   * Get current state or a specific state slice
   * @param {string} [slice] - Optional state slice name ('tabs', 'groups', 'search', 'ui', 'settings')
   * @returns {*} Current state or state slice
   */
  getState(slice = null) {
    if (slice) {
      return this._state[slice] ?? null;
    }
    return { ...this._state };
  }

  /**
   * Get a specific value from state
   * @param {string} key - Dot-notation key (e.g., 'tabs.activeTabId')
   * @returns {*} State value
   */
  get(key) {
    const keys = key.split('.');
    let value = this._state;
    for (const k of keys) {
      if (value === undefined || value === null) return undefined;
      value = value[k];
    }
    return value;
  }

  // ==================== State Update Methods ====================

  /**
   * Set state with optional middleware execution
   * @private
   * @param {string} slice - State slice name
   * @param {string} key - Key within the slice
   * @param {*} value - New value
   * @param {boolean} emit - Whether to emit change event
   */
  _setState(slice, key, value, emit = true) {
    const oldValue = this._state[slice]?.[key];
    
    // Skip if value hasn't changed
    if (oldValue === value) return;

    // Execute middleware
    for (const middleware of this._middleware) {
      const shouldContinue = middleware({
        slice,
        key,
        oldValue,
        newValue: value,
        state: this._state
      });
      if (shouldContinue === false) return;
    }

    // Update state
    if (!this._state[slice]) {
      this._state[slice] = {};
    }
    this._state[slice][key] = value;

    // Emit change event
    if (emit) {
      this._emit(slice, {
        key,
        oldValue,
        newValue: value,
        fullState: this._state[slice]
      });
    }
  }

  /**
   * Update multiple state values at once
   * @param {Object} updates - Object with state updates
   * @param {string} [slice='ui'] - State slice to update
   */
  setState(updates, slice = 'ui') {
    for (const [key, value] of Object.entries(updates)) {
      this._setState(slice, key, value, false);
    }
    this._emit(slice, { 
      changes: updates, 
      fullState: this._state[slice] 
    });
  }

  /**
   * Update state and emit single event
   * @param {string} key - State key (dot-notation supported)
   * @param {*} value - New value
   */
  set(key, value) {
    const [slice, ...rest] = key.split('.');
    if (rest.length === 0) {
      // Direct slice update
      this._setState(slice, null, value);
    } else {
      // Nested key update
      const actualKey = rest.join('.');
      this._setState(slice, actualKey, value);
    }
  }

  // ==================== Tab State Methods ====================

  /**
   * Update tabs state
   * @param {Array} tabs - Array of tab objects
   * @param {number} [activeTabId] - Active tab ID
   */
  setTabs(tabs, activeTabId = null) {
    this._setState('tabs', 'tabs', tabs);
    if (activeTabId !== null) {
      this._setState('tabs', 'activeTabId', activeTabId);
    }
  }

  /**
   * Update active tab
   * @param {number} tabId - Active tab ID
   */
  setActiveTab(tabId) {
    this._setState('tabs', 'activeTabId', tabId);
  }

  /**
   * Add a tab to state
   * @param {Object} tab - Tab object
   */
  addTab(tab) {
    const tabs = [...this._state.tabs, tab];
    this._setState('tabs', 'tabs', tabs);
  }

  /**
   * Remove a tab from state
   * @param {number} tabId - Tab ID to remove
   */
  removeTab(tabId) {
    const tabs = this._state.tabs.filter(t => t.id !== tabId);
    this._setState('tabs', 'tabs', tabs);
  }

  /**
   * Update a tab in state
   * @param {number} tabId - Tab ID
   * @param {Object} updates - Tab updates
   */
  updateTab(tabId, updates) {
    const tabs = this._state.tabs.map(t => 
      t.id === tabId ? { ...t, ...updates } : t
    );
    this._setState('tabs', 'tabs', tabs);
  }

  // ==================== Group State Methods ====================

  /**
   * Update groups state
   * @param {Array} groups - Array of group objects
   * @param {Object} [metadata] - Group tab metadata
   */
  setGroups(groups, metadata = null) {
    this._setState('groups', 'customGroups', groups);
    if (metadata !== null) {
      this._setState('groups', 'groupTabMetadata', metadata);
    }
  }

  /**
   * Add a group to state
   * @param {Object} group - Group object
   */
  addGroup(group) {
    const groups = [...this._state.customGroups, group];
    this._setState('groups', 'customGroups', groups);
  }

  /**
   * Remove a group from state
   * @param {string} groupId - Group ID
   */
  removeGroup(groupId) {
    const groups = this._state.customGroups.filter(g => g.id !== groupId);
    this._setState('groups', 'customGroups', groups);
  }

  /**
   * Update a group in state
   * @param {string} groupId - Group ID
   * @param {Object} updates - Group updates
   */
  updateGroup(groupId, updates) {
    const groups = this._state.customGroups.map(g => 
      g.id === groupId ? { ...g, ...updates } : g
    );
    this._setState('groups', 'customGroups', groups);
  }

  /**
   * Update group tab metadata
   * @param {Object} metadata - Metadata object
   */
  setGroupMetadata(metadata) {
    this._setState('groups', 'groupTabMetadata', metadata);
  }

  // ==================== Search State Methods ====================

  /**
   * Update search state
   * @param {Object} searchState - Search state object
   */
  setSearchState(searchState) {
    if (searchState.query !== undefined) {
      this._setState('search', 'searchQuery', searchState.query);
    }
    if (searchState.filteredTabs !== undefined) {
      this._setState('search', 'filteredTabs', searchState.filteredTabs);
    }
    if (searchState.headingResults !== undefined) {
      this._setState('search', 'headingSearchResults', searchState.headingResults);
    }
    this._setState('search', 'isSearching', searchState.query?.length > 0);
  }

  /**
   * Clear search state
   */
  clearSearch() {
    this._setState('search', 'searchQuery', '');
    this._setState('search', 'filteredTabs', []);
    this._setState('search', 'headingSearchResults', []);
    this._setState('search', 'isSearching', false);
  }

  // ==================== UI State Methods ====================

  /**
   * Set selected group
   * @param {string|null} groupId - Group ID or null
   */
  setSelectedGroup(groupId) {
    this._setState('ui', 'selectedGroupId', groupId);
  }

  /**
   * Set selected tabs
   * @param {Array} tabIds - Array of tab IDs
   */
  setSelectedTabs(tabIds) {
    this._setState('ui', 'selectedTabIds', tabIds);
  }

  /**
   * Toggle tab selection
   * @param {number} tabId - Tab ID
   */
  toggleTabSelection(tabId) {
    const selected = [...this._state.selectedTabIds];
    const index = selected.indexOf(tabId);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(tabId);
    }
    this._setState('ui', 'selectedTabIds', selected);
  }

  /**
   * Clear tab selection
   */
  clearSelection() {
    this._setState('ui', 'selectedTabIds', []);
  }

  /**
   * Set current view
   * @param {string} view - View name ('tabs', 'groups', 'search')
   */
  setCurrentView(view) {
    this._setState('ui', 'currentView', view);
  }

  /**
   * Toggle sidebar collapsed state
   */
  toggleSidebar() {
    this._setState('ui', 'sidebarCollapsed', !this._state.sidebarCollapsed);
  }

  // ==================== Settings State Methods ====================

  /**
   * Update settings
   * @param {Object} settings - Settings object
   */
  setSettings(settings) {
    this._setState('settings', 'settings', settings);
  }

  /**
   * Update a single setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  updateSetting(key, value) {
    const settings = { ...this._state.settings, [key]: value };
    this._setState('settings', 'settings', settings);
  }

  // ==================== Loading State Methods ====================

  /**
   * Set loading state
   * @param {string} resource - Resource name ('tabs', 'groups', 'settings')
   * @param {boolean} isLoading - Loading state
   */
  setLoading(resource, isLoading) {
    this._setState('isLoading', resource, isLoading);
  }

  // ==================== Middleware ====================

  /**
   * Add middleware function
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this._middleware.push(middleware);
  }

  /**
   * Remove middleware function
   * @param {Function} middleware - Middleware function to remove
   */
  removeMiddleware(middleware) {
    const index = this._middleware.indexOf(middleware);
    if (index > -1) {
      this._middleware.splice(index, 1);
    }
  }

  // ==================== History & Debugging ====================

  /**
   * Record state change in history
   * @private
   */
  _recordHistory(event, data) {
    this._history.push({ event, data, timestamp: Date.now() });
    if (this._history.length > this._maxHistorySize) {
      this._history.shift();
    }
  }

  /**
   * Get state change history
   * @returns {Array} History array
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Get state snapshot for debugging
   * @returns {Object} Debug snapshot
   */
  getDebugSnapshot() {
    return {
      state: this._state,
      listeners: Array.from(this._listeners.keys()).map(key => ({
        event: key,
        count: this._listeners.get(key).length
      })),
      historyLength: this._history.length,
      middlewareCount: this._middleware.length
    };
  }

  // ==================== Persistence ====================

  /**
   * Export state to JSON
   * @returns {string} JSON string
   */
  exportState() {
    return JSON.stringify(this._state, null, 2);
  }

  /**
   * Import state from JSON
   * @param {string} json - JSON string
   */
  importState(json) {
    try {
      const imported = JSON.parse(json);
      this._state = { ...this._state, ...imported };
      this._emit('stateImported', { state: this._state });
    } catch (error) {
      console.error('StateManager: Error importing state:', error);
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Reset state to initial values
   */
  reset() {
    const oldState = { ...this._state };
    this._state = {
      tabs: [],
      activeTabId: null,
      customGroups: [],
      groupTabMetadata: {},
      searchQuery: '',
      filteredTabs: [],
      headingSearchResults: [],
      isSearching: false,
      selectedGroupId: null,
      selectedTabIds: [],
      sidebarCollapsed: false,
      currentView: 'tabs',
      settings: {},
      isLoading: {
        tabs: false,
        groups: false,
        settings: false
      }
    };
    this._emit('reset', { oldState, newState: this._state });
  }

  /**
   * Subscribe to specific manager events and sync with StateManager
   * @param {Object} manager - Manager instance (TabManager, GroupManager, SearchEngine)
   * @param {string} type - Manager type ('tabs', 'groups', 'search')
   */
  connectManager(manager, type) {
    switch (type) {
      case 'tabs':
        manager.on('tabsLoaded', (data) => {
          this.setTabs(data.tabs, data.activeTabId);
        });
        manager.on('tabActivated', (data) => {
          this.setActiveTab(data.tabId);
        });
        manager.on('tabCreated', (data) => {
          this.addTab(data.tab);
        });
        manager.on('tabClosed', (data) => {
          this.removeTab(data.tabId);
        });
        manager.on('tabUpdated', (data) => {
          if (data.tab) {
            this.updateTab(data.tab.id, data.tab);
          }
        });
        break;

      case 'groups':
        manager.on('groupsLoaded', (data) => {
          this.setGroups(data.groups, data.metadata);
        });
        manager.on('groupCreated', (data) => {
          this.addGroup(data.group);
        });
        manager.on('groupDeleted', (data) => {
          this.removeGroup(data.groupId);
        });
        manager.on('groupUpdated', (data) => {
          if (data.group) {
            this.updateGroup(data.group.id, data.changes);
          }
        });
        break;

      case 'search':
        manager.onSearchResults = (data) => {
          this.setSearchState(data);
        };
        break;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
}

// Make available globally for browser extension
window.StateManager = StateManager;
