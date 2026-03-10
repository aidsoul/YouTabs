/**
 * YouTabs Extension - Sidebar Script
 * Extends YouTabsCore for sidebar-specific behavior
 */

class YouTabsSidebar extends YouTabsCore {
  constructor() {
    // Sidebar doesn't close window after actions
    super({
      closeOnSelect: false,
      shouldCloseWindow: false
    });
    
    // Search history state
    this.searchHistory = [];
    this.isShowingHistory = false;
    this.historySelectedIndex = -1;
    
    // Initialize DOM elements
    this.tabsList = document.getElementById('tabsList');
    this.tabCount = document.getElementById('tabCount');
    this.createGroupBtn = document.getElementById('createGroupBtn');
    this.tabsScrollContainer = document.getElementById('tabsScrollContainer');
    this.tabPreview = document.getElementById('tabPreview');
    this.searchInput = document.getElementById('searchInput');
    
    // Set DOM elements on UIRenderer
    if (this.uiRenderer) {
      this.uiRenderer.setElements({
        tabsList: this.tabsList,
        tabCount: this.tabCount,
        tabsScrollContainer: this.tabsScrollContainer,
        tabPreview: this.tabPreview
      });
    }
    this.searchClear = document.getElementById('searchClear');
    this.searchRegex = document.getElementById('searchRegex');
    
    // Filter UI elements
    this.searchFilter = document.getElementById('searchFilter');
    this.filterModalOverlay = document.getElementById('filterModalOverlay');
    this.filterModalClose = document.getElementById('filterModalClose');
    this.filterTabs = document.getElementById('filterTabs');
    this.filterHeadingsTrigger = document.getElementById('filterHeadingsTrigger');
    this.filterHeadingsMenu = document.getElementById('filterHeadingsMenu');
    this.filterHeadingsCount = document.getElementById('filterHeadingsCount');
    this.filterApplyBtn = document.getElementById('filterApplyBtn');
    this.filterResetBtn = document.getElementById('filterResetBtn');
    
    // Generate filter dropdown items dynamically if needed
    if (this.filterHeadingsMenu && this.filterHeadingsMenu.dataset.generated === 'true' && typeof YouTabsCore !== 'undefined') {
      // Clear existing content
      this.filterHeadingsMenu.innerHTML = '';
      
      // Get the HTML string from core
      const filterHTML = YouTabsCore.getFilterTypeHTML(true);
      
      // Use DOMParser to safely parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(filterHTML, 'text/html');
      const tempDiv = doc.body;
      
      // Append child nodes to target element
      while (tempDiv.firstChild) {
        this.filterHeadingsMenu.appendChild(tempDiv.firstChild);
      }
    }
    
    this.init();
  }
  
  setupEventListeners() {
    super.setupEventListeners();
    
    // Create group button
    if (this.createGroupBtn) {
      this.createGroupBtn.addEventListener('click', () => {
        this.createNewGroup();
      });
    }
    
    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (!query) {
          // Show history when input is empty
          this.loadSearchHistory().then(() => {
            this.renderSearchHistory();
          });
        } else {
          // Hide history and search
          this.isShowingHistory = false;
          this.setSearchQuery(query);
        }
        this.updateSearchClearButton();
      });
      
      this.searchInput.addEventListener('focus', (e) => {
        const query = e.target.value.trim();
        
        if (!query) {
          this.loadSearchHistory().then(() => {
            this.renderSearchHistory();
          });
        }
      });
      
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.isShowingHistory) {
            this.isShowingHistory = false;
            this.renderTabsList();
          } else {
            this.clearSearchInput();
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.isShowingHistory) {
            this.navigateHistory(1);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.isShowingHistory) {
            this.navigateHistory(-1);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.isShowingHistory) {
            this.selectHistoryItem();
          }
        }
      });
    }
    
    if (this.searchClear) {
      this.searchClear.addEventListener('click', () => {
        this.clearSearchInput();
      });
    }
    
    // Filter functionality
    this.setupFilterEventListeners();
    
    // Keyboard shortcut to focus search (Ctrl+F)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.searchInput?.focus();
      }
    });
  }
  
  clearSearchInput() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.clearSearch();
      this.updateSearchClearButton();
    }
  }
  
  updateSearchClearButton() {
    if (this.searchClear) {
      this.searchClear.style.display = this.searchInput?.value ? 'flex' : 'none';
    }
  }
  
  // Filter modal methods
  setupFilterEventListeners() {
    // Filter button click - open modal
    if (this.searchFilter) {
      this.searchFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openFilterModal();
      });
    }
    
    // Regex toggle button click
    if (this.searchRegex) {
      this.searchRegex.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleRegexMode();
      });
    }
    
    // Modal close button
    if (this.filterModalClose) {
      this.filterModalClose.addEventListener('click', () => {
        this.closeFilterModal();
      });
    }
    
    // Modal overlay click - close modal
    if (this.filterModalOverlay) {
      this.filterModalOverlay.addEventListener('click', (e) => {
        if (e.target === this.filterModalOverlay) {
          this.closeFilterModal();
        }
      });
    }
    
    // Headings dropdown toggle
    if (this.filterHeadingsTrigger) {
      this.filterHeadingsTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFilterDropdown();
      });
    }
    
    // Headings dropdown items
    if (this.filterHeadingsMenu) {
      const dropdownItems = this.filterHeadingsMenu.querySelectorAll('.filter-dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const checkbox = item.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            item.classList.toggle('selected', checkbox.checked);
            this.updateFilterHeadingsCount();
          }
        });
      });
    }
    
    // Apply button
    if (this.filterApplyBtn) {
      this.filterApplyBtn.addEventListener('click', () => {
        this.applyFilterFromUI();
      });
    }
    
    // Reset button
    if (this.filterResetBtn) {
      this.filterResetBtn.addEventListener('click', () => {
        this.resetFilterFromUI();
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      this.closeFilterDropdown();
    });
    
    // Initialize filter button state
    this.updateFilterButtonState();
    this.updateFilterHeadingsCount();
    this.initFilterCheckboxes();
  }
  
  openFilterModal() {
    if (this.filterModalOverlay) {
      this.filterModalOverlay.classList.add('active');
      // Initialize checkboxes with current filter state
      this.initFilterCheckboxes();
    }
  }
  
  closeFilterModal() {
    if (this.filterModalOverlay) {
      this.filterModalOverlay.classList.remove('active');
    }
    this.closeFilterDropdown();
  }
  
  toggleFilterDropdown() {
    if (this.filterHeadingsTrigger) {
      this.filterHeadingsTrigger.classList.toggle('open');
    }
    if (this.filterHeadingsMenu) {
      this.filterHeadingsMenu.classList.toggle('open');
    }
  }
  
  closeFilterDropdown() {
    if (this.filterHeadingsTrigger) {
      this.filterHeadingsTrigger.classList.remove('open');
    }
    if (this.filterHeadingsMenu) {
      this.filterHeadingsMenu.classList.remove('open');
    }
  }
  
  updateFilterHeadingsCount() {
    if (!this.filterHeadingsMenu || !this.filterHeadingsCount) return;
    
    const checkboxes = this.filterHeadingsMenu.querySelectorAll('input[type="checkbox"]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    if (checkedCount === checkboxes.length) {
      this.filterHeadingsCount.textContent = '';
    } else if (checkedCount > 0) {
      this.filterHeadingsCount.textContent = ` (${checkedCount})`;
    } else {
      this.filterHeadingsCount.textContent = ' (0)';
    }
  }
  
  initFilterCheckboxes() {
    if (!this.filterTabs || !this.filterHeadingsMenu) return;
    
    // Get filter state first
    const filterState = this.getFilterState();
    
    // Set tabs checkbox
    this.filterTabs.checked = filterState.filterTabs;
    
    // Set heading type checkboxes
    const dropdownItems = this.filterHeadingsMenu.querySelectorAll('.filter-dropdown-item');
    dropdownItems.forEach(item => {
      const value = item.dataset.value;
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && value) {
        checkbox.checked = filterState.filterHeadingTypes.includes(value);
        item.classList.toggle('selected', checkbox.checked);
      }
    });
    
    this.updateFilterHeadingsCount();
  }
  
  applyFilterFromUI() {
    if (!this.filterTabs || !this.filterHeadingsMenu) return;
    
    // Get tabs filter value
    const filterTabsValue = this.filterTabs.checked;
    
    // Get selected heading types
    const filterHeadingTypes = [];
    const dropdownItems = this.filterHeadingsMenu.querySelectorAll('.filter-dropdown-item');
    dropdownItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        filterHeadingTypes.push(item.dataset.value);
      }
    });
    
    // Apply filter
    this.applyFilter({
      filterTabs: filterTabsValue,
      filterHeadingTypes: filterHeadingTypes
    });
    
    // Update filter button state
    this.updateFilterButtonState();
    
    // Close modal
    this.closeFilterModal();
  }
  
  resetFilterFromUI() {
    if (!this.filterTabs || !this.filterHeadingsMenu) return;
    
    // Reset to default values
    this.filterTabs.checked = true;
    
    // Select all heading types by default
    const dropdownItems = this.filterHeadingsMenu.querySelectorAll('.filter-dropdown-item');
    dropdownItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = true;
        item.classList.add('selected');
      }
    });
    
    this.updateFilterHeadingsCount();
    
    // Apply reset to core filter
    const core = this.getCore();
    if (core && typeof core.resetFilter === 'function') {
      core.resetFilter();
    }
    
    // Update filter button state
    this.updateFilterButtonState();
    
    // Close modal
    this.closeFilterModal();
  }
  
  updateFilterButtonState() {
    if (!this.searchFilter) return;
    
    const filterState = this.getFilterState();
    this.searchFilter.classList.toggle('active', filterState.hasActiveFilter);
  }
  
  /**
   * Toggle regex search mode
   */
  toggleRegexMode() {
    if (!this.searchEngine) return;
    
    const currentMode = this.searchEngine.getRegexMode();
    this.searchEngine.setRegexMode(!currentMode);
    
    // Update UI
    if (this.searchRegex) {
      this.searchRegex.classList.toggle('active', !currentMode);
    }
    
    // Re-run search with new mode
    if (this.searchInput && this.searchInput.value) {
      this.setSearchQuery(this.searchInput.value);
    }
  }
  
  /**
   * Update regex button state based on search results
   * @param {Object} searchResults - Search results from SearchEngine
   */
  updateRegexButtonState(searchResults) {
    if (!this.searchRegex) return;
    
    // Show error state if there's a regex error
    if (searchResults.useRegex && searchResults.regexError) {
      this.searchRegex.classList.add('error');
      this.searchRegex.title = `Regex Error: ${searchResults.regexError}`;
    } else {
      this.searchRegex.classList.remove('error');
      this.searchRegex.title = searchResults.useRegex ? 'Regex Search (.*) - ON' : 'Regex Search (.*)';
    }
  }
  
  handleTabClick(e, tab) {
    // Don't switch if clicking close button
    if (e.target.closest('.tab-close')) return;
    
    // Save search query before switching tabs
    const query = this.searchInput?.value?.trim();
    if (query) {
      this.saveSearchQuery(query);
    }
    
    // Activate tab
    browser.tabs.update(tab.id, { active: true });
    browser.windows.update(tab.windowId, { focused: true });
    
    // Sidebar stays open - no need to close
  }
  
  async createNewTab() {
    try {
      const currentWindow = await browser.windows.getCurrent();
      await browser.tabs.create({
        windowId: currentWindow.id,
        active: true
      });
      // Sidebar stays open - don't close
    } catch (error) {
      console.error('Error creating new tab:', error);
    }
  }
  
  async createNewGroup() {
    try {
      const groupName = await this.showPrompt('New Group', 'Enter group name:', 'New group');
      if (groupName && groupName.trim() !== '') {
        await this.createCustomGroup(groupName.trim());
      }
    } catch (error) {
      console.error('Error creating new group:', error);
    }
  }
  
  async openSettings() {
    // Open settings in a new tab
    try {
      const currentWindow = await browser.windows.getCurrent();
      await browser.tabs.create({
        windowId: currentWindow.id,
        url: 'settings.html',
        active: true
      });
      // Sidebar stays open
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }
  
  // ==================== Search History Functions ====================
  
  /**
   * Load search history from IndexedDB
   */
  async loadSearchHistory() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.getSearchHistory) {
        this.searchHistory = await window.YouTabsDB.getSearchHistory(30);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      this.searchHistory = [];
    }
  }
  
  /**
   * Save search query to history
   */
  async saveSearchQuery(query) {
    if (!query || query.trim().length === 0) return;
    
    try {
      if (window.YouTabsDB && window.YouTabsDB.addSearchQuery) {
        await window.YouTabsDB.addSearchQuery(query.trim());
        await this.loadSearchHistory();
      }
    } catch (error) {
      console.error('Error saving search query:', error);
    }
  }
  
  /**
   * Render search history dropdown
   */
  renderSearchHistory(filter = '') {
    if (!this.tabsList) return;
    
    // Filter history based on input
    let filteredHistory = this.searchHistory;
    if (filter && filter.length > 0) {
      filteredHistory = this.searchHistory.filter(item => 
        item.query.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    // Show empty state if no history
    if (filteredHistory.length === 0) {
      this.tabsList.innerHTML = `
        <div class="sidebar-history-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>${filter ? 'No matching searches' : 'No recent searches'}</p>
        </div>
      `;
      if (this.tabCount) this.tabCount.textContent = filter ? '0' : '0';
      return;
    }
    
    this.isShowingHistory = true;
    this.historySelectedIndex = -1;
    
    // Render history items
    const html = filteredHistory.map((item, index) => `
      <div class="sidebar-history-item ${index === this.historySelectedIndex ? 'selected' : ''}" data-query="${this.escapeHtml(item.query)}" data-index="${index}">
        <svg class="history-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="history-query">${this.escapeHtml(item.query)}</span>
        ${item.count > 1 ? `<span class="history-count">×${item.count}</span>` : ''}
        <button class="delete-history-item" data-id="${item.id}" title="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');
    
    this.tabsList.innerHTML = html;
    
    // Add event listeners
    this.tabsList.querySelectorAll('.sidebar-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-history-item')) return;
        const query = item.dataset.query;
        if (this.searchInput) {
          this.searchInput.value = query;
          this.setSearchQuery(query);
          this.isShowingHistory = false;
        }
      });
    });
    
    // Delete buttons
    this.tabsList.querySelectorAll('.delete-history-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        try {
          if (window.YouTabsDB && window.YouTabsDB.deleteSearchHistoryItem) {
            await window.YouTabsDB.deleteSearchHistoryItem(id);
            await this.loadSearchHistory();
            const currentFilter = this.searchInput?.value.trim() || '';
            this.renderSearchHistory(currentFilter);
          }
        } catch (error) {
          console.error('Error deleting history item:', error);
        }
      });
    });
    
    if (this.tabCount) this.tabCount.textContent = `${filteredHistory.length}`;
  }
  
  /**
   * Navigate through history items with arrow keys
   */
  navigateHistory(direction) {
    const items = this.tabsList?.querySelectorAll('.sidebar-history-item');
    if (!items || items.length === 0) return;
    
    this.historySelectedIndex = Math.max(0, Math.min(this.historySelectedIndex + direction, items.length - 1));
    
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.historySelectedIndex);
      if (index === this.historySelectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  
  /**
   * Select current history item on Enter
   */
  selectHistoryItem() {
    const items = this.tabsList?.querySelectorAll('.sidebar-history-item');
    if (items && items[this.historySelectedIndex]) {
      const query = items[this.historySelectedIndex].dataset.query;
      if (this.searchInput) {
        this.searchInput.value = query;
        this.setSearchQuery(query);
        this.isShowingHistory = false;
      }
    }
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
function initSidebar() {
  if (window._sidebarInitialized) return;
  window._sidebarInitialized = true;
  
  const sidebar = new YouTabsSidebar();
  window.addEventListener('unload', () => sidebar.cleanup());
}

document.addEventListener('DOMContentLoaded', initSidebar);

// Fallback: if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSidebar();
}
