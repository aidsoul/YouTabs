/**
 * DragDropManager.js - YouTabs Extension
 * Manages all drag-and-drop functionality for tabs and groups
 * 
 * This module handles:
 * - Tab dragging within and between groups
 * - Group dragging for reordering and nesting
 * - Visual feedback during drag operations
 * - Drop validation and execution
 */

class DragDropManager {
  /**
   * @param {Object} options - Configuration options
   * @param {TabManager} options.tabManager - TabManager instance
   * @param {GroupManager} options.groupManager - GroupManager instance
   * @param {Function} options.getSettings - Function to get current settings
   * @param {Function} options.getTabsInGroup - Function to get tabs in a group
   * @param {Function} options.addTabToGroup - Function to add tab to custom group
   * @param {Function} options.removeTabFromGroup - Function to remove tab from custom group
   * @param {Function} options.getCustomGroupForTab - Function to get custom group for a tab
   * @param {Function} options.getGroupDepth - Function to get group nesting depth
   * @param {Function} options.saveCustomGroups - Function to save custom groups
   * @param {Function} options.renderTabs - Function to trigger tab re-rendering
   * @param {Function} options.loadTabs - Function to reload tabs
   */
  constructor(options = {}) {
    this.options = {
      getSettings: () => ({}),
      getTabsInGroup: () => [],
      addTabToGroup: async () => {},
      removeTabFromGroup: async () => {},
      getCustomGroupForTab: () => null,
      getGroupDepth: () => 0,
      saveCustomGroups: async () => {},
      renderTabs: async () => {},
      loadTabs: async () => {},
      ...options
    };
    
    // ==================== Drag State ====================
    
    /**
     * Currently dragged tab object
     * @type {Object|null}
     */
    this.draggedTab = null;
    
    /**
     * Index of the dragged tab in its original position
     * @type {number|null}
     */
    this.draggedIndex = null;
    
    /**
     * Group key of the dragged tab/group
     * @type {string|null}
     */
    this.draggedGroup = null;
    
    // ==================== Event Listeners ====================
    
    /**
     * Event listeners storage
     * @type {Map<string, Function[]>}
     * @private
     */
    this._listeners = new Map();
    
    // Bind methods to preserve context
    this._bindMethods();
  }
  
  /**
   * Bind all methods to preserve 'this' context
   * @private
   */
  _bindMethods() {
    // Tab drag handlers
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    
    // Custom group handlers
    this.handleCustomGroupDragOver = this.handleCustomGroupDragOver.bind(this);
    this.handleCustomGroupDragLeave = this.handleCustomGroupDragLeave.bind(this);
    this.handleCustomGroupDrop = this.handleCustomGroupDrop.bind(this);
    
    // Sorted group handlers
    this.handleSortedGroupDragOver = this.handleSortedGroupDragOver.bind(this);
    this.handleSortedGroupDragLeave = this.handleSortedGroupDragLeave.bind(this);
    this.handleSortedGroupDrop = this.handleSortedGroupDrop.bind(this);
    
    // Group (header) handlers
    this.handleGroupDragStart = this.handleGroupDragStart.bind(this);
    this.handleGroupDragEnd = this.handleGroupDragEnd.bind(this);
    this.handleGroupDragOver = this.handleGroupDragOver.bind(this);
    this.handleGroupDrop = this.handleGroupDrop.bind(this);
    
    // Container handlers
    this.handleContainerDragOver = this.handleContainerDragOver.bind(this);
    this.handleContainerDragLeave = this.handleContainerDragLeave.bind(this);
    this.handleContainerDrop = this.handleContainerDrop.bind(this);
  }
  
  // ==================== Event System ====================
  
  /**
   * Subscribe to drag-drop events
   * @param {string} event - Event name: 'dragStart', 'dragEnd', 'drop', 'error'
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
   * Unsubscribe from drag-drop events
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
        console.error(`Error in DragDropManager ${event} handler:`, error);
      }
    });
  }
  
  // ==================== Tab Drag Handlers ====================
  
  /**
   * Handle tab drag start
   * @param {DragEvent} e - Drag event
   * @param {Object} tab - Tab object being dragged
   * @param {number} index - Current index of the tab
   * @param {string} groupKey - Group key the tab belongs to
   */
  handleDragStart(e, tab, index, groupKey) {
    this.draggedTab = tab;
    this.draggedIndex = index;
    this.draggedGroup = groupKey;
    
    if (e.target?.classList) {
      e.target.classList.add('dragging');
    }
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      index: index,
      group: groupKey,
      tabId: tab.id
    }));
    
    this._emit('dragStart', { type: 'tab', tab, index, groupKey });
  }
  
  /**
   * Handle tab drag end
   * @param {DragEvent} e - Drag event
   */
  handleDragEnd(e) {
    if (e.target?.classList) {
      e.target.classList.remove('dragging');
    }
    
    // Clean up all drag visual states
    this._cleanupTabVisuals();
    this._cleanupGroupVisuals();
    
    const wasDraggingTab = this.draggedTab;
    const wasDraggingGroup = this.draggedGroup;
    
    this.draggedTab = null;
    this.draggedIndex = null;
    this.draggedGroup = null;
    
    this._emit('dragEnd', { 
      type: wasDraggingTab ? 'tab' : (wasDraggingGroup ? 'group' : null) 
    });
  }
  
  /**
   * Handle drag over a tab item
   * @param {DragEvent} e - Drag event
   * @param {number} index - Index of the target tab
   * @param {string} groupKey - Group key of the target tab
   */
  handleDragOver(e, index, groupKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Clean up previous drag-over states
    this._cleanupTabVisuals();
    this._cleanupGroupVisuals();
    
    const targetTab = e.target?.closest('.tab-item');
    if (targetTab) {
      // Determine if we're dragging above or below the target tab
      const rect = targetTab.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      targetTab.classList.add('drag-over');
      if (e.clientY < midY) {
        targetTab.classList.add('drag-over-top');
      } else {
        targetTab.classList.add('drag-over-bottom');
      }
    }
  }
  
  /**
   * Handle tab drop
   * @param {DragEvent} e - Drag event
   * @param {number} targetIndex - Target index for the drop
   * @param {string} targetGroup - Target group key
   */
  async handleDrop(e, targetIndex, targetGroup) {
    e.preventDefault();
    
    // Defensive check: if targetGroup is undefined, just clean up and return
    if (!targetGroup) {
      this._cleanupTabVisuals();
      return;
    }
    
    let dragData;
    try {
      dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch (err) {
      dragData = { index: this.draggedIndex, group: this.draggedGroup };
    }
    
    // Check if dropping into a custom group
    if (targetGroup.startsWith('custom_')) {
      const groupId = targetGroup.replace('custom_', '');
      if (this.draggedTab) {
        const tabId = this.draggedTab.id;
        try {
          await this.options.addTabToGroup(tabId, groupId);
          this._emit('drop', { type: 'tabToGroup', tabId, groupId });
        } catch (error) {
          console.error('DragDropManager: Error adding tab to group:', error);
          this._emit('error', { action: 'addTabToGroup', error });
        }
      }
      this._cleanupTabVisuals();
      return;
    }
    
    if (this.draggedTab) {
      try {
        await this._handleTabMove(e, targetIndex, targetGroup, dragData);
      } catch (error) {
        console.error('DragDropManager: Error moving tab:', error);
        this._emit('error', { action: 'moveTab', error });
      }
    }
    
    this._cleanupTabVisuals();
  }
  
  /**
   * Handle the actual tab movement logic
   * @private
   */
  async _handleTabMove(e, targetIndex, targetGroup, dragData) {
    // Find the target tab element
    const targetTabEl = e.target?.closest('.tab-item');
    const settings = this.options.getSettings();
    
    if (targetTabEl) {
      // Get all tab items in the same group container
      const groupContainer = targetTabEl.closest('.tab-group-tabs');
      const allTabsInGroup = groupContainer ? 
        Array.from(groupContainer.querySelectorAll('.tab-item')) : [];
      
      // Find the actual current index of the target tab
      const actualTargetIndex = allTabsInGroup.indexOf(targetTabEl);
      
      if (actualTargetIndex !== -1) {
        // Determine if dropping above or below the target
        const rect = targetTabEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        let newIndex;
        if (e.clientY < midY) {
          // Dropping above the target
          newIndex = actualTargetIndex;
        } else {
          // Dropping below the target
          newIndex = actualTargetIndex + 1;
        }
        
        // Adjust for the dragged tab's current position if moving within same group
        if (dragData.group === targetGroup) {
          const tabId = this.draggedTab?.id;
          if (!tabId) return;
          
          const draggedTabId = String(tabId);
          const draggedTabIndex = allTabsInGroup.findIndex(tab =>
            String(tab.dataset.tabId) === draggedTabId
          );
          
          if (draggedTabIndex !== -1) {
            // If moving down, account for the removed tab
            if (newIndex > draggedTabIndex) {
              newIndex = newIndex - 1;
            }
            // Skip if positions are the same
            if (newIndex === draggedTabIndex) return;
          }
        }
        
        // Handle cross-group moves with grouping enabled
        if (dragData.group !== targetGroup && settings.enableGrouping) {
          if (targetIndex > this.draggedIndex && dragData.group !== targetGroup) {
            newIndex = Math.max(0, targetIndex);
          }
        }
        
        // Move tab to new position
        const tabId = this.draggedTab?.id;
        const tabWindowId = this.draggedTab?.windowId;
        if (tabId && tabWindowId) {
          await browser.tabs.move(tabId, {
            windowId: tabWindowId,
            index: newIndex
          });
          await this.options.loadTabs();
          this._emit('drop', { type: 'tabMove', tabId, newIndex, targetGroup });
        }
      }
    } else {
      // Fallback when target tab element not found
      await this._handleFallbackTabMove(targetIndex, targetGroup, dragData);
    }
  }
  
  /**
   * Handle fallback tab movement when target element not found
   * @private
   */
  async _handleFallbackTabMove(targetIndex, targetGroup, dragData) {
    let newIndex = targetIndex;
    const settings = this.options.getSettings();
    
    // Apply same-group adjustment logic for fallback
    if (dragData.group === targetGroup && this.draggedIndex !== null) {
      if (newIndex > this.draggedIndex) {
        newIndex = newIndex - 1;
      }
      if (newIndex === this.draggedIndex) return;
    }
    
    // Handle cross-group moves with grouping enabled (fallback path)
    if (dragData.group !== targetGroup && settings.enableGrouping) {
      const sourceGroup = dragData.group;
      if (targetIndex > this.draggedIndex && sourceGroup !== targetGroup) {
        newIndex = Math.max(0, targetIndex);
      }
    }
    
    const tabId = this.draggedTab?.id;
    const tabWindowId = this.draggedTab?.windowId;
    if (tabId && tabWindowId) {
      await browser.tabs.move(tabId, {
        windowId: tabWindowId,
        index: newIndex
      });
      await this.options.loadTabs();
      this._emit('drop', { type: 'tabMove', tabId, newIndex, targetGroup });
    }
  }
  
  // ==================== Custom Group Drag Handlers ====================
  
  /**
   * Handle drag over custom group tab list
   * @param {DragEvent} e - Drag event
   * @param {string} groupKey - Group key
   */
  handleCustomGroupDragOver(e, groupKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const tabList = e.target?.closest('.tab-group-tabs');
    if (tabList) {
      tabList.classList.add('drag-over');
    }
    
    // Remove drag-over class from other group tab lists
    document.querySelectorAll('.tab-group-tabs').forEach(list => {
      if (list !== tabList) {
        list.classList.remove('drag-over');
      }
    });
  }
  
  /**
   * Handle drag leave from custom group tab list
   * @param {DragEvent} e - Drag event
   * @param {string} groupKey - Group key
   */
  handleCustomGroupDragLeave(e, groupKey) {
    const tabList = e.target?.closest('.tab-group-tabs');
    // Only remove if we're actually leaving the tab list, not entering a child element
    if (tabList && !tabList.contains(e.relatedTarget)) {
      tabList.classList.remove('drag-over');
    }
  }
  
  /**
   * Handle drop on custom group
   * @param {DragEvent} e - Drag event
   * @param {string} groupKey - Target group key
   */
  async handleCustomGroupDrop(e, groupKey) {
    e.preventDefault();
    e.stopPropagation();
    
    const tabList = e.target?.closest('.tab-group-tabs');
    if (tabList) {
      tabList.classList.remove('drag-over');
    }
    
    // Clean up all drag-over classes
    this._cleanupGroupVisuals();
    
    const groupId = groupKey.replace('custom_', '');
    
    if (this.draggedTab) {
      const tabId = this.draggedTab.id;
      
      try {
        // Check if tab is already in a different custom group
        const currentGroup = this.options.getCustomGroupForTab(tabId);
        
        if (currentGroup && currentGroup.id !== groupId) {
          // Tab is in another group - move it
          await this.options.removeTabFromGroup(tabId, currentGroup.id);
          await this.options.addTabToGroup(tabId, groupId);
        } else if (!currentGroup) {
          // Tab is not in any custom group - just add it
          await this.options.addTabToGroup(tabId, groupId);
        }
        
        // Note: renderTabs() is called by the tabAddedToGroup event listener
        
        this._emit('drop', { type: 'tabToCustomGroup', tabId, groupId });
      } catch (error) {
        console.error('DragDropManager: Error handling custom group drop:', error);
        this._emit('error', { action: 'customGroupDrop', error });
      }
    }
    
    this.cleanupDrag();
  }
  
  // ==================== Sorted Group Drag Handlers ====================
  
  /**
   * Handle drag over sorted group (domain/color/time)
   * @param {DragEvent} e - Drag event
   */
  handleSortedGroupDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Check if there's a custom group under the cursor
    const customGroup = e.target?.closest('.tab-group-tabs[data-group-key^="custom_"]');
    if (customGroup) {
      customGroup.classList.add('drag-over');
    }
  }
  
  /**
   * Handle drag leave from sorted group
   * @param {DragEvent} e - Drag event
   */
  handleSortedGroupDragLeave(e) {
    const tabList = e.target?.closest('.tab-group-tabs');
    if (tabList && !tabList.contains(e.relatedTarget)) {
      tabList.classList.remove('drag-over');
    }
  }
  
  /**
   * Handle drop on sorted group
   * @param {DragEvent} e - Drag event
   */
  async handleSortedGroupDrop(e) {
    e.preventDefault();
    
    // Find if we dropped on a custom group
    const customGroupTabList = e.target?.closest('.tab-group-tabs[data-group-key^="custom_"]');
    
    // Handle group drop onto custom group
    if (customGroupTabList && this.draggedGroup && !this.draggedTab) {
      await this._handleGroupToGroupDrop(e, customGroupTabList);
    }
    
    // Handle tab drop onto custom group
    if (customGroupTabList && this.draggedTab) {
      const groupKey = customGroupTabList.dataset.groupKey;
      const groupId = groupKey.replace('custom_', '');
      const tabId = this.draggedTab.id;
      
      try {
        await this.options.addTabToGroup(tabId, groupId);
        this._emit('drop', { type: 'tabToGroup', tabId, groupId });
        this.cleanupDrag();
      } catch (error) {
        console.error('DragDropManager: Error adding tab to group:', error);
        this._emit('error', { action: 'sortedGroupDrop', error });
      }
    }
    
    // Clean up all drag-over classes
    this._cleanupGroupVisuals();
  }
  
  // ==================== Group (Header) Drag Handlers ====================
  
  /**
   * Handle group drag start
   * @param {DragEvent} e - Drag event
   * @param {string} groupKey - Group key being dragged
   */
  handleGroupDragStart(e, groupKey) {
    this.draggedGroup = groupKey;
    if (e.target?.classList) {
      e.target.classList.add('dragging');
    }
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'group',
      groupKey: groupKey
    }));
    
    this._emit('dragStart', { type: 'group', groupKey });
  }
  
  /**
   * Handle group drag end
   * @param {DragEvent} e - Drag event
   */
  handleGroupDragEnd(e) {
    if (e.target?.classList) {
      e.target.classList.remove('dragging');
    }
    this._cleanupGroupHeaderVisuals();
    this.draggedGroup = null;
    
    this._emit('dragEnd', { type: 'group' });
  }
  
  /**
   * Handle drag over group header
   * @param {DragEvent} e - Drag event
   * @param {string} targetGroupKey - Target group key
   */
  handleGroupDragOver(e, targetGroupKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Check if we're dragging a group or a tab
    const isDraggingGroup = this.draggedGroup && this.draggedGroup !== targetGroupKey;
    const isDraggingTab = this.draggedTab;
    
    if (!isDraggingGroup && !isDraggingTab) return;
    
    // Don't allow dropping a group onto itself
    if (isDraggingGroup && this.draggedGroup === targetGroupKey) return;
    
    // Remove previous indicators
    this._cleanupGroupHeaderVisuals();
    
    const header = e.target?.closest('.tab-group-header');
    if (header) {
      const rect = header.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const headerHeight = rect.height;
      const isOntoCenter = Math.abs(e.clientY - midY) < headerHeight * 0.3;
      
      if (isDraggingTab) {
        // When dragging a tab, always show center drop indicator
        header.classList.add('drag-over', 'drag-over-center');
      } else if (isDraggingGroup) {
        if (isOntoCenter) {
          // Dropping onto the group - check if target is at max depth
          const targetGroupId = targetGroupKey.replace('custom_', '');
          const targetDepth = this.options.getGroupDepth(targetGroupId);
          
          if (targetDepth < 2) {
            // Target is not at max depth - allow dropping into it
            header.classList.add('drag-over', 'drag-over-center');
          } else {
            // Target is at max depth - only allow reorder
            if (e.clientY < midY) {
              header.classList.add('drag-over', 'drag-over-top');
            } else {
              header.classList.add('drag-over', 'drag-over-bottom');
            }
          }
        } else if (e.clientY < midY) {
          header.classList.add('drag-over', 'drag-over-top');
        } else {
          header.classList.add('drag-over', 'drag-over-bottom');
        }
      }
    }
  }
  
  /**
   * Handle group drop
   * @param {DragEvent} e - Drag event
   * @param {string} targetGroupKey - Target group key
   */
  async handleGroupDrop(e, targetGroupKey) {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're dragging a tab
    if (this.draggedTab) {
      await this._handleTabDropOnGroup(e, targetGroupKey);
      this.cleanupDrag();
      return;
    }
    
    // Handle group drop (reorder or change parent)
    if (!this.draggedGroup || this.draggedGroup === targetGroupKey) {
      this.cleanupDrag();
      return;
    }
    
    await this._handleGroupReorder(e, targetGroupKey);
    this.cleanupDrag();
  }
  
  /**
   * Handle tab drop on group header
   * @private
   */
  async _handleTabDropOnGroup(e, targetGroupKey) {
    const tabId = this.draggedTab.id;
    const groupId = targetGroupKey.replace('custom_', '');
    
    try {
      // Check if tab is already in a different custom group
      const currentGroup = this.options.getCustomGroupForTab(tabId);
      
      if (currentGroup && currentGroup.id !== groupId) {
        // Tab is in another group - move it
        await this.options.removeTabFromGroup(tabId, currentGroup.id);
        await this.options.addTabToGroup(tabId, groupId);
      } else if (!currentGroup) {
        // Tab is not in any custom group - just add it
        await this.options.addTabToGroup(tabId, groupId);
      }
      
      this._emit('drop', { type: 'tabToGroupHeader', tabId, groupId });
    } catch (error) {
      console.error('DragDropManager: Error adding tab to group:', error);
      this._emit('error', { action: 'tabDropOnGroup', error });
    }
  }
  
  /**
   * Handle group-to-group drop (reorder/nesting)
   * @private
   */
  async _handleGroupReorder(e, targetGroupKey) {
    const sourceGroupId = this.draggedGroup.replace('custom_', '');
    const targetGroupId = targetGroupKey.replace('custom_', '');
    
    // Get the group manager for group lookups
    const groupManager = this.options.groupManager;
    if (!groupManager) return;
    
    const sourceGroup = groupManager._getGroupById?.(sourceGroupId);
    const targetGroup = groupManager._getGroupById?.(targetGroupId);
    
    if (!sourceGroup || !targetGroup) return;
    
    // Prevent dropping a group onto itself or its descendants
    if (this._isDescendant(groupManager, sourceGroupId, targetGroupId)) {
      console.warn('DragDropManager: Cannot drop a group onto its own descendant');
      return;
    }
    
    // Determine drop position
    const header = e.target?.closest('.tab-group-header');
    const rect = header?.getBoundingClientRect();
    
    if (!rect) return;
    
    const midY = rect.top + rect.height / 2;
    const headerHeight = rect.height;
    const isOntoCenter = Math.abs(e.clientY - midY) < headerHeight * 0.3;
    const targetDepth = this.options.getGroupDepth(targetGroupId);
    
    // Check if Shift key is pressed - if so, make it a root-level group
    if (e.shiftKey) {
      sourceGroup.parentId = null;
    } else if (isOntoCenter && targetDepth < 2) {
      // Dropping onto the group center - make it a child
      sourceGroup.parentId = targetGroupId;
    } else if (isOntoCenter && targetDepth >= 2) {
      // Dropping onto a level 3 group - cannot nest
      console.warn('DragDropManager: Cannot nest group into level 3 subgroup');
    }
    // Dropping above/below - keep current parent (reorder only)
    
    await this.options.saveCustomGroups();
    await this.options.renderTabs();
    
    this._emit('drop', { 
      type: 'groupReorder', 
      sourceGroupId, 
      targetGroupId,
      newParentId: sourceGroup.parentId 
    });
  }
  
  /**
   * Handle group-to-group drop from sorted group area
   * @private
   */
  async _handleGroupToGroupDrop(e, customGroupTabList) {
    const groupKey = customGroupTabList.dataset.groupKey;
    const targetGroupId = groupKey.replace('custom_', '');
    const targetDepth = this.options.getGroupDepth(targetGroupId);
    
    // Check if target is at max depth
    if (targetDepth >= 2) {
      console.warn('DragDropManager: Cannot nest group into level 3 subgroup');
      this.cleanupDrag();
      return;
    }
    
    const sourceGroupId = this.draggedGroup.replace('custom_', '');
    const groupManager = this.options.groupManager;
    const sourceGroup = groupManager?._getGroupById?.(sourceGroupId);
    
    if (!sourceGroup) {
      this.cleanupDrag();
      return;
    }
    
    // Prevent dropping a group onto itself or its descendants
    if (this._isDescendant(groupManager, sourceGroupId, targetGroupId)) {
      console.warn('DragDropManager: Cannot drop a group onto its own descendant');
      this.cleanupDrag();
      return;
    }
    
    // Move source group into target group
    sourceGroup.parentId = targetGroupId;
    await this.options.saveCustomGroups();
    await this.options.renderTabs();
    this.cleanupDrag();
    
    this._emit('drop', { 
      type: 'groupNesting', 
      sourceGroupId, 
      targetGroupId 
    });
  }
  
  // ==================== Container Drag Handlers ====================
  
  /**
   * Handle drag over container (for making groups root-level)
   * @param {DragEvent} e - Drag event
   * @param {HTMLElement} container - The scroll container
   */
  handleContainerDragOver(e, container) {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (data.type === 'group') {
        e.dataTransfer.dropEffect = 'move';
        container?.classList.add('drag-over-empty');
      }
    } catch (err) {
      // Ignore parse errors
    }
  }
  
  /**
   * Handle drag leave from container
   * @param {DragEvent} e - Drag event
   * @param {HTMLElement} container - The scroll container
   */
  handleContainerDragLeave(e, container) {
    if (container && !container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over-empty');
    }
  }
  
  /**
   * Handle drop on container (make group root-level)
   * @param {DragEvent} e - Drag event
   */
  async handleContainerDrop(e) {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (data.type === 'group' && data.groupKey) {
        const groupId = data.groupKey.replace('custom_', '');
        const groupManager = this.options.groupManager;
        const group = groupManager?._getGroupById?.(groupId);
        
        if (group && group.parentId) {
          // Make it a root-level group
          group.parentId = null;
          await this.options.saveCustomGroups();
          await this.options.renderTabs();
          
          this._emit('drop', { type: 'groupToRoot', groupId });
        }
      }
    } catch (err) {
      // Ignore parse errors
    }
  }
  
  // ==================== Utility Methods ====================
  
  /**
   * Check if a group is a descendant of another group
   * @private
   * @param {GroupManager} groupManager - GroupManager instance
   * @param {string} ancestorId - Potential ancestor group ID
   * @param {string} descendantId - Potential descendant group ID
   * @returns {boolean}
   */
  _isDescendant(groupManager, ancestorId, descendantId) {
    if (groupManager.isDescendant) {
      return groupManager.isDescendant(ancestorId, descendantId);
    }
    
    // Fallback implementation
    const child = groupManager?._getGroupById?.(descendantId);
    if (!child) return false;
    if (child.parentId === ancestorId) return true;
    if (!child.parentId) return false;
    return this._isDescendant(groupManager, ancestorId, child.parentId);
  }
  
  /**
   * Clean up all drag visual states
   */
  cleanupDrag() {
    this._cleanupGroupHeaderVisuals();
    this._cleanupGroupVisuals();
    this._cleanupTabVisuals();
    this._cleanupContainerVisuals();
  }
  
  /**
   * Clean up tab visual states
   * @private
   */
  _cleanupTabVisuals() {
    document.querySelectorAll('.tab-item').forEach(item => {
      item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
  }
  
  /**
   * Clean up group visual states
   * @private
   */
  _cleanupGroupVisuals() {
    document.querySelectorAll('.tab-group-tabs').forEach(group => {
      group.classList.remove('drag-over');
    });
    document.querySelectorAll('.tab-group').forEach(group => {
      group.classList.remove('drag-over');
    });
  }
  
  /**
   * Clean up group header visual states
   * @private
   */
  _cleanupGroupHeaderVisuals() {
    document.querySelectorAll('.tab-group-header').forEach(header => {
      header.classList.remove('dragging', 'drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
    });
  }
  
  /**
   * Clean up container visual states
   * @private
   */
  _cleanupContainerVisuals() {
    document.querySelectorAll('.tabs-scroll-container').forEach(container => {
      container.classList.remove('drag-over-empty');
    });
  }
  
  /**
   * Get current drag state
   * @returns {Object} Current drag state
   */
  getDragState() {
    return {
      draggedTab: this.draggedTab,
      draggedIndex: this.draggedIndex,
      draggedGroup: this.draggedGroup,
      isDraggingTab: !!this.draggedTab,
      isDraggingGroup: !!this.draggedGroup && !this.draggedTab
    };
  }
  
  /**
   * Reset drag state
   */
  resetDragState() {
    this.draggedTab = null;
    this.draggedIndex = null;
    this.draggedGroup = null;
    this.cleanupDrag();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DragDropManager;
}