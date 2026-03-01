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
    
    // Initialize DOM elements
    this.tabsList = document.getElementById('tabsList');
    this.tabCount = document.getElementById('tabCount');
    this.createGroupBtn = document.getElementById('createGroupBtn');
    this.tabsScrollContainer = document.getElementById('tabsScrollContainer');
    this.tabPreview = document.getElementById('tabPreview');
    this.searchInput = document.getElementById('searchInput');
    this.searchClear = document.getElementById('searchClear');
    
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
      this.filterHeadingsMenu.innerHTML = YouTabsCore.getFilterTypeHTML(true);
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
    
    // Click on empty area of you-tabs-container to show create group menu
    const tabsContainer = document.querySelector('.you-tabs-container');
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
        const target = e.target;
        // Don't show menu if clicking on interactive elements
        if (target.closest('.tab-item') || 
            target.closest('.tab-group-header') || 
            target.closest('.tabs-header') ||
            target.closest('.tab-preview') ||
            target.tagName === 'INPUT' ||
            target.tagName === 'BUTTON') {
          return;
        }
        // Hide any existing menu before showing new one
        this.hideContextMenu();
        // Show create group menu on click
        e.preventDefault();
        this.showEmptyAreaContextMenu(e);
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
  
  handleTabClick(e, tab) {
    // Don't switch if clicking close button
    if (e.target.closest('.tab-close')) return;
    
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
