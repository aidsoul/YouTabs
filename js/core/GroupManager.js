/**
 * GroupManager.js - YouTabs Extension
 * Manages custom tab groups: creation, organization, hierarchy, and metadata
 * 
 * This module handles all group-related functionality including CRUD operations,
 * nesting/hierarchy, tab assignments, sorting, and storage persistence.
 */

class GroupManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Function} options.onGroupsLoaded - Callback when groups are loaded
   * @param {Function} options.onGroupCreated - Callback when a group is created
   * @param {Function} options.onGroupUpdated - Callback when a group is updated
   * @param {Function} options.onGroupDeleted - Callback when a group is deleted
   * @param {Function} options.onTabAddedToGroup - Callback when a tab is added to a group
   * @param {Function} options.onTabRemovedFromGroup - Callback when a tab is removed from a group
   * @param {Function} options.onError - Callback for errors
   */
  constructor(options = {}) {
    this.options = {
      onGroupsLoaded: null,
      onGroupCreated: null,
      onGroupUpdated: null,
      onGroupDeleted: null,
      onTabAddedToGroup: null,
      onTabRemovedFromGroup: null,
      onError: null,
      ...options
    };
    
    // ==================== State ====================
    
    /**
     * Custom user groups array
     * @type {Array<{id: string, name: string, color: string, tabIds: number[], parentId: string|null, createdAt: number, sortBy: string, sortOrder: string}>}
     */
    this.customGroups = [];
    
    /**
     * Group tab metadata (tracks when tabs were added to groups)
     * Structure: { groupId: { tabId: { addedAt: timestamp, lastUsed: timestamp, useCount: number } } }
     * @type {Object}
     */
    this.groupTabMetadata = {};
    
    /**
     * Available colors for custom groups
     * @type {Array<{id: string, name: string, color: string}>}
     */
    this.groupColors = [
      { id: 'red', name: 'Red', color: '#ff5252' },
      { id: 'orange', name: 'Orange', color: '#ff9800' },
      { id: 'yellow', name: 'Yellow', color: '#ffc107' },
      { id: 'green', name: 'Green', color: '#4caf50' },
      { id: 'blue', name: 'Blue', color: '#2196f3' },
      { id: 'purple', name: 'Purple', color: '#9c27b0' },
      { id: 'pink', name: 'Pink', color: '#e91e63' },
      { id: 'cyan', name: 'Cyan', color: '#00bcd4' }
    ];
    
    /**
     * Cache for group depth calculations
     * @type {Map<string, number>}
     * @private
     */
    this._groupDepthCache = new Map();
    
    /**
     * Map for O(1) group lookups by ID (rebuilt when groups change)
     * @type {Map<string, Object>}
     * @private
     */
    this._groupsById = new Map();
    
    /**
     * Event listeners storage
     * @type {Map<string, Function[]>}
     * @private
     */
    this._listeners = new Map();
    
    /**
     * Debounce timeout for metadata saves
     * @type {number|null}
     * @private
     */
    this._saveMetadataTimeout = null;
  }

  // ==================== Event System ====================

  /**
   * Subscribe to group events
   * @param {string} event - Event name: 'groupsLoaded', 'groupCreated', 'groupUpdated', 'groupDeleted', 'tabAddedToGroup', 'tabRemovedFromGroup', 'error'
   * @param {Function} callback - Event handler
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
   * Unsubscribe from group events
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
  _emit(event, data) {
    if (!this._listeners.has(event)) return;
    this._listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in GroupManager ${event} handler:`, error);
      }
    });
    
    // Also call legacy callback if provided
    const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
    if (this.options[callbackName] && typeof this.options[callbackName] === 'function') {
      try {
        this.options[callbackName](data);
      } catch (error) {
        console.error(`Error in GroupManager ${callbackName} callback:`, error);
      }
    }
  }

  // ==================== Storage Methods ====================

  /**
   * Load groups and metadata from storage (IndexedDB or localStorage)
   * @returns {Promise<boolean>} Success status
   */
  async loadGroups() {
    try {
      // Try IndexedDB first
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.openDatabase();
        await window.YouTabsDB.migrateFromLocalStorage();
        
        // Load custom groups from IndexedDB
        const storedGroups = await window.YouTabsDB.getCustomGroups();
        if (storedGroups && storedGroups.length > 0) {
          this.customGroups = storedGroups.map(group => ({
            ...group,
            sortBy: group.sortBy || 'addedAt',
            sortOrder: group.sortOrder || 'desc'
          }));
        }
        
        // Build groups lookup Map for O(1) access
        this._rebuildGroupsMap();
        
        // Load group tab metadata from IndexedDB
        const storedGroupTabMeta = await window.YouTabsDB.getGroupTabMetadata();
        if (storedGroupTabMeta && Object.keys(storedGroupTabMeta).length > 0) {
          this.groupTabMetadata = storedGroupTabMeta;
        }
      } else {
        // Fallback to localStorage if IndexedDB is not available
        const storedGroups = await browser.storage.local.get('customGroups');
        if (storedGroups.customGroups) {
          this.customGroups = storedGroups.customGroups.map(group => ({
            ...group,
            sortBy: group.sortBy || 'addedAt',
            sortOrder: group.sortOrder || 'desc'
          }));
        }
        
        // Build groups lookup Map for O(1) access
        this._rebuildGroupsMap();
        
        const storedGroupTabMeta = await browser.storage.local.get('groupTabMetadata');
        if (storedGroupTabMeta.groupTabMetadata) {
          this.groupTabMetadata = storedGroupTabMeta.groupTabMetadata;
        }
      }
      
      this._emit('groupsLoaded', { 
        groups: this.customGroups, 
        metadata: this.groupTabMetadata 
      });
      return true;
    } catch (error) {
      console.error('GroupManager: Error loading groups:', error);
      this._emit('error', { action: 'loadGroups', error });
      return false;
    }
  }

  /**
   * Save custom groups to storage
   * @returns {Promise<boolean>} Success status
   */
  async saveCustomGroups() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.saveCustomGroups(this.customGroups);
      } else {
        // Fallback to localStorage if IndexedDB is not available
        await browser.storage.local.set({
          customGroups: this.customGroups
        });
      }
      
      // Clear depth cache since group structure may have changed
      this.clearGroupDepthCache();
      
      // Rebuild groups lookup Map
      this._rebuildGroupsMap();
      
      return true;
    } catch (error) {
      console.error('GroupManager: Error saving custom groups:', error);
      this._emit('error', { action: 'saveCustomGroups', error });
      return false;
    }
  }

  /**
   * Save group tab metadata to storage (debounced)
   * @returns {Promise<boolean>} Success status
   */
  async saveGroupTabMetadata() {
    return new Promise((resolve) => {
      if (this._saveMetadataTimeout) {
        clearTimeout(this._saveMetadataTimeout);
      }
      
      this._saveMetadataTimeout = setTimeout(async () => {
        try {
          if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
            await window.YouTabsDB.saveGroupTabMetadata(this.groupTabMetadata);
          } else {
            // Fallback to localStorage if IndexedDB is not available
            await browser.storage.local.set({
              groupTabMetadata: this.groupTabMetadata
            });
          }
          this._saveMetadataTimeout = null;
          resolve(true);
        } catch (error) {
          console.error('GroupManager: Error saving group tab metadata:', error);
          this._emit('error', { action: 'saveGroupTabMetadata', error });
          this._saveMetadataTimeout = null;
          resolve(false);
        }
      }, 1000); // Debounce for 1 second
    });
  }

  // ==================== Group CRUD Operations ====================

  /**
   * Create a new custom group
   * @param {string} name - Group name
   * @param {string} color - Color ID or hex color (default: 'blue')
   * @param {string|null} parentId - Parent group ID for nested groups (default: null)
   * @returns {Promise<Object|null>} The created group or null if failed
   */
  async createCustomGroup(name, color = 'blue', parentId = null) {
    // Check nesting level if parent is specified
    if (parentId) {
      const depth = this.getGroupDepth(parentId);
      if (depth >= 2) {
        console.warn('GroupManager: Maximum nesting level (3) reached');
        return null;
      }
    }
    
    let groupColor = color;
    
    // If creating a root group, generate a unique random color
    if (!parentId) {
      groupColor = this.generateUniqueColor();
    } else {
      // If creating a subgroup, use parent's color (will be darkened based on depth in getGroupInfo)
      const parentGroup = this._getGroupById(parentId);
      if (parentGroup) {
        // Store the root color for subgroups
        let rootParent = parentGroup;
        while (rootParent.parentId) {
          const nextParent = this._getGroupById(rootParent.parentId);
          if (nextParent) {
            rootParent = nextParent;
          } else {
            break;
          }
        }
        groupColor = rootParent.color;
      }
    }
    
    const newGroup = {
      id: 'group_' + Date.now(),
      name: name,
      color: groupColor,
      tabIds: [],
      parentId: parentId,
      createdAt: Date.now(),
      sortBy: 'addedAt', // addedAt, lastAccessed, useCount, title, url
      sortOrder: 'desc' // asc, desc
    };
    
    this.customGroups.push(newGroup);
    this._rebuildGroupsMap();
    await this.saveCustomGroups();
    
    this._emit('groupCreated', { group: newGroup });
    return newGroup;
  }

  /**
   * Rename a custom group
   * @param {string} groupId - Group ID to rename
   * @param {string} newName - New group name
   * @returns {Promise<boolean>} Success status
   */
  async renameCustomGroup(groupId, newName) {
    const group = this._getGroupById(groupId);
    if (group) {
      const oldName = group.name;
      group.name = newName;
      await this.saveCustomGroups();
      this._emit('groupUpdated', { group, changes: { name: { old: oldName, new: newName } } });
      return true;
    }
    return false;
  }

  /**
   * Delete a custom group and all its subgroups
   * @param {string} groupId - Group ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteCustomGroup(groupId) {
    // Helper function to get all descendant group IDs
    const getAllDescendantIds = (parentId) => {
      const children = this.customGroups.filter(g => g.parentId === parentId);
      let ids = children.map(g => g.id);
      children.forEach(child => {
        ids = ids.concat(getAllDescendantIds(child.id));
      });
      return ids;
    };
    
    const group = this._getGroupById(groupId);
    if (!group) return false;
    
    // Get all group IDs to delete (including subgroups)
    const idsToDelete = [groupId, ...getAllDescendantIds(groupId)];
    const deletedGroups = this.customGroups.filter(g => idsToDelete.includes(g.id));
    
    this.customGroups = this.customGroups.filter(g => !idsToDelete.includes(g.id));
    await this.saveCustomGroups();
    
    this._emit('groupDeleted', { groupId, deletedGroups, deletedCount: deletedGroups.length });
    return true;
  }

  /**
   * Update group color
   * @param {string} groupId - Group ID
   * @param {string} newColor - New color ID or hex color
   * @returns {Promise<boolean>} Success status
   */
  async updateCustomGroupColor(groupId, newColor) {
    const group = this._getGroupById(groupId);
    if (group) {
      const oldColor = group.color;
      group.color = newColor;

      // Also update all subgroups to inherit the new color
      const updateSubgroups = (parentId) => {
        const children = this.customGroups.filter(g => g.parentId === parentId);
        for (const child of children) {
          child.color = newColor;
          // Recursively update this child's subgroups
          updateSubgroups(child.id);
        }
      };
      updateSubgroups(groupId);

      await this.saveCustomGroups();
      this._emit('groupUpdated', { group, changes: { color: { old: oldColor, new: newColor } } });
      return true;
    }
    return false;
  }

  // ==================== Group Hierarchy Methods ====================

  /**
   * Get nesting depth of a group (with memoization)
   * @param {string} groupId - Group ID
   * @param {number} depth - Current depth (for recursion)
   * @returns {number} Nesting depth (0 = root)
   */
  getGroupDepth(groupId, depth = 0) {
    // Check cache first
    if (this._groupDepthCache.has(groupId)) {
      return this._groupDepthCache.get(groupId);
    }
    
    const group = this._getGroupById(groupId);
    if (!group || !group.parentId) {
      this._groupDepthCache.set(groupId, depth);
      return depth;
    }
    
    const result = this.getGroupDepth(group.parentId, depth + 1);
    this._groupDepthCache.set(groupId, result);
    return result;
  }

  /**
   * Clear depth cache when groups are modified
   */
  clearGroupDepthCache() {
    this._groupDepthCache.clear();
  }

  /**
   * Get all subgroups (children) of a group
   * @param {string} parentId - Parent group ID
   * @returns {Array<Object>} Array of child groups
   */
  getSubgroups(parentId) {
    return this.customGroups.filter(g => g.parentId === parentId);
  }

  /**
   * Get root groups (no parent)
   * @returns {Array<Object>} Array of root groups
   */
  getRootGroups() {
    return this.customGroups.filter(g => !g.parentId);
  }

  /**
   * Get total tabs count in all nested groups (descendants)
   * @param {string} groupId - Group ID
   * @returns {number} Total tab count in all nested groups
   */
  getNestedTabsCount(groupId) {
    const subgroups = this.getSubgroups(groupId);
    let count = 0;
    for (const subgroup of subgroups) {
      count += subgroup.tabIds.length; // tabs in this subgroup
      count += this.getNestedTabsCount(subgroup.id); // tabs in nested subgroups
    }
    return count;
  }

  /**
   * Check if a group is a descendant of another group
   * @param {string} ancestorId - Potential ancestor group ID
   * @param {string} descendantId - Potential descendant group ID
   * @returns {boolean} True if descendantId is a descendant of ancestorId
   */
  isDescendant(ancestorId, descendantId) {
    const descendant = this._getGroupById(descendantId);
    if (!descendant) return false;
    if (!descendant.parentId) return false;
    if (descendant.parentId === ancestorId) return true;
    return this.isDescendant(ancestorId, descendant.parentId);
  }

  // ==================== Tab-to-Group Operations ====================

  /**
   * Add tab to custom group (removes from other groups)
   * @param {number|string} tabId - Tab ID to add
   * @param {string} groupId - Group ID to add to
   * @returns {Promise<boolean>} Success status
   */
  async addTabToGroup(tabId, groupId) {
    const group = this._getGroupById(groupId);
    // Convert tabId to number for comparison
    const numericTabId = Number(tabId);
    
    if (group) {
      // Check if already in this group
      if (group.tabIds.includes(numericTabId)) {
        return true; // Already in this group
      }
      
      // Remove from other groups (tabs can only be in one group)
      for (const g of this.customGroups) {
        if (g.id !== groupId) {
          const hadTab = g.tabIds.includes(numericTabId);
          g.tabIds = g.tabIds.filter(id => Number(id) !== numericTabId);
          if (hadTab) {
            this._emit('tabRemovedFromGroup', { tabId: numericTabId, groupId: g.id, group: g });
          }
        }
      }
      
      group.tabIds.push(numericTabId);
      
      // Track when tab was added to group
      if (!this.groupTabMetadata[groupId]) {
        this.groupTabMetadata[groupId] = {};
      }
      if (!this.groupTabMetadata[groupId][numericTabId]) {
        this.groupTabMetadata[groupId][numericTabId] = {
          addedAt: Date.now(),
          lastUsed: Date.now(),
          useCount: 0
        };
      } else {
        // Update addedAt if re-adding
        this.groupTabMetadata[groupId][numericTabId].addedAt = Date.now();
      }
      
      await this.saveCustomGroups();
      await this.saveGroupTabMetadata();
      
      this._emit('tabAddedToGroup', { tabId: numericTabId, groupId, group });
      return true;
    }
    return false;
  }

  /**
   * Remove tab from custom group
   * @param {number|string} tabId - Tab ID to remove
   * @param {string} groupId - Group ID to remove from
   * @returns {Promise<boolean>} Success status
   */
  async removeTabFromGroup(tabId, groupId) {
    const group = this._getGroupById(groupId);
    if (group) {
      // Convert to number for comparison
      const numericTabId = Number(tabId);
      const hadTab = group.tabIds.includes(numericTabId);
      group.tabIds = group.tabIds.filter(id => Number(id) !== numericTabId);
      
      if (hadTab) {
        await this.saveCustomGroups();
        this._emit('tabRemovedFromGroup', { tabId: numericTabId, groupId, group });
        return true;
      }
    }
    return false;
  }

  /**
   * Get custom group for a tab (optimized with early exit)
   * @param {number|string} tabId - Tab ID
   * @returns {Object|undefined} The group containing the tab, or undefined
   */
  getCustomGroupForTab(tabId) {
    const numericTabId = Number(tabId);
    for (const group of this.customGroups) {
      if (group.tabIds.some(id => Number(id) === numericTabId)) {
        return group;
      }
    }
    return undefined;
  }

  /**
   * Get all tabs in a custom group
   * @param {string} groupId - Group ID
   * @param {Array<Object>} allTabs - All available tabs to filter from
   * @returns {Array<Object>} Array of tab objects in the group
   */
  getTabsInCustomGroup(groupId, allTabs = []) {
    const group = this._getGroupById(groupId);
    if (!group) return [];
    return allTabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
  }

  /**
   * Clean up duplicate tabs - ensure each tab is only in one group
   * @returns {Promise<boolean>} Success status
   */
  async cleanupDuplicateTabs() {
    const tabIdsInGroups = new Map(); // tabId -> first group it appears in
    
    for (const group of this.customGroups) {
      const uniqueTabIds = [];
      for (const tabId of group.tabIds) {
        const numericId = Number(tabId);
        if (!tabIdsInGroups.has(numericId)) {
          tabIdsInGroups.set(numericId, group.id);
          uniqueTabIds.push(numericId);
        }
      }
      group.tabIds = uniqueTabIds;
    }
    
    await this.saveCustomGroups();
    return true;
  }

  // ==================== Sorting Methods ====================

  /**
   * Get sorted tabs in a custom group
   * @param {string} groupId - Group ID
   * @param {Array<Object>} allTabs - All available tabs to filter from
   * @returns {Array<Object>} Sorted array of tab objects
   */
  getSortedTabsInGroup(groupId, allTabs = []) {
    const group = this._getGroupById(groupId);
    if (!group) return [];
    
    const tabsInGroup = allTabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
    const sortBy = group.sortBy || 'addedAt';
    const sortOrder = group.sortOrder || 'desc';
    
    return this.sortTabs(tabsInGroup, groupId, sortBy, sortOrder);
  }

  /**
   * Sort tabs based on criteria
   * @param {Array<Object>} tabs - Tabs to sort
   * @param {string} groupId - Group ID for metadata lookup
   * @param {string} sortBy - Sort criteria: 'addedAt', 'lastAccessed', 'useCount', 'title', 'url'
   * @param {string} sortOrder - Sort order: 'asc', 'desc'
   * @returns {Array<Object>} Sorted tabs
   */
  sortTabs(tabs, groupId, sortBy, sortOrder) {
    const metadata = this.groupTabMetadata[groupId] || {};
    
    const sortedTabs = [...tabs].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'addedAt':
          // Date added to group
          valueA = metadata[a.id]?.addedAt || 0;
          valueB = metadata[b.id]?.addedAt || 0;
          break;
        case 'lastAccessed':
          // Last accessed (from browser)
          valueA = a.lastAccessed || 0;
          valueB = b.lastAccessed || 0;
          break;
        case 'useCount':
          // Frequency of use
          valueA = metadata[a.id]?.useCount || 0;
          valueB = metadata[b.id]?.useCount || 0;
          break;
        case 'title':
          // Tab title
          valueA = (a.title || '').toLowerCase();
          valueB = (b.title || '').toLowerCase();
          return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        case 'url':
          // Tab URL
          valueA = (a.url || '').toLowerCase();
          valueB = (b.url || '').toLowerCase();
          return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        default:
          valueA = metadata[a.id]?.addedAt || 0;
          valueB = metadata[b.id]?.addedAt || 0;
      }
      
      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    
    return sortedTabs;
  }

  /**
   * Update group sorting settings
   * @param {string} groupId - Group ID
   * @param {string} sortBy - Sort criteria: 'addedAt', 'lastAccessed', 'useCount', 'title', 'url'
   * @param {string} sortOrder - Sort order: 'asc', 'desc'
   * @returns {Promise<boolean>} Success status
   */
  async updateGroupSorting(groupId, sortBy, sortOrder) {
    const group = this._getGroupById(groupId);
    if (group) {
      group.sortBy = sortBy;
      group.sortOrder = sortOrder;
      await this.saveCustomGroups();
      this._emit('groupUpdated', { group, changes: { sortBy, sortOrder } });
      return true;
    }
    return false;
  }

  /**
   * Update tab usage when tab is activated
   * @param {number|string} tabId - Tab ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} Success status
   */
  async updateTabUsage(tabId, groupId) {
    const numericTabId = Number(tabId);
    if (!this.groupTabMetadata[groupId] || !this.groupTabMetadata[groupId][numericTabId]) {
      return false;
    }
    
    this.groupTabMetadata[groupId][numericTabId].lastUsed = Date.now();
    this.groupTabMetadata[groupId][numericTabId].useCount = 
      (this.groupTabMetadata[groupId][numericTabId].useCount || 0) + 1;
    
    await this.saveGroupTabMetadata();
    return true;
  }

  // ==================== Hierarchy Name Methods ====================

  /**
   * Get all parent group names for a tab (for breadcrumbs)
   * @param {number|string} tabId - Tab ID
   * @returns {Array<string>} Array of group names from root to leaf
   */
  getGroupHierarchyNames(tabId) {
    const group = this.getCustomGroupForTab(tabId);
    if (!group) return [];
    
    return this.getGroupHierarchyNamesForGroup(group.id);
  }

  /**
   * Get all parent group names for a group (for context menu search)
   * @param {string} groupId - Group ID
   * @returns {Array<string>} Array of group names from root to leaf
   */
  getGroupHierarchyNamesForGroup(groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group) return [];
    
    const names = [];
    let currentGroup = group;
    
    while (currentGroup) {
      names.unshift(currentGroup.name);
      if (currentGroup.parentId) {
        currentGroup = this.customGroups.find(g => g.id === currentGroup.parentId);
      } else {
        currentGroup = null;
      }
    }
    
    return names;
  }

  // ==================== Grouping Functions ====================

  /**
   * Group tabs by domain
   * @param {Array<Object>} tabs - All tabs to group
   * @returns {Object} Groups keyed by domain
   */
  groupTabsByDomain(tabs) {
    const groups = {};
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    tabs.forEach(tab => {
      // Skip tabs that are already in custom groups
      if (tabsInCustomGroups.has(tab.id)) {
        return;
      }
      
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
    
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }

  /**
   * Group tabs by color based on domain patterns
   * @param {Array<Object>} tabs - All tabs to group
   * @returns {Object} Groups keyed by color
   */
  groupTabsByColor(tabs) {
    const groups = {};
    groups['gray'] = [];
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    tabs.forEach(tab => {
      // Skip tabs that are already in custom groups
      if (tabsInCustomGroups.has(tab.id)) {
        return;
      }
      
      let colorKey = 'gray';
      
      try {
        if (tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('chrome:')) {
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
    
    const sortedGroups = {};
    const colorOrder = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
    colorOrder.forEach(color => {
      if (groups[color] && groups[color].length > 0) {
        sortedGroups[color] = groups[color];
      }
    });
    
    return sortedGroups;
  }

  /**
   * Group tabs by time of last access
   * @param {Array<Object>} tabs - All tabs to group
   * @returns {Object} Groups keyed by time period
   */
  groupTabsByTime(tabs) {
    const groups = {
      'today': [],
      'yesterday': [],
      'thisWeek': [],
      'older': []
    };
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    const now = Date.now();
    const hourMs = 3600000;
    
    tabs.forEach(tab => {
      // Skip tabs that are already in custom groups
      if (tabsInCustomGroups.has(tab.id)) {
        return;
      }
      
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
      
      groups[groupKey].push(tab);
    });
    
    const sortedGroups = {};
    const timeOrder = ['today', 'yesterday', 'thisWeek', 'older'];
    timeOrder.forEach(time => {
      if (groups[time] && groups[time].length > 0) {
        sortedGroups[time] = groups[time];
      }
    });
    
    return sortedGroups;
  }

  /**
   * Group tabs by custom user groups
   * @param {Array<Object>} tabs - All tabs to group
   * @returns {Object} Groups keyed by group identifier
   */
  groupTabsByCustomGroups(tabs) {
    const groups = {};
    
    // First, add all custom groups
    this.customGroups.forEach(group => {
      const groupKey = 'custom_' + group.id;
      groups[groupKey] = tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
    });
    
    // Add ungrouped tabs
    const groupedTabIds = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(Number(id)));
    });
    
    const ungroupedTabs = tabs.filter(tab => !groupedTabIds.has(tab.id));
    if (ungroupedTabs.length > 0) {
      groups['ungrouped'] = ungroupedTabs;
    }
    
    return groups;
  }

  // ==================== Utility Methods ====================

  /**
   * Rebuild the groups lookup Map for O(1) access by ID
   * @private
   */
  _rebuildGroupsMap() {
    this._groupsById.clear();
    for (const group of this.customGroups) {
      this._groupsById.set(group.id, group);
    }
  }

  /**
   * Get group by ID with O(1) lookup
   * @private
   * @param {string} groupId - Group ID
   * @returns {Object|undefined} The group object
   */
  _getGroupById(groupId) {
    return this._groupsById.get(groupId);
  }

  /**
   * Get public group info for display
   * @param {string} groupKey - Group key (e.g., 'custom_groupId')
   * @param {Object} group - Group data
   * @returns {Object|null} Group info for display
   */
  getGroupInfo(groupKey, group) {
    // Check if it's a custom group
    if (groupKey.startsWith('custom_')) {
      const groupId = groupKey.replace('custom_', '');
      const customGroup = this.customGroups.find(g => g.id === groupId);
      if (customGroup) {
        // Get depth
        let depth = this.getGroupDepth(groupId);
        let baseColor = customGroup.color;
        
        // If nested, use immediate parent's color as base
        if (customGroup.parentId && depth > 0) {
          const parentGroup = this._getGroupById(customGroup.parentId);
          if (parentGroup) {
            baseColor = parentGroup.color;
          }
        }
        
        // Get color - handle both color ID (red, blue) and hex color (#ff5252)
        let displayColor;
        const colorObj = this.groupColors.find(c => c.id === baseColor);
        if (colorObj) {
          displayColor = colorObj.color;
        } else if (baseColor && baseColor.startsWith('#')) {
          // Handle hex color from color picker or generated unique color
          displayColor = baseColor;
        } else {
          // Fallback to default blue
          displayColor = this.groupColors[4].color;
        }
        
        // Darken color based on nesting depth (darker for deeper levels)
        if (depth > 0) {
          displayColor = this.darkenColor(displayColor, depth * 20);
        }
        
        return {
          name: customGroup.name,
          icon: '●',
          color: displayColor,
          isCustom: true,
          groupId: customGroup.id,
          subgroupCount: this.getSubgroups(groupId).length,
          nestedTabsCount: this.getNestedTabsCount(groupId),
          depth: depth,
          sortBy: customGroup.sortBy || 'addedAt',
          sortOrder: customGroup.sortOrder || 'desc'
        };
      }
    }
    
    // Check if it's ungrouped
    if (groupKey === 'ungrouped') {
      return {
        name: 'All tabs',
        icon: '',
        color: 'var(--text-secondary)',
        isCustom: false
      };
    }
    
    // Default fallback for unknown group keys
    return {
      name: groupKey,
      icon: '',
      color: 'var(--text-secondary)',
      isCustom: false
    };
  }

  /**
   * Get a color object by ID
   * @param {string} colorId - Color ID
   * @returns {Object|undefined} Color object
   */
  getColorById(colorId) {
    return this.groupColors.find(c => c.id === colorId);
  }

  /**
   * Get all available group colors
   * @returns {Array<Object>} Array of color objects
   */
  getAvailableColors() {
    return [...this.groupColors];
  }

  /**
   * Update group color when it's moved to a new parent
   * Root groups get their own unique color, subgroups inherit from root parent
   * @param {string} groupId - Group ID that was moved
   * @returns {Promise<boolean>} Success status
   */
  async updateGroupColorOnMove(groupId) {
    const group = this._getGroupById(groupId);
    if (!group) return false;

    // If group is now a root group (no parent), generate unique color
    if (!group.parentId) {
      group.color = this.generateUniqueColor();
    } else {
      // If group has a parent, use the root parent's color
      let rootParent = this._getGroupById(group.parentId);
      while (rootParent && rootParent.parentId) {
        rootParent = this._getGroupById(rootParent.parentId);
      }
      if (rootParent) {
        group.color = rootParent.color;
      }
    }

    // Recursively update all descendants
    const updateDescendants = (parentId) => {
      const children = this.customGroups.filter(g => g.parentId === parentId);
      for (const child of children) {
        // Child inherits from its immediate parent (which is now updated)
        const immediateParent = this._getGroupById(child.parentId);
        if (immediateParent) {
          child.color = immediateParent.color;
        }
        // Recursively update this child's descendants
        updateDescendants(child.id);
      }
    };
    updateDescendants(groupId);

    await this.saveCustomGroups();
    return true;
  }

  // ==================== Color Utilities ====================

  /**
   * Convert hex color to HSL
   * @param {string} hex - Hex color (e.g., '#ff5252' or '#f52')
   * @returns {{h: number, s: number, l: number}} HSL values
   */
  hexToHsl(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const cmin = Math.min(r, g, b);
    const cmax = Math.max(r, g, b);
    const delta = cmax - cmin;
    let h = 0, s = 0, l = 0;
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
  }

  /**
   * Convert HSL to hex color
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-100)
   * @param {number} l - Lightness (0-100)
   * @returns {string} Hex color
   */
  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);
    if (r.length === 1) r = '0' + r;
    if (g.length === 1) g = '0' + g;
    if (b.length === 1) b = '0' + b;
    return '#' + r + g + b;
  }

  /**
   * Generate a unique random color for a new group
   * Uses HSL to generate vibrant colors with good contrast
   * @returns {string} Random hex color
   */
  generateUniqueColor() {
    // Generate random hue (0-360)
    const h = Math.floor(Math.random() * 360);
    // Use high saturation (65-85%) for vibrant colors
    const s = Math.floor(Math.random() * 21) + 65;
    // Use medium-high lightness (50-65%) for good visibility
    const l = Math.floor(Math.random() * 16) + 50;
    return this.hslToHex(h, s, l);
  }

  /**
   * Darken a hex color by a percentage
   * @param {string} hex - Hex color
   * @param {number} percent - Percentage to darken (0-100)
   * @returns {string} Darkened hex color
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }

  // ==================== Cleanup ====================

  /**
   * Destroy the GroupManager instance and clean up resources
   */
  destroy() {
    // Clear all listeners
    this._listeners.clear();
    
    // Clear caches
    this.clearGroupDepthCache();
    this._groupsById.clear();
    
    // Clear pending timeouts
    if (this._saveMetadataTimeout) {
      clearTimeout(this._saveMetadataTimeout);
      this._saveMetadataTimeout = null;
    }
    
    // Clear state
    this.customGroups = [];
    this.groupTabMetadata = {};
  }
}

// Export for use in browser environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupManager;
}

// Make available globally for browser environments
if (typeof window !== 'undefined') {
  window.GroupManager = GroupManager;
}
