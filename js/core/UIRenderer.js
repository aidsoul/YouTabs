/**
 * UIRenderer.js - YouTabs Extension
 * Manages all UI rendering functionality: tabs, groups, modals, context menus, and visual feedback
 * 
 * This module handles:
 * - Tab and group DOM element creation and rendering
 * - Modal dialogs (prompt, confirm, delete confirmation)
 * - Context menus for tabs and groups
 * - Color picker for group customization
 * - Tab preview tooltips
 * - Collapse/expand functionality for groups and tabs
 * - Search results rendering
 */

class UIRenderer {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.settings - Settings object
   * @param {Function} options.getTabs - Callback to get current tabs
   * @param {Function} options.getFilteredTabs - Callback to get filtered tabs
   * @param {Function} options.getHeadingSearchResults - Callback to get heading search results
   * @param {Function} options.getSearchQuery - Callback to get current search query
   * @param {Function} options.getCustomTabNames - Callback to get custom tab names
   * @param {Function} options.getPageHeadings - Callback to get page headings
   * @param {Function} options.getCustomGroupForTab - Callback to get custom group for a tab
   * @param {Function} options.getGroupHierarchyNames - Callback to get group hierarchy names
   * @param {Function} options.getGroupHierarchyNamesForGroup - Callback to get hierarchy for a group
   * @param {Function} options.getSortedTabsInGroup - Callback to get sorted tabs in a group
   * @param {Function} options.getGroupDepth - Callback to get group nesting depth
   * @param {Function} options.getSubgroups - Callback to get subgroups
   * @param {Function} options.getNestedTabsCount - Callback to get nested tabs count
   * @param {Function} options.getTabDisplayTitle - Callback to get tab display title
   * @param {Function} options.getUrlKey - Callback to get URL key for indexing
   * @param {Object} options.groupManager - GroupManager instance
   * @param {Object} options.dragDropManager - DragDropManager instance
   * @param {Function} options.onTabClick - Callback when tab is clicked
   * @param {Function} options.onTabClose - Callback when tab close button is clicked
   * @param {Function} options.onToggleMute - Callback to toggle tab mute
   * @param {Function} options.onAddTabToGroup - Callback to add tab to group
   * @param {Function} options.onRemoveTabFromGroup - Callback to remove tab from group
   * @param {Function} options.onCreateCustomGroup - Callback to create custom group
   * @param {Function} options.onRenameCustomGroup - Callback to rename custom group
   * @param {Function} options.onDeleteCustomGroup - Callback to delete custom group
   * @param {Function} options.onUpdateGroupColor - Callback to update group color
   * @param {Function} options.onUpdateGroupSorting - Callback to update group sorting
   * @param {Function} options.onSaveCollapsedState - Callback to save collapsed state
   * @param {Function} options.onSaveTabCollapsedState - Callback to save tab collapsed state
   * @param {Function} options.onSetTabCustomName - Callback to set tab custom name
   * @param {Function} options.onRestoreTabOriginalName - Callback to restore tab original name
   * @param {Function} options.onIndexPageHeadings - Callback to index page headings
   * @param {Function} options.onRemovePageHeadings - Callback to remove page headings
   * @param {Function} options.onReloadTab - Callback to reload a tab
   * @param {Function} options.onDiscardTab - Callback to discard a tab
   * @param {Function} options.onSaveCustomGroups - Callback to save custom groups
   * @param {Function} options.onRenderTabs - Callback to trigger tab re-rendering
   * @param {Function} options.onLoadTabs - Callback to reload tabs
   * @param {Function} options.onError - Callback for errors
   */
  constructor(options = {}) {
    this.options = {
      settings: {},
      getTabs: () => [],
      getFilteredTabs: () => [],
      getHeadingSearchResults: () => [],
      getSearchQuery: () => '',
      getCustomTabNames: () => ({}),
      getPageHeadings: () => ({}),
      getCustomGroupForTab: () => null,
      getGroupHierarchyNames: () => [],
      getGroupHierarchyNamesForGroup: () => [],
      getSortedTabsInGroup: () => [],
      getGroupDepth: () => 0,
      getSubgroups: () => [],
      getNestedTabsCount: () => 0,
      getTabDisplayTitle: (tab) => tab?.title || 'New tab',
      getUrlKey: (url) => url,
      groupManager: null,
      dragDropManager: null,
      onTabClick: () => {},
      onTabClose: () => {},
      onToggleMute: () => {},
      onAddTabToGroup: async () => {},
      onRemoveTabFromGroup: async () => {},
      onCreateCustomGroup: async () => {},
      onRenameCustomGroup: async () => {},
      onDeleteCustomGroup: async () => {},
      onUpdateGroupColor: async () => {},
      onUpdateGroupSorting: async () => {},
      onSaveCollapsedState: async () => {},
      onSaveTabCollapsedState: async () => {},
      onSetTabCustomName: async () => {},
      onRestoreTabOriginalName: async () => {},
      onIndexPageHeadings: async () => {},
      onRemovePageHeadings: async () => {},
      onReloadTab: async () => {},
      onDiscardTab: async () => {},
      onSaveCustomGroups: async () => {},
      onRenderTabs: () => {},
      onLoadTabs: async () => {},
      onError: (error) => console.error('UIRenderer error:', error),
      ...options
    };
    
    // ==================== DOM Elements ====================
    
    this.tabsList = null;
    this.tabCount = null;
    this.tabsScrollContainer = null;
    this.tabPreview = null;
    
    // ==================== Modal ====================
    
    this.modal = null;
    this.modalResolve = null;
    
    // ==================== Context Menu ====================
    
    this.contextMenu = null;
    
    // ==================== State ====================
    
    this._renderDebounceTimer = null;
    this._activeSortDropdownHandlers = new Set();
    this._colorPickerCloseHandler = null;
    this._loadedGroups = new Set();
    
    // ==================== Virtual Scrolling ====================
    
    this._virtualScrollEnabled = true;
    this._virtualScrollState = {
      itemHeight: 36, // Default estimated height, will be measured
      bufferSize: 5,  // Extra items to render above/below viewport
      visibleStartIndex: 0,
      visibleEndIndex: 0,
      totalItems: 0,
      scrollTop: 0,
      containerHeight: 0,
      measured: false
    };
    this._scrollRafId = null;
    this._renderRafId = null;
    this._tabElementsCache = new Map(); // Cache for tab elements by tabId
    
    // ==================== Shared DOMParser ====================
    
    this._domParser = new DOMParser();
    
    // ==================== Bind Methods ====================
    
    this._bindMethods();
  }
  
  /**
   * Bind all methods to preserve 'this' context
   * @private
   */
  _bindMethods() {
    // Modal methods
    this.createModal = this.createModal.bind(this);
    this.showPrompt = this.showPrompt.bind(this);
    this.showConfirm = this.showConfirm.bind(this);
    this.showDeleteConfirm = this.showDeleteConfirm.bind(this);
    this.hideModal = this.hideModal.bind(this);
    
    // Context menu methods
    this.showTabContextMenu = this.showTabContextMenu.bind(this);
    this.showGroupContextMenu = this.showGroupContextMenu.bind(this);
    this.showEmptyAreaContextMenu = this.showEmptyAreaContextMenu.bind(this);
    this.positionContextMenu = this.positionContextMenu.bind(this);
    this.hideContextMenu = this.hideContextMenu.bind(this);
    
    // Color picker methods
    this.showColorPicker = this.showColorPicker.bind(this);
    this.openColorPickerWindow = this.openColorPickerWindow.bind(this);
    
    // Group dialog methods
    this.showRenameGroupDialog = this.showRenameGroupDialog.bind(this);
    this.confirmDeleteGroup = this.confirmDeleteGroup.bind(this);
    
    // Rendering methods
    this.renderTabs = this.renderTabs.bind(this);
    this._doRenderTabs = this._doRenderTabs.bind(this);
    this.createTabElement = this.createTabElement.bind(this);
    
    // Collapse/expand methods
    this.toggleGroupCollapse = this.toggleGroupCollapse.bind(this);
    this.toggleTabCollapse = this.toggleTabCollapse.bind(this);
    this.collapseAllDescendants = this.collapseAllDescendants.bind(this);
    this.expandDirectChildren = this.expandDirectChildren.bind(this);
    
    // Preview methods
    this.showTabPreview = this.showTabPreview.bind(this);
    this.updatePreviewPosition = this.updatePreviewPosition.bind(this);
    this.hideTabPreview = this.hideTabPreview.bind(this);
    
    // Utility methods
    this.escapeHtml = this.escapeHtml.bind(this);
    this.getInitial = this.getInitial.bind(this);
    this.isValidFaviconUrl = this.isValidFaviconUrl.bind(this);
    this.formatUrl = this.formatUrl.bind(this);
    this.getGroupInfo = this.getGroupInfo.bind(this);
    
    // Virtual scrolling methods
    this._onScroll = this._onScroll.bind(this);
    this._updateVirtualScroll = this._updateVirtualScroll.bind(this);
    this._measureItemHeight = this._measureItemHeight.bind(this);
  }
  
  // ==================== DOM Element Setup ====================
  
  /**
   * Set DOM elements for rendering
   * @param {Object} elements - DOM elements
   * @param {HTMLElement} elements.tabsList - Tabs list container
   * @param {HTMLElement} elements.tabCount - Tab count element
   * @param {HTMLElement} elements.tabsScrollContainer - Scroll container
   * @param {HTMLElement} elements.tabPreview - Tab preview element
   */
  setElements(elements) {
    this.tabsList = elements.tabsList || null;
    this.tabCount = elements.tabCount || null;
    this.tabsScrollContainer = elements.tabsScrollContainer || null;
    this.tabPreview = elements.tabPreview || null;
    
    // Setup scroll listener for virtual scrolling
    if (this.tabsScrollContainer && this._virtualScrollEnabled) {
      this.tabsScrollContainer.removeEventListener('scroll', this._onScroll);
      this.tabsScrollContainer.addEventListener('scroll', this._onScroll, { passive: true });
      
      // Measure container height
      this._virtualScrollState.containerHeight = this.tabsScrollContainer.clientHeight || 400;
    }
  }
  
  // ==================== Modal Methods ====================
  
  /**
   * Create custom modal element
   */
  createModal() {
    if (this.modal) return;
    
    const modalHTML = `
      <div class="modal-overlay" id="customModalOverlay">
        <div class="custom-modal">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle"></h3>
            <button class="modal-close" id="modalClose" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-message" id="modalMessage"></p>
            <div class="modal-input-wrapper" id="modalInputWrapper" style="display: none;">
              <input type="text" class="modal-input" id="modalInput" placeholder="Enter name...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-cancel" id="modalCancel">Cancel</button>
            <button class="modal-btn modal-btn-confirm" id="modalConfirm">OK</button>
          </div>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = modalHTML;
    this.modal = container.firstElementChild;
    document.body.appendChild(this.modal);
    
    // Bind modal events - query relative to the modal to avoid conflicts
    const overlay = this.modal;
    const closeBtn = this.modal.querySelector('#modalClose');
    const cancelBtn = this.modal.querySelector('#modalCancel');
    const confirmBtn = this.modal.querySelector('#modalConfirm');
    const input = this.modal.querySelector('#modalInput');
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideModal(false);
      }
    });
    
    // Close button
    closeBtn.addEventListener('click', () => {
      this.hideModal(false);
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      this.hideModal(false);
    });
    
    // Confirm button
    confirmBtn.addEventListener('click', () => {
      const inputWrapper = this.modal.querySelector('#modalInputWrapper');
      if (inputWrapper.style.display !== 'none') {
        this.hideModal(input.value);
      } else {
        this.hideModal(true);
      }
    });
    
    // Enter key in input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.hideModal(input.value);
      } else if (e.key === 'Escape') {
        this.hideModal(false);
      }
    });
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.hideModal(false);
      }
    });
  }
  
  /**
   * Show prompt modal (replacement for prompt())
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {string} defaultValue - Default input value
   * @returns {Promise<string|boolean>} User input or false if cancelled
   */
  showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      if (!this.modal) {
        this.createModal();
      }
      
      this.modalResolve = resolve;
      
      const modalTitle = this.modal.querySelector('#modalTitle');
      const modalMessage = this.modal.querySelector('#modalMessage');
      const modalInputWrapper = this.modal.querySelector('#modalInputWrapper');
      const modalInput = this.modal.querySelector('#modalInput');
      const modalConfirm = this.modal.querySelector('#modalConfirm');
      const modalCancel = this.modal.querySelector('#modalCancel');
      
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalInputWrapper.style.display = 'block';
      modalInput.value = defaultValue;
      modalInput.placeholder = 'Enter name...';
      
      modalConfirm.textContent = 'OK';
      modalCancel.textContent = 'Cancel';
      
      this.modal.classList.add('active');
      
      // Focus input
      setTimeout(() => modalInput.focus(), 50);
    });
  }
  
  /**
   * Show confirm modal (replacement for confirm())
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @returns {Promise<boolean>} True if confirmed, false otherwise
   */
  showConfirm(title, message) {
    return new Promise((resolve) => {
      if (!this.modal) {
        this.createModal();
      }
      
      this.modalResolve = resolve;
      
      const modalTitle = this.modal.querySelector('#modalTitle');
      const modalMessage = this.modal.querySelector('#modalMessage');
      const modalInputWrapper = this.modal.querySelector('#modalInputWrapper');
      const modalConfirm = this.modal.querySelector('#modalConfirm');
      const modalCancel = this.modal.querySelector('#modalCancel');
      
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalInputWrapper.style.display = 'none';
      
      modalConfirm.textContent = 'OK';
      modalCancel.textContent = 'Cancel';
      
      this.modal.classList.add('active');
    });
  }
  
  /**
   * Show delete confirmation modal
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @returns {Promise<boolean>} True if confirmed, false otherwise
   */
  showDeleteConfirm(title, message) {
    return new Promise((resolve) => {
      if (!this.modal) {
        this.createModal();
      }
      
      this.modalResolve = resolve;
      
      const modalTitle = this.modal.querySelector('#modalTitle');
      const modalMessage = this.modal.querySelector('#modalMessage');
      const modalInputWrapper = this.modal.querySelector('#modalInputWrapper');
      const modalConfirm = this.modal.querySelector('#modalConfirm');
      const modalCancel = this.modal.querySelector('#modalCancel');
      
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalInputWrapper.style.display = 'none';
      
      modalConfirm.textContent = 'Delete';
      modalConfirm.classList.remove('modal-btn-confirm');
      modalConfirm.classList.add('modal-btn-danger');
      modalCancel.textContent = 'Cancel';
      
      this.modal.classList.add('active');
    });
  }
  
  /**
   * Hide modal and resolve promise
   * @param {*} value - Value to resolve with
   */
  hideModal(value) {
    if (!this.modal) return;
    
    this.modal.classList.remove('active');
    
    // Reset confirm button styling
    const modalConfirm = this.modal.querySelector('#modalConfirm');
    if (modalConfirm) {
      modalConfirm.classList.remove('modal-btn-danger');
      modalConfirm.classList.add('modal-btn-confirm');
    }
    
    if (this.modalResolve) {
      this.modalResolve(value);
      this.modalResolve = null;
    }
  }
  
  // ==================== Context Menu Methods ====================
  
  /**
   * Show context menu for tabs
   * @param {Event} e - Context menu event
   * @param {number} tabId - Tab ID
   * @param {Object} customGroup - Custom group the tab belongs to
   * @param {Object} tab - Tab object
   * @param {Object} options - Additional options
   */
  showTabContextMenu(e, tabId, customGroup, tab, options = {}) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    const customTabNames = this.options.getCustomTabNames();
    const tabs = this.options.getTabs();
    const hasCustomName = customTabNames[Number(tabId)]?.customName;
    const customTabNameData = customTabNames[Number(tabId)];
    const realName = customTabNameData?.originalName || tab?.title || 'New tab';
    
    // Show real tab name in context menu (especially useful when custom name is set)
    if (hasCustomName) {
      const realNameItem = document.createElement('div');
      realNameItem.className = 'context-menu-item context-menu-info';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'context-menu-label';
      labelSpan.textContent = 'Real name:';
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'context-menu-value';
      valueSpan.textContent = realName;
      
      const container = document.createElement('span');
      container.appendChild(labelSpan);
      container.appendChild(valueSpan);
      
      realNameItem.appendChild(container);
      realNameItem.style.pointerEvents = 'none';
      menu.appendChild(realNameItem);
      
      // Divider after real name
      const divider = document.createElement('div');
      divider.className = 'context-menu-divider';
      menu.appendChild(divider);
    }
    
    // Rename option
    const renameItem = document.createElement('div');
    renameItem.className = 'context-menu-item';
    renameItem.textContent = 'Rename';
    renameItem.addEventListener('click', async () => {
      const currentName = this.options.getTabDisplayTitle(tab);
      const newName = await this.showPrompt('Rename Tab', 'Enter new name:', currentName);
      if (newName && typeof newName === 'string' && newName.trim() && newName !== currentName) {
        await this.options.onSetTabCustomName(tabId, newName.trim());
      }
      this.hideContextMenu();
    });
    menu.appendChild(renameItem);
    
    // Restore original name option (only if custom name exists)
    if (hasCustomName) {
      const restoreItem = document.createElement('div');
      restoreItem.className = 'context-menu-item';
      restoreItem.textContent = 'Restore original name';
      restoreItem.addEventListener('click', async () => {
        await this.options.onRestoreTabOriginalName(tabId);
        this.hideContextMenu();
      });
      menu.appendChild(restoreItem);
    }
    
    // Divider
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    menu.appendChild(divider);
    
    // Add to group submenu
    const groupManager = this.options.groupManager;
    if (groupManager && groupManager.customGroups.length > 0) {
      // Show "Add to group" with submenu when there are existing groups
      const addToGroupItem = document.createElement('div');
      addToGroupItem.className = 'context-menu-item has-submenu';
      const span = document.createElement('span');
      span.textContent = 'Add to group';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('fill', 'currentColor');
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M4.5 2L8.5 6L4.5 10');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      
      svg.appendChild(path);
      addToGroupItem.appendChild(span);
      addToGroupItem.appendChild(svg);
      
      // Create submenu for groups
      const submenu = document.createElement('div');
      submenu.className = 'context-submenu';
      
      // Add option to create new group
      const newGroupItem = document.createElement('div');
      newGroupItem.className = 'context-menu-item';
      newGroupItem.textContent = 'Create group...';
      newGroupItem.addEventListener('click', async () => {
        const groupName = await this.showPrompt('New Group', 'Enter group name:', 'New group');
        if (groupName && typeof groupName === 'string' && groupName.trim()) {
          const newGroup = await this.options.onCreateCustomGroup(groupName.trim());
          if (newGroup) {
            await this.options.onAddTabToGroup(tabId, newGroup.id);
          }
        }
        this.hideContextMenu();
      });
      submenu.appendChild(newGroupItem);
      
      // Add existing groups
      const submenuDivider = document.createElement('div');
      submenuDivider.className = 'context-menu-divider';
      submenu.appendChild(submenuDivider);
      
      // Search input for filtering groups
      const searchContainer = document.createElement('div');
      searchContainer.className = 'context-menu-search';
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search group...';
      searchInput.className = 'context-menu-search-input';
      searchInput.addEventListener('click', (e) => e.stopPropagation());
      searchInput.addEventListener('keydown', (e) => e.stopPropagation());
      searchInput.addEventListener('input', (e) => e.stopPropagation());
      searchContainer.appendChild(searchInput);
      submenu.appendChild(searchContainer);
      
      // Groups container for filtering
      const groupsContainer = document.createElement('div');
      groupsContainer.className = 'context-menu-groups-container';
      
      // Sort groups: root groups first, then by depth
      const sortedGroups = [...groupManager.customGroups].sort((a, b) => {
        const depthA = this.options.getGroupDepth(a.id);
        const depthB = this.options.getGroupDepth(b.id);
        if (depthA !== depthB) return depthA - depthB;
        return a.name.localeCompare(b.name);
      });
      
      sortedGroups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'context-menu-item group-search-item';
        
        // Get full hierarchy path for search
        const hierarchyNames = this.options.getGroupHierarchyNamesForGroup(group.id);
        groupItem.dataset.groupName = hierarchyNames.join(' ').toLowerCase();
        
        const depth = this.options.getGroupDepth(group.id);
        const indent = depth > 0 ? '└'.repeat(depth) + ' ' : '';
        const span = document.createElement('span');
        span.textContent = indent + group.name;
        groupItem.appendChild(span);
        if (depth > 0) {
          groupItem.style.paddingLeft = (8 + depth * 12) + 'px';
        }
        groupItem.addEventListener('click', async () => {
          try {
            await this.options.onAddTabToGroup(tabId, group.id);
          } catch (error) {
            this.options.onError(error);
          }
          this.hideContextMenu();
        });
        groupsContainer.appendChild(groupItem);
      });
      
      submenu.appendChild(groupsContainer);
      
      // Filter groups on search
      searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const items = groupsContainer.querySelectorAll('.group-search-item');
        items.forEach(item => {
          const groupName = item.dataset.groupName;
          item.style.display = groupName.includes(searchTerm) ? '' : 'none';
        });
      });
      
      // Append submenu and menu item when there are groups
      addToGroupItem.appendChild(submenu);
      menu.appendChild(addToGroupItem);
    } else {
      // No custom groups exist - show "Create group..." as a standalone item at this level
      const createGroupItem = document.createElement('div');
      createGroupItem.className = 'context-menu-item';
      createGroupItem.textContent = 'Create group...';
      createGroupItem.addEventListener('click', async () => {
        const groupName = await this.showPrompt('New Group', 'Enter group name:', 'New group');
        if (groupName && typeof groupName === 'string' && groupName.trim()) {
          const newGroup = await this.options.onCreateCustomGroup(groupName.trim());
          if (newGroup) {
            await this.options.onAddTabToGroup(tabId, newGroup.id);
          }
        }
        this.hideContextMenu();
      });
      menu.appendChild(createGroupItem);
    }
    
    // If tab is already in a group, show remove option
    if (customGroup) {
      const removeItem = document.createElement('div');
      removeItem.className = 'context-menu-item';
      removeItem.textContent = 'Remove from group';
      removeItem.addEventListener('click', async () => {
        await this.options.onRemoveTabFromGroup(tabId, customGroup.id);
        this.hideContextMenu();
      });
      menu.appendChild(removeItem);
    }
    
    // Divider before unload/reload option
    const divider2 = document.createElement('div');
    divider2.className = 'context-menu-divider';
    menu.appendChild(divider2);
    
    // Check if tab is discarded (unloaded from memory)
    const isTabDiscarded = tab?.discarded;
    const isTabActive = tab?.active;
    
    if (isTabDiscarded) {
      // Tab is unloaded - show "Load" option
      const loadItem = document.createElement('div');
      loadItem.className = 'context-menu-item';
      const span = document.createElement('span');
      span.textContent = 'Load tab';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.style.marginLeft = '8px';
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M8 5v14l11-7z');
      
      svg.appendChild(path);
      loadItem.appendChild(span);
      loadItem.appendChild(svg);
      loadItem.addEventListener('click', async () => {
        try {
          await this.options.onReloadTab(tabId);
        } catch (error) {
          console.error('Error loading tab:', error);
        }
        this.hideContextMenu();
      });
      menu.appendChild(loadItem);
    } else if (!isTabActive) {
      // Tab is loaded and not active - show "Unload" option
      const unloadItem = document.createElement('div');
      unloadItem.className = 'context-menu-item';
      unloadItem.innerHTML = `
        <span>Unload from memory</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 8px;">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      unloadItem.addEventListener('click', async () => {
        try {
          await this.options.onDiscardTab(tabId);
        } catch (error) {
          console.error('Error unloading tab:', error);
        }
        this.hideContextMenu();
      });
      menu.appendChild(unloadItem);
    } else {
      // Tab is active - show disabled "Unload" option with explanation
      const unloadItem = document.createElement('div');
      unloadItem.className = 'context-menu-item disabled';
      unloadItem.innerHTML = `
        <span>Unload from memory</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 8px; opacity: 0.5;">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      unloadItem.title = 'Cannot unload the active tab';
      menu.appendChild(unloadItem);
    }
    
    // Divider before index options
    const indexDivider = document.createElement('div');
    indexDivider.className = 'context-menu-divider';
    menu.appendChild(indexDivider);
    
    // Check if tab is indexed (use URL key, not tabId)
    const tabUrlKey = tab ? this.options.getUrlKey(tab.url) : null;
    const pageHeadings = this.options.getPageHeadings();
    const isIndexed = tabUrlKey && pageHeadings && pageHeadings[tabUrlKey] && pageHeadings[tabUrlKey].length > 0;
    
    if (isIndexed) {
      // Show indexed info and update/remove options
      const headings = pageHeadings[tabUrlKey];
      const headingCount = headings.filter(h => h.type === 'heading').length;
      const otherCount = headings.length - headingCount;
      
      const indexedInfo = document.createElement('div');
      indexedInfo.className = 'context-menu-item context-menu-info';
      const indexedSpan = document.createElement('span');
      indexedSpan.textContent = `Indexed: ${headings.length} items`;
      indexedInfo.appendChild(indexedSpan);
      indexedInfo.style.pointerEvents = 'none';
      menu.appendChild(indexedInfo);
      
      // Remove index option
      const removeIndexItem = document.createElement('div');
      removeIndexItem.className = 'context-menu-item';
      removeIndexItem.textContent = 'Remove index';
      removeIndexItem.addEventListener('click', async () => {
        await this.options.onRemovePageHeadings(tabId);
        this.hideContextMenu();
        this.options.onRenderTabs();
      });
      menu.appendChild(removeIndexItem);
    } else {
      // Create index option
      const createIndexItem = document.createElement('div');
      createIndexItem.className = 'context-menu-item';
      createIndexItem.textContent = 'Create index';
      createIndexItem.addEventListener('click', async () => {
        this.hideContextMenu();
        await this.options.onIndexPageHeadings(tabId);
        this.options.onRenderTabs();
      });
      menu.appendChild(createIndexItem);
    }
    
    this.positionContextMenu(menu, e);
    document.body.appendChild(menu);
    this.contextMenu = menu;
  }
  
  /**
   * Show context menu for groups
   * @param {Event} e - Context menu event
   * @param {string} groupId - Group ID
   */
  showGroupContextMenu(e, groupId) {
    const groupManager = this.options.groupManager;
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Check if this is a nested group (has parent)
    const group = groupManager._getGroupById(groupId);
    const isNested = group && group.parentId;
    
    // Rename option
    const renameItem = document.createElement('div');
    renameItem.className = 'context-menu-item';
    renameItem.textContent = 'Rename';
    renameItem.addEventListener('click', () => {
      this.showRenameGroupDialog(groupId);
      this.hideContextMenu();
    });
    menu.appendChild(renameItem);
    
    // Color picker - only for root groups (not nested)
    if (!isNested) {
      const colorItem = document.createElement('div');
      colorItem.className = 'context-menu-item';
      colorItem.textContent = 'Change color';
      colorItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideContextMenu();
        // Get click position for the picker window
        const rect = e.target.getBoundingClientRect();
        this.openColorPickerWindow(groupId, { x: rect.left, y: rect.bottom + 4 });
      });
      menu.appendChild(colorItem);
    }
    
    // Add subgroup option if not at max depth (3 levels)
    const currentDepth = this.options.getGroupDepth(groupId);
    if (currentDepth < 2) { // depth 0 = root, depth 1 = level 2, depth 2 = level 3
      const addSubgroupItem = document.createElement('div');
      addSubgroupItem.className = 'context-menu-item';
      addSubgroupItem.textContent = 'Add subgroup';
      addSubgroupItem.addEventListener('click', async () => {
        const subgroupName = await this.showPrompt('New Subgroup', 'Enter subgroup name:', 'New subgroup');
        if (subgroupName && typeof subgroupName === 'string' && subgroupName.trim()) {
          await this.options.onCreateCustomGroup(subgroupName.trim(), 'blue', groupId);
        }
        this.hideContextMenu();
      });
      menu.appendChild(addSubgroupItem);
    }
    
    // Delete option
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete group';
    deleteItem.addEventListener('click', () => {
      this.confirmDeleteGroup(groupId);
      this.hideContextMenu();
    });
    menu.appendChild(deleteItem);
    
    this.positionContextMenu(menu, e);
    document.body.appendChild(menu);
    this.contextMenu = menu;
  }
  
  /**
   * Show context menu for empty area
   * @param {Event} e - Context menu event
   */
  showEmptyAreaContextMenu(e) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Create group option
    const createGroupItem = document.createElement('div');
    createGroupItem.className = 'context-menu-item';
    createGroupItem.textContent = 'Create group';
    createGroupItem.addEventListener('click', async () => {
      const groupName = await this.showPrompt('New Group', 'Enter group name:', 'New group');
      if (groupName && typeof groupName === 'string' && groupName.trim()) {
        await this.options.onCreateCustomGroup(groupName.trim());
      }
      this.hideContextMenu();
    });
    menu.appendChild(createGroupItem);
    
    this.positionContextMenu(menu, e);
    document.body.appendChild(menu);
    this.contextMenu = menu;
  }
  
  /**
   * Position context menu
   * @param {HTMLElement} menu - Context menu element
   * @param {Event} e - Event with mouse position
   */
  positionContextMenu(menu, e) {
    // Menu might not be in DOM yet, so we need to temporarily add it to get dimensions
    const wasInDOM = menu.parentElement !== null;
    if (!wasInDOM) {
      menu.style.visibility = 'hidden';
      menu.style.position = 'fixed';
      document.body.appendChild(menu);
    }
    
    const rect = menu.getBoundingClientRect();
    
    // Get the sidebar container bounds
    const container = document.querySelector('.you-tabs-container') || document.body;
    const containerRect = container.getBoundingClientRect();
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Check if menu would go off the right edge - open to the left instead
    if (x + rect.width > containerRect.right) {
      // Try opening to the left of the click position
      const leftSpace = x - containerRect.left;
      
      if (leftSpace > rect.width + 10) {
        // There's enough space on the left, open left
        x = x - rect.width - 8;
      } else {
        // Not enough space on left either, use right edge as fallback
        x = containerRect.right - rect.width - 8;
      }
    }
    
    // Also check if too far left
    if (x < containerRect.left) {
      x = containerRect.left + 8;
    }
    
    // Check vertical boundaries
    if (y + rect.height > containerRect.bottom) {
      y = containerRect.bottom - rect.height - 8;
    }
    if (y < containerRect.top) {
      y = containerRect.top + 8;
    }
    
    // Remove from DOM if it wasn't there before, then add it back positioned
    if (!wasInDOM) {
      document.body.removeChild(menu);
      menu.style.visibility = '';
    }
    
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }
  
  /**
   * Hide context menu
   */
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
    // Also remove any color picker dropdowns
    const pickers = document.querySelectorAll('.color-picker-dropdown');
    pickers.forEach(p => p.remove());
  }
  
  // ==================== Color Picker Methods ====================
  
  /**
   * Show color picker for group
   * @param {string} groupId - Group ID
   * @param {Event} event - Click event
   */
  showColorPicker(groupId, event) {
    const groupManager = this.options.groupManager;
    
    // Create color picker dropdown
    const existingPicker = document.querySelector('.color-picker-dropdown');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    const picker = document.createElement('div');
    picker.className = 'color-picker-dropdown modern-picker';
    
    // Get current color
    const group = groupManager._getGroupById(groupId);
    const currentColor = group?.color || '#2196f3';
    const currentHsl = groupManager.hexToHsl(currentColor);
    
    // Hue slider
    const hueSlider = document.createElement('input');
    hueSlider.type = 'range';
    hueSlider.className = 'color-hue-slider';
    hueSlider.min = '0';
    hueSlider.max = '360';
    hueSlider.value = currentHsl.h;
    
    // Saturation/Lightness box
    const satLightBox = document.createElement('div');
    satLightBox.className = 'color-sat-light-box';
    
    const satLightIndicator = document.createElement('div');
    satLightIndicator.className = 'color-indicator';
    
    // Color preview and hex input row
    const previewRow = document.createElement('div');
    previewRow.className = 'color-picker-preview-row';
    
    const colorPreview = document.createElement('div');
    colorPreview.className = 'color-preview-small';
    colorPreview.style.backgroundColor = currentColor;
    
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'color-hex-input';
    hexInput.value = currentColor;
    hexInput.maxLength = 7;
    
    previewRow.appendChild(colorPreview);
    previewRow.appendChild(hexInput);
    
    // Update function
    const updateColor = (h, s, l) => {
      const hex = groupManager.hslToHex(h, s, l);
      colorPreview.style.backgroundColor = hex;
      hexInput.value = hex;
      satLightBox.style.background = `linear-gradient(to right, #fff, hsl(${h}, 100%, 50%)), linear-gradient(to top, #000, transparent)`;
      satLightIndicator.style.left = `${s}%`;
      satLightIndicator.style.top = `${100 - l}%`;
      satLightIndicator.style.backgroundColor = `hsl(${h}, ${s}%, ${l}%)`;
    };
    
    // Initialize
    updateColor(currentHsl.h, currentHsl.s, currentHsl.l);
    
    // Event listeners
    hueSlider.addEventListener('input', (e) => {
      const h = parseInt(e.target.value);
      updateColor(h, currentHsl.s, currentHsl.l);
    });
    
    // Click on saturation/lightness box
    satLightBox.addEventListener('click', (e) => {
      const rect = satLightBox.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const l = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
      const h = parseInt(hueSlider.value);
      updateColor(h, s, l);
    });
    
    // Dragging for saturation/lightness
    let isDragging = false;
    satLightBox.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = satLightBox.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const l = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
      const h = parseInt(hueSlider.value);
      updateColor(h, s, l);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = satLightBox.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const l = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
      const h = parseInt(hueSlider.value);
      updateColor(h, s, l);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // Hex input
    hexInput.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        const hsl = groupManager.hexToHsl(val);
        hueSlider.value = hsl.h;
        updateColor(hsl.h, hsl.s, hsl.l);
      }
    });
    
    hexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        hexInput.blur();
      }
    });
    
    // Add elements to picker
    picker.appendChild(hueSlider);
    picker.appendChild(satLightBox);
    picker.appendChild(previewRow);
    
    // Add predefined colors as quick select
    const quickColors = document.createElement('div');
    quickColors.className = 'color-quick-select';
    
    groupManager.groupColors.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.className = 'color-picker-btn';
      colorBtn.style.backgroundColor = color.color;
      colorBtn.title = color.name;
      
      colorBtn.addEventListener('click', () => {
        this.options.onUpdateGroupColor(groupId, color.color);
        picker.remove();
      });
      
      quickColors.appendChild(colorBtn);
    });
    
    picker.appendChild(quickColors);
    
    // Position the picker near the clicked button
    const rect = event.target.closest('.group-color-btn').getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;
    
    // Store closePicker function reference for cleanup
    const closePicker = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    };
    
    // Add click handler to close picker when clicking outside
    setTimeout(() => document.addEventListener('click', closePicker), 0);
    
    // Store reference for cleanup
    this._colorPickerCloseHandler = closePicker;
  }
  
  /**
   * Open color picker in separate window
   * @param {string} groupId - Group ID
   * @param {Object} position - Position {x, y}
   */
  openColorPickerWindow(groupId, position) {
    const groupManager = this.options.groupManager;
    
    // Remove any existing color picker window
    const existingPicker = document.querySelector('.color-picker-window');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    // Get current color
    const group = groupManager._getGroupById(groupId);
    const currentColor = group?.color || '#2196f3';
    const currentHsl = groupManager.hexToHsl(currentColor);
    
    // Create window container
    const pickerWindow = document.createElement('div');
    pickerWindow.className = 'color-picker-window';
    pickerWindow.style.position = 'fixed';
    pickerWindow.style.left = position.x + 'px';
    pickerWindow.style.top = position.y + 'px';
    pickerWindow.style.zIndex = '10000';
    
    // Header
    const header = document.createElement('div');
    header.className = 'color-picker-header';
    header.innerHTML = '<span>Color Picker</span>';
    header.style.cursor = 'move';
    
    // Drag functionality
    let isWindowDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    header.addEventListener('mousedown', (e) => {
      isWindowDragging = true;
      const rect = pickerWindow.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      pickerWindow.style.transition = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isWindowDragging) return;
      pickerWindow.style.left = (e.clientX - dragOffsetX) + 'px';
      pickerWindow.style.top = (e.clientY - dragOffsetY) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      isWindowDragging = false;
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'color-picker-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => pickerWindow.remove());
    header.appendChild(closeBtn);
    
    // Hue slider
    const hueContainer = document.createElement('div');
    hueContainer.className = 'color-picker-section';
    const hueLabel = document.createElement('label');
    hueLabel.textContent = 'Hue';
    hueContainer.appendChild(hueLabel);
    
    const hueSlider = document.createElement('input');
    hueSlider.type = 'range';
    hueSlider.className = 'color-hue-slider';
    hueSlider.min = '0';
    hueSlider.max = '360';
    hueSlider.value = currentHsl.h;
    hueContainer.appendChild(hueSlider);
    
    // Saturation/Lightness box
    const satLightContainer = document.createElement('div');
    satLightContainer.className = 'color-picker-section';
    const satLightLabel = document.createElement('label');
    satLightLabel.textContent = 'Saturation / Lightness';
    satLightContainer.appendChild(satLightLabel);
    
    const satLightBox = document.createElement('div');
    satLightBox.className = 'color-sat-light-box';
    
    const satLightIndicator = document.createElement('div');
    satLightIndicator.className = 'color-indicator';
    
    // Color preview row
    const previewRow = document.createElement('div');
    previewRow.className = 'color-picker-preview-row';
    
    const colorPreview = document.createElement('div');
    colorPreview.className = 'color-preview-large';
    colorPreview.style.backgroundColor = currentColor;
    
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'color-hex-input';
    hexInput.value = currentColor;
    hexInput.maxLength = 7;
    hexInput.placeholder = '#000000';
    
    previewRow.appendChild(colorPreview);
    previewRow.appendChild(hexInput);
    
    // Quick colors
    const quickColorsContainer = document.createElement('div');
    quickColorsContainer.className = 'color-picker-section';
    const quickLabel = document.createElement('label');
    quickLabel.textContent = 'Quick Colors';
    quickColorsContainer.appendChild(quickLabel);
    
    const quickColors = document.createElement('div');
    quickColors.className = 'color-quick-grid';
    groupManager.groupColors.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'color-quick-btn';
      btn.style.backgroundColor = color.color;
      btn.title = color.name;
      btn.addEventListener('click', async () => {
        await this.options.onUpdateGroupColor(groupId, color.color);
        pickerWindow.remove();
      });
      quickColors.appendChild(btn);
    });
    quickColorsContainer.appendChild(quickColors);
    
    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'color-picker-apply';
    applyBtn.textContent = 'Apply Color';
    
    // Update function
    const updateColor = (h, s, l) => {
      const hex = groupManager.hslToHex(h, s, l);
      colorPreview.style.backgroundColor = hex;
      hexInput.value = hex;
      satLightBox.style.background = `linear-gradient(to right, #fff, hsl(${h}, 100%, 50%)), linear-gradient(to top, #000, transparent)`;
      satLightIndicator.style.left = `${s}%`;
      satLightIndicator.style.top = `${100 - l}%`;
      satLightIndicator.style.backgroundColor = `hsl(${h}, ${s}%, ${l}%)`;
    };
    
    // Initialize
    updateColor(currentHsl.h, currentHsl.s, currentHsl.l);
    
    // Event listeners
    hueSlider.addEventListener('input', (e) => {
      const h = parseInt(e.target.value);
      updateColor(h, currentHsl.s, currentHsl.l);
    });
    
    // Sat/Light box click and drag
    let isDragging = false;
    
    const handleSatLightMove = (e) => {
      const rect = satLightBox.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const l = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
      const h = parseInt(hueSlider.value);
      updateColor(h, s, l);
    };
    
    satLightBox.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleSatLightMove(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) handleSatLightMove(e);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // Close on outside click
    const closeOnOutside = (e) => {
      if (!pickerWindow.contains(e.target)) {
        pickerWindow.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
    
    // Hex input
    hexInput.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        const hsl = groupManager.hexToHsl(val);
        hueSlider.value = hsl.h;
        updateColor(hsl.h, hsl.s, hsl.l);
      }
    });
    
    hexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        hexInput.blur();
      }
    });
    
    // Apply button
    applyBtn.addEventListener('click', async () => {
      await this.options.onUpdateGroupColor(groupId, hexInput.value);
      pickerWindow.remove();
    });
    
    // Assemble
    satLightBox.appendChild(satLightIndicator);
    pickerWindow.appendChild(header);
    pickerWindow.appendChild(hueContainer);
    pickerWindow.appendChild(satLightContainer);
    pickerWindow.appendChild(satLightBox);
    pickerWindow.appendChild(previewRow);
    pickerWindow.appendChild(quickColorsContainer);
    pickerWindow.appendChild(applyBtn);
    
    document.body.appendChild(pickerWindow);
    
    // Ensure it stays in viewport
    const rect = pickerWindow.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      pickerWindow.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      pickerWindow.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }
  
  // ==================== Group Dialog Methods ====================
  
  /**
   * Show rename group dialog
   * @param {string} groupId - Group ID
   */
  async showRenameGroupDialog(groupId) {
    const groupManager = this.options.groupManager;
    const group = groupManager._getGroupById(groupId);
    if (!group) return;
    
    const newName = await this.showPrompt('Rename Group', 'Enter new group name:', group.name);
    if (newName && typeof newName === 'string' && newName.trim() !== '') {
      await this.options.onRenameCustomGroup(groupId, newName.trim());
    }
  }
  
  /**
   * Confirm delete group
   * @param {string} groupId - Group ID
   */
  async confirmDeleteGroup(groupId) {
    const groupManager = this.options.groupManager;
    const group = groupManager._getGroupById(groupId);
    if (!group) return;
    
    const tabCount = group.tabIds.length;
    const message = tabCount > 0
      ? `Delete group "${group.name}" and all ${tabCount} tabs in it?`
      : `Delete group "${group.name}"?`;
    
    if (await this.showDeleteConfirm('Delete Group', message)) {
      await this.options.onDeleteCustomGroup(groupId);
    }
  }
  
  // ==================== Rendering Methods ====================
  
  /**
   * Render tabs with debouncing
   */
  renderTabs() {
    if (!this.tabsList) return;
    
    // Cancel any pending RAF render
    if (this._renderRafId) {
      cancelAnimationFrame(this._renderRafId);
    }
    
    // Use requestAnimationFrame for rendering - syncs with browser paint cycle
    this._renderRafId = requestAnimationFrame(() => {
      this._renderRafId = null;
      this._doRenderTabs();
    });
  }
  
  /**
   * Actually render tabs to DOM
   * @private
   */
  _doRenderTabs() {
    if (!this.tabsList) return;
    
    this.tabsList.innerHTML = '';
    
    // Use DocumentFragment for batch DOM operations - reduces reflow/repaint
    const fragment = document.createDocumentFragment();
    
    const tabs = this.options.getTabs();
    const searchQuery = this.options.getSearchQuery();
    const filteredTabs = this.options.getFilteredTabs();
    const headingSearchResults = this.options.getHeadingSearchResults();
    
    // Determine which tabs to display
    const displayTabs = searchQuery ? filteredTabs : tabs;
    
    // Update tab count
    if (this.tabCount) {
      if (searchQuery) {
        const headingCount = headingSearchResults?.length || 0;
        this.tabCount.textContent = `${displayTabs.length} / ${tabs.length}` + (headingCount > 0 ? ` (+${headingCount} headings)` : '');
      } else {
        this.tabCount.textContent = tabs.length;
      }
    }
    
    // When searching, show tabs first without grouping
    if (searchQuery && displayTabs.length > 0) {
      displayTabs.forEach((tab, index) => {
        const tabElement = this.createTabElement(tab, index, 'search');
        fragment.appendChild(tabElement);
      });
    }
    
    // Render heading search results if there are any (shown after tabs)
    if (searchQuery && headingSearchResults && headingSearchResults.length > 0) {
      const headingResultsContainer = document.createElement('div');
      headingResultsContainer.className = 'heading-search-results';
      headingResultsContainer.dataset.noGroup = "true";
      
      // Group heading results by type
      const groupedResults = {};
      const typeLabels = {
        'heading': 'Headings',
        'paragraph': 'Paragraphs',
        'link': 'Links',
        'image': 'Images',
        'div': 'Divs',
        'list': 'Lists',
        'listItem': 'List Items',
        'file': 'File Inputs',
        'fileDownload': 'Downloads',
        'video': 'Videos',
        'audio': 'Audio',
        'videoEmbed': 'Embedded Videos',
        'span': 'Spans',
        'table': 'Tables',
        'section': 'Sections',
        'article': 'Articles',
        'aside': 'Asides',
        'nav': 'Navigation',
        'footer': 'Footers',
        'header': 'Headers',
        'blockquote': 'Blockquotes',
        'code': 'Code',
        'pre': 'Preformatted',
        'cite': 'Citations',
        'abbr': 'Abbreviations',
        'time': 'Time',
        'mark': 'Highlighted',
        'button': 'Buttons',
        'textarea': 'Textareas',
        'select': 'Selects',
        'label': 'Labels',
        'figure': 'Figures',
        'details': 'Details',
        'summary': 'Summary'
      };
      
      headingSearchResults.forEach((result) => {
        const headingType = result.heading.type;
        if (!groupedResults[headingType]) {
          groupedResults[headingType] = [];
        }
        groupedResults[headingType].push(result);
      });
      
      // Create subcategory for each type - sort by total relevance (descending)
      const sortedTypes = Object.entries(groupedResults)
        .filter(([type, results]) => results.length > 0)
        .sort((a, b) => {
          // Calculate total relevance for each category
          const totalRelevanceA = a[1].reduce((sum, result) => sum + (result.relevance || 0), 0);
          const totalRelevanceB = b[1].reduce((sum, result) => sum + (result.relevance || 0), 0);
          return totalRelevanceB - totalRelevanceA;
        });
      
      sortedTypes.forEach(([type, results]) => {
        const subcategory = document.createElement('div');
        subcategory.className = 'heading-search-subcategory';
        
        const subcategoryHeader = document.createElement('div');
        subcategoryHeader.className = 'heading-search-subcategory-header';
        
        const doc = this._domParser.parseFromString(`
          <span class="heading-search-subcategory-toggle">+</span>
          <span class="heading-search-subcategory-title">${typeLabels[type] || type}</span>
          <span class="heading-search-subcategory-count">${results.length}</span>
        `, 'text/html');
        while (doc.body.firstChild) {
          subcategoryHeader.appendChild(doc.body.firstChild);
        }
        
        // Toggle collapse/expand on header click
        subcategoryHeader.addEventListener('click', () => {
          subcategory.classList.toggle('collapsed');
          const toggle = subcategoryHeader.querySelector('.heading-search-subcategory-toggle');
          if (toggle) {
            toggle.textContent = subcategory.classList.contains('collapsed') ? '+' : '−';
          }
        });
        
        subcategory.appendChild(subcategoryHeader);
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'heading-search-subcategory-items';
        
        results.forEach((result) => {
          const headingItem = document.createElement('div');
          headingItem.className = 'heading-search-item';
          
          // Build item HTML - add thumbnail for images
          let itemContent = '';
          if (type === 'image' && result.heading.imgUrl) {
            itemContent = `
              <div class="heading-search-item-thumbnail clickable">
                <img src="${this.escapeHtml(result.heading.imgUrl)}" alt="${this.escapeHtml(result.heading.text)}" loading="lazy" />
              </div>
            `;
          }
          
          // Add video preview for video types
          if ((type === 'video' || type === 'videoEmbed') && result.heading.videoUrl) {
            itemContent = `
              <div class="heading-search-item-thumbnail clickable video-preview">
                <span class="video-icon">▶</span>
                <span class="video-label">${this.escapeHtml(result.heading.text || 'Video')}</span>
              </div>
            `;
          }
          
          // Add audio preview for audio types
          if (type === 'audio' && result.heading.audioUrl) {
            itemContent = `
              <div class="heading-search-item-thumbnail clickable audio-preview">
                <span class="audio-icon">♪</span>
                <span class="audio-label">${this.escapeHtml(result.heading.text || 'Audio')}</span>
              </div>
            `;
          }
          
          // Truncate text if > 48 chars
          let displayText = result.heading.text || '';
          if (displayText.length > 48) {
            displayText = displayText.substring(0, 45) + '...';
          }
          
          itemContent += `
            <div class="heading-search-item-content">
              <span class="heading-text">${this.escapeHtml(displayText)}</span>
            </div>
          `;
          
          const doc = this._domParser.parseFromString(itemContent, 'text/html');
          while (doc.body.firstChild) {
            headingItem.appendChild(doc.body.firstChild);
          }
          
          // Handle click on image/video/audio thumbnail - open media URL directly
          const thumbnail = headingItem.querySelector('.heading-search-item-thumbnail.clickable');
          if (thumbnail) {
            thumbnail.addEventListener('click', (e) => {
              e.stopPropagation();
              if (result.heading.imgUrl) {
                browser.tabs.create({ url: result.heading.imgUrl });
              } else if (result.heading.videoUrl) {
                browser.tabs.create({ url: result.heading.videoUrl });
              } else if (result.heading.audioUrl) {
                browser.tabs.create({ url: result.heading.audioUrl });
              }
            });
          }
          
          // Click to activate the tab and scroll to heading
          headingItem.addEventListener('click', async () => {
            const pageUrl = result.pageUrl || result.heading.url;
            
            if (result.isTabOpen && result.tab && result.tabId) {
              // Tab is open - activate it
              try {
                await browser.tabs.update(result.tabId, { active: true });
                await browser.windows.update(result.tab.windowId, { focused: true });
                
                // Send message to content script to scroll to heading
                try {
                  await browser.tabs.sendMessage(result.tabId, {
                    action: 'scrollToHeading',
                    headingId: result.heading.id,
                    elementType: result.heading.type,
                    searchQuery: searchQuery
                  });
                } catch (e) {
                  console.debug('Could not scroll to heading:', e.message);
                }
              } catch (e) {
                // Tab no longer exists (closed) - open in new tab
                console.debug('Tab no longer exists, opening new tab:', e.message);
                const newTab = await browser.tabs.create({ url: pageUrl, active: true });
                
                const loadListener = (tabId, info) => {
                  if (tabId === newTab.id && info.status === 'complete') {
                    browser.tabs.onUpdated.removeListener(loadListener);
                    setTimeout(async () => {
                      try {
                        await browser.tabs.sendMessage(newTab.id, {
                          action: 'scrollToHeading',
                          headingId: result.heading.id,
                          elementType: result.heading.type,
                          searchQuery: searchQuery
                        });
                      } catch (e) {
                        console.debug('Could not scroll to heading in new tab:', e.message);
                      }
                    }, 100);
                  }
                };
                browser.tabs.onUpdated.addListener(loadListener);
              }
            } else {
              // Tab is closed - open in new tab
              const newTab = await browser.tabs.create({ url: pageUrl, active: true });
              
              const loadListener = (tabId, info) => {
                if (tabId === newTab.id && info.status === 'complete') {
                  browser.tabs.onUpdated.removeListener(loadListener);
                  setTimeout(async () => {
                    try {
                      await browser.tabs.sendMessage(newTab.id, {
                        action: 'scrollToHeading',
                        headingId: result.heading.id,
                        elementType: result.heading.type,
                        searchQuery: searchQuery
                      });
                    } catch (e) {
                      console.debug('Could not scroll to heading in new tab:', e.message);
                    }
                  }, 100);
                }
              };
              browser.tabs.onUpdated.addListener(loadListener);
            }
          });
          
          itemsContainer.appendChild(headingItem);
        });
        
        subcategory.appendChild(itemsContainer);
        headingResultsContainer.appendChild(subcategory);
      });
      
      fragment.appendChild(headingResultsContainer);
    }
    
    // Show search results indicator
    const hasHeadingResults = headingSearchResults && headingSearchResults.length > 0;
    if (searchQuery && displayTabs.length === 0 && !hasHeadingResults) {
      const doc = this._domParser.parseFromString(`
        <div class="tabs-empty">
          <svg class="tabs-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <span class="tabs-empty-text">No results found for "${this.escapeHtml(searchQuery)}"</span>
        </div>
      `, 'text/html');
      fragment.appendChild(doc.body);
      this.tabsList.appendChild(fragment);
      return;
    }
    
    // Group tabs - only custom groups with ungrouped tabs
    let groupedTabs;
    const groupManager = this.options.groupManager;
    
    // Get ungrouped tabs (tabs not in any custom group)
    const groupedTabIds = new Set();
    groupManager.customGroups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(Number(id)));
    });
    
    const ungroupedTabs = tabs.filter(tab => !groupedTabIds.has(tab.id));
    
    groupedTabs = {};
    
    // Add ungrouped section first (at top)
    if (ungroupedTabs.length > 0) {
      groupedTabs['ungrouped'] = ungroupedTabs;
    }
    
    // Add custom groups - first root groups, then their subgroups recursively
    const addGroupsRecursively = (parentId, depth) => {
      const groups = parentId
        ? groupManager.customGroups.filter(g => g.parentId === parentId)
        : groupManager.customGroups.filter(g => !g.parentId);
      
      groups.forEach(group => {
        const groupKey = 'custom_' + group.id;
        const groupTabs = tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
        
        // Always add group (even if empty) - display all groups and subgroups
        groupedTabs[groupKey] = {
          tabs: groupTabs,
          depth: depth,
          group: group
        };
        
        // Recursively add subgroups
        if (depth < 3) {
          addGroupsRecursively(group.id, depth + 1);
        }
      });
    };
    
    if (groupManager.customGroups.length > 0) {
      addGroupsRecursively(null, 0);
    }
    
    // Render groups and tabs
    // Include all custom groups (even if empty), only filter ungrouped if empty
    const groupKeys = Object.keys(groupedTabs).filter(key => {
      if (key === 'ungrouped') return groupedTabs[key].length > 0;
      // Always include custom groups (even if empty)
      return key.startsWith('custom_');
    });
    
    const settings = this.options.settings;
    
    groupKeys.forEach(groupKey => {
      const groupData = groupedTabs[groupKey];
      const isUngrouped = groupKey === 'ungrouped';
      const group = isUngrouped ? groupData : groupData.tabs;
      const depth = isUngrouped ? 0 : (groupData.depth || 0);
      
      // Check if any parent group is collapsed
      let parentCollapsed = false;
      if (!isUngrouped && groupData.group) {
        let parentId = groupData.group.parentId;
        while (parentId) {
          const parentKey = 'custom_' + parentId;
          if (settings.collapsedGroups?.includes(parentKey)) {
            parentCollapsed = true;
            break;
          }
          const parent = groupManager._getGroupById(parentId);
          parentId = parent?.parentId;
        }
      }
      
      const isCollapsed = parentCollapsed || settings?.collapsedGroups?.includes(groupKey);
      
      const groupContainer = document.createElement('div');
      groupContainer.className = 'tab-group';
      groupContainer.dataset.groupKey = groupKey;
      
      // Hide entire group if parent is collapsed
      if (parentCollapsed) {
        groupContainer.style.display = 'none';
      }
      
      // Add nested level class for visual styling
      if (depth > 0) {
        groupContainer.classList.add('nested-level-' + Math.min(depth, 3));
      }
      
      // Create group header
      if (groupKeys.length > 1 || groupKey.startsWith('custom_')) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tab-group-header' + (isCollapsed ? ' collapsed' : '');
        
        const groupInfo = this.getGroupInfo(groupKey, group);
        
        // Add border-left color for custom groups
        if (groupInfo.isCustom && groupInfo.color) {
          groupHeader.style.borderLeft = '3px solid ' + groupInfo.color;
        }
        
        let headerActions = '';
        if (groupInfo.isCustom) {
          const currentSortBy = groupInfo.sortBy || 'addedAt';
          const currentSortOrder = groupInfo.sortOrder || 'desc';
          headerActions = `
            <div class="group-actions">
              <button class="group-action-btn group-sort-btn" title="Sort tabs" data-group-id="${groupInfo.groupId}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M6 12h12M9 18h6"/>
                </svg>
              </button>
              <div class="group-sort-dropdown" data-group-id="${groupInfo.groupId}" style="display: none;">
                <div class="sort-option ${currentSortBy === 'addedAt' ? 'active' : ''}" data-sort="addedAt">
                  <span>By date added</span>
                  ${currentSortBy === 'addedAt' ? `<span class="sort-direction">${currentSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
                </div>
                <div class="sort-option ${currentSortBy === 'lastAccessed' ? 'active' : ''}" data-sort="lastAccessed">
                  <span>By last used</span>
                  ${currentSortBy === 'lastAccessed' ? `<span class="sort-direction">${currentSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
                </div>
                <div class="sort-option ${currentSortBy === 'useCount' ? 'active' : ''}" data-sort="useCount">
                  <span>By frequency</span>
                  ${currentSortBy === 'useCount' ? `<span class="sort-direction">${currentSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
                </div>
                <div class="sort-option ${currentSortBy === 'title' ? 'active' : ''}" data-sort="title">
                  <span>By title</span>
                  ${currentSortBy === 'title' ? `<span class="sort-direction">${currentSortOrder === 'asc' ? '↑' : '↓'}</span>` : ''}
                </div>
                <div class="sort-divider"></div>
                <div class="sort-order-option ${currentSortOrder === 'asc' ? 'active' : ''}" data-order="asc">
                  <span>Ascending ↑</span>
                </div>
                <div class="sort-order-option ${currentSortOrder === 'desc' ? 'active' : ''}" data-order="desc">
                  <span>Descending ↓</span>
                </div>
              </div>
              <button class="group-action-btn group-delete-btn" title="Delete group" data-group-id="${groupInfo.groupId}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          `;
        }
        
        const doc = this._domParser.parseFromString(`
          <div class="tab-group-toggle">
            <span class="tab-group-toggle-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
          </div>
          <span class="tab-group-name">${this.escapeHtml(groupInfo.name)}</span>
          ${(groupInfo.nestedTabsCount ?? 0) > 0 ? `<span class="tab-group-nested-tabs"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>${groupInfo.nestedTabsCount}/${groupInfo.subgroupCount}</span>` : ''}
          ${groupInfo.isCustom !== true ? '<span class="tab-group-auto">auto</span>' : ''}
          <span class="tab-group-count">${group.length + (groupInfo.nestedTabsCount || 0)}</span>
          ${headerActions}
        `, 'text/html');
        while (doc.body.firstChild) {
          groupHeader.appendChild(doc.body.firstChild);
        }
        
        // Update toggle icon based on collapsed state
        const toggleIcon = groupHeader.querySelector('.tab-group-toggle-icon');
        if (isCollapsed) {
          toggleIcon.textContent = '+';
        } else {
          toggleIcon.textContent = '−';
        }
        
        groupHeader.addEventListener('click', (e) => {
          // Don't toggle if clicking on action buttons or sort dropdown
          if (e.target.closest('.group-actions')) return;
          this.toggleGroupCollapse(groupKey, groupContainer);
        });
        
        // Add event listeners for custom group actions
        if (groupInfo.isCustom) {
          const deleteBtn = groupHeader.querySelector('.group-delete-btn');
          const sortBtn = groupHeader.querySelector('.group-sort-btn');
          const sortDropdown = groupHeader.querySelector('.group-sort-dropdown');
          
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.confirmDeleteGroup(groupInfo.groupId);
            });
          }
          
          // Sort button click - toggle dropdown
          if (sortBtn) {
            sortBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              // Close other dropdowns first
              document.querySelectorAll('.group-sort-dropdown').forEach(dropdown => {
                if (dropdown !== sortDropdown) {
                  dropdown.style.display = 'none';
                }
              });
              // Toggle this dropdown
              if (sortDropdown) {
                sortDropdown.style.display = sortDropdown.style.display === 'none' ? 'block' : 'none';
              }
            });
          }
          
          // Close dropdown when clicking outside - use { once: true } to prevent memory leaks
          const closeSortDropdown = (e) => {
            if (sortDropdown && !sortDropdown.contains(e.target) && !e.target.closest('.group-sort-btn')) {
              sortDropdown.style.display = 'none';
            }
          };
          
          // Store reference for potential cleanup
          this._activeSortDropdownHandlers.add(closeSortDropdown);
          
          // Use a timeout to avoid immediate trigger from the button click
          setTimeout(() => {
            document.addEventListener('click', closeSortDropdown, { once: true });
          }, 0);
          
          // Sort option clicks
          if (sortDropdown) {
            sortDropdown.querySelectorAll('.sort-option').forEach(option => {
              option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sortBy = option.dataset.sort;
                const group = groupManager._getGroupById(groupInfo.groupId);
                const sortOrder = group?.sortOrder || 'desc';
                await this.options.onUpdateGroupSorting(groupInfo.groupId, sortBy, sortOrder);
                sortDropdown.style.display = 'none';
              });
            });
            
            sortDropdown.querySelectorAll('.sort-order-option').forEach(option => {
              option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sortOrder = option.dataset.order;
                const group = groupManager._getGroupById(groupInfo.groupId);
                const sortBy = group?.sortBy || 'addedAt';
                await this.options.onUpdateGroupSorting(groupInfo.groupId, sortBy, sortOrder);
                sortDropdown.style.display = 'none';
              });
            });
          }
        }
        
        groupContainer.appendChild(groupHeader);
      }
      
      // Create tab list for this group
      const tabList = document.createElement('div');
      tabList.className = 'tab-group-tabs' + (isCollapsed ? ' collapsed' : '');
      
      // Add drag and drop for all groups (to allow dropping into custom groups)
      // Check if this is a custom group
      const isCustomGroup = groupKey.startsWith('custom_');
      const dragDropManager = this.options.dragDropManager;
      
      if (isCustomGroup) {
        tabList.dataset.groupKey = groupKey;
        tabList.addEventListener('dragover', (e) => dragDropManager.handleCustomGroupDragOver(e, groupKey));
        tabList.addEventListener('dragleave', (e) => dragDropManager.handleCustomGroupDragLeave(e, groupKey));
        tabList.addEventListener('drop', (e) => dragDropManager.handleCustomGroupDrop(e, groupKey));
        
        // Add drag/drop to entire group container for easier dropping
        groupContainer.dataset.groupKey = groupKey;
        groupContainer.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          
          // Check if dragging a tab or group - show appropriate feedback
          const dragState = dragDropManager.getDragState();
          if (dragState.isDraggingTab || dragState.isDraggingGroup) {
            groupContainer.classList.add('drag-over');
          }
        });
        groupContainer.addEventListener('dragleave', (e) => {
          if (!groupContainer.contains(e.relatedTarget)) {
            groupContainer.classList.remove('drag-over');
          }
        });
        groupContainer.addEventListener('drop', async (e) => {
          e.preventDefault();
          groupContainer.classList.remove('drag-over');
          
          const groupId = groupKey.replace('custom_', '');
          const targetDepth = this.options.getGroupDepth(groupId);
          const dragState = dragDropManager.getDragState();
          
          // Check if we're dragging a group (not a tab)
          if (dragState.isDraggingGroup) {
            // Check if target is at max depth (level 3)
            if (targetDepth >= 2) {
              console.warn('Cannot nest group into level 3 subgroup');
              dragDropManager.cleanupDrag();
              return;
            }
            
            const draggedGroup = dragState.draggedGroup;
            const sourceGroupId = draggedGroup.replace('custom_', '');
            const sourceGroup = groupManager._getGroupById(sourceGroupId);

            if (!sourceGroup) {
              dragDropManager.cleanupDrag();
              return;
            }
            
            // Prevent dropping a group onto itself or its descendants
            const isDescendant = (parentId, childId) => {
              const child = groupManager._getGroupById(childId);
              if (!child) return false;
              if (child.parentId === parentId) return true;
              return isDescendant(parentId, child.parentId);
            };
            
            if (isDescendant(sourceGroupId, groupId)) {
              console.warn('Cannot drop a group onto its own descendant');
              dragDropManager.cleanupDrag();
              return;
            }
            
            // Move source group into target group
            sourceGroup.parentId = groupId;
            
            // Update color to match new parent's color
            await groupManager.updateGroupColorOnMove(sourceGroupId);
            
            await this.options.onSaveCustomGroups();
            this.options.onRenderTabs();
            dragDropManager.cleanupDrag();
            return;
          }
          
          // Handle tab drops
          if (dragState.isDraggingTab) {
            const tabId = dragState.draggedTab.id;
            try {
              await this.options.onAddTabToGroup(tabId, groupId);
              dragDropManager.cleanupDrag();
            } catch (error) {
              console.error('Error adding tab to group:', error);
            }
          }
        });
      } else {
        // For non-custom groups, still add listeners to allow dropping into custom groups
        tabList.addEventListener('dragover', (e) => dragDropManager.handleSortedGroupDragOver(e));
        tabList.addEventListener('dragleave', (e) => dragDropManager.handleSortedGroupDragLeave(e));
        tabList.addEventListener('drop', (e) => dragDropManager.handleSortedGroupDrop(e));
      }
      
      // Make custom group headers draggable
      if (groupKey.startsWith('custom_')) {
        const groupHeader = groupContainer.querySelector('.tab-group-header');
        if (groupHeader) {
          groupHeader.draggable = true;
          groupHeader.dataset.groupId = groupKey.replace('custom_', '');
          groupHeader.addEventListener('dragstart', (e) => dragDropManager.handleGroupDragStart(e, groupKey));
          groupHeader.addEventListener('dragend', (e) => dragDropManager.handleGroupDragEnd(e));
          groupHeader.addEventListener('dragover', (e) => dragDropManager.handleGroupDragOver(e, groupKey));
          groupHeader.addEventListener('drop', (e) => dragDropManager.handleGroupDrop(e, groupKey));
        }
      }
      
      // Get sorted tabs for custom groups
      let tabsToRender = group;
      if (groupKey.startsWith('custom_')) {
        const groupId = groupKey.replace('custom_', '');
        tabsToRender = this.options.getSortedTabsInGroup(groupId);
      }
      
      // Use DocumentFragment for tabs to reduce DOM operations
      const tabsFragment = document.createDocumentFragment();
      tabsToRender.forEach(tab => {
        const tabElement = this.createTabElement(tab, tabs.indexOf(tab), groupKey);
        tabsFragment.appendChild(tabElement);
      });
      tabList.appendChild(tabsFragment);
      
      groupContainer.appendChild(tabList);
      fragment.appendChild(groupContainer);
    });
    
    // Single DOM operation to append all content
    this.tabsList.appendChild(fragment);
    
    // Measure item height after first render for virtual scrolling
    if (!this._virtualScrollState.measured) {
      this._measureItemHeight();
    }
  }
  
  // ==================== Virtual Scrolling Methods ====================
  
  /**
   * Handle scroll event with requestAnimationFrame throttling
   * @param {Event} e - Scroll event
   */
  _onScroll(e) {
    if (this._scrollRafId) return;
    
    this._scrollRafId = requestAnimationFrame(() => {
      this._scrollRafId = null;
      this._updateVirtualScroll();
    });
  }
  
  /**
   * Update visible items based on scroll position
   */
  _updateVirtualScroll() {
    if (!this.tabsScrollContainer || !this._virtualScrollEnabled) return;
    
    const state = this._virtualScrollState;
    const scrollTop = this.tabsScrollContainer.scrollTop;
    const containerHeight = this.tabsScrollContainer.clientHeight || state.containerHeight;
    
    state.scrollTop = scrollTop;
    state.containerHeight = containerHeight;
    
    // Calculate visible range
    const visibleStart = Math.floor(scrollTop / state.itemHeight);
    const visibleEnd = Math.ceil((scrollTop + containerHeight) / state.itemHeight);
    
    // Add buffer
    const buffer = state.bufferSize;
    state.visibleStartIndex = Math.max(0, visibleStart - buffer);
    state.visibleEndIndex = visibleEnd + buffer;
    
    // Re-render only if visible range changed significantly
    // Note: This is a simplified version - full implementation would reuse DOM elements
  }
  
  /**
   * Measure item height from existing DOM elements
   */
  _measureItemHeight() {
    if (!this.tabsList) return;
    
    const firstTab = this.tabsList.querySelector('.tab-item');
    if (firstTab) {
      const height = firstTab.getBoundingClientRect().height;
      if (height > 0) {
        this._virtualScrollState.itemHeight = height;
        this._virtualScrollState.measured = true;
      }
    }
  }
  
  /**
   * Enable or disable virtual scrolling
   * @param {boolean} enabled - Whether to enable virtual scrolling
   */
  setVirtualScrollEnabled(enabled) {
    this._virtualScrollEnabled = enabled;
  }
  
  /**
   * Create a tab element
   * @param {Object} tab - Tab object
   * @param {number} index - Tab index
   * @param {string} groupKey - Group key
   * @param {number} depth - Tree depth
   * @param {boolean} hasChildren - Whether tab has children
   * @param {boolean} isCollapsed - Whether tab is collapsed
   * @returns {HTMLElement} Tab element
   */
  createTabElement(tab, index, groupKey = 'all', depth = 0, hasChildren = false, isCollapsed = false) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.index = index;
    tabItem.dataset.group = groupKey;
    tabItem.draggable = true;
    
    // Add tree depth class
    if (depth > 0) {
      tabItem.classList.add('tree-depth-' + Math.min(depth, 5));
    }
    
    // Check if tab is in a custom group
    const customGroup = this.options.getCustomGroupForTab(tab.id);
    if (customGroup) {
      tabItem.dataset.customGroupId = customGroup.id;
    }
    
    if (tab.active) {
      tabItem.classList.add('active');
    }
    
    // Add discarded class if tab is unloaded from memory
    if (tab.discarded) {
      tabItem.classList.add('discarded');
    }
    
    const settings = this.options.settings;
    const hasAudio = tab.audible || tab.mutedInfo?.muted;
    if (settings.showAudio && hasAudio) {
      tabItem.classList.add('playing');
    }
    
    if (tab.mutedInfo?.muted) {
      tabItem.classList.add('muted');
    }
    
    if (!settings.showFavicon) {
      tabItem.classList.add('hide-favicon');
    }
    
    const title = this.options.getTabDisplayTitle(tab);
    
    // Tree twisty - collapse/expand control
    let treeTwistyHtml = '';
    if (hasChildren) {
      treeTwistyHtml = `
        <div class="tree-twisty ${isCollapsed ? 'collapsed' : 'expanded'}" data-tab-id="${tab.id}" title="${isCollapsed ? 'Expand' : 'Collapse'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      `;
    }
    
    let faviconHtml = '';
    let indexedIndicator = '';
    
    // Get URL key for this tab to check if indexed
    const tabUrlKey = this.options.getUrlKey(tab.url);
    const pageHeadings = this.options.getPageHeadings();
    
    // Check if this tab is indexed in the database
    if (pageHeadings && pageHeadings[tabUrlKey] && pageHeadings[tabUrlKey].length > 0) {
      indexedIndicator = `<span class="tab-indexed-indicator" title="Page indexed in database">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12z"/>
        </svg>
      </span>`;
    }
    
    if (settings.showFavicon) {
      if (tab.favIconUrl && this.isValidFaviconUrl(tab.favIconUrl)) {
        faviconHtml = `<img class="tab-favicon" src="${this.escapeHtml(tab.favIconUrl)}" alt="" />`;
      } else {
        faviconHtml = `<div class="tab-favicon-placeholder">${this.escapeHtml(this.getInitial(title))}</div>`;
      }
    }
    
    // Show group name in search results
    let groupNameHtml = '';
    if (groupKey === 'search') {
      const groupNames = this.options.getGroupHierarchyNames(tab.id);
      if (groupNames.length > 0) {
        groupNameHtml = `<div class="tab-group-name">${this.escapeHtml(groupNames.join(' > '))}</div>`;
      }
    }
    
    let audioButton = '';
    if (settings.showAudio) {
      if (tab.mutedInfo?.muted) {
        audioButton = `<button class="tab-audio-btn muted" title="Sound off - click to enable" data-tab-id="${this.escapeHtml(String(tab.id))}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        </button>`;
      } else if (tab.audible) {
        audioButton = `<button class="tab-audio-btn playing" title="Click to mute" data-tab-id="${this.escapeHtml(String(tab.id))}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>`;
      }
    }
    
    // Discarded (unloaded) tab indicator
    let discardedIndicator = '';
    if (tab.discarded) {
      discardedIndicator = `<button class="tab-discarded-btn" title="Tab unloaded - click to load" data-tab-id="${this.escapeHtml(String(tab.id))}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </button>`;
    }
    
    const doc = this._domParser.parseFromString(`
      ${treeTwistyHtml}
      <div class="tab-favicon-wrapper">
        ${faviconHtml}
      </div>
      <div class="tab-content">
        ${this.options.settings.showTabTitle !== false ? `<span class="tab-title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</span>` : ''}
        ${groupNameHtml}
      </div>
      ${indexedIndicator}
      ${discardedIndicator}
      ${audioButton}
      <button class="tab-close" title="Close tab" aria-label="Close tab">
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `, 'text/html');
    while (doc.body.firstChild) {
      tabItem.appendChild(doc.body.firstChild);
    }
    
    // Add click handler for discarded indicator
    const discardedBtn = tabItem.querySelector('.tab-discarded-btn');
    if (discardedBtn) {
      discardedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onReloadTab(tab.id);
      });
    }
    
    // Add click handler for tree twisty
    const twisty = tabItem.querySelector('.tree-twisty');
    if (twisty) {
      twisty.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTabCollapse(tab.id);
      });
    }
    
    const audioBtn = tabItem.querySelector('.tab-audio-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onToggleMute(tab);
      });
    }
    
    const dragDropManager = this.options.dragDropManager;
    
    tabItem.addEventListener('click', (e) => this.options.onTabClick(e, tab));
    tabItem.querySelector('.tab-close').addEventListener('click', (e) => this.options.onTabClose(e, tab));
    tabItem.addEventListener('mouseenter', (e) => this.showTabPreview(e, tab));
    tabItem.addEventListener('mouseleave', () => this.hideTabPreview());
    tabItem.addEventListener('mousemove', (e) => this.updatePreviewPosition(e));
    
    tabItem.addEventListener('dragstart', (e) => dragDropManager.handleDragStart(e, tab, index, groupKey));
    tabItem.addEventListener('dragend', (e) => dragDropManager.handleDragEnd(e));
    tabItem.addEventListener('dragover', (e) => dragDropManager.handleDragOver(e, index, groupKey));
    tabItem.addEventListener('drop', (e) => dragDropManager.handleDrop(e, index, groupKey));
    
    return tabItem;
  }
  
  // ==================== Collapse/Expand Methods ====================
  
  /**
   * Toggle group collapse state
   * @param {string} groupKey - Group key
   * @param {HTMLElement} groupContainer - Group container element
   */
  toggleGroupCollapse(groupKey, groupContainer) {
    const header = groupContainer.querySelector('.tab-group-header');
    const tabList = groupContainer.querySelector('.tab-group-tabs');
    const toggleIcon = header.querySelector('.tab-group-toggle-icon');
    const isCollapsed = header.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expanding - only expand direct level
      header.classList.remove('collapsed');
      tabList.classList.remove('collapsed');
      if (toggleIcon) {
        toggleIcon.textContent = '−';
        toggleIcon.style.transform = 'rotate(0deg)';
      }
      this.options.onSaveCollapsedState(groupKey, false);
      
      // Optionally expand direct children only
      this.expandDirectChildren(groupKey);
    } else {
      // Collapsing - collapse this and all descendants
      header.classList.add('collapsed');
      tabList.classList.add('collapsed');
      if (toggleIcon) {
        toggleIcon.textContent = '+';
        toggleIcon.style.transform = 'rotate(-90deg)';
      }
      this.options.onSaveCollapsedState(groupKey, true);
      
      // Collapse all nested subgroups
      this.collapseAllDescendants(groupKey);
    }
  }
  
  /**
   * Toggle collapse state for a tab (used for tree structure)
   * @param {number} tabId - Tab ID
   */
  toggleTabCollapse(tabId) {
    const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabElement) return;
    
    const isCollapsed = tabElement.classList.contains('tab-collapsed');
    
    if (isCollapsed) {
      // Expand
      tabElement.classList.remove('tab-collapsed');
      const children = tabElement.nextElementSibling;
      if (children && children.classList.contains('tab-item-children')) {
        children.classList.remove('collapsed');
      }
      const twisty = tabElement.querySelector('.tree-twisty');
      if (twisty) {
        twisty.classList.remove('collapsed');
        twisty.classList.add('expanded');
      }
      this.options.onSaveTabCollapsedState(tabId, false);
    } else {
      // Collapse
      tabElement.classList.add('tab-collapsed');
      const children = tabElement.nextElementSibling;
      if (children && children.classList.contains('tab-item-children')) {
        children.classList.add('collapsed');
      }
      const twisty = tabElement.querySelector('.tree-twisty');
      if (twisty) {
        twisty.classList.remove('expanded');
        twisty.classList.add('collapsed');
      }
      this.options.onSaveTabCollapsedState(tabId, true);
    }
  }
  
  /**
   * Collapse all descendant groups
   * @param {string} parentGroupKey - Parent group key
   */
  collapseAllDescendants(parentGroupKey) {
    const groupManager = this.options.groupManager;
    const parentId = parentGroupKey.replace('custom_', '');
    
    // Find all child groups
    const childGroups = groupManager.customGroups.filter(g => g.parentId === parentId);
    
    childGroups.forEach(child => {
      const childKey = 'custom_' + child.id;
      
      // Find the DOM element for this child group
      const childContainer = document.querySelector(`.tab-group[data-group-key="${childKey}"]`);
      if (childContainer) {
        const childHeader = childContainer.querySelector('.tab-group-header');
        const childTabList = childContainer.querySelector('.tab-group-tabs');
        
        if (childHeader && childTabList) {
          childHeader.classList.add('collapsed');
          childTabList.classList.add('collapsed');
          this.options.onSaveCollapsedState(childKey, true);
        }
      }
      
      // Recursively collapse grandchildren
      this.collapseAllDescendants(child.id);
    });
  }
  
  /**
   * Expand only direct children (not grandchildren)
   * @param {string} parentGroupKey - Parent group key
   */
  expandDirectChildren(parentGroupKey) {
    const groupManager = this.options.groupManager;
    const parentId = parentGroupKey.replace('custom_', '');
    const settings = this.options.settings;
    
    // Find all child groups
    const childGroups = groupManager.customGroups.filter(g => g.parentId === parentId);
    
    childGroups.forEach(child => {
      const childKey = 'custom_' + child.id;
      
      // Find the DOM element for this child group
      const childContainer = document.querySelector(`.tab-group[data-group-key="${childKey}"]`);
      if (childContainer) {
        const childHeader = childContainer.querySelector('.tab-group-header');
        const childTabList = childContainer.querySelector('.tab-group-tabs');
        
        if (childHeader && childTabList) {
          // Check if this child was collapsed
          if (settings.collapsedGroups?.includes(childKey)) {
            childHeader.classList.add('collapsed');
            childTabList.classList.add('collapsed');
          } else {
            childHeader.classList.remove('collapsed');
            childTabList.classList.remove('collapsed');
          }
        }
      }
    });
  }
  
  // ==================== Preview Methods ====================
  
  /**
   * Show tab preview tooltip
   * @param {Event} e - Mouse event
   * @param {Object} tab - Tab object
   */
  showTabPreview(e, tab) {
    if (!this.tabPreview) return;
    
    const title = tab.title || 'New tab';
    const url = tab.url || '';
    
    const previewTitle = this.tabPreview.querySelector('.preview-title');
    const previewUrl = this.tabPreview.querySelector('.preview-url');
    
    if (previewTitle) previewTitle.textContent = title;
    if (previewUrl) previewUrl.textContent = this.formatUrl(url);
    
    this.tabPreview.classList.add('visible');
    this.updatePreviewPosition(e);
  }
  
  /**
   * Update preview tooltip position
   * @param {Event} e - Mouse event
   */
  updatePreviewPosition(e) {
    if (!this.tabPreview) return;
    
    const rect = this.tabPreview.getBoundingClientRect();
    let x = e.clientX + 10;
    let y = e.clientY + 10;
    
    if (x + rect.width > window.innerWidth) {
      x = e.clientX - rect.width - 10;
    }
    if (y + rect.height > window.innerHeight) {
      y = e.clientY - rect.height - 10;
    }
    
    this.tabPreview.style.left = `${x}px`;
    this.tabPreview.style.top = `${y}px`;
  }
  
  /**
   * Hide tab preview tooltip
   */
  hideTabPreview() {
    if (this.tabPreview) {
      this.tabPreview.classList.remove('visible');
    }
  }
  
  // ==================== Utility Methods ====================
  
  /**
   * Get group info for rendering
   * @param {string} groupKey - Group key
   * @param {Array|Object} group - Group data
   * @returns {Object} Group info object
   */
  getGroupInfo(groupKey, group) {
    const groupManager = this.options.groupManager;
    
    if (groupKey === 'ungrouped') {
      return {
        name: 'Ungrouped',
        isCustom: false,
        count: group.length
      };
    }
    
    if (groupKey.startsWith('custom_')) {
      const groupId = groupKey.replace('custom_', '');
      const customGroup = groupManager._getGroupById(groupId);
      const nestedCount = this.options.getNestedTabsCount(groupId);
      const subgroups = this.options.getSubgroups(groupId);
      
      return {
        name: customGroup?.name || 'Unknown',
        isCustom: true,
        color: customGroup?.color,
        count: group.tabs?.length || 0,
        nestedTabsCount: nestedCount,
        subgroupCount: subgroups.length,
        groupId: groupId,
        sortBy: customGroup?.sortBy,
        sortOrder: customGroup?.sortOrder
      };
    }
    
    return {
      name: groupKey,
      isCustom: false,
      count: group.length || 0
    };
  }
  
  /**
   * Get initial letter from title
   * @param {string} title - Title string
   * @returns {string} Initial letter
   */
  getInitial(title) {
    if (!title) return '?';
    const words = title.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return '?';
    return words[0][0].toUpperCase();
  }
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Check if favicon URL is valid
   * @param {string} url - Favicon URL
   * @returns {boolean} Whether URL is valid
   */
  isValidFaviconUrl(url) {
    if (!url) return false;
    // Only allow data:, http:, or https: URLs
    return url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:');
  }
  
  /**
   * Format URL for display
   * @param {string} url - URL to format
   * @returns {string} Formatted URL
   */
  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  }
  
  // ==================== Cleanup ====================
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clear debounce timer
    if (this._renderDebounceTimer) {
      clearTimeout(this._renderDebounceTimer);
      this._renderDebounceTimer = null;
    }
    
    // Remove color picker close handler
    if (this._colorPickerCloseHandler) {
      document.removeEventListener('click', this._colorPickerCloseHandler);
      this._colorPickerCloseHandler = null;
    }
    
    // Clear active sort dropdown handlers
    this._activeSortDropdownHandlers.clear();
    
    // Hide context menu
    this.hideContextMenu();
    
    // Hide modal
    if (this.modal) {
      this.hideModal(false);
    }
    
    // Clear loaded groups
    this._loadedGroups.clear();
  }
}
