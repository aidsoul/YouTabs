/**
 * YouTabs Extension - Core Tab Management Module
 * Shared functionality for sidebar and popup scripts
 */

// Extract headings (h1-h6) and other content from a page - used by executeScript
function extractHeadings(settings) {
  const MAX_LENGTH = settings?.maxIndexChars || 250;
  const headings = [];
  
  // Helper to truncate text
  const truncate = (text) => {
    const trimmed = text.trim();
    if (trimmed.length > MAX_LENGTH) {
      return trimmed.substring(0, MAX_LENGTH - 3) + '...';
    }
    return trimmed;
  };
  
  // Extract h1-h6 headings
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headingElements.forEach((element, index) => {
    let id = element.id;
    if (!id) {
      id = 'heading-' + index;
      const anchor = element.querySelector('a[id], a[name]');
      if (anchor) {
        id = anchor.id || anchor.getAttribute('name');
      }
    }
    
    const text = truncate(element.textContent);
    if (text) {
      headings.push({
        id: id,
        text: text,
        level: parseInt(element.tagName.substring(1)),
        type: 'heading',
        url: window.location.href
      });
    }
  });
  
  // Extract <p> tags
  const pElements = document.querySelectorAll('p');
  pElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text) {
      headings.push({
        id: 'p-' + index,
        text: text,
        type: 'paragraph',
        url: window.location.href
      });
    }
  });
  
  // Extract <a> tags with text
  const aElements = document.querySelectorAll('a');
  aElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    const href = element.href;
    if (text || href) {
      headings.push({
        id: 'a-' + index,
        text: text,
        type: 'link',
        url: href || window.location.href,
        linkUrl: href
      });
    }
  });
  
  // Extract <img> tags with alt text
  const imgElements = document.querySelectorAll('img');
  imgElements.forEach((element, index) => {
    const alt = truncate(element.alt);
    const src = element.src;
    if (alt || src) {
      headings.push({
        id: 'img-' + index,
        text: alt,
        type: 'image',
        url: window.location.href,
        imgUrl: src
      });
    }
  });
  
  // Extract <div> tags with text content
  const divElements = document.querySelectorAll('div');
  divElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    // Only index divs with meaningful text (more than just whitespace)
    if (text && text.length > 2) {
      headings.push({
        id: 'div-' + index,
        text: text,
        type: 'div',
        url: window.location.href
      });
    }
  });
  
  // Extract <ul> and <ol> tags (lists)
  const listElements = document.querySelectorAll('ul, ol');
  listElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    const listType = element.tagName.toLowerCase();
    // Only index lists with meaningful text
    if (text && text.length > 2) {
      headings.push({
        id: 'list-' + index,
        text: text,
        type: 'list',
        listType: listType,
        url: window.location.href
      });
    }
  });
  
  // Extract <li> tags
  const liElements = document.querySelectorAll('li');
  liElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 0) {
      headings.push({
        id: 'li-' + index,
        text: text,
        type: 'listItem',
        url: window.location.href
      });
    }
  });
  
  // Extract <input type="file"> tags
  const fileInputElements = document.querySelectorAll('input[type="file"]');
  fileInputElements.forEach((element, index) => {
    const text = element.name || element.id || 'File input';
    const accept = element.accept || '';
    headings.push({
      id: 'file-' + index,
      text: text,
      type: 'file',
      fileTypes: accept,
      url: window.location.href
    });
  });
  
  // Extract <a download> tags (download links)
  const downloadLinkElements = document.querySelectorAll('a[download]');
  downloadLinkElements.forEach((element, index) => {
    const text = truncate(element.textContent) || element.download;
    const href = element.href;
    if (text || href) {
      headings.push({
        id: 'download-' + index,
        text: text,
        type: 'fileDownload',
        url: href || window.location.href,
        linkUrl: href
      });
    }
  });
  
  // Extract <video> tags
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach((element, index) => {
    const src = element.src || (element.querySelector('source')?.src || '');
    let text = element.title || element.alt || '';
    // If text is empty, extract filename from URL
    if (!text && src) {
      text = getFilenameFromUrl(src);
    }
    headings.push({
      id: 'video-' + index,
      text: truncate(text),
      type: 'video',
      url: src || window.location.href,
      videoUrl: src
    });
  });
  
  // Extract <audio> tags
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach((element, index) => {
    const src = element.src || (element.querySelector('source')?.src || '');
    let text = element.title || element.alt || '';
    // If text is empty, extract filename from URL
    if (!text && src) {
      text = getFilenameFromUrl(src);
    }
    headings.push({
      id: 'audio-' + index,
      text: truncate(text),
      type: 'audio',
      url: src || window.location.href,
      audioUrl: src
    });
  });
  
  // Extract <iframe> with video sources (YouTube, Vimeo, etc.)
  const iframeElements = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[src*="video"]');
  iframeElements.forEach((element, index) => {
    const src = element.src;
    let text = element.title || '';
    // If text is empty, try to extract video ID or filename from URL
    if (!text && src) {
      text = extractVideoIdentifier(src) || getFilenameFromUrl(src);
    }
    if (text || src) {
      headings.push({
        id: 'iframe-video-' + index,
        text: truncate(text),
        type: 'videoEmbed',
        url: window.location.href,
        videoUrl: src
      });
    }
  });
  
  return headings;
}

// Helper function to extract filename from URL
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    // Decode URI component to handle encoded characters
    return decodeURIComponent(filename) || '';
  } catch (e) {
    // If URL parsing fails, try simple extraction
    const parts = url.split('/');
    return parts.pop() || '';
  }
}

// Helper function to extract video identifier from video embed URLs
function extractVideoIdentifier(url) {
  try {
    const urlObj = new URL(url);
    // YouTube: extract video ID from query parameter
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return 'YouTube: ' + videoId;
      // Handle youtu.be short URLs
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length > 1 && pathParts[1]) {
        return 'YouTube: ' + pathParts[1];
      }
    }
    // Vimeo: extract video ID from path
    if (url.includes('vimeo.com')) {
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length > 1 && pathParts[1]) {
        return 'Vimeo: ' + pathParts[1];
      }
    }
    // Dailymotion: extract video ID from path
    if (url.includes('dailymotion.com')) {
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length > 1 && pathParts[1]) {
        return 'Dailymotion: ' + pathParts[1];
      }
    }
    return '';
  } catch (e) {
    return '';
  }
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
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
    { value: 'span', label: 'Spans' }
  ];
  
  static getFilterTypeHTML(checked = true) {
    return YouTabsCore.FILTER_TYPES.map(type => `
      <label class="filter-dropdown-item" data-value="${type.value}">
        <input type="checkbox" ${checked ? 'checked' : ''}>
        <span>${type.label}</span>
      </label>
    `).join('');
  }
  constructor(options = {}) {
    // Configuration options - store in settings for consistency
    this.shouldCloseWindow = options.shouldCloseWindow ?? false;
    
    // State
    this.tabs = [];
    this.filteredTabs = [];
    this.headingSearchResults = [];
    this.activeTabId = null;
    this.draggedTab = null;
    this.draggedIndex = null;
    this.draggedGroup = null;
    this.searchQuery = '';
    
    // Search filter state
    this.filterTabs = true;
    this.filterHeadingTypes = ['heading', 'paragraph', 'link', 'image', 'div', 'ul', 'ol', 'li', 'input', 'video', 'audio', 'iframe', 'span'];
    this.totalFilterTypes = this.filterHeadingTypes.length;
    this.hasActiveFilter = false;
    
    this.settings = {
      showFavicon: true,
      showAudio: true,
      closeOnSelect: options.closeOnSelect ?? true,
      enablePageSearch: true,
      maxSearchResults: 15,
      // Index expiration settings (default: 3 days)
      indexExpirationDays: 3,
      indexExpirationHours: 0,
      indexExpirationMinutes: 0,
      // Index character limit
      maxIndexChars: 250,
      enableGrouping: true,
      groupingType: 'custom',
      collapsedGroups: [],
      collapsedTabs: []
    };
    
    // Custom user groups
    this.customGroups = [];
    
    // Custom tab names (user-renamed tabs)
    this.customTabNames = {}; // { tabId: { customName: string, originalName: string } }

    // Indexed page headings for search
    this.pageHeadings = {}; // { urlKey: [{ id: string, text: string, level: number, url: string }] }
    
    // Mapping from tabId to urlKey for search
    this.tabIdToUrlKey = {}; // { tabId: urlKey }
    
    // Group tab metadata (tracks when tabs were added to groups)
    this.groupTabMetadata = {}; // { groupId: { tabId: { addedAt: timestamp, lastUsed: timestamp, useCount: number } } }
    
    // Available colors for custom groups
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
    
    // Debounced loadTabs for performance
    this.debouncedLoadTabs = debounce(() => this.loadTabs(), 100);
    
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
  }
  
  async init() {
    // Load settings
    await this.loadSettings();
    
    // Load page headings from storage
    await this.loadPageHeadings();
    
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
  
  // Clean up expired page headings from IndexedDB
  async cleanupExpiredPageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        const expirationMs = this.getIndexExpirationMs();
        await window.YouTabsDB.cleanupExpiredPagesIndex(expirationMs);
        console.log(`Page headings cleanup completed. Expiration: ${expirationMs}ms (${this.settings?.indexExpirationDays ?? 3} days)`);
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
    // Use DOMParser to safely parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(modalHTML, 'text/html');
    this.modal = doc.body.firstElementChild;
    document.body.appendChild(this.modal);
    
    // Bind modal events
    const overlay = this.modal;
    const closeBtn = document.getElementById('modalClose');
    const cancelBtn = document.getElementById('modalCancel');
    const confirmBtn = document.getElementById('modalConfirm');
    const input = document.getElementById('modalInput');
    
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
      const inputWrapper = document.getElementById('modalInputWrapper');
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
      
      const modalTitle = document.getElementById('modalTitle');
      const modalMessage = document.getElementById('modalMessage');
      const modalInputWrapper = document.getElementById('modalInputWrapper');
      const modalInput = document.getElementById('modalInput');
      const modalConfirm = document.getElementById('modalConfirm');
      const modalCancel = document.getElementById('modalCancel');
      
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
      
      const modalTitle = document.getElementById('modalTitle');
      const modalMessage = document.getElementById('modalMessage');
      const modalInputWrapper = document.getElementById('modalInputWrapper');
      const modalConfirm = document.getElementById('modalConfirm');
      const modalCancel = document.getElementById('modalCancel');
      
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
      
      const modalTitle = document.getElementById('modalTitle');
      const modalMessage = document.getElementById('modalMessage');
      const modalInputWrapper = document.getElementById('modalInputWrapper');
      const modalConfirm = document.getElementById('modalConfirm');
      const modalCancel = document.getElementById('modalCancel');
      
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
    const modalConfirm = document.getElementById('modalConfirm');
    modalConfirm.classList.remove('modal-btn-danger');
    modalConfirm.classList.add('modal-btn-confirm');
    
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
      if (newName?.trim() && newName !== currentName) {
        await this.setTabCustomName(tabId, newName.trim());
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
    if (this.customGroups.length > 0) {
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
        if (groupName?.trim()) {
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
      const sortedGroups = [...this.customGroups].sort((a, b) => {
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
        if (groupName?.trim()) {
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
      
      // Update index option
      const updateIndexItem = document.createElement('div');
      updateIndexItem.className = 'context-menu-item';
      updateIndexItem.textContent = 'Update index';
      updateIndexItem.addEventListener('click', async () => {
        const tab = this.tabs.find(t => t.id === Number(tabId));
        if (tab && tab.url) {
          // Send message to background script to handle the update
          try {
            await browser.runtime.sendMessage({
              action: 'updatePageIndex',
              tabId: tab.id
            });
          } catch (error) {
            console.error('Error sending message to background:', error);
          }
        }
        this.hideContextMenu();
      });
      menu.appendChild(updateIndexItem);
      
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
    const group = this.customGroups.find(g => g.id === groupId);
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
    if (currentDepth < 2) { // depth 0 = root, depth 1 = level 2, depth 2 = level 3
      const addSubgroupItem = document.createElement('div');
      addSubgroupItem.className = 'context-menu-item';
      addSubgroupItem.textContent = 'Add subgroup';
      addSubgroupItem.addEventListener('click', async () => {
        const subgroupName = await this.showPrompt('New Subgroup', 'Enter subgroup name:', 'New subgroup');
        if (subgroupName?.trim()) {
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
      if (groupName?.trim()) {
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
    const rect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu goes off screen
    if (x + rect.width > window.innerWidth) {
      x = window.innerWidth - rect.width - 8;
    }
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 8;
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
      const stored = await browser.storage.local.get('settings');
      if (stored.settings) {
        this.settings = { ...this.settings, ...stored.settings };
      }
      
      // Migrate from localStorage to IndexedDB if needed
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.openDatabase();
        await window.YouTabsDB.migrateFromLocalStorage();
        await window.YouTabsDB.migrateFromYouTabsHeadings();
        
        // Load custom groups from IndexedDB
        const storedGroups = await window.YouTabsDB.getCustomGroups();
        if (storedGroups && storedGroups.length > 0) {
          this.customGroups = storedGroups.map(group => ({
            ...group,
            sortBy: group.sortBy || 'addedAt',
            sortOrder: group.sortOrder || 'desc'
          }));
        }
        
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
        
        const storedGroupTabMeta = await browser.storage.local.get('groupTabMetadata');
        if (storedGroupTabMeta.groupTabMetadata) {
          this.groupTabMetadata = storedGroupTabMeta.groupTabMetadata;
        }
      }
      
      // Load custom tab names
      const storedTabNames = await browser.storage.local.get('customTabNames');
      if (storedTabNames.customTabNames) {
        this.customTabNames = storedTabNames.customTabNames;
      }
      
      // Load group tab metadata
      const storedGroupTabMeta = await browser.storage.local.get('groupTabMetadata');
      if (storedGroupTabMeta.groupTabMetadata) {
        this.groupTabMetadata = storedGroupTabMeta.groupTabMetadata;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  // Save custom groups to storage
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
    } catch (error) {
      console.error('Error saving custom groups:', error);
    }
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
  
  // Save group tab metadata to storage (debounced)
  _saveMetadataTimeout = null;
  
  async saveGroupTabMetadata() {
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
      } catch (error) {
        console.error('Error saving group tab metadata:', error);
      }
      this._saveMetadataTimeout = null;
    }, 1000); // Debounce for 1 second
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
  
  // Clean up duplicate tabs - ensure each tab is only in one group
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
  }
  
  // Create a new custom group
  async createCustomGroup(name, color = 'blue', parentId = null) {
    // Check nesting level if parent is specified
    if (parentId) {
      const depth = this.getGroupDepth(parentId);
      if (depth >= 3) {
        console.warn('Maximum nesting level (3) reached');
        return null;
      }
    }
    
    const newGroup = {
      id: 'group_' + Date.now(),
      name: name,
      color: color,
      tabIds: [],
      parentId: parentId,
      createdAt: Date.now(),
      sortBy: 'addedAt', // addedAt, lastAccessed, useCount, title, url
      sortOrder: 'desc' // asc, desc
    };
    this.customGroups.push(newGroup);
    await this.saveCustomGroups();
    this.renderTabs();
    return newGroup;
  }
  
  // Get nesting depth of a group
  getGroupDepth(groupId, depth = 0) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group || !group.parentId) {
      return depth;
    }
    return this.getGroupDepth(group.parentId, depth + 1);
  }
  
  // Get all subgroups (children) of a group
  getSubgroups(parentId) {
    return this.customGroups.filter(g => g.parentId === parentId);
  }
  
  // Get root groups (no parent)
  getRootGroups() {
    return this.customGroups.filter(g => !g.parentId);
  }
  
  // Get total tabs count in all nested groups (descendants)
  getNestedTabsCount(groupId) {
    const subgroups = this.getSubgroups(groupId);
    let count = 0;
    for (const subgroup of subgroups) {
      count += subgroup.tabIds.length; // tabs in this subgroup
      count += this.getNestedTabsCount(subgroup.id); // tabs in nested subgroups
    }
    return count;
  }
  
  // Rename a custom group
  async renameCustomGroup(groupId, newName) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (group) {
      group.name = newName;
      await this.saveCustomGroups();
      this.renderTabs();
    }
  }
  
  // Update group color
  async updateCustomGroupColor(groupId, newColor) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (group) {
      group.color = newColor;
      await this.saveCustomGroups();
      this.renderTabs();
    }
  }
  
  // Delete a custom group and all its subgroups
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
    
    // Get all group IDs to delete (including subgroups)
    const idsToDelete = [groupId, ...getAllDescendantIds(groupId)];
    
    this.customGroups = this.customGroups.filter(g => !idsToDelete.includes(g.id));
    await this.saveCustomGroups();
    this.renderTabs();
  }
  
  // Add tab to custom group (removes from other groups)
  async addTabToGroup(tabId, groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    // Convert tabId to number for comparison
    const numericTabId = Number(tabId);
    
    if (group) {
      // Check if already in this group
      if (group.tabIds.includes(numericTabId)) {
        return; // Already in this group
      }
      
      // Remove from other groups (tabs can only be in one group)
      for (const g of this.customGroups) {
        if (g.id !== groupId) {
          g.tabIds = g.tabIds.filter(id => Number(id) !== numericTabId);
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
      this.renderTabs();
    }
  }
  
  // Remove tab from custom group
  async removeTabFromGroup(tabId, groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (group) {
      // Convert to number for comparison
      const numericTabId = Number(tabId);
      group.tabIds = group.tabIds.filter(id => Number(id) !== numericTabId);
      await this.saveCustomGroups();
      this.renderTabs();
    }
  }
  
  // Get custom group for a tab
  getCustomGroupForTab(tabId) {
    const numericTabId = Number(tabId);
    return this.customGroups.find(g => g.tabIds.some(id => Number(id) === numericTabId));
  }
  
  // Get all tabs in a custom group
  getTabsInCustomGroup(groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group) return [];
    return this.tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
  }
  
  // Get sorted tabs in a custom group
  getSortedTabsInGroup(groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group) return [];
    
    const tabsInGroup = this.tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
    const sortBy = group.sortBy || 'addedAt';
    const sortOrder = group.sortOrder || 'desc';
    
    return this.sortTabs(tabsInGroup, groupId, sortBy, sortOrder);
  }
  
  // Sort tabs based on criteria
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
  
  // Update group sorting settings
  async updateGroupSorting(groupId, sortBy, sortOrder) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (group) {
      group.sortBy = sortBy;
      group.sortOrder = sortOrder;
      await this.saveCustomGroups();
      this.renderTabs();
    }
  }
  
  // Update tab usage when tab is activated
  async updateTabUsage(tabId, groupId) {
    const numericTabId = Number(tabId);
    if (!this.groupTabMetadata[groupId] || !this.groupTabMetadata[groupId][numericTabId]) {
      return;
    }
    
    this.groupTabMetadata[groupId][numericTabId].lastUsed = Date.now();
    this.groupTabMetadata[groupId][numericTabId].useCount = 
      (this.groupTabMetadata[groupId][numericTabId].useCount || 0) + 1;
    
    await this.saveGroupTabMetadata();
  }
  
  // Show rename group dialog
  async showRenameGroupDialog(groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const newName = await this.showPrompt('Rename Group', 'Enter new group name:', group.name);
    if (newName && newName.trim() !== '') {
      this.renameCustomGroup(groupId, newName.trim());
    }
  }
  
  // Show color picker for group
  showColorPicker(groupId, event) {
    // Create color picker dropdown
    const existingPicker = document.querySelector('.color-picker-dropdown');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    const picker = document.createElement('div');
    picker.className = 'color-picker-dropdown modern-picker';
    
    // Get current color
    const group = this.customGroups.find(g => g.id === groupId);
    const currentColor = group?.color || '#2196f3';
    const currentHsl = this.hexToHsl(currentColor);
    
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
    
    // Add elements to picker
    picker.appendChild(hueSlider);
    picker.appendChild(satLightBox);
    picker.appendChild(previewRow);
    
    // Add predefined colors as quick select
    const quickColors = document.createElement('div');
    quickColors.className = 'color-quick-select';
    
    this.groupColors.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.className = 'color-picker-btn';
      colorBtn.style.backgroundColor = color.color;
      colorBtn.title = color.name;
      
      colorBtn.addEventListener('click', () => {
        this.updateCustomGroupColor(groupId, color.color);
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
  
  // Confirm delete group
  async confirmDeleteGroup(groupId) {
    const group = this.customGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const tabCount = group.tabIds.length;
    const message = tabCount > 0 
      ? `Delete group "${group.name}" and all ${tabCount} tabs in it?`
      : `Delete group "${group.name}"?`;
    
    if (await this.showDeleteConfirm('Delete Group', message)) {
      this.deleteCustomGroup(groupId);
    }
  }
  
  // Handle drag over custom group
  handleCustomGroupDragOver(e, groupKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const tabList = e.target.closest('.tab-group-tabs');
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
  
  // Handle drag leave custom group
  handleCustomGroupDragLeave(e, groupKey) {
    const tabList = e.target.closest('.tab-group-tabs');
    // Only remove if we're actually leaving the tab list, not entering a child element
    if (tabList && !tabList.contains(e.relatedTarget)) {
      tabList.classList.remove('drag-over');
    }
  }
  
  // Handle drag over sorted group (domain/color/time) - allow drop on custom groups
  handleSortedGroupDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Check if there's a custom group under the cursor
    const customGroup = e.target.closest('.tab-group-tabs[data-group-key^="custom_"]');
    if (customGroup) {
      customGroup.classList.add('drag-over');
    }
  }
  
  // Handle drag leave sorted group
  handleSortedGroupDragLeave(e) {
    // Check if we're actually leaving the tab list
    const tabList = e.target.closest('.tab-group-tabs');
    if (tabList && !tabList.contains(e.relatedTarget)) {
      tabList.classList.remove('drag-over');
    }
  }
  
  // Handle drop on sorted group - check if dropped on a custom group
  async handleSortedGroupDrop(e) {
    e.preventDefault();
    
    // Find if we dropped on a custom group
    const customGroupTabList = e.target.closest('.tab-group-tabs[data-group-key^="custom_"]');
    
    // Handle group drop onto custom group
    if (customGroupTabList && this.draggedGroup && !this.draggedTab) {
      const groupKey = customGroupTabList.dataset.groupKey;
      const targetGroupId = groupKey.replace('custom_', '');
      const targetDepth = this.getGroupDepth(targetGroupId);
      
      // Check if target is at max depth (level 3)
      if (targetDepth >= 2) {
        console.warn('Cannot nest group into level 3 subgroup');
        this.cleanupDrag();
        return;
      }
      
      const sourceGroupId = this.draggedGroup.replace('custom_', '');
      const sourceGroup = this.customGroups.find(g => g.id === sourceGroupId);
      
      if (!sourceGroup) {
        this.cleanupDrag();
        return;
      }
      
      // Prevent dropping a group onto itself or its descendants
      const isDescendant = (parentId, childId) => {
        const child = this.customGroups.find(g => g.id === childId);
        if (!child) return false;
        if (child.parentId === parentId) return true;
        return isDescendant(parentId, child.parentId);
      };
      
      if (isDescendant(sourceGroupId, targetGroupId)) {
        console.warn('Cannot drop a group onto its own descendant');
        this.cleanupDrag();
        return;
      }
      
      // Move source group into target group
      sourceGroup.parentId = targetGroupId;
      await this.saveCustomGroups();
      this.renderTabs();
      this.cleanupDrag();
      return;
    }
    
    // Handle tab drop onto custom group
    if (customGroupTabList && this.draggedTab) {
      const groupKey = customGroupTabList.dataset.groupKey;
      const groupId = groupKey.replace('custom_', '');
      const tabId = this.draggedTab.id;
      
      try {
        // Add tab to custom group
        await this.addTabToGroup(tabId, groupId);
        this.cleanupDrag();
      } catch (error) {
        console.error('Error adding tab to group:', error);
      }
    }
    
    // Clean up all drag-over classes
    document.querySelectorAll('.tab-group-tabs').forEach(list => {
      list.classList.remove('drag-over');
    });
  }
  
  // Handle drop on custom group
  async handleCustomGroupDrop(e, groupKey) {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to groupContainer
    
    const tabList = e.target.closest('.tab-group-tabs');
    if (tabList) {
      tabList.classList.remove('drag-over');
    }
    
    // Clean up all drag-over classes
    document.querySelectorAll('.tab-group-tabs').forEach(list => {
      list.classList.remove('drag-over');
    });
    
    const groupId = groupKey.replace('custom_', '');
    
    if (this.draggedTab) {
      // Save the tab ID immediately to avoid issues with async operations
      const tabId = this.draggedTab.id;
      
      try {
        // Check if tab is already in a different custom group
        const currentGroup = this.getCustomGroupForTab(tabId);
        
        if (currentGroup && currentGroup.id !== groupId) {
          // Tab is in another group - move it (remove from old, add to new)
          await this.removeTabFromGroup(tabId, currentGroup.id);
          await this.addTabToGroup(tabId, groupId);
        } else if (!currentGroup) {
          // Tab is not in any custom group - just add it
          await this.addTabToGroup(tabId, groupId);
        }
        // If already in this group, do nothing
        
        // Clean up drag state
        this.cleanupDrag();
        this.draggedTab = null;
      } catch (error) {
        console.error('Error moving tab between groups:', error);
      }
    }
  }
  
  // Group drag state
  draggedGroup = null;
  
  // Handle group drag start
  handleGroupDragStart(e, groupKey) {
    this.draggedGroup = groupKey;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'group',
      groupKey: groupKey
    }));
  }
  
  // Handle group drag end
  handleGroupDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.tab-group-header').forEach(header => {
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
    });
    this.draggedGroup = null;
  }
  
  // Handle group drag over (for both groups and tabs)
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
    document.querySelectorAll('.tab-group-header').forEach(header => {
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
    });
    
    const header = e.target.closest('.tab-group-header');
    if (header) {
      const rect = header.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      // Check if dropping onto the center of the header (not above/below)
      const headerHeight = rect.height;
      const isOntoCenter = Math.abs(e.clientY - midY) < headerHeight * 0.3;
      
      if (isDraggingTab) {
        // When dragging a tab, always show center drop indicator on the header
        header.classList.add('drag-over', 'drag-over-center');
      } else if (isDraggingGroup) {
        if (isOntoCenter) {
          // Dropping onto the group - check if target is at max depth
          const targetGroupId = targetGroupKey.replace('custom_', '');
          const targetDepth = this.getGroupDepth(targetGroupId);
          
          if (targetDepth < 2) {
            // Target is not at max depth - allow dropping into it
            header.classList.add('drag-over', 'drag-over-center');
          } else {
            // Target is at max depth (level 3) - only allow reorder, not nesting
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
  
  // Handle group drop (reorder, change parent, or add tab to group)
  async handleGroupDrop(e, targetGroupKey) {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to parent elements
    
    // Check if we're dragging a tab
    if (this.draggedTab) {
      // Save the tab ID immediately to avoid issues with async operations
      const tabId = this.draggedTab.id;
      const groupId = targetGroupKey.replace('custom_', '');
      
      try {
        // Check if tab is already in a different custom group
        const currentGroup = this.getCustomGroupForTab(tabId);
        
        if (currentGroup && currentGroup.id !== groupId) {
          // Tab is in another group - move it (remove from old, add to new)
          await this.removeTabFromGroup(tabId, currentGroup.id);
          await this.addTabToGroup(tabId, groupId);
        } else if (!currentGroup) {
          // Tab is not in any custom group - just add it
          await this.addTabToGroup(tabId, groupId);
        }
        // If already in this group, do nothing
      } catch (error) {
        console.error('Error adding tab to group:', error);
      }
      
      this.cleanupDrag();
      return;
    }
    
    // Handle group drop (reorder or change parent)
    if (!this.draggedGroup || this.draggedGroup === targetGroupKey) {
      this.cleanupDrag();
      return;
    }
    
    const sourceGroupId = this.draggedGroup.replace('custom_', '');
    const targetGroupId = targetGroupKey.replace('custom_', '');
    
    // Find the groups
    const sourceGroup = this.customGroups.find(g => g.id === sourceGroupId);
    const targetGroup = this.customGroups.find(g => g.id === targetGroupId);
    
    if (!sourceGroup || !targetGroup) return;
    
    // Prevent dropping a group onto itself or its descendants
    const isDescendant = (parentId, childId) => {
      const child = this.customGroups.find(g => g.id === childId);
      if (!child) return false;
      if (child.parentId === parentId) return true;
      return isDescendant(parentId, child.parentId);
    };
    
    if (isDescendant(sourceGroupId, targetGroupId)) {
      console.warn('Cannot drop a group onto its own descendant');
      this.cleanupDrag();
      return;
    }
    
    // Determine if dropping above, below, or onto (into) the target group
    const header = e.target.closest('.tab-group-header');
    const rect = header?.getBoundingClientRect();
    
    if (!rect) {
      this.cleanupDrag();
      return;
    }
    
    const midY = rect.top + rect.height / 2;
    const headerHeight = rect.height;
    const isOntoCenter = Math.abs(e.clientY - midY) < headerHeight * 0.3;
    const dropBelow = e.clientY > midY;
    
    // Get current depth of target to calculate new parent
    const targetDepth = this.getGroupDepth(targetGroupId);
    
    // Check if Shift key is pressed - if so, make it a root-level group
    if (e.shiftKey) {
      // Move to root level
      sourceGroup.parentId = null;
    } else if (isOntoCenter && targetDepth < 2) {
      // Dropping onto the group center and target is not at max depth - make it a child
      sourceGroup.parentId = targetGroupId;
    } else if (isOntoCenter && targetDepth >= 2) {
      // Dropping onto a level 3 group - cannot nest, just reorder
      // Keep current parentId (reorder only)
      console.warn('Cannot nest group into level 3 subgroup');
    } else {
      // Dropping above/below - reorder at same level
      // Keep current parentId
    }
    
    await this.saveCustomGroups();
    this.renderTabs();
    
    // Clean up
    this.cleanupDrag();
  }
  
  // Cleanup drag visual states
  cleanupDrag() {
    document.querySelectorAll('.tab-group-header').forEach(header => {
      header.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
    });
  }
  
  
  // Convert hex to HSL
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
    const cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin;
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
  
  // Convert HSL to hex
  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs((h / 60) % 2 - 1)),
      m = l - c / 2,
      r = 0, g = 0, b = 0;
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
  
  // Open color picker in separate window
  openColorPickerWindow(groupId, position) {
    // Remove any existing color picker window
    const existingPicker = document.querySelector('.color-picker-window');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    // Get current color
    const group = this.customGroups.find(g => g.id === groupId);
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
    this.groupColors.forEach(color => {
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
    try {
      const currentWindow = await browser.windows.getCurrent();
      
      this.tabs = await browser.tabs.query({
        windowId: currentWindow.id,
        windowType: 'normal'
      });
      
      this.activeTabId = this.tabs.find(tab => tab.active)?.id;
      
      this.renderTabs();
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }
  
  renderTabs() {
    if (!this.tabsList) return;
    
    this.tabsList.innerHTML = '';
    
    // Determine which tabs to display
    const displayTabs = this.searchQuery ? this.filteredTabs : this.tabs;
    
    // Update tab count
    if (this.tabCount) {
      if (this.searchQuery) {
        const headingCount = this.headingSearchResults?.length || 0;
        this.tabCount.textContent = `${displayTabs.length} / ${this.tabs.length}` + (headingCount > 0 ? ` (+${headingCount} headings)` : '');
      } else {
        this.tabCount.textContent = this.tabs.length;
      }
    }
    
    // When searching, show tabs first without grouping
    if (this.searchQuery && displayTabs.length > 0) {
      displayTabs.forEach((tab, index) => {
        const tabElement = this.createTabElement(tab, index, 'search');
        this.tabsList.appendChild(tabElement);
      });
    }
    
    // Render heading search results if there are any (shown after tabs)
    if (this.searchQuery && this.headingSearchResults && this.headingSearchResults.length > 0) {
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
        'videoEmbed': 'Embedded Videos'
      };
      
      this.headingSearchResults.forEach((result) => {
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
        
        // Use DOMParser to safely parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(`
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
          
          // Truncate URL if > 35 chars
          let displayUrl = result.heading.url || result.pageUrl || '';
          if (displayUrl.length > 35) {
            displayUrl = displayUrl.substring(0, 32) + '...';
          }
          
          itemContent += `
            <div class="heading-search-item-content">
              <span class="heading-text">${this.escapeHtml(displayText)}</span>
              <span class="heading-url">${this.escapeHtml(displayUrl)}</span>
            </div>
          `;
          
          // Use DOMParser to safely parse HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(itemContent, 'text/html');
          while (doc.body.firstChild) {
            headingItem.appendChild(doc.body.firstChild);
          }
          
          // Handle click on image/video/audio thumbnail - open media URL directly
          const thumbnail = headingItem.querySelector('.heading-search-item-thumbnail.clickable');
          if (thumbnail) {
            thumbnail.addEventListener('click', (e) => {
              e.stopPropagation();
              // Handle image
              if (result.heading.imgUrl) {
                browser.tabs.create({ url: result.heading.imgUrl });
              }
              // Handle video
              else if (result.heading.videoUrl) {
                browser.tabs.create({ url: result.heading.videoUrl });
              }
              // Handle audio
              else if (result.heading.audioUrl) {
                browser.tabs.create({ url: result.heading.audioUrl });
              }
            });
          }
          
          // Click to activate the tab and scroll to heading
          // If tab is closed, open it in a new tab
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
                    searchQuery: this.searchQuery
                  });
                } catch (e) {
                  // If content script is not available, just activate the tab
                  console.debug('Could not scroll to heading:', e.message);
                }
              } catch (e) {
                // Tab no longer exists (closed) - open in new tab
                console.debug('Tab no longer exists, opening new tab:', e.message);
                const newTab = await browser.tabs.create({ url: pageUrl, active: true });
                
                // Wait for the tab to load using event listener instead of fixed timeout
                const loadListener = (tabId, info) => {
                  if (tabId === newTab.id && info.status === 'complete') {
                    browser.tabs.onUpdated.removeListener(loadListener);
                    // Small delay to ensure content script is ready
                    setTimeout(async () => {
                      try {
                        await browser.tabs.sendMessage(newTab.id, {
                          action: 'scrollToHeading',
                          headingId: result.heading.id,
                          elementType: result.heading.type,
                          searchQuery: this.searchQuery
                        });
                      } catch (e) {
                        // If content script is not available, just leave the tab open
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
              
              // Wait for the tab to load using event listener instead of fixed timeout
              const loadListener = (tabId, info) => {
                if (tabId === newTab.id && info.status === 'complete') {
                  browser.tabs.onUpdated.removeListener(loadListener);
                  // Small delay to ensure content script is ready
                  setTimeout(async () => {
                    try {
                      await browser.tabs.sendMessage(newTab.id, {
                        action: 'scrollToHeading',
                        headingId: result.heading.id,
                        elementType: result.heading.type,
                        searchQuery: this.searchQuery
                      });
                    } catch (e) {
                      // If content script is not available, just leave the tab open
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
      
      this.tabsList.appendChild(headingResultsContainer);
    }
    
    // Show search results indicator
    const hasHeadingResults = this.headingSearchResults && this.headingSearchResults.length > 0;
    if (this.searchQuery && displayTabs.length === 0 && !hasHeadingResults) {
      // Use DOMParser to safely parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(`
        <div class="tabs-empty">
          <svg class="tabs-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <span class="tabs-empty-text">No results found for "${this.escapeHtml(this.searchQuery)}"</span>
        </div>
      `, 'text/html');
      this.tabsList.appendChild(doc.body);
      return;
    }
    
    // Group tabs - only custom groups with ungrouped tabs
    let groupedTabs;
    
    // Get ungrouped tabs (tabs not in any custom group)
    const groupedTabIds = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(Number(id)));
    });
    
    const ungroupedTabs = this.tabs.filter(tab => !groupedTabIds.has(tab.id));
    
    groupedTabs = {};
    
    // Add ungrouped section first (at top)
    if (ungroupedTabs.length > 0) {
      groupedTabs['ungrouped'] = ungroupedTabs;
    }
    
    // Add custom groups - first root groups, then their subgroups recursively
    const addGroupsRecursively = (parentId, depth) => {
      const groups = parentId 
        ? this.customGroups.filter(g => g.parentId === parentId)
        : this.customGroups.filter(g => !g.parentId);
      
      groups.forEach(group => {
        const groupKey = 'custom_' + group.id;
        const groupTabs = this.tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
        
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
    
    if (this.customGroups.length > 0) {
      addGroupsRecursively(null, 0);
    }
    
    // Render groups and tabs
    // Include all custom groups (even if empty), only filter ungrouped if empty
    const groupKeys = Object.keys(groupedTabs).filter(key => {
      if (key === 'ungrouped') return groupedTabs[key].length > 0;
      // Always include custom groups (even if empty)
      return key.startsWith('custom_');
    });
    
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
          if (this.settings.collapsedGroups?.includes(parentKey)) {
            parentCollapsed = true;
            break;
          }
          const parent = this.customGroups.find(g => g.id === parentId);
          parentId = parent?.parentId;
        }
      }
      
      const isCollapsed = parentCollapsed || this.settings.collapsedGroups?.includes(groupKey);
      
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
        
        // Use DOMParser to safely parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(`
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
          
          // Close dropdown when clicking outside
          const closeSortDropdown = (e) => {
            if (sortDropdown && !sortDropdown.contains(e.target) && !e.target.closest('.group-sort-btn')) {
              sortDropdown.style.display = 'none';
            }
          };
          
          // Use a timeout to avoid immediate trigger from the button click
          setTimeout(() => {
            document.addEventListener('click', closeSortDropdown);
          }, 0);
          
          // Sort option clicks
          if (sortDropdown) {
            sortDropdown.querySelectorAll('.sort-option').forEach(option => {
              option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sortBy = option.dataset.sort;
                const group = this.customGroups.find(g => g.id === groupInfo.groupId);
                const sortOrder = group?.sortOrder || 'desc';
                await this.updateGroupSorting(groupInfo.groupId, sortBy, sortOrder);
                sortDropdown.style.display = 'none';
              });
            });
            
            sortDropdown.querySelectorAll('.sort-order-option').forEach(option => {
              option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sortOrder = option.dataset.order;
                const group = this.customGroups.find(g => g.id === groupInfo.groupId);
                const sortBy = group?.sortBy || 'addedAt';
                await this.updateGroupSorting(groupInfo.groupId, sortBy, sortOrder);
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
      
      if (isCustomGroup) {
        tabList.dataset.groupKey = groupKey;
        tabList.addEventListener('dragover', (e) => this.handleCustomGroupDragOver(e, groupKey));
        tabList.addEventListener('dragleave', (e) => this.handleCustomGroupDragLeave(e, groupKey));
        tabList.addEventListener('drop', (e) => this.handleCustomGroupDrop(e, groupKey));
        
        // Add drag/drop to entire group container for easier dropping
        groupContainer.dataset.groupKey = groupKey;
        groupContainer.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          
          // Check if dragging a tab or group - show appropriate feedback
          if (this.draggedTab || this.draggedGroup) {
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
          const targetDepth = this.getGroupDepth(groupId);
          
          // Check if we're dragging a group (not a tab)
          // We check draggedTab first to distinguish between tab drag and group drag
          if (this.draggedGroup && !this.draggedTab) {
            // Check if target is at max depth (level 3)
            if (targetDepth >= 2) {
              console.warn('Cannot nest group into level 3 subgroup');
              this.cleanupDrag();
              return;
            }
            
            const sourceGroupId = this.draggedGroup.replace('custom_', '');
            const sourceGroup = this.customGroups.find(g => g.id === sourceGroupId);
            
            if (!sourceGroup) {
              this.cleanupDrag();
              return;
            }
            
            // Prevent dropping a group onto itself or its descendants
            const isDescendant = (parentId, childId) => {
              const child = this.customGroups.find(g => g.id === childId);
              if (!child) return false;
              if (child.parentId === parentId) return true;
              return isDescendant(parentId, child.parentId);
            };
            
            if (isDescendant(sourceGroupId, groupId)) {
              console.warn('Cannot drop a group onto its own descendant');
              this.cleanupDrag();
              return;
            }
            
            // Move source group into target group
            sourceGroup.parentId = groupId;
            await this.saveCustomGroups();
            this.renderTabs();
            this.cleanupDrag();
            return;
          }
          
          // Handle tab drops
          if (this.draggedTab) {
            const tabId = this.draggedTab.id;
            try {
              await this.addTabToGroup(tabId, groupId);
              this.cleanupDrag();
            } catch (error) {
              console.error('Error adding tab to group:', error);
            }
          }
        });
      } else {
        // For non-custom groups, still add listeners to allow dropping into custom groups
        tabList.addEventListener('dragover', (e) => this.handleSortedGroupDragOver(e));
        tabList.addEventListener('dragleave', (e) => this.handleSortedGroupDragLeave(e));
        tabList.addEventListener('drop', (e) => this.handleSortedGroupDrop(e));
      }
    
    // Make custom group headers draggable
    if (groupKey.startsWith('custom_')) {
      const groupHeader = groupContainer.querySelector('.tab-group-header');
      if (groupHeader) {
        groupHeader.draggable = true;
        groupHeader.dataset.groupId = groupKey.replace('custom_', '');
        groupHeader.addEventListener('dragstart', (e) => this.handleGroupDragStart(e, groupKey));
        groupHeader.addEventListener('dragend', (e) => this.handleGroupDragEnd(e));
        groupHeader.addEventListener('dragover', (e) => this.handleGroupDragOver(e, groupKey));
        groupHeader.addEventListener('drop', (e) => this.handleGroupDrop(e, groupKey));
      }
    }
    
    // Get sorted tabs for custom groups
    let tabsToRender = group;
    if (groupKey.startsWith('custom_')) {
      const groupId = groupKey.replace('custom_', '');
      tabsToRender = this.getSortedTabsInGroup(groupId);
    }
    
    tabsToRender.forEach(tab => {
      const tabElement = this.createTabElement(tab, this.tabs.indexOf(tab), groupKey);
      tabList.appendChild(tabElement);
    });
      
      groupContainer.appendChild(tabList);
      this.tabsList.appendChild(groupContainer);
    });
  }
  
  getGroupInfo(groupKey, group) {
    // Helper function to darken a hex color
    const darkenColor = (hex, percent) => {
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
    };
    
    // Check if it's a custom group
    if (groupKey.startsWith('custom_')) {
      const groupId = groupKey.replace('custom_', '');
      const customGroup = this.customGroups.find(g => g.id === groupId);
      if (customGroup) {
        // Get depth and find root parent's color
        let depth = this.getGroupDepth(groupId);
        let rootColorId = customGroup.color;
        
        // If nested, find the root parent's color
        if (customGroup.parentId) {
          let parent = this.customGroups.find(g => g.id === customGroup.parentId);
          while (parent && parent.parentId) {
            parent = this.customGroups.find(g => g.id === parent.parentId);
          }
          if (parent) {
            rootColorId = parent.color;
          }
        }
        
        // Get color - handle both color ID (red, blue) and hex color (#ff5252)
        let displayColor;
        const colorObj = this.groupColors.find(c => c.id === rootColorId);
        if (colorObj) {
          displayColor = colorObj.color;
        } else if (rootColorId && rootColorId.startsWith('#')) {
          // Handle hex color from color picker
          displayColor = rootColorId;
        } else {
          // Fallback to default blue
          displayColor = this.groupColors[4].color;
        }
        
        // Darken color based on nesting depth
        if (depth > 0) {
          displayColor = darkenColor(displayColor, depth * 15);
        }
        
        return {
          name: customGroup.name,
          icon: '●',
          color: displayColor,
          isCustom: true,
          groupId: customGroup.id,
          subgroupCount: this.getSubgroups(groupId).length,
          nestedTabsCount: this.getNestedTabsCount(groupId),
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
      browser.storage.local.set({ collapsedTabs });
    } catch (error) {
      console.error('Error saving tab collapsed state:', error);
    }
  }
  
  // Collapse all descendant groups
  collapseAllDescendants(parentGroupKey) {
    const parentId = parentGroupKey.replace('custom_', '');
    
    // Find all child groups
    const childGroups = this.customGroups.filter(g => g.parentId === parentId);
    
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
    const childGroups = this.customGroups.filter(g => g.parentId === parentId);
    
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
      
      await browser.storage.local.set({
        settings: { ...this.settings }
      });
    } catch (error) {
      console.error('Error saving collapsed state:', error);
    }
  }
  
  groupTabsByDomain() {
    const groups = {};
    
    // Get IDs of tabs that are in custom groups
    const tabsInCustomGroups = new Set();
    this.customGroups.forEach(group => {
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
    this.customGroups.forEach(group => {
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
    this.customGroups.forEach(group => {
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
    this.customGroups.forEach(group => {
      const groupKey = 'custom_' + group.id;
      groups[groupKey] = this.tabs.filter(tab => group.tabIds.some(id => Number(id) === tab.id));
    });
    
    // Add ungrouped tabs
    const groupedTabIds = new Set();
    this.customGroups.forEach(group => {
      group.tabIds.forEach(id => groupedTabIds.add(Number(id)));
    });
    
    const ungroupedTabs = this.tabs.filter(tab => !groupedTabIds.has(tab.id));
    if (ungroupedTabs.length > 0) {
      groups['ungrouped'] = ungroupedTabs;
    }
    
    return groups;
  }
  
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
    const customGroup = this.getCustomGroupForTab(tab.id);
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
    
    const hasAudio = tab.audible || tab.mutedInfo?.muted;
    if (this.settings.showAudio && hasAudio) {
      tabItem.classList.add('playing');
    }
    
    if (tab.mutedInfo?.muted) {
      tabItem.classList.add('muted');
    }
    
    if (!this.settings.showFavicon) {
      tabItem.classList.add('hide-favicon');
    }
    
    const title = this.getTabDisplayTitle(tab);
    
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
    const tabUrlKey = this.getUrlKey(tab.url);
    
    // Check if this tab is indexed in the database
    if (this.pageHeadings && this.pageHeadings[tabUrlKey] && this.pageHeadings[tabUrlKey].length > 0) {
      indexedIndicator = `<span class="tab-indexed-indicator" title="Page indexed in database">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12z"/>
        </svg>
      </span>`;
    }
    
    if (this.settings.showFavicon) {
      if (tab.favIconUrl && this.isValidFaviconUrl(tab.favIconUrl)) {
        faviconHtml = `<img class="tab-favicon" src="${this.escapeHtml(tab.favIconUrl)}" alt="" />`;
      } else {
        faviconHtml = `<div class="tab-favicon-placeholder">${this.escapeHtml(this.getInitial(title))}</div>`;
      }
    }
    
    // Show group name in search results
    let groupNameHtml = '';
    if (groupKey === 'search') {
      const groupNames = this.getGroupHierarchyNames(tab.id);
      if (groupNames.length > 0) {
        groupNameHtml = `<div class="tab-group-name">${this.escapeHtml(groupNames.join(' > '))}</div>`;
      }
    }
    
    let audioButton = '';
    if (this.settings.showAudio) {
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
    
    // Use DOMParser to safely parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(`
      ${treeTwistyHtml}
      <div class="tab-favicon-wrapper">
        ${faviconHtml}
      </div>
      <div class="tab-content">
        <span class="tab-title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</span>
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
        // Reload the discarded tab
        browser.tabs.reload(Number(tab.id)).catch(err => console.error('Error loading tab:', err));
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
        this.toggleTabMute(tab);
      });
    }
    
    tabItem.addEventListener('click', (e) => this.handleTabClick(e, tab));
    tabItem.querySelector('.tab-close').addEventListener('click', (e) => this.handleTabClose(e, tab));
    tabItem.addEventListener('mouseenter', (e) => this.showTabPreview(e, tab));
    tabItem.addEventListener('mouseleave', () => this.hideTabPreview());
    tabItem.addEventListener('mousemove', (e) => this.updatePreviewPosition(e));
    
    tabItem.addEventListener('dragstart', (e) => this.handleDragStart(e, tab, index, groupKey));
    tabItem.addEventListener('dragend', (e) => this.handleDragEnd(e));
    tabItem.addEventListener('dragover', (e) => this.handleDragOver(e, index, groupKey));
    tabItem.addEventListener('drop', (e) => this.handleDrop(e, index, groupKey));
    
    return tabItem;
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
    
    const indexAllBtn = document.getElementById('indexAllBtn');
    if (indexAllBtn) {
      indexAllBtn.addEventListener('click', async () => {
        const originalHtml = indexAllBtn.innerHTML;
        // Show loading icon while indexing - use DOMParser for safety
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>`, 'text/html');
        indexAllBtn.innerHTML = '';
        indexAllBtn.appendChild(doc.body.firstChild);
        indexAllBtn.disabled = true;
        
        await this.indexAllTabs();
        
        // Restore original content using DOMParser for safety
        const restoreParser = new DOMParser();
        const restoreDoc = restoreParser.parseFromString(originalHtml, 'text/html');
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
      this.tabsScrollContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const data = e.dataTransfer.types.includes('text/plain') ? 
          JSON.parse(e.dataTransfer.getData('text/plain') || '{}') : {};
        if (data.type === 'group') {
          e.dataTransfer.dropEffect = 'move';
          this.tabsScrollContainer.classList.add('drag-over-empty');
        }
      });
      
      this.tabsScrollContainer.addEventListener('dragleave', (e) => {
        if (!this.tabsScrollContainer.contains(e.relatedTarget)) {
          this.tabsScrollContainer.classList.remove('drag-over-empty');
        }
      });
      
      this.tabsScrollContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        this.tabsScrollContainer.classList.remove('drag-over-empty');
        
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
          if (data.type === 'group' && data.groupKey) {
            const groupId = data.groupKey.replace('custom_', '');
            const group = this.customGroups.find(g => g.id === groupId);
            
            if (group && group.parentId) {
              // Make it a root-level group
              group.parentId = null;
              await this.saveCustomGroups();
              this.renderTabs();
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      });
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
    const currentWindow = await browser.windows.getCurrent();
    await browser.tabs.create({
      windowId: currentWindow.id,
      url: 'settings.html',
      active: true
    });
    
    if (this.shouldCloseWindow) {
      window.close();
    }
  }
  
  handleTabClick(e, tab) {
    if (e.target.closest('.tab-close')) return;
    
    browser.tabs.update(tab.id, { active: true });
    browser.windows.update(tab.windowId, { focused: true });
    
    // Update tab usage in group
    const group = this.getCustomGroupForTab(tab.id);
    if (group) {
      this.updateTabUsage(tab.id, group.id);
    }
    
    if (this.settings.closeOnSelect && this.shouldCloseWindow) {
      window.close();
    }
  }
  
  handleTabClose(e, tab) {
    e.stopPropagation();
    this.closeTabById(tab.id);
  }
  
  async closeTabById(tabId) {
    try {
      await browser.tabs.remove(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }
  
  // Refresh all tabs
  async refreshAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      for (const tab of tabs) {
        if (!tab.pinned) {
          await browser.tabs.reload(tab.id);
        }
      }
    } catch (error) {
      console.error('Error refreshing tabs:', error);
    }
  }
  
  // Close all tabs
  async closeAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const tabIds = tabs.map(tab => tab.id);
      if (tabIds.length > 0) {
        await browser.tabs.remove(tabIds);
      }
    } catch (error) {
      console.error('Error closing all tabs:', error);
    }
  }
  
  // Index all tabs for search
  async indexAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      console.log('Indexing all tabs:', tabs.length);
      for (const tab of tabs) {
        // Skip URLs that can't be indexed
        if (tab.id && tab.url && 
            !tab.url.startsWith('about:') && 
            !tab.url.startsWith('chrome:') &&
            !tab.url.startsWith('moz-extension:') &&
            !tab.url.startsWith('file:') &&
            !tab.url.startsWith('javascript:') &&
            !tab.url.startsWith('data:') &&
            !tab.url.startsWith('blob:')) {
          await this.indexPageHeadings(tab.id);
        } else {
          console.log('Skipping URL:', tab.url);
        }
      }
      console.log('Indexing complete for all tabs');
    } catch (error) {
      console.error('Error indexing all tabs:', error);
    }
  }
  
  // Clear indexed data for all open tabs
  async clearIndexForAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      console.log('Clearing index for all tabs:', tabs.length);
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          const urlKey = this.getUrlKey(tab.url);
          // Remove from memory
          if (urlKey && this.pageHeadings[urlKey]) {
            delete this.pageHeadings[urlKey];
          }
          // Remove from IndexedDB
          if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
            try {
              await window.YouTabsDB.deleteTabUrlMapping(tab.id);
              if (urlKey) {
                await window.YouTabsDB.deletePagesIndexByUrl(urlKey);
              }
            } catch (e) {
              // Ignore individual errors
            }
          }
        }
      }
      console.log('Cleared index for all tabs');
      this.renderTabs(); // Re-render to update indexed indicators
    } catch (error) {
      console.error('Error clearing index for all tabs:', error);
    }
  }
  
  // Close other tabs (all except the active one)
  async closeOtherTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const otherTabIds = tabs.filter(tab => tab.id !== activeTab.id).map(tab => tab.id);
        if (otherTabIds.length > 0) {
          await browser.tabs.remove(otherTabIds);
        }
      }
    } catch (error) {
      console.error('Error closing other tabs:', error);
    }
  }
  
  // Close tabs to the left of the active tab
  async closeTabsToLeft() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const tabsToClose = tabs.filter(tab => tab.index < activeTab.index && !tab.pinned).map(tab => tab.id);
        if (tabsToClose.length > 0) {
          await browser.tabs.remove(tabsToClose);
        }
      }
    } catch (error) {
      console.error('Error closing tabs to left:', error);
    }
  }
  
  // Close tabs to the right of the active tab
  async closeTabsToRight() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const activeTab = tabs.find(tab => tab.active);
      if (activeTab) {
        const tabsToClose = tabs.filter(tab => tab.index > activeTab.index && !tab.pinned).map(tab => tab.id);
        if (tabsToClose.length > 0) {
          await browser.tabs.remove(tabsToClose);
        }
      }
    } catch (error) {
      console.error('Error closing tabs to right:', error);
    }
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
  
  // Filter out duplicate headings from the indexed list
  filterDuplicateHeadings(headings) {
    const seen = new Map();
    const uniqueHeadings = [];
    
    for (const heading of headings) {
      let key;
      
      if (heading.type === 'image') {
        // For images, duplicate is defined by text and imgUrl
        key = `image:${heading.text || ''}:${heading.imgUrl || ''}`;
      } else if (heading.type === 'video' || heading.type === 'videoEmbed') {
        // For videos, duplicate is defined by text and videoUrl
        key = `${heading.type}:${heading.text || ''}:${heading.videoUrl || ''}`;
      } else if (heading.type === 'audio') {
        // For audio, duplicate is defined by text and audioUrl
        key = `audio:${heading.text || ''}:${heading.audioUrl || ''}`;
      } else {
        // For other types, duplicate is defined by text, type, and url
        key = `${heading.type || ''}:${heading.text || ''}:${heading.url || ''}`;
      }
      
      if (!seen.has(key)) {
        seen.set(key, true);
        uniqueHeadings.push(heading);
      }
    }
    
    return uniqueHeadings;
  }

  // Index page headings (h1-h6) for a specific tab
  // Extract headings via content script message (more reliable with CSP)
  async extractHeadingsViaContentScript(tabId, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await browser.tabs.sendMessage(tabId, { action: 'extractHeadings' });
        if (response && response.headings && response.headings.length > 0) {
          console.log('extractHeadingsViaContentScript: got', response.headings.length, 'headings on attempt', attempt + 1);
          return response.headings;
        }
        if (attempt < maxRetries) {
          console.log('extractHeadingsViaContentScript: no results, retrying...');
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
        }
      } catch (error) {
        console.log('extractHeadingsViaContentScript: attempt', attempt + 1, 'failed:', error.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
        }
      }
    }
    console.log('extractHeadingsViaContentScript: all attempts failed');
    return null;
  }

  // Only indexes if: page URL is not in index OR 30 minutes have passed since last index
  async indexPageHeadings(tabId) {
    console.log('indexPageHeadings: called for tab', tabId);
    try {
      // Get the tab to check its URL
      const tab = await browser.tabs.get(tabId);
      console.log('indexPageHeadings: got tab', tab?.url);
      if (!tab || !tab.url) {
        console.log('indexPageHeadings: no tab or url');
        return;
      }
      
      // Skip URLs that can't be indexed
      if (tab.url.startsWith('about:') || 
          tab.url.startsWith('chrome:') ||
          tab.url.startsWith('moz-extension:') ||
          tab.url.startsWith('file:') ||
          tab.url.startsWith('javascript:') ||
          tab.url.startsWith('data:') ||
          tab.url.startsWith('blob:')) {
        console.log('indexPageHeadings: skipping unsupported URL:', tab.url);
        return;
      }
      
      // Check if page URL is already indexed and doesn't need re-indexing
      const shouldIndex = await this.shouldReindexPageByUrl(tab.url);
      console.log('indexPageHeadings: shouldIndex =', shouldIndex);
      
      if (!shouldIndex) {
        console.log('indexPageHeadings: skipping, already indexed');
        return;
      }
      
      // Try to extract headings via content script (works better with CSP)
      let headings = null;
      const contentScriptHeadings = await this.extractHeadingsViaContentScript(tabId);
      
      if (contentScriptHeadings && contentScriptHeadings.length > 0) {
        console.log('indexPageHeadings: got headings via content script:', contentScriptHeadings.length);
        headings = contentScriptHeadings;
      } else {
        // Fallback to executeScript with MAIN world to bypass CSP
        const maxChars = this.settings?.maxIndexChars || 250;
        console.log('indexPageHeadings: trying executeScript with MAIN world');
        try {
          const results = await browser.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN', // Run in page's main world to bypass CSP
            func: extractHeadings,
            args: [{ maxIndexChars: maxChars }]
          });
          console.log('indexPageHeadings: executeScript results:', results);
          if (results && results[0] && results[0].result) {
            headings = results[0].result;
          }
        } catch (scriptError) {
          console.error('indexPageHeadings: scripting.executeScript error:', scriptError.message);
        }
      }
      
      if (headings && headings.length > 0) {
        // Filter out duplicates before storing
        headings = this.filterDuplicateHeadings(headings);
        console.log('indexPageHeadings: after filter', headings.length, 'headings');
        
        // Store by URL instead of tabId to avoid duplicate indexing
        const urlKey = this.getUrlKey(tab.url);
        this.pageHeadings[urlKey] = headings;
        await window.YouTabsDB.savePageHeadingsByUrl(tab.url, tabId, headings);
        console.log('indexPageHeadings: saved for', urlKey, 'with', headings.length, 'headings');
      } else {
        console.log('indexPageHeadings: no results for', tab.url);
      }
    } catch (error) {
      // Log errors for debugging
      console.error('indexPageHeadings: error for', tab?.url, error.message);
    }
  }
  
  // Get a URL key for indexing (normalizes the URL)
  getUrlKey(url) {
    try {
      // Remove trailing slash and hash for consistent indexing
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    } catch (e) {
      console.log('getUrlKey: failed to parse URL:', url, e);
      return url;
    }
  }
  
  // Check if a page should be re-indexed by URL
  // Returns true if: page URL is not indexed OR 30 minutes have passed since last index
  async shouldReindexPageByUrl(url) {
    try {
      const urlKey = this.getUrlKey(url);
      console.log('shouldReindexPageByUrl: checking URL:', urlKey);
      
      // Ensure database is opened
      if (!window.YouTabsDB || !window.YouTabsDB.isIndexedDBAvailable()) {
        console.log('shouldReindexPageByUrl: no DB, should index');
        return true;
      }
      
      await window.YouTabsDB.openDatabase();
      
      // Get page index by URL with timestamp
      const pageIndexWithTimestamp = await window.YouTabsDB.getPagesIndexByUrl(urlKey);
      console.log('shouldReindexPageByUrl: result:', pageIndexWithTimestamp);
      
      if (!pageIndexWithTimestamp || !pageIndexWithTimestamp.indexedAt) {
        console.log('shouldReindexPageByUrl: not indexed, should index');
        return true;
      }
      
      // Check if 30 minutes have passed since last index
      const now = Date.now();
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;
      const timeSinceIndex = now - pageIndexWithTimestamp.indexedAt;
      
      if (timeSinceIndex >= THIRTY_MINUTES_MS) {
        console.log('shouldReindexPageByUrl: expired, should re-index. Time:', Math.round(timeSinceIndex / 60000), 'minutes');
        return true;
      }
      
      console.log('shouldReindexPageByUrl: indexed recently, skip');
      return false;
    } catch (error) {
      console.error('shouldReindexPageByUrl: error:', error);
      return true;
    }
  }
  
  // Save page headings to IndexedDB
  async savePageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.savePagesIndex(this.pageHeadings);
      }
    } catch (error) {
      console.error('Error saving page headings:', error);
    }
  }
  
  // Load page headings from IndexedDB
  async loadPageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.openDatabase();
        
        // Get pagesIndex (url -> headings)
        const pagesIndex = await window.YouTabsDB.getPagesIndexWithTimestamp();
        
        // Build in-memory index: urlKey -> headings
        this.pageHeadings = {};
        for (const [urlKey, data] of Object.entries(pagesIndex)) {
          if (data.headings && data.headings.length > 0) {
            this.pageHeadings[urlKey] = this.filterDuplicateHeadings(data.headings);
          }
        }
        
        // Note: tabIdToUrlKey mapping is no longer needed since we get tabId from open tabs
        // when searching, and for closed tabs we can't know the tabId anyway
        this.tabIdToUrlKey = {};
      }
    } catch (error) {
      console.error('Error loading page headings:', error);
    }
  }
  
  // Search page headings
  searchHeadings(query) {
    if (!query || !this.settings.enablePageSearch || this.filterHeadingTypes.length === 0) {
      return [];
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    const maxResults = this.settings.maxSearchResults || 15;
    
    // Get list of currently open tabs for URL matching
    const openTabs = this.tabs;
    
    // Search through all indexed headings (including closed tabs)
    for (const [urlKey, headings] of Object.entries(this.pageHeadings)) {
      // urlKey is the normalized URL
      
      for (const heading of headings) {
        // Filter by heading type
        if (!this.filterHeadingTypes.includes(heading.type)) {
          continue;
        }
        
        if (heading.text.toLowerCase().includes(lowerQuery)) {
          // Try to find an open tab with matching URL
          const pageUrl = heading.url;
          const matchingTab = openTabs.find(t => {
            try {
              const tUrl = t.url || '';
              const hUrl = pageUrl || '';
              return tUrl.includes(hUrl) || hUrl.includes(tUrl);
            } catch {
              return false;
            }
          });
          
          const isTabOpen = !!matchingTab;
          const tabId = matchingTab ? matchingTab.id : null;
          
          // Calculate relevance score
          let relevance = 0;
          const lowerText = heading.text.toLowerCase();
          
          // Exact match gets highest score
          if (lowerText === lowerQuery) {
            relevance = 100;
          } else if (lowerText.startsWith(lowerQuery)) {
            relevance = 80;
          } else if (lowerText.includes(lowerQuery)) {
            // Check position - earlier in text = higher relevance
            const position = lowerText.indexOf(lowerQuery);
            relevance = 70 - position;
          }
          
          // Give higher priority to headings (h1-h6) and paragraphs
          if (heading.type === 'heading') {
            relevance += 20;
          } else if (heading.type === 'paragraph') {
            relevance += 10;
          }
          
          // Give slightly higher priority to results from open tabs
          if (isTabOpen) {
            relevance += 5;
          }
          
          results.push({
            tabId: tabId,
            tab: matchingTab,
            isTabOpen: isTabOpen,
            pageUrl: pageUrl,
            heading: heading,
            relevance: relevance
          });
        }
      }
    }
    
    // Sort by relevance (descending) and limit results
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, maxResults);
  }
  
  // Search and display all headings for a specific tab
  searchHeadingsForTab(tabId) {
    const numericTabId = Number(tabId);
    
    // Find the tab to get its URL
    const tab = this.tabs.find(t => t.id === numericTabId);
    if (!tab) {
      console.log(`Tab ${numericTabId} not found`);
      return;
    }
    
    // Use URL key to get headings
    const urlKey = this.getUrlKey(tab.url);
    const headings = this.pageHeadings[urlKey];
    
    if (!headings || headings.length === 0) {
      console.log(`No indexed headings found for tab ${numericTabId}`);
      return;
    }
    
    // Create results from all headings for this tab
    this.headingSearchResults = headings.map(heading => ({
      tabId: numericTabId,
      tab: tab,
      heading: heading,
      relevance: 50 // Default relevance for showing all headings
    }));
    
    // Clear search query to show all headings for this tab
    this.searchQuery = '';
    
    // Update UI
    this.renderTabs();
    
    // Scroll to top to see results
    if (this.tabsScrollContainer) {
      this.tabsScrollContainer.scrollTop = 0;
    }
    
    console.log(`Showing ${headings.length} indexed headings for tab ${numericTabId}`);
  }
  
  // Remove headings for a tab from memory and IndexedDB
  // This is called from the context menu "Remove index" option
  // Note: Indexed data is NOT removed when a tab is closed - only via this method or expiration time
  async removePageHeadingsForTab(tabId) {
    const numericTabId = Number(tabId);
    
    // Try to get the tab URL first
    let urlKey = null;
    try {
      const tab = await browser.tabs.get(numericTabId);
      if (tab && tab.url) {
        urlKey = this.getUrlKey(tab.url);
      }
    } catch (e) {
      // Tab might not be available
    }
    
    // Remove from memory using URL key
    if (urlKey && this.pageHeadings[urlKey]) {
      delete this.pageHeadings[urlKey];
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
      
      // Remove tab from all custom groups
      for (const group of this.customGroups) {
        const originalLength = group.tabIds.length;
        group.tabIds = group.tabIds.filter(id => Number(id) !== numericTabId);
        
        if (group.tabIds.length !== originalLength) {
          removed = true;
          // Also remove metadata for this tab in this group
          if (this.groupTabMetadata[group.id] && this.groupTabMetadata[group.id][numericTabId]) {
            delete this.groupTabMetadata[group.id][numericTabId];
          }
        }
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
      
      // Save changes if tab was removed from any group
      if (removed) {
        await this.saveCustomGroups();
        await this.saveGroupTabMetadata();
        // Reload tabs to update the display
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
    try {
      await browser.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
      await this.loadTabs();
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }
  
  async createNewTab() {
    try {
      const currentWindow = await browser.windows.getCurrent();
      await browser.tabs.create({
        windowId: currentWindow.id,
        active: true
      });
      
      if (this.shouldCloseWindow) {
        window.close();
      }
    } catch (error) {
      console.error('Error creating new tab:', error);
    }
  }
  
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
  
  handleDragStart(e, tab, index, groupKey) {
    this.draggedTab = tab;
    this.draggedIndex = index;
    this.draggedGroup = groupKey;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      index: index,
      group: groupKey,
      tabId: tab.id
    }));
  }
  
  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.tab-item').forEach(item => {
      item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
    document.querySelectorAll('.tab-group-tabs').forEach(group => {
      group.classList.remove('drag-over');
    });
    this.draggedTab = null;
    this.draggedIndex = null;
    this.draggedGroup = null;
  }
  
  handleDragOver(e, index, groupKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    document.querySelectorAll('.tab-item').forEach(item => {
      item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
    document.querySelectorAll('.tab-group-tabs').forEach(group => {
      group.classList.remove('drag-over');
    });
    
    const targetTab = e.target.closest('.tab-item');
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
  
  async handleDrop(e, targetIndex, targetGroup) {
    e.preventDefault();
    // NOTE: Removed stopPropagation() to avoid breaking other event handlers
    // If you need to prevent bubbling, consider using capture phase or specific handlers
    
    // Defensive check: if targetGroup is undefined, just clean up and return
    if (!targetGroup) {
      this.handleDragEnd(e);
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
        await this.addTabToGroup(tabId, groupId);
      }
      return;
    }
    
    if (this.draggedTab) {
      try {
        // Find the target tab element
        const targetTabEl = e.target.closest('.tab-item');
        
        if (targetTabEl) {
          // Get all tab items in the same group container
          const groupContainer = targetTabEl.closest('.tab-group-tabs');
          const allTabsInGroup = groupContainer ? Array.from(groupContainer.querySelectorAll('.tab-item')) : [];
          
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
              // FIX 2: Use explicit string comparison for IDs
              // Save tab ID first to avoid async issues
              const tabId = this.draggedTab?.id;
              if (!tabId) {
                this.handleDragEnd(e);
                return;
              }
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
                if (newIndex === draggedTabIndex) {
                  this.handleDragEnd(e);
                  return;
                }
              }
            }
            
            // FIX 4: Handle cross-group moves with grouping enabled
            // Moving between groups with grouping enabled - calculate proper position
            if (dragData.group !== targetGroup && this.settings.enableGrouping) {
              // Get the target group's tabs to calculate insertion point
              const targetGroupTabs = this.getTabsInGroup(targetGroup);
              const sourceGroup = dragData.group;
              
              // Adjust index based on whether we're moving up or down in the target group
              if (targetIndex > this.draggedIndex && sourceGroup !== targetGroup) {
                // Moving down - adjust for removed tab
                newIndex = Math.max(0, targetIndex);
              }
            }
            
            // Move tab to new position
            // Save tab ID first to avoid async issues
            const tabId = this.draggedTab?.id;
            const tabWindowId = this.draggedTab?.windowId;
            if (tabId && tabWindowId) {
              await browser.tabs.move(tabId, {
                windowId: tabWindowId,
                index: newIndex
              });
            }
            
            // Reload tabs to reflect new order
            await this.loadTabs();
          }
        } else {
          // FIX 1: Fallback when target tab element not found - use targetIndex parameter
          console.warn('Drop target tab element not found, using fallback with targetIndex');
          
          let newIndex = targetIndex;
          
          // Apply same-group adjustment logic for fallback
          if (dragData.group === targetGroup && this.draggedIndex !== null) {
            if (newIndex > this.draggedIndex) {
              newIndex = newIndex - 1;
            }
            if (newIndex === this.draggedIndex) {
              this.handleDragEnd(e);
              return;
            }
          }
          
          // Handle cross-group moves with grouping enabled (fallback path)
          if (dragData.group !== targetGroup && this.settings.enableGrouping) {
            const sourceGroup = dragData.group;
            if (targetIndex > this.draggedIndex && sourceGroup !== targetGroup) {
              newIndex = Math.max(0, targetIndex);
            }
          }
          
          await browser.tabs.move(this.draggedTab?.id, {
            windowId: this.draggedTab?.windowId,
            index: newIndex
          });
          
          await this.loadTabs();
        }
      } catch (error) {
        console.error('Error moving tab:', error);
      }
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
  
  // Search functionality
  setSearchQuery(query) {
    this.searchQuery = query?.toLowerCase() || '';
    
    // Apply filter - only filter tabs if filterTabs is enabled
    this.filteredTabs = (this.searchQuery && this.filterTabs) ? this.filterTabsList(this.tabs, this.searchQuery) : [];
    
    // Also search page headings if enabled and has heading types selected
    this.headingSearchResults = [];
    if (this.searchQuery && this.settings.enablePageSearch && this.filterHeadingTypes.length > 0) {
      this.headingSearchResults = this.searchHeadings(this.searchQuery);
    }
    
    this.renderTabs();
  }
  
  filterTabsList(tabs, query) {
    if (!query) return tabs;
    
    return tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      
      // Get custom tab name for this tab
      const numericTabId = Number(tab.id);
      const customTabName = this.customTabNames[numericTabId]?.customName?.toLowerCase() || '';
      
      // Get group and subgroup names for this tab
      const groupNames = this.getGroupHierarchyNames(tab.id);
      const groupNameSearch = groupNames.join(' ').toLowerCase();
      
      return title.includes(query) || url.includes(query) || customTabName.includes(query) || groupNameSearch.includes(query);
    });
  }
  
  // Get all parent group names for a tab (including subgroups)
  getGroupHierarchyNames(tabId) {
    const group = this.getCustomGroupForTab(tabId);
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
  
  // Get all parent group names for a group (for context menu search)
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
  
  getTabsToDisplay() {
    // If filterTabs is false, return empty array during search
    if (this.searchQuery && !this.filterTabs) {
      return [];
    }
    if (this.searchQuery && this.filteredTabs.length > 0) {
      return this.filteredTabs;
    }
    return this.tabs;
  }
  
  clearSearch() {
    this.searchQuery = '';
    this.filteredTabs = [];
    this.headingSearchResults = [];
    this.renderTabs();
  }
  
  // Apply search filter
  applyFilter(filterOptions) {
    if (filterOptions.filterTabs !== undefined) {
      this.filterTabs = filterOptions.filterTabs;
    }
    if (filterOptions.filterHeadingTypes !== undefined) {
      this.filterHeadingTypes = filterOptions.filterHeadingTypes;
    }
    
    // Update hasActiveFilter state
    this.hasActiveFilter = !this.filterTabs || this.filterHeadingTypes.length < this.totalFilterTypes;
    
    // Re-run search with new filter
    if (this.searchQuery) {
      this.setSearchQuery(this.searchQuery);
    } else {
      this.renderTabs();
    }
  }
  
  // Get current filter state
  getFilterState() {
    return {
      filterTabs: this.filterTabs,
      filterHeadingTypes: this.filterHeadingTypes,
      hasActiveFilter: this.hasActiveFilter
    };
  }
  
  // Reset filter to default values
  resetFilter() {
    // Default filter values
    this.filterTabs = true;
    this.filterHeadingTypes = [...YouTabsCore.FILTER_TYPES].map(t => t.value);
    this.hasActiveFilter = false;
    
    // Re-run search if there's an active search query
    if (this.searchQuery) {
      this.setSearchQuery(this.searchQuery);
    } else {
      this.renderTabs();
    }
  }
}
