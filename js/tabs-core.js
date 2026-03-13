/**
 * YouTabs Extension - Core Tab Management Module
 * Shared functionality for sidebar and popup scripts
 */

// Settings manager instance
let settingsManager = null;

// Get or create SettingsManager instance
function getSettingsManager() {
  if (!settingsManager) {
    settingsManager = new SettingsManager();
  }
  return settingsManager;
}

/**
 * ContentExtractor class is now defined in content-extractor.js
 * This file should be loaded before tabs-core.js
 * The class provides methods for extracting headings and content from web pages
 */

// Legacy function for backward compatibility
function extractHeadings(settings) {
  return ContentExtractor.extract(settings);
}

// Debounce utility function
// Note: Uses global SearchUtils from search-utils.js which is loaded before this file
function debounce(func, wait) {
  return window.SearchUtils ? window.SearchUtils.debounce(func, wait) : 
    ((...args) => {
      let timeout;
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    });
}

// Reference to global SearchUtils (loaded from js/utils/search-utils.js)
const SearchUtils = window.SearchUtils;

// Helper function to get icon URL for notifications
function getNotificationIconUrl() {
  try {
    return browser.runtime.getManifest()?.icons?.['48'] || 'icons/48.png';
  } catch (e) {
    return 'icons/48.png';
  }
}

// Helper function to show a notification using Firefox notifications API
function showNotification(message, title = 'YouTabs') {
  try {
    browser.notifications.create({
      type: 'basic',
      iconUrl: getNotificationIconUrl(),
      title: title,
      message: message
    });
  } catch (error) {
    console.warn('YouTabs: Notification API not available:', error);
  }
}


class YouTabsCore {
  // Static filter type definitions
  static FILTER_TYPES = [
    { value: 'heading', label: 'Headings (h1-h6)' },
    { value: 'paragraph', label: 'Paragraphs' },
    { value: 'link', label: 'Links' },
    { value: 'image', label: 'Images' },
    { value: 'div', label: 'Divs' },
    { value: 'ul', label: 'UL Lists' },
    { value: 'ol', label: 'OL Lists' },
    { value: 'li', label: 'LI Items' },
    { value: 'input', label: 'Inputs' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'iframe', label: 'IFrames (Video)' },
    { value: 'span', label: 'Spans' },
    { value: 'table', label: 'Tables' },
    { value: 'section', label: 'Sections' },
    { value: 'article', label: 'Articles' },
    { value: 'aside', label: 'Asides' },
    { value: 'nav', label: 'Navigation' },
    { value: 'footer', label: 'Footers' },
    { value: 'header', label: 'Headers' },
    { value: 'blockquote', label: 'Blockquotes' },
    { value: 'code', label: 'Code' },
    { value: 'pre', label: 'Preformatted' },
    { value: 'cite', label: 'Citations' },
    { value: 'abbr', label: 'Abbreviations' },
    { value: 'time', label: 'Time' },
    { value: 'mark', label: 'Highlighted' },
    { value: 'button', label: 'Buttons' },
    { value: 'textarea', label: 'Textareas' },
    { value: 'select', label: 'Selects' },
    { value: 'label', label: 'Labels' },
    { value: 'figure', label: 'Figures' },
    { value: 'details', label: 'Details' },
    { value: 'summary', label: 'Summary' },
    { value: 'meta', label: 'Meta Tags' },
    { value: 'aria', label: 'ARIA Labels' },
    { value: 'data', label: 'Data Attributes' }
  ];
  
  static getFilterTypeHTML(checked = true) {
    return YouTabsCore.FILTER_TYPES.map(type => `
      <label class="filter-dropdown-item" data-value="${type.value}">
        <input type="checkbox" ${checked ? 'checked' : ''}>
        <span>${type.label}</span>
      </label>
    `).join('');
  }

  // Static fuzzy search helpers - delegate to shared SearchUtils
  static levenshteinDistance(str1, str2, maxDist = Infinity) {
    return SearchUtils.levenshteinDistance(str1, str2, maxDist);
  }

  static fuzzyMatch(query, text, maxDistance = 2) {
    return SearchUtils.fuzzyMatch(query, text, maxDistance);
  }
  
  constructor(options = {}) {
    // Configuration options - store in settings for consistency
    this.shouldCloseWindow = options.shouldCloseWindow ?? false;
    
    // Initialize TabManager
    this.tabManager = new TabManager({
      shouldCloseWindow: this.shouldCloseWindow
    });
    
    // Setup TabManager event listeners
    this._setupTabManagerListeners();
    
    // Initialize GroupManager
    this.groupManager = new GroupManager();
    
    // Setup GroupManager event listeners
    this._setupGroupManagerListeners();
    
    // Initialize DragDropManager
    this.dragDropManager = new DragDropManager({
      tabManager: this.tabManager,
      groupManager: this.groupManager,
      getSettings: () => this.settings,
      getTabsInGroup: (groupKey) => this.getTabsInGroup(groupKey),
      addTabToGroup: (tabId, groupId) => this.addTabToGroup(tabId, groupId),
      removeTabFromGroup: (tabId, groupId) => this.removeTabFromGroup(tabId, groupId),
      getCustomGroupForTab: (tabId) => this.getCustomGroupForTab(tabId),
      getGroupDepth: (groupId) => this.getGroupDepth(groupId),
      saveCustomGroups: () => this.saveCustomGroups(),
      renderTabs: () => this.renderTabs(),
      loadTabs: () => this.loadTabs()
    });
    
    // Initialize SearchEngine
    this.searchEngine = new SearchEngine({
      settings: {},
      getTabs: () => this.tabs,
      getCustomTabNames: () => this.customTabNames,
      getGroupHierarchyNames: (tabId) => this.getGroupHierarchyNames(tabId),
      onSearchResults: (results) => {
        // Sync search state from SearchEngine
        this.filteredTabs = results.filteredTabs;
        this.headingSearchResults = results.headingResults;
        
        // Call updateRegexButtonState if it exists (in popup context)
        if (typeof this.updateRegexButtonState === 'function') {
          this.updateRegexButtonState(results);
        }
        
        this.renderTabs();
      },
      onError: (error) => console.error('SearchEngine error:', error)
    });
    
    // Settings manager
    this.settingsManager = getSettingsManager();
    
    // Settings (synced with SettingsManager) - must be before UIRenderer
    this.settings = {};
    
    // Initialize UIRenderer
    this.uiRenderer = new UIRenderer({
      settings: this.settings,
      getTabs: () => this.tabs,
      getFilteredTabs: () => this.filteredTabs,
      getHeadingSearchResults: () => this.headingSearchResults,
      getSearchQuery: () => this.searchQuery,
      getCustomTabNames: () => this.customTabNames,
      getPageHeadings: () => this.pageHeadings,
      getPageTags: () => this.pageTags,
      getCustomGroupForTab: (tabId) => this.getCustomGroupForTab(tabId),
      getGroupHierarchyNames: (tabId) => this.getGroupHierarchyNames(tabId),
      getGroupHierarchyNamesForGroup: (groupId) => this.getGroupHierarchyNamesForGroup(groupId),
      getSortedTabsInGroup: (groupId) => this.getSortedTabsInGroup(groupId),
      getGroupDepth: (groupId) => this.getGroupDepth(groupId),
      getSubgroups: (parentId) => this.getSubgroups(parentId),
      getNestedTabsCount: (groupId) => this.getNestedTabsCount(groupId),
      getTabDisplayTitle: (tab) => this.getTabDisplayTitle(tab),
      getUrlKey: (url) => this.getUrlKey(url),
      groupManager: this.groupManager,
      dragDropManager: this.dragDropManager,
      onTabClick: (e, tab) => this.handleTabClick(e, tab),
      onTabClose: (e, tab) => this.handleTabClose(e, tab),
      onToggleMute: (tab) => this.toggleTabMute(tab),
      onAddTabToGroup: (tabId, groupId) => this.addTabToGroup(tabId, groupId),
      onRemoveTabFromGroup: (tabId, groupId) => this.removeTabFromGroup(tabId, groupId),
      onCreateCustomGroup: (name, color, parentId) => this.createCustomGroup(name, color, parentId),
      onRenameCustomGroup: (groupId, newName) => this.renameCustomGroup(groupId, newName),
      onDeleteCustomGroup: (groupId) => this.deleteCustomGroup(groupId),
      onUpdateGroupColor: (groupId, newColor) => this.updateCustomGroupColor(groupId, newColor),
      onUpdateGroupSorting: (groupId, sortBy, sortOrder) => this.updateGroupSorting(groupId, sortBy, sortOrder),
      onSaveCollapsedState: (groupKey, collapsed) => this.saveCollapsedState(groupKey, collapsed),
      onSaveTabCollapsedState: (tabId, collapsed) => this.saveTabCollapsedState(tabId, collapsed),
      onSetTabCustomName: (tabId, customName) => this.setTabCustomName(tabId, customName),
      onRestoreTabOriginalName: (tabId) => this.restoreTabOriginalName(tabId),
      onIndexPageHeadings: (tabId) => this.indexPageHeadings(tabId),
      onRemovePageHeadings: (tabId) => this.removePageHeadingsForTab(tabId),
      onReloadTab: (tabId) => browser.tabs.reload(Number(tabId)),
      onDiscardTab: (tabId) => browser.tabs.discard(Number(tabId)),
      onSaveCustomGroups: () => this.saveCustomGroups(),
      onRenderTabs: () => this.renderTabs(),
      onLoadTabs: () => this.loadTabs(),
      onError: (error) => console.error('UIRenderer error:', error)
    });
    
    // State - sync with TabManager
    this.tabs = this.tabManager.getTabs();
    this.activeTabId = null;
    // Drag state is now managed by DragDropManager
    
    // Settings manager
    this.settingsManager = getSettingsManager();
    
    // Custom tab names (user-renamed tabs)
    this.customTabNames = {}; // { tabId: { customName: string, originalName: string } }
    
    // Debounced loadTabs for performance
    this.debouncedLoadTabs = debounce(() => this.loadTabs(), 100);
    
    // Track active sort dropdown close handlers for cleanup
    this._activeSortDropdownHandlers = new Set();
    
    // Shared DOMParser instance for reuse (avoid creating in loops)
    this._domParser = new DOMParser();
    
    // Bind event listeners for cleanup
    this._boundLoadTabs = () => this.debouncedLoadTabs();
    this._boundStorageListener = (changes, areaName) => this.handleStorageChange(changes, areaName);
    this._boundContextMenuHandler = (e) => this.handleContextMenu(e);
    this._boundClickHandler = () => this.hideContextMenu();
    this._boundKeydownHandler = (e) => this.handleKeydown(e);
    this._boundTabRemoved = (tabId, removeInfo) => this.handleTabRemoved(tabId, removeInfo);
    this._boundTabActivated = (activeInfo) => this.handleTabActivated(activeInfo);
    
    // Context menu element
    this.contextMenu = null;
    
    // Color categories for grouping
    this.colorCategories = {
      'red': { name: 'Red', color: '#ff5252' },
      'orange': { name: 'Orange', color: '#ff9800' },
      'yellow': { name: 'Yellow', color: '#ffeb3b' },
      'green': { name: 'Green', color: '#4caf50' },
      'blue': { name: 'Blue', color: '#2196f3' },
      'purple': { name: 'Purple', color: '#9c27b0' },
      'gray': { name: 'Gray', color: '#9e9e9e' }
    };
    
    // DOM elements - to be set by subclasses
    this.tabsList = null;
    this.tabCount = null;
    this.tabsScrollContainer = null;
    this.tabPreview = null;
    
    // Modal element
    this.modal = null;
    this.modalResolve = null;
    
    // Lazy loading state
    this._loadedGroups = new Set(); // Track which groups have been loaded
  }
  
  /**
   * Setup TabManager event listeners
   * @private
   */
  _setupTabManagerListeners() {
    // Listen for tabs loaded event to sync state
    this.tabManager.on('tabsLoaded', ({ tabs, activeTabId }) => {
      this.tabs = tabs;
      this.activeTabId = activeTabId;
      this.renderTabs();
    });
    
    // Listen for tab activation
    this.tabManager.on('tabActivated', ({ tabId }) => {
      this.activeTabId = tabId;
    });
    
    // Listen for errors
    this.tabManager.on('error', ({ action, error }) => {
      console.error(`TabManager error in ${action}:`, error);
    });
  }
  
  /**
   * Setup GroupManager event listeners
   * @private
   */
  _setupGroupManagerListeners() {
    // Listen for group changes to re-render
    this.groupManager.on('groupsLoaded', () => {
      this.renderTabs();
    });
    
    this.groupManager.on('groupCreated', ({ group }) => {
      this.renderTabs();
      // Show notification for group creation
      showNotification(`Group "${group.name}" was created`);
    });
    
    this.groupManager.on('groupUpdated', ({ group, changes }) => {
      this.renderTabs();
    });
    
    this.groupManager.on('groupDeleted', ({ groupId, deletedGroups, deletedCount }) => {
      this.renderTabs();
      // Show notification for group deletion
      const groupNames = deletedGroups.map(g => g.name).join(', ');
      showNotification(`Group "${groupNames}" ${deletedCount > 1 ? 'deleted' : 'removed'}`);
    });
    
    this.groupManager.on('tabAddedToGroup', () => {
      this.renderTabs();
    });
    
    this.groupManager.on('tabRemovedFromGroup', () => {
      this.renderTabs();
    });
    
    this.groupManager.on('error', ({ action, error }) => {
      console.error(`GroupManager error in ${action}:`, error);
    });
  }
  
  /**
   * Handle tabs loaded from TabManager
   * @private
   */
  _onTabsLoaded({ tabs, activeTabId }) {
    this.tabs = tabs;
    this.activeTabId = activeTabId;
  }
  
  async init() {
    // Load settings
    await this.loadSettings();
    
    // Update action buttons visibility based on settings
    this.updateActionButtonsVisibility();
    
    // Load page headings from storage (via SearchEngine)
    await this.searchEngine.loadPageHeadings();
    
    // Load page tags from storage (via SearchEngine)
    await this.searchEngine.loadPageTags();
    
    // Load current window tabs
    await this.loadTabs();
    
    // Set up event listeners
    this.setupEventListeners();
    this.setupStorageListener();
    this.setupContextMenu();
    this.createModal();
    
    // Listen for tab updates with debouncing
    this.setupTabListeners();
    
    // Start periodic cleanup of expired page headings
    this.startExpiredPageHeadingsCleanup();
  }
  
  // Update action buttons left panel visibility based on settings
  updateActionButtonsVisibility() {
    const actionButtonsLeft = document.querySelectorAll('.action-buttons-left');
    const enabled = this.settings?.enableActionButtonsLeft ?? false;
    
    actionButtonsLeft.forEach(el => {
      if (enabled) {
        el.classList.add('visible');
      } else {
        el.classList.remove('visible');
      }
    });
  }
  
  // Calculate expiration time in milliseconds from settings
  getIndexExpirationMs() {
    const days = this.settings?.indexExpirationDays ?? 3;
    const hours = this.settings?.indexExpirationHours ?? 0;
    const minutes = this.settings?.indexExpirationMinutes ?? 0;
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerHour = 60 * 60 * 1000;
    const msPerMinute = 60 * 1000;
    
    return (days * msPerDay) + (hours * msPerHour) + (minutes * msPerMinute);
  }
  
  // Property getters/setters for backward compatibility - delegate to SearchEngine
  get searchQuery() {
    return this.searchEngine ? this.searchEngine.getSearchQuery() : '';
  }
  
  set searchQuery(value) {
    if (this.searchEngine) {
      this.searchEngine.searchQuery = value;
    }
  }
  
  get filteredTabs() {
    return this.searchEngine ? this.searchEngine.getFilteredTabs() : [];
  }
  
  set filteredTabs(value) {
    if (this.searchEngine) {
      this.searchEngine.filteredTabs = value;
    }
  }
  
  get headingSearchResults() {
    return this.searchEngine ? this.searchEngine.getHeadingSearchResults() : [];
  }
  
  set headingSearchResults(value) {
    if (this.searchEngine) {
      this.searchEngine.headingSearchResults = value;
    }
  }
  
  get filterTabs() {
    return this.searchEngine ? this.searchEngine.filterTabs : true;
  }
  
  set filterTabs(value) {
    if (this.searchEngine) {
      this.searchEngine.filterTabs = value;
    }
  }
  
  get filterHeadingTypes() {
    return this.searchEngine ? this.searchEngine.filterHeadingTypes : [];
  }
  
  set filterHeadingTypes(value) {
    if (this.searchEngine) {
      this.searchEngine.filterHeadingTypes = value;
    }
  }
  
  get hasActiveFilter() {
    return this.searchEngine ? this.searchEngine.hasActiveFilter : false;
  }
  
  set hasActiveFilter(value) {
    if (this.searchEngine) {
      this.searchEngine.hasActiveFilter = value;
    }
  }
  
  get pageHeadings() {
    return this.searchEngine ? this.searchEngine.pageHeadings : {};
  }
  
  set pageHeadings(value) {
    if (this.searchEngine) {
      this.searchEngine.pageHeadings = value;
    }
  }
  
  get pageTags() {
    return this.searchEngine ? this.searchEngine.pageTags : {};
  }
  
  set pageTags(value) {
    if (this.searchEngine) {
      this.searchEngine.pageTags = value;
    }
  }
  
  // Get tags for a specific tab
  getTagsForTab(tab) {
    if (!tab || !tab.url) return [];
    const urlKey = this.getUrlKey(tab.url);
    return this.pageTags[urlKey] || [];
  }
  
  // Set tags for a specific tab
  async setTagsForTab(tab, tags) {
    if (!tab || !tab.url) return;
    await this.searchEngine.setTagsForUrl(tab.url, tags);
  }
  
  // Get all unique tags
  async getAllUniqueTags() {
    return await this.searchEngine.getAllUniqueTags();
  }
  
  // Get a URL key for indexing - delegate to SearchEngine
  getUrlKey(url) {
    return this.searchEngine ? this.searchEngine.getUrlKey(url) : url;
  }
  
  // Clean up expired page headings from IndexedDB
  async cleanupExpiredPageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        const expirationMs = this.getIndexExpirationMs();
        await window.YouTabsDB.cleanupExpiredPagesIndex(expirationMs);
        console.log(`Page headings cleanup completed. Expiration: ${expirationMs}ms (${this.settings?.indexExpirationDays ?? 3} days)`);
        
        // Also cleanup by max pages limit
        const maxPages = this.settings?.maxIndexedPages || 1000;
        await window.YouTabsDB.cleanupMaxPages(maxPages);
        console.log(`Max pages cleanup completed. Max: ${maxPages}`);
      }
    } catch (error) {
      console.error('Error cleaning up expired page headings:', error);
    }
  }
  
  // Start periodic cleanup of expired page headings
  startExpiredPageHeadingsCleanup() {
    // Run cleanup immediately
    this.cleanupExpiredPageHeadings();
    
    // Then run every hour
    setInterval(() => {
      this.cleanupExpiredPageHeadings();
    }, 60 * 60 * 1000); // 1 hour
  }
  
  // Create custom modal element
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
  
  // Show prompt modal (replacement for prompt())
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
  
  // Show confirm modal (replacement for confirm())
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
  
  // Show delete confirmation modal
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
  
  // Hide modal and resolve promise
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
  
  // Handle tab update for indexing
  handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && this.settings.enablePageSearch) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        this.indexPageHeadings(tabId);
      }, 500);
    }
  }
  
  setupTabListeners() {
    // Bind the new handler
    this._boundHandleTabUpdate = (tabId, changeInfo, tab) => this.handleTabUpdate(tabId, changeInfo, tab);
    
    browser.tabs.onUpdated.addListener(this._boundLoadTabs);
    browser.tabs.onCreated.addListener(this._boundLoadTabs);
    browser.tabs.onRemoved.addListener(this._boundTabRemoved);
    browser.tabs.onActivated.addListener(this._boundLoadTabs);
    browser.tabs.onActivated.addListener(this._boundTabActivated);
    
    // Also listen for tab updates to index pages when they complete loading
    browser.tabs.onUpdated.addListener(this._boundHandleTabUpdate);
  }
  
  cleanup() {
    // Cleanup TabManager
    if (this.tabManager) {
      this.tabManager.destroy();
    }
    
    // Cleanup GroupManager
    if (this.groupManager) {
      this.groupManager.destroy();
    }
    
    // Remove tab event listeners
    browser.tabs.onUpdated.removeListener(this._boundLoadTabs);
    browser.tabs.onCreated.removeListener(this._boundLoadTabs);
    browser.tabs.onRemoved.removeListener(this._boundTabRemoved);
    browser.tabs.onActivated.removeListener(this._boundLoadTabs);
    browser.tabs.onActivated.removeListener(this._boundTabActivated);
    browser.tabs.onUpdated.removeListener(this._boundHandleTabUpdate);
    
    // Remove storage listener
    browser.storage.onChanged.removeListener(this._boundStorageListener);
    
    // Remove context menu listeners
    document.removeEventListener('contextmenu', this._boundContextMenuHandler);
    document.removeEventListener('click', this._boundClickHandler);
    document.removeEventListener('keydown', this._boundKeydownHandler);
    
    // Remove color picker close handler if exists
    if (this._colorPickerCloseHandler) {
      document.removeEventListener('click', this._colorPickerCloseHandler);
      this._colorPickerCloseHandler = null;
    }
    
    // Hide any open context menu
    this.hideContextMenu();
  }
  
  setupStorageListener() {
    browser.storage.onChanged.addListener(this._boundStorageListener);
  }
  
  // Setup context menu for tabs and groups
  setupContextMenu() {
    // Listen for context menu events on the document
    document.addEventListener('contextmenu', this._boundContextMenuHandler);
    
    // Close context menu on click elsewhere
    document.addEventListener('click', this._boundClickHandler);
  }
  
  // Handle context menu display
  handleContextMenu(e) {
    // Hide any existing menu
    this.hideContextMenu();
    
    const target = e.target;
    
    // Check if right-clicking on heading search results - don't show context menu
    const headingResults = target.closest('.heading-search-results');
    if (headingResults) {
      e.preventDefault();
      return;
    }
    
    // Check if right-clicking on a tab
    const tabItem = target.closest('.tab-item');
    if (tabItem) {
      e.preventDefault();
      const tabId = parseInt(tabItem.dataset.tabId);
      const customGroup = this.getCustomGroupForTab(tabId);
      this.showTabContextMenu(e, tabId, customGroup);
      return;
    }
    
    // Check if right-clicking on a group header
    const groupHeader = target.closest('.tab-group-header');
    if (groupHeader) {
      e.preventDefault();
      const groupContainer = groupHeader.closest('.tab-group');
      const groupKey = groupContainer?.dataset.groupKey;
      if (groupKey?.startsWith('custom_')) {
        const groupId = groupKey.replace('custom_', '');
        this.showGroupContextMenu(e, groupId);
      }
      return;
    }
    
    // Right-click on empty area - show create group option
    const tabsContainer = target.closest('.you-tabs-container');
    
    // Show menu when clicking on you-tabs-container empty area (not on tabs or groups)
    if (tabsContainer && !tabItem && !groupHeader) {
      e.preventDefault();
      this.showEmptyAreaContextMenu(e);
    }
  }
  
  // Show context menu for tabs
  showTabContextMenu(e, tabId, customGroup) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Check if tab has custom name
    const hasCustomName = this.hasCustomTabName(tabId);
    const tab = this.tabs.find(t => t.id === Number(tabId));
    
    // Get real/original tab name
    const customTabNameData = this.customTabNames[Number(tabId)];
    const realName = customTabNameData?.originalName || tab?.title || 'New tab';
    
    // Show real tab name in context menu (especially useful when custom name is set)
    if (hasCustomName) {
      const realNameItem = document.createElement('div');
      realNameItem.className = 'context-menu-item context-menu-info';
      // Create elements safely instead of using innerHTML
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
      const tab = this.tabs.find(t => t.id === Number(tabId));
      const currentName = this.getTabDisplayTitle(tab);
      const newName = await this.showPrompt('Rename Tab', 'Enter new name:', currentName);
      if (newName && typeof newName === 'string' && newName.trim() && newName !== currentName) {
        await this.setTabCustomName(tabId, newName.trim());
      }
      this.hideContextMenu();
    });
    menu.appendChild(renameItem);
    
    // Tags option
    const tagsItem = document.createElement('div');
    tagsItem.className = 'context-menu-item';
    tagsItem.textContent = 'Tags';
    tagsItem.addEventListener('click', async () => {
      const tab = this.tabs.find(t => t.id === Number(tabId));
      if (tab) {
        const currentTags = this.getTagsForTab(tab);
        const tagsInput = await this.showPrompt('Manage Tags', 'Enter tags (comma-separated):', currentTags.join(', '));
        if (tagsInput !== null) {
          const newTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
          await this.setTagsForTab(tab, newTags);
          this.renderTabs();
        }
      }
      this.hideContextMenu();
    });
    menu.appendChild(tagsItem);
    
    // Restore original name option (only if custom name exists)
    if (hasCustomName) {
      const restoreItem = document.createElement('div');
      restoreItem.className = 'context-menu-item';
      restoreItem.textContent = 'Restore original name';
      restoreItem.addEventListener('click', async () => {
        await this.restoreTabOriginalName(tabId);
        this.hideContextMenu();
      });
      menu.appendChild(restoreItem);
    }
    
    // Divider
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    menu.appendChild(divider);
    
    // Add to group submenu
    if (this.groupManager.customGroups.length > 0) {
      // Show "Add to group" with submenu when there are existing groups
      const addToGroupItem = document.createElement('div');
      addToGroupItem.className = 'context-menu-item has-submenu';
      // Create elements safely instead of using innerHTML
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
          const newGroup = await this.createCustomGroup(groupName.trim());
          await this.addTabToGroup(tabId, newGroup.id);
        }
        this.hideContextMenu();
      });
      submenu.appendChild(newGroupItem);
      
      // Add existing groups
      const divider = document.createElement('div');
      divider.className = 'context-menu-divider';
      submenu.appendChild(divider);
      
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
      const sortedGroups = [...this.groupManager.customGroups].sort((a, b) => {
        const depthA = this.getGroupDepth(a.id);
        const depthB = this.getGroupDepth(b.id);
        if (depthA !== depthB) return depthA - depthB;
        return a.name.localeCompare(b.name);
      });
      
      sortedGroups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'context-menu-item group-search-item';
        
        // Get full hierarchy path for search
        const hierarchyNames = this.getGroupHierarchyNamesForGroup(group.id);
        groupItem.dataset.groupName = hierarchyNames.join(' ').toLowerCase();
        
        const depth = this.getGroupDepth(group.id);
        const indent = depth > 0 ? '└'.repeat(depth) + ' ' : '';
        // Create elements safely instead of using innerHTML
        const span = document.createElement('span');
        span.textContent = indent + group.name;
        groupItem.appendChild(span);
        if (depth > 0) {
          groupItem.style.paddingLeft = (8 + depth * 12) + 'px';
        }
        groupItem.addEventListener('click', async () => {
          await this.addTabToGroup(tabId, group.id);
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
          const newGroup = await this.createCustomGroup(groupName.trim());
          await this.addTabToGroup(tabId, newGroup.id);
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
        await this.removeTabFromGroup(tabId, customGroup.id);
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
      // Create elements safely instead of using innerHTML
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
          // To reload a discarded tab, we reload it
          await browser.tabs.reload(Number(tabId));
        } catch (error) {
          console.error('Error loading tab:', error);
        }
        this.hideContextMenu();
      });
      menu.appendChild(loadItem);
    } else if (!isTabActive) {
      // Tab is loaded and not active - show "Unload" option
      // Note: Cannot discard the active tab
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
          // Discard the tab (unload from memory)
          await browser.tabs.discard(Number(tabId));
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
    const tabUrlKey = tab ? this.getUrlKey(tab.url) : null;
    const isIndexed = tabUrlKey && this.pageHeadings && this.pageHeadings[tabUrlKey] && this.pageHeadings[tabUrlKey].length > 0;
    
    if (isIndexed) {
      // Show indexed info and update/remove options
      const headings = this.pageHeadings[tabUrlKey];
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
        await this.removePageHeadingsForTab(tabId);
        this.hideContextMenu();
        this.renderTabs();
      });
      menu.appendChild(removeIndexItem);
    } else {
      // Create index option
      const createIndexItem = document.createElement('div');
      createIndexItem.className = 'context-menu-item';
      createIndexItem.textContent = 'Create index';
      createIndexItem.addEventListener('click', async () => {
        this.hideContextMenu();
        await this.indexPageHeadings(tabId);
        this.renderTabs();
      });
      menu.appendChild(createIndexItem);
    }
    
    this.positionContextMenu(menu, e);
    document.body.appendChild(menu);
    this.contextMenu = menu;
  }
  
  // Show context menu for groups
  showGroupContextMenu(e, groupId) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Check if this is a nested group (has parent)
    const group = this.groupManager._getGroupById(groupId);
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
    const currentDepth = this.getGroupDepth(groupId);
    if (currentDepth < 2) { // depth 0 = level 1, depth 1 = level 2 (can create subgroups), depth 2 = level 3 (cannot create subgroups)
      const addSubgroupItem = document.createElement('div');
      addSubgroupItem.className = 'context-menu-item';
      addSubgroupItem.textContent = 'Add subgroup';
      addSubgroupItem.addEventListener('click', async () => {
        const subgroupName = await this.showPrompt('New Subgroup', 'Enter subgroup name:', 'New subgroup');
        if (subgroupName && typeof subgroupName === 'string' && subgroupName.trim()) {
          await this.createCustomGroup(subgroupName.trim(), 'blue', groupId);
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
  
  // Show context menu for empty area
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
        await this.createCustomGroup(groupName.trim());
      }
      this.hideContextMenu();
    });
    menu.appendChild(createGroupItem);
    
    this.positionContextMenu(menu, e);
    document.body.appendChild(menu);
    this.contextMenu = menu;
  }
  
  // Position context menu
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
  
  // Hide context menu
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
    // Also remove any color picker dropdowns
    const pickers = document.querySelectorAll('.color-picker-dropdown');
    pickers.forEach(p => p.remove());
  }
  
  handleStorageChange(changes, areaName) {
    if (areaName === 'local') {
      if (changes.settings) {
        const oldSettings = this.settings;
        this.settings = { ...this.settings, ...(changes.settings?.newValue || {}) };
        
        // Update UIRenderer settings reference
        if (this.uiRenderer) {
          this.uiRenderer.options.settings = this.settings;
        }
        
        // Check if theme changed
        if (oldSettings.theme !== this.settings.theme) {
          this.applyTheme(this.settings.theme);
        }
        
        // Update action buttons visibility if setting changed
        if (oldSettings.enableActionButtonsLeft !== this.settings.enableActionButtonsLeft) {
          this.updateActionButtonsVisibility();
        }
        
        // Check if index expiration settings changed - run cleanup
        const expirationKeys = ['indexExpirationDays', 'indexExpirationHours', 'indexExpirationMinutes'];
        const hasExpirationChange = expirationKeys.some(key => 
          oldSettings[key] !== this.settings[key]
        );
        
        if (hasExpirationChange) {
          this.cleanupExpiredPageHeadings();
        }
        
        // Clean up duplicates - now tabs can only be in one group
        this.cleanupDuplicateTabs().then(async () => {
          // Reload tabs if grouping settings changed
          if (oldSettings.enableGrouping !== this.settings.enableGrouping ||
              oldSettings.groupingType !== this.settings.groupingType) {
            this.loadTabs();
          } else {
            this.renderTabs();
          }
        });
      }
    }
  }
  
  async loadSettings() {
    try {
      // Load settings from SettingsManager
      this.settings = await this.settingsManager.getAll();
      
      // Apply theme
      await this.applyTheme(this.settings.theme);
      
      // Migrate from localStorage to IndexedDB if needed
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.openDatabase();
        await window.YouTabsDB.migrateFromLocalStorage();
        await window.YouTabsDB.migrateFromYouTabsHeadings();
      }
      
      // Load groups via GroupManager
      await this.groupManager.loadGroups();
      
      // Update UIRenderer settings reference after loading
      if (this.uiRenderer) {
        this.uiRenderer.options.settings = this.settings;
      }
      
      // Load custom tab names
      const storedTabNames = await browser.storage.local.get('customTabNames');
      if (storedTabNames.customTabNames) {
        this.customTabNames = storedTabNames.customTabNames;
      }
      
      // Note: groupTabMetadata is already loaded above (lines 1247-1250)
      // Removed duplicate request to browser.storage.local.get('groupTabMetadata')
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  // Save custom groups to storage
  async saveCustomGroups() {
    try {
      // Delegate to GroupManager
      await this.groupManager.saveCustomGroups();
    } catch (error) {
      console.error('Error saving custom groups:', error);
    }
  }
  
  // Rebuild the groups lookup Map for O(1) access by ID - delegated to GroupManager
  _rebuildGroupsMap() {
    return this.groupManager._rebuildGroupsMap();
  }
  
  // Get group by ID with O(1) lookup - delegated to GroupManager
  _getGroupById(groupId) {
    return this.groupManager._getGroupById(groupId);
  }
  
  // Save custom tab names to storage
  async saveCustomTabNames() {
    try {
      await browser.storage.local.set({
        customTabNames: this.customTabNames
      });
    } catch (error) {
      console.error('Error saving custom tab names:', error);
    }
  }
  
  // Save group tab metadata to storage (debounced) - delegated to GroupManager
  async saveGroupTabMetadata() {
    return this.groupManager.saveGroupTabMetadata();
  }
  
  // Set custom name for a tab
  async setTabCustomName(tabId, customName) {
    const numericTabId = Number(tabId);
    // Get the current tab to store original name
    const tab = this.tabs.find(t => t.id === numericTabId);
    if (!tab) return;
    
    if (!this.customTabNames[numericTabId]) {
      this.customTabNames[numericTabId] = {
        originalName: tab.title
      };
    }
    
    this.customTabNames[numericTabId].customName = customName;
    await this.saveCustomTabNames();
    this.renderTabs();
  }
  
  // Restore original tab name
  async restoreTabOriginalName(tabId) {
    const numericTabId = Number(tabId);
    if (this.customTabNames[numericTabId]) {
      delete this.customTabNames[numericTabId];
      await this.saveCustomTabNames();
      this.renderTabs();
    }
  }
  
  // Check if tab has custom name
  hasCustomTabName(tabId) {
    const numericTabId = Number(tabId);
    return this.customTabNames[numericTabId]?.customName;
  }
  
  // Get display title for tab (custom or original)
  getTabDisplayTitle(tab) {
    const numericTabId = Number(tab.id);
    if (this.customTabNames[numericTabId]?.customName) {
      return this.customTabNames[numericTabId].customName;
    }
    return tab.title || 'New tab';
  }
  
  // Clean up duplicate tabs - ensure each tab is only in one group - delegated to GroupManager
  async cleanupDuplicateTabs() {
    return this.groupManager.cleanupDuplicateTabs();
  }
  
  // Create a new custom group - delegated to GroupManager
  async createCustomGroup(name, color = 'blue', parentId = null) {
    const newGroup = await this.groupManager.createCustomGroup(name, color, parentId);
    if (newGroup) {
      this.renderTabs();
    }
    return newGroup;
  }
  
  // Get nesting depth of a group (with memoization) - delegated to GroupManager
  getGroupDepth(groupId) {
    return this.groupManager.getGroupDepth(groupId);
  }
  
  // Clear depth cache when groups are modified - delegated to GroupManager
  clearGroupDepthCache() {
    return this.groupManager.clearGroupDepthCache();
  }
  
  // Get all subgroups (children) of a group - delegated to GroupManager
  getSubgroups(parentId) {
    return this.groupManager.getSubgroups(parentId);
  }
  
  // Get root groups (no parent) - delegated to GroupManager
  getRootGroups() {
    return this.groupManager.getRootGroups();
  }
  
  // Get total tabs count in all nested groups (descendants) - delegated to GroupManager
  getNestedTabsCount(groupId) {
    return this.groupManager.getNestedTabsCount(groupId);
  }
  
  // Rename a custom group - delegated to GroupManager
  async renameCustomGroup(groupId, newName) {
    await this.groupManager.renameCustomGroup(groupId, newName);
    this.renderTabs();
  }
  
  // Update group color - delegated to GroupManager
  async updateCustomGroupColor(groupId, newColor) {
    await this.groupManager.updateCustomGroupColor(groupId, newColor);
    this.renderTabs();
  }
  
  // Delete a custom group and all its subgroups - delegated to GroupManager
  async deleteCustomGroup(groupId) {
    await this.groupManager.deleteCustomGroup(groupId);
    this.renderTabs();
  }
  
  // Add tab to custom group (removes from other groups) - delegated to GroupManager
  async addTabToGroup(tabId, groupId) {
    await this.groupManager.addTabToGroup(tabId, groupId);
    // Note: renderTabs() is called by the tabAddedToGroup event listener
  }
  
  // Remove tab from custom group - delegated to GroupManager
  async removeTabFromGroup(tabId, groupId) {
    await this.groupManager.removeTabFromGroup(tabId, groupId);
    this.renderTabs();
  }
  
  // Get custom group for a tab (optimized with early exit) - delegated to GroupManager
  getCustomGroupForTab(tabId) {
    return this.groupManager.getCustomGroupForTab(tabId);
  }
  
  // Get all tabs in a custom group - delegated to GroupManager
  getTabsInCustomGroup(groupId) {
    return this.groupManager.getTabsInCustomGroup(groupId, this.tabs);
  }
  
  // Get sorted tabs in a custom group - delegated to GroupManager
  getSortedTabsInGroup(groupId) {
    return this.groupManager.getSortedTabsInGroup(groupId, this.tabs);
  }
  
  // Sort tabs based on criteria - delegated to GroupManager
  sortTabs(tabs, groupId, sortBy, sortOrder) {
    return this.groupManager.sortTabs(tabs, groupId, sortBy, sortOrder);
  }
  
  // Update group sorting settings - delegated to GroupManager
  async updateGroupSorting(groupId, sortBy, sortOrder) {
    await this.groupManager.updateGroupSorting(groupId, sortBy, sortOrder);
    this.renderTabs();
  }
  
  // Update tab usage when tab is activated - delegated to GroupManager
  async updateTabUsage(tabId, groupId) {
    await this.groupManager.updateTabUsage(tabId, groupId);
  }
  
  // Show rename group dialog
  async showRenameGroupDialog(groupId) {
    const group = this.groupManager._getGroupById(groupId);
    if (!group) return;
    
    const newName = await this.showPrompt('Rename Group', 'Enter new group name:', group.name);
    if (newName && typeof newName === 'string' && newName.trim() !== '') {
      this.renameCustomGroup(groupId, newName.trim());
    }
  }
  
  // Confirm delete group
  async confirmDeleteGroup(groupId) {
    const group = this.groupManager._getGroupById(groupId);
    if (!group) return;
    
    const tabCount = group.tabIds.length;
    const message = tabCount > 0
      ? `Delete group "${group.name}" and all ${tabCount} tabs in it?`
      : `Delete group "${group.name}"?`;
    
    if (await this.showDeleteConfirm('Delete Group', message)) {
      this.deleteCustomGroup(groupId);
    }
  }
  
  
  
  
  // Convert hex to HSL - delegated to GroupManager
  hexToHsl(hex) {
    return this.groupManager.hexToHsl(hex);
  }
  
  // Convert HSL to hex - delegated to GroupManager
  hslToHex(h, s, l) {
    return this.groupManager.hslToHex(h, s, l);
  }
  
  // Open color picker in separate window
  openColorPickerWindow(groupId, position) {
    // Remove any existing color picker window
    const existingPicker = document.querySelector('.color-picker-window');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    // Get current color
    const group = this.groupManager._getGroupById(groupId);
    const currentColor = group?.color || '#2196f3';
    const currentHsl = this.hexToHsl(currentColor);
    
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
    this.groupManager.groupColors.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'color-quick-btn';
      btn.style.backgroundColor = color.color;
      btn.title = color.name;
      btn.addEventListener('click', async () => {
        await this.updateCustomGroupColor(groupId, color.color);
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
      const hex = this.hslToHex(h, s, l);
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
        const hsl = this.hexToHsl(val);
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
      await this.updateCustomGroupColor(groupId, hexInput.value);
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

  async loadTabs() {
    // Delegate to TabManager
    try {
      await this.tabManager.loadTabs();
      // State is synced via event listener
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }
  
  renderTabs() {
    // Delegate to UIRenderer
    if (this.uiRenderer) {
      this.uiRenderer.renderTabs();
    }
  }

  getGroupInfo(groupKey, group) {
    // Delegate to GroupManager
    return this.groupManager.getGroupInfo(groupKey, group);
  }
  
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
      this.saveCollapsedState(groupKey, false);
      
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
      this.saveCollapsedState(groupKey, true);
      
      // Collapse all nested subgroups
      this.collapseAllDescendants(groupKey);
    }
  }
  
  // Toggle collapse state for a tab (used for tree structure)
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
      this.saveTabCollapsedState(tabId, false);
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
      this.saveTabCollapsedState(tabId, true);
    }
  }
  
  saveTabCollapsedState(tabId, collapsed) {
    try {
      let collapsedTabs = this.settings.collapsedTabs || [];
      
      if (collapsed) {
        if (!collapsedTabs.includes(tabId)) {
          collapsedTabs.push(tabId);
        }
      } else {
        collapsedTabs = collapsedTabs.filter(id => id !== tabId);
      }
      
      this.settings.collapsedTabs = collapsedTabs;
      this.settingsManager.save(this.settings);
    } catch (error) {
      console.error('Error saving tab collapsed state:', error);
    }
  }
  
  // Collapse all descendant groups
  collapseAllDescendants(parentGroupKey) {
    const parentId = parentGroupKey.replace('custom_', '');
    
    // Find all child groups
    const childGroups = this.groupManager.customGroups.filter(g => g.parentId === parentId);
    
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
          this.saveCollapsedState(childKey, true);
        }
      }
      
      // Recursively collapse grandchildren
      this.collapseAllDescendants(child.id);
    });
  }
  
  // Expand only direct children (not grandchildren)
  expandDirectChildren(parentGroupKey) {
    const parentId = parentGroupKey.replace('custom_', '');
    
    // Find all child groups
    const childGroups = this.groupManager.customGroups.filter(g => g.parentId === parentId);
    
    childGroups.forEach(child => {
      const childKey = 'custom_' + child.id;
      
      // Find the DOM element for this child group
      const childContainer = document.querySelector(`.tab-group[data-group-key="${childKey}"]`);
      if (childContainer) {
        const childHeader = childContainer.querySelector('.tab-group-header');
        const childTabList = childContainer.querySelector('.tab-group-tabs');
        
        if (childHeader && childTabList) {
          // Check if this child was collapsed
          if (this.settings.collapsedGroups?.includes(childKey)) {
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
  
  async saveCollapsedState(groupKey, forceState = null) {
    try {
      let collapsedGroups = this.settings.collapsedGroups || [];
      
      if (forceState === true) {
        // Add to collapsed if not already
        if (!collapsedGroups.includes(groupKey)) {
          collapsedGroups = [...collapsedGroups, groupKey];
        }
      } else if (forceState === false) {
        // Remove from collapsed
        collapsedGroups = collapsedGroups.filter(g => g !== groupKey);
      } else {
        // Toggle
        if (collapsedGroups.includes(groupKey)) {
          collapsedGroups = collapsedGroups.filter(g => g !== groupKey);
        } else {
          collapsedGroups = [...collapsedGroups, groupKey];
        }
      }
      
      this.settings.collapsedGroups = collapsedGroups;
      
      await this.settingsManager.save(this.settings);
    } catch (error) {
      console.error('Error saving collapsed state:', error);
    }
  }
  
  groupTabsByDomain() {
    const groups = {};
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.groupManager.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    this.tabs.forEach(tab => {
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
  
  groupTabsByColor() {
    const groups = {};
    groups['gray'] = [];
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.groupManager.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    this.tabs.forEach(tab => {
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
  
  groupTabsByTime() {
    const groups = {
      'today': [],
      'yesterday': [],
      'thisWeek': [],
      'older': []
    };
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.groupManager.customGroups.forEach(group => {
      group.tabIds.forEach(id => tabsInCustomGroups.add(Number(id)));
    });
    
    const now = Date.now();
    const hourMs = 3600000;
    
    this.tabs.forEach(tab => {
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
  
  // Group tabs by custom user groups
  groupTabsByCustomGroups() {
    const groups = {};
    
    // First, add all custom groups
    this.groupManager.customGroups.forEach(group => {
      const groupKey = 'custom_' + group.id;
      groups[groupKey] = this.tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
    });
    
    // Add ungrouped tabs
    const groupedTabIds = new Set();
    this.groupManager.customGroups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(Number(id)));
    });
    
    const ungroupedTabs = this.tabs.filter(tab => !groupedTabIds.has(tab.id));
    if (ungroupedTabs.length > 0) {
      groups['ungrouped'] = ungroupedTabs;
    }
    
    return groups;
  }
  
  setupEventListeners() {
    // To be implemented by subclasses
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSettings();
      });
    }
    
    // Tabs actions panel buttons
    const refreshAllBtn = document.getElementById('refreshAllBtn');
    if (refreshAllBtn) {
      refreshAllBtn.addEventListener('click', async () => {
        await this.refreshAllTabs();
      });
    }
    
    const closeAllBtn = document.getElementById('closeAllBtn');
    if (closeAllBtn) {
      closeAllBtn.addEventListener('click', async () => {
        await this.closeAllTabs();
      });
    }
    
    const closeOthersBtn = document.getElementById('closeOthersBtn');
    if (closeOthersBtn) {
      closeOthersBtn.addEventListener('click', async () => {
        await this.closeOtherTabs();
      });
    }
    
    const closeLeftBtn = document.getElementById('closeLeftBtn');
    if (closeLeftBtn) {
      closeLeftBtn.addEventListener('click', async () => {
        await this.closeTabsToLeft();
      });
    }
    
    const closeRightBtn = document.getElementById('closeRightBtn');
    if (closeRightBtn) {
      closeRightBtn.addEventListener('click', async () => {
        await this.closeTabsToRight();
      });
    }
    
    const openIndexesBtn = document.getElementById('openIndexesBtn');
    if (openIndexesBtn) {
      openIndexesBtn.addEventListener('click', async () => {
        // Open the indexes page in a new tab
        const indexesUrl = browser.runtime.getURL('indexes.html');
        await browser.tabs.create({ url: indexesUrl });
      });
    }
    
    const indexAllBtn = document.getElementById('indexAllBtn');
    if (indexAllBtn) {
      indexAllBtn.addEventListener('click', async () => {
        const originalHtml = indexAllBtn.innerHTML;
        // Show loading icon while indexing - use shared DOMParser for safety
        const doc = this._domParser.parseFromString(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>`, 'text/html');
        indexAllBtn.innerHTML = '';
        indexAllBtn.appendChild(doc.body.firstChild);
        indexAllBtn.disabled = true;
        
        await this.indexAllTabs();
        
        // Restore original content using shared DOMParser for safety
        const restoreDoc = this._domParser.parseFromString(originalHtml, 'text/html');
        indexAllBtn.textContent = '';
        while (restoreDoc.body.firstChild) {
          indexAllBtn.appendChild(restoreDoc.body.firstChild);
        }
        indexAllBtn.disabled = false;
      });
    }
    
    const clearIndexBtn = document.getElementById('clearIndexBtn');
    if (clearIndexBtn) {
      clearIndexBtn.addEventListener('click', async () => {
        await this.clearIndexForAllTabs();
      });
    }
    
    if (this.tabsScrollContainer) {
      this.tabsScrollContainer.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          this.tabsScrollContainer.scrollLeft += e.deltaY;
        }
      });
      
      // Allow dropping groups on empty area to make them root-level
      this.tabsScrollContainer.addEventListener('dragover', (e) =>
        this.dragDropManager.handleContainerDragOver(e, this.tabsScrollContainer));
      
      this.tabsScrollContainer.addEventListener('dragleave', (e) =>
        this.dragDropManager.handleContainerDragLeave(e, this.tabsScrollContainer));
      
      this.tabsScrollContainer.addEventListener('drop', (e) =>
        this.dragDropManager.handleContainerDrop(e));
    }
    
    document.addEventListener('keydown', this._boundKeydownHandler);
  }
  
  handleKeydown(e) {
    // Don't intercept if user is typing in an input field
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
      return;
    }

    // Escape key to clear heading search results
    if (e.key === 'Escape' && this.headingSearchResults && this.headingSearchResults.length > 0) {
      e.preventDefault();
      this.clearSearch();
      return;
    }

    if (e.ctrlKey && e.key === 'w' && this.activeTabId) {
      e.preventDefault();
      this.closeTabById(this.activeTabId);
    }

    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      this.createNewTab();
    }
  }
  
  async openSettings() {
    await this.tabManager.openSettings({
      closeWindow: this.shouldCloseWindow
    });
  }
  
  handleTabClick(e, tab) {
    // Update tab usage in group before activation
    const group = this.getCustomGroupForTab(tab.id);
    if (group) {
      this.updateTabUsage(tab.id, group.id);
    }
    
    // Delegate to TabManager
    this.tabManager.handleTabClick(e, tab, {
      closeOnSelect: this.settings.closeOnSelect,
      shouldCloseWindow: this.shouldCloseWindow
    });
  }
  
  handleTabClose(e, tab) {
    e.stopPropagation();
    this.tabManager.closeTab(tab.id);
  }
  
  async closeTabById(tabId) {
    return this.tabManager.closeTab(tabId);
  }
  
  // Refresh all tabs - delegate to TabManager
  async refreshAllTabs() {
    return this.tabManager.refreshAllTabs();
  }
  
  // Close all tabs - delegate to TabManager
  async closeAllTabs() {
    return this.tabManager.closeAllTabs();
  }
  
  // Index all tabs for search - delegate to SearchEngine
  async indexAllTabs() {
    await this.searchEngine.indexAllTabs();
  }
  
  // Clear indexed data for all open tabs - delegate to SearchEngine
  async clearIndexForAllTabs() {
    await this.searchEngine.clearIndexForAllTabs();
    this.renderTabs(); // Re-render to update indexed indicators
  }
  
  // Close other tabs (all except the active one) - delegate to TabManager
  async closeOtherTabs() {
    return this.tabManager.closeOtherTabs();
  }
  
  // Close tabs to the left of the active tab - delegate to TabManager
  async closeTabsToLeft() {
    return this.tabManager.closeTabsToLeft();
  }
  
  // Close tabs to the right of the active tab - delegate to TabManager
  async closeTabsToRight() {
    return this.tabManager.closeTabsToRight();
  }
  
  // Handle tab activation - update usage stats
  handleTabActivated(activeInfo) {
    // Add delay to ensure loadTabs has completed
    setTimeout(async () => {
      const tabId = activeInfo.tabId;
      const group = this.getCustomGroupForTab(tabId);
      if (group) {
        await this.updateTabUsage(tabId, group.id);
      }
      
      // Index page headings for search if enabled
      if (this.settings.enablePageSearch) {
        await this.indexPageHeadings(tabId);
      }
    }, 100);
  }
  

  // Index page headings for a specific tab - delegate to SearchEngine
  async indexPageHeadings(tabId) {
    // Update SearchEngine settings before indexing
    this.searchEngine.updateSettings(this.settings);
    await this.searchEngine.indexPageHeadings(tabId);
  }
  
  
  // Search and display all headings for a specific tab - delegate to SearchEngine
  searchHeadingsForTab(tabId) {
    const numericTabId = Number(tabId);
    
    // Get headings from SearchEngine
    const headings = this.searchEngine.getHeadingsForTab(numericTabId);
    
    if (!headings || headings.length === 0) {
      console.log(`No indexed headings found for tab ${numericTabId}`);
      return;
    }
    
    // Find the tab
    const tab = this.tabs.find(t => t.id === numericTabId);
    if (!tab) {
      console.log(`Tab ${numericTabId} not found`);
      return;
    }
    
    // Set results in SearchEngine and clear query
    this.searchEngine.headingSearchResults = headings.map(heading => ({
      tabId: numericTabId,
      tab: tab,
      heading: heading,
      relevance: 50 // Default relevance for showing all headings
    }));
    this.searchEngine.searchQuery = '';
    
    // Update UI
    this.renderTabs();
    
    // Scroll to top to see results
    if (this.tabsScrollContainer) {
      this.tabsScrollContainer.scrollTop = 0;
    }
    
    console.log(`Showing ${headings.length} indexed headings for tab ${numericTabId}`);
  }
  
  // Remove headings for a tab from memory and IndexedDB - uses SearchEngine URL key
  async removePageHeadingsForTab(tabId) {
    const numericTabId = Number(tabId);
    
    // Try to get the tab URL first
    let urlKey = null;
    try {
      const tab = await browser.tabs.get(numericTabId);
      if (tab && tab.url) {
        urlKey = this.searchEngine.getUrlKey(tab.url);
      }
    } catch (e) {
      // Tab might not be available
    }
    
    // Remove from memory using URL key
    if (urlKey && this.searchEngine.pageHeadings[urlKey]) {
      delete this.searchEngine.pageHeadings[urlKey];
    }
    
    // Remove from IndexedDB
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        // Delete from pages table
        await window.YouTabsDB.deleteTabUrlMapping(numericTabId);
        // Delete from pagesIndex by URL key
        if (urlKey) {
          await window.YouTabsDB.deletePagesIndexByUrl(urlKey);
        }
        console.log(`Removed indexed data for tab ${numericTabId}${urlKey ? ' (' + urlKey + ')' : ''} from memory and IndexedDB`);
      }
    } catch (error) {
      console.error('Error removing page headings from IndexedDB:', error);
    }
  }
  
  // Handle tab removal - remove from custom groups
  // Note: We no longer remove indexed data when tab is closed.
  // Indexed data will be cleaned up by:
  // 1. Index expiration time (cleanupExpiredPageHeadings)
  // 2. "Remove index" context menu item
  async handleTabRemoved(tabId, removeInfo) {
    try {
      const numericTabId = Number(tabId);
      let removed = false;
      
      // Remove tab from all custom groups via GroupManager
      const group = this.groupManager.getCustomGroupForTab(numericTabId);
      if (group) {
        await this.groupManager.removeTabFromGroup(numericTabId, group.id);
        removed = true;
      }
      
      // Remove custom tab name if exists
      if (this.customTabNames[numericTabId]) {
        delete this.customTabNames[numericTabId];
        await this.saveCustomTabNames();
        removed = true;
      }
      
      // Note: We no longer remove indexed headings for closed tabs.
      // Data remains in memory and IndexedDB until:
      // 1. It expires based on indexExpirationDays setting
      // 2. User manually removes it via "Remove index" context menu
      
      // Reload tabs to update the display if needed
      if (removed) {
        try {
          await this.loadTabs();
        } catch (error) {
          console.error('Error reloading tabs after removal:', error);
        }
      }
    } catch (error) {
      console.error('Error removing tab from groups:', error);
    }
  }
  
  async toggleTabMute(tab) {
    const success = await this.tabManager.toggleMute(tab);
    if (success) {
      await this.loadTabs();
    }
  }
  
  async createNewTab() {
    await this.tabManager.createNewTab({
      closeWindow: this.shouldCloseWindow
    });
  }
  
  showTabPreview(e, tab) {
    if (!this.tabPreview) return;
    
    // Check if tab preview is enabled in settings
    if (this.settings && this.settings.showTabPreview === false) {
      return;
    }
    
    const title = tab.title || 'New tab';
    const url = tab.url || '';
    
    const previewTitle = this.tabPreview.querySelector('.preview-title');
    const previewUrl = this.tabPreview.querySelector('.preview-url');
    
    if (previewTitle) previewTitle.textContent = title;
    if (previewUrl) previewUrl.textContent = this.formatUrl(url);
    
    this.tabPreview.classList.add('visible');
    this.updatePreviewPosition(e);
  }
  
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
  
  hideTabPreview() {
    if (this.tabPreview) {
      this.tabPreview.classList.remove('visible');
    }
  }
  
  
  getTabsInGroup(groupKey) {
    // Check if it's a custom group
    if (groupKey.startsWith('custom_')) {
      const groupId = groupKey.replace('custom_', '');
      return this.getTabsInCustomGroup(groupId);
    }
    
    // Get tabs that belong to a specific group based on current grouping settings
    if (!this.settings.enableGrouping || groupKey === 'all') {
      return this.tabs;
    }
    
    switch (this.settings.groupingType) {
      case 'domain':
        return this.tabs.filter(tab => {
          try {
            if (tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('chrome:') && !tab.url.startsWith('moz-extension:')) {
              const url = new URL(tab.url);
              return url.hostname === groupKey;
            }
          } catch (e) {}
          return groupKey === 'Other';
        });
      case 'color':
        // This is a simplification - actual implementation would need to match the grouping logic
        return this.tabs;
      case 'time':
        return this.tabs.filter(tab => {
          const tabTime = (tab.lastAccessed || tab.created) * 1000;
          const hoursAgo = (Date.now() - tabTime) / 3600000;
          
          if (groupKey === 'today' && hoursAgo <= 24) return true;
          if (groupKey === 'yesterday' && hoursAgo > 24 && hoursAgo <= 48) return true;
          if (groupKey === 'thisWeek' && hoursAgo > 48 && hoursAgo <= 168) return true;
          if (groupKey === 'older' && hoursAgo > 168) return true;
          return false;
        });
      default:
        return this.tabs;
    }
  }
  
  // Utility methods
  getInitial(title) {
    if (!title) return '?';
    const words = title.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return '?';
    return words[0][0].toUpperCase();
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  isValidFaviconUrl(url) {
    if (!url) return false;
    // Only allow data:, http:, or https: URLs
    return url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:');
  }
  
  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  }
  
  // Search functionality - delegate to SearchEngine
  setSearchQuery(query) {
    // Update SearchEngine settings before searching
    this.searchEngine.updateSettings(this.settings);
    this.searchEngine.setSearchQuery(query);
  }
  
  // Get all parent group names for a tab (including subgroups) - delegated to GroupManager
  getGroupHierarchyNames(tabId) {
    return this.groupManager.getGroupHierarchyNames(tabId);
  }
  
  // Get all parent group names for a group (for context menu search) - delegated to GroupManager
  getGroupHierarchyNamesForGroup(groupId) {
    return this.groupManager.getGroupHierarchyNamesForGroup(groupId);
  }
  
  getTabsToDisplay() {
    return this.searchEngine.getTabsToDisplay();
  }
  
  clearSearch() {
    this.searchEngine.clearSearch();
  }
  
  // Apply search filter - delegate to SearchEngine
  applyFilter(filterOptions) {
    this.searchEngine.applyFilter(filterOptions);
  }
  
  // Get current filter state - delegate to SearchEngine
  getFilterState() {
    return this.searchEngine.getFilterState();
  }
  
  // Reset filter to default values - delegate to SearchEngine
  resetFilter() {
    this.searchEngine.resetFilter();
  }
  
  // Apply theme to the page
  async applyTheme(theme) {
    // Default to light theme
    const themeName = theme || 'light';
    
    // Remove existing theme link if present
    const existingThemeLink = document.getElementById('theme-css');
    if (existingThemeLink) {
      existingThemeLink.remove();
    }
    
    // Create and add new theme link
    const themeLink = document.createElement('link');
    themeLink.id = 'theme-css';
    themeLink.rel = 'stylesheet';
    themeLink.href = `css/${themeName}.css`;
    document.head.appendChild(themeLink);
  }
}
