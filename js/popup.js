/**
 * YouTabs Extension - Popup Script
 * Extends YouTabsCore for popup-specific behavior
 */

class YouTabsPopup extends YouTabsCore {
  constructor() {
    // Popup closes window after certain actions
    super({
      closeOnSelect: true,
      shouldCloseWindow: true
    });
    
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
    
    // Filter UI elements
    this.searchFilter = document.getElementById('searchFilter');
    this.searchRegex = document.getElementById('searchRegex');
    this.filterModalOverlay = document.getElementById('filterModalOverlay');
    this.filterModalClose = document.getElementById('filterModalClose');
    this.filterTabs = document.getElementById('filterTabs');
    this.filterHeadingsTrigger = document.getElementById('filterHeadingsTrigger');
    this.filterHeadingsMenu = document.getElementById('filterHeadingsMenu');
    this.filterHeadingsCount = document.getElementById('filterHeadingsCount');
    this.filterApplyBtn = document.getElementById('filterApplyBtn');
    this.filterResetBtn = document.getElementById('filterResetBtn');
    this.filterTagInput = document.getElementById('filterTagInput');
    
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
    
    // Apply full-height class for popup windows
    if (window.innerWidth > 400) {
      document.body.classList.add('full-height');
    }
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
        this.setSearchQuery(e.target.value);
        this.updateSearchClearButton();
      });
      
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.clearSearchInput();
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
    
    // Handle tag filter - use as search query
    if (this.filterTagInput && this.filterTagInput.value.trim()) {
      const tagValue = this.filterTagInput.value.trim();
      if (this.core && this.core.searchEngine) {
        this.core.searchEngine.setSearchQuery('#' + tagValue);
      }
    } else {
      // If no tag filter, clear the search if it was a tag search
      const currentQuery = this.searchInput?.value?.trim() || '';
      if (currentQuery.startsWith('#') || currentQuery.startsWith('tag:')) {
        if (this.core && this.core.searchEngine) {
          this.core.searchEngine.setSearchQuery('');
        }
      }
    }
    
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
    
    // Reset tag filter input
    if (this.filterTagInput) {
      this.filterTagInput.value = '';
    }
    
    // Apply reset to core filter
    if (this.core && typeof this.core.resetFilter === 'function') {
      this.core.resetFilter();
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
  
  handleTabClick(e, tab) {
    // Don't switch if clicking close button
    if (e.target.closest('.tab-close')) return;
    
    // Activate tab
    browser.tabs.update(tab.id, { active: true });
    browser.windows.update(tab.windowId, { focused: true });
    
    // Close popup based on setting
    if (this.settings.closeOnSelect) {
      window.close();
    }
  }
  
  async createNewTab() {
    try {
      const currentWindow = await browser.windows.getCurrent();
      await browser.tabs.create({
        windowId: currentWindow.id,
        active: true
      });
      window.close();
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
    // Open settings in a new tab or window
    try {
      const currentWindow = await browser.windows.getCurrent();
      await browser.tabs.create({
        windowId: currentWindow.id,
        url: 'settings.html',
        active: true
      });
      window.close();
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }
}

// Initialize when DOM is ready
function initPopup() {
  if (window._popupInitialized) return;
  window._popupInitialized = true;
  
  const popup = new YouTabsPopup();
  window.addEventListener('unload', () => popup.cleanup());
}

document.addEventListener('DOMContentLoaded', initPopup);

// Fallback: if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initPopup();
}
