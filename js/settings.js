/**
 * YouTabs Extension - Settings Script
 * Handles settings page interactions
 */

// Initialize SettingsManager - wrapped in IIFE to avoid global pollution
(function() {
  window.settingsManager = new SettingsManager();

  // Expose functions to global scope
  window.loadSettings = async function() {
    return window.settingsManager.getAll();
  };

  window.saveSettings = async function(settings) {
    await window.settingsManager.save(settings);
    // Notify content scripts about settings change
    try {
      await browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {});
        });
      });
    } catch (e) {
      console.warn('Failed to notify content scripts of settings change:', e);
    }
  };
})();

// Current category
let currentCategory = 'general';
let isSearchActive = false;

// Initialize settings page
async function initSettings() {
  const settings = await loadSettings();
  
  // Apply theme first
  await applyTheme(settings.theme);
  
  // Apply settings to toggles and selects
  Object.keys(settings).forEach(key => {
    const element = document.getElementById(key);
    if (!element) return;
    
    // Handle toggle switches
    if (element.classList.contains('toggle-switch')) {
      if (settings[key]) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
    
    // Handle select elements
    if (element.tagName === 'SELECT') {
      element.value = settings[key];
    }
    
    // Handle number inputs
    if (element.tagName === 'INPUT' && element.type === 'number') {
      element.value = settings[key];
    }
  });
  
  // Add click handlers to toggles
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      const setting = toggle.dataset.setting;
      const isActive = toggle.classList.toggle('active');
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = isActive;
      await saveSettings(currentSettings);
    });
  });
  
  // Add change handlers to select elements
  document.querySelectorAll('.settings-select').forEach(select => {
    select.addEventListener('change', async () => {
      const setting = select.dataset.setting;
      const value = select.value;
      
      // If theme setting, apply immediately
      if (setting === 'theme') {
        await applyTheme(value);
      }
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = value;
      await saveSettings(currentSettings);
    });
  });
  
  // Add change handlers to number inputs
  document.querySelectorAll('.settings-input[type="number"]').forEach(input => {
    input.addEventListener('change', async () => {
      const setting = input.dataset.setting;
      let value = parseInt(input.value, 10);
      
      // Validate min/max
      const min = parseInt(input.min, 10) || 0;
      const max = parseInt(input.max, 10) || 9999;
      value = Math.max(min, Math.min(max, value));
      
      // Update input value to valid range
      input.value = value;
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = value;
      await saveSettings(currentSettings);
    });
  });
  
  // Initialize category navigation
  initCategoryNavigation();
  
  // Initialize search
  initSearch();
  
  // Initialize reset button
  initResetButton();
}

// Apply theme to the page
async function applyTheme(theme) {
  // Remove existing theme link if present
  const existingThemeLink = document.getElementById('theme-css');
  if (existingThemeLink) {
    existingThemeLink.remove();
  }
  
  // Create and add new theme link
  const themeLink = document.createElement('link');
  themeLink.id = 'theme-css';
  themeLink.rel = 'stylesheet';
  themeLink.href = `css/${theme}.css`;
  document.head.appendChild(themeLink);
}

// Initialize category navigation
function initCategoryNavigation() {
  const navItems = document.querySelectorAll('.settings-nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      if (category) {
        switchCategory(category);
      }
    });
  });
}

// Switch category
function switchCategory(category) {
  currentCategory = category;
  isSearchActive = false;
  
  // Update nav items
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    if (item.dataset.category === category) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update category visibility
  document.querySelectorAll('.settings-category').forEach(cat => {
    if (cat.id === `category-${category}`) {
      cat.classList.add('active');
    } else {
      cat.classList.remove('active');
    }
  });
  
  // Clear search when switching categories
  const searchInput = document.getElementById('settingsSearch');
  if (searchInput) {
    searchInput.value = '';
  }
}

// Initialize search functionality
function initSearch() {
  const searchInput = document.getElementById('settingsSearch');
  
  if (!searchInput) return;
  
  searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (!query) {
      switchCategory(currentCategory);
      return;
    }
    
    performSearch(query);
  }, 150));
}

// Initialize reset settings button
function initResetButton() {
  const resetBtn = document.getElementById('resetSettingsBtn');
  const modalOverlay = document.getElementById('resetModalOverlay');
  const modalClose = document.getElementById('resetModalClose');
  const modalCancel = document.getElementById('resetModalCancel');
  const modalConfirm = document.getElementById('resetModalConfirm');
  
  if (!resetBtn || !modalOverlay) return;
  
  // Open modal on button click
  resetBtn.addEventListener('click', () => {
    modalOverlay.classList.add('active');
  });
  
  // Close modal functions
  const closeModal = () => {
    modalOverlay.classList.remove('active');
  };
  
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  
  if (modalCancel) {
    modalCancel.addEventListener('click', closeModal);
  }
  
  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
  
  // Confirm reset
  if (modalConfirm) {
    modalConfirm.addEventListener('click', async () => {
      try {
        await settingsManager.reset();
        closeModal();
        // Reload the page to reflect all changes
        location.reload();
      } catch (error) {
        console.error('Error resetting settings:', error);
        alert('Не удалось сбросить настройки. Пожалуйста, попробуйте еще раз.');
      }
    });
  }
}

// Perform search
function performSearch(query) {
  isSearchActive = true;
  
  // Hide all categories
  document.querySelectorAll('.settings-category').forEach(cat => {
    cat.classList.remove('active');
  });
  
  // Show search category
  const searchCategory = document.getElementById('category-search');
  searchCategory.classList.add('active');
  
  // Update search query text
  const searchQueryText = document.getElementById('searchQueryText');
  if (searchQueryText) {
    searchQueryText.textContent = `Results for "${query}"`;
  }
  
  // Get all settings items from all categories
  const allItems = document.querySelectorAll('.settings-item');
  let foundItems = [];
  
  allItems.forEach(item => {
    // Skip items inside search results container to avoid duplicates
    if (item.closest('#searchResultsContainer')) {
      return;
    }
    
    const keywords = item.dataset.keywords || '';
    const label = item.querySelector('.settings-label')?.textContent || '';
    const description = item.querySelector('.settings-description')?.textContent || '';
    
    const searchText = `${keywords} ${label} ${description}`.toLowerCase();
    
    if (searchText.includes(query)) {
      // Clone the item for display in search results
      foundItems.push({
        element: item.cloneNode(true),
        label: label.toLowerCase(),
        relevance: calculateRelevance(query, keywords, label, description)
      });
    }
  });
  
  // Sort by relevance
  foundItems.sort((a, b) => b.relevance - a.relevance);
  
  // Get container
  const searchResultsContainer = document.getElementById('searchResultsContainer');
  const noResultsMessage = document.getElementById('noResultsMessage');
  
  if (foundItems.length === 0) {
    searchResultsContainer.innerHTML = '';
    noResultsMessage.style.display = 'block';
  } else {
    noResultsMessage.style.display = 'none';
    
    // Build search results using DOM methods
    searchResultsContainer.innerHTML = '';
    
    foundItems.forEach(item => {
      const originalItem = item.element;
      const label = originalItem.querySelector('.settings-label')?.textContent || '';
      const description = originalItem.querySelector('.settings-description')?.textContent || '';
      const toggle = originalItem.querySelector('.toggle-switch');
      const input = originalItem.querySelector('.settings-input');
      const inputGroup = originalItem.querySelector('.settings-input-group');
      
      // Create settings item container
      const itemDiv = document.createElement('div');
      itemDiv.className = 'settings-item';
      itemDiv.dataset.keywords = originalItem.dataset.keywords || '';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'settings-item-content';
      
      // Create label with highlighting
      const labelDiv = document.createElement('div');
      labelDiv.className = 'settings-label';
      labelDiv.appendChild(highlightTextDOM(label, query));
      contentDiv.appendChild(labelDiv);
      
      // Create description with highlighting
      const descDiv = document.createElement('div');
      descDiv.className = 'settings-description';
      descDiv.appendChild(highlightTextDOM(description, query));
      contentDiv.appendChild(descDiv);
      
      itemDiv.appendChild(contentDiv);
      
      // Add control element
      if (toggle) {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = `toggle-switch ${toggle.classList.contains('active') ? 'active' : ''}`;
        toggleDiv.dataset.setting = toggle.dataset.setting;
        itemDiv.appendChild(toggleDiv);
      } else if (input) {
        const inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.className = 'settings-input settings-input-small';
        inputEl.dataset.setting = input.dataset.setting;
        inputEl.min = input.min;
        inputEl.max = input.max;
        inputEl.value = input.value;
        itemDiv.appendChild(inputEl);
      } else if (inputGroup) {
        itemDiv.appendChild(inputGroup.cloneNode(true));
      }
      
      searchResultsContainer.appendChild(itemDiv);
    });
    
    // Add event listeners to the cloned toggles
    searchResultsContainer.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const setting = toggle.dataset.setting;
        const isActive = toggle.classList.toggle('active');
        
        // Update settings
        const currentSettings = await loadSettings();
        currentSettings[setting] = isActive;
        await saveSettings(currentSettings);
        
        // Also update the original toggle
        const originalToggle = document.querySelector(`.toggle-switch[data-setting="${setting}"]`);
        if (originalToggle) {
          if (isActive) {
            originalToggle.classList.add('active');
          } else {
            originalToggle.classList.remove('active');
          }
        }
      });
    });
    
    // Add event listeners to the cloned inputs
    searchResultsContainer.querySelectorAll('.settings-input[type="number"]').forEach(input => {
      input.addEventListener('change', async () => {
        const setting = input.dataset.setting;
        let value = parseInt(input.value, 10);
        
        // Validate min/max
        const min = parseInt(input.min, 10) || 0;
        const max = parseInt(input.max, 10) || 9999;
        value = Math.max(min, Math.min(max, value));
        
        // Update input value to valid range
        input.value = value;
        
        // Update settings
        const currentSettings = await loadSettings();
        currentSettings[setting] = value;
        await saveSettings(currentSettings);
        
        // Also update the original input
        const originalInput = document.querySelector(`.settings-input[data-setting="${setting}"]`);
        if (originalInput) {
          originalInput.value = value;
        }
      });
    });
    
    // Add event listeners to the cloned selects
    searchResultsContainer.querySelectorAll('.settings-select').forEach(select => {
      select.addEventListener('change', async () => {
        const setting = select.dataset.setting;
        const value = select.value;
        
        // Update settings
        const currentSettings = await loadSettings();
        currentSettings[setting] = value;
        await saveSettings(currentSettings);
        
        // Also update the original select
        const originalSelect = document.querySelector(`.settings-select[data-setting="${setting}"]`);
        if (originalSelect) {
          originalSelect.value = value;
        }
      });
    });
  }
}

// Calculate relevance score
function calculateRelevance(query, keywords, label, description) {
  let score = 0;
  const q = query.toLowerCase();
  
  // Exact match in label
  if (label.toLowerCase() === q) score += 100;
  // Starts with query in label
  else if (label.toLowerCase().startsWith(q)) score += 50;
  // Contains query in label
  else if (label.toLowerCase().includes(q)) score += 25;
  
  // Match in description
  if (description.toLowerCase().includes(q)) score += 10;
  
  // Match in keywords
  if (keywords.toLowerCase().includes(q)) score += 15;
  
  return score;
}

// Highlight matching text
function highlightText(text, query) {
  if (!query || !text) return text;
  
  // Local fallback escapeHtml function
  const localEscapeHtml = (txt) => {
    if (!txt) return '';
    const div = document.createElement('div');
    div.textContent = txt;
    return div.innerHTML;
  };
  
  // First escape HTML to prevent XSS
  const escapeHtml = window.DOMUtils ? window.DOMUtils.escapeHtml : localEscapeHtml;
  const escapedText = escapeHtml(text);

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return escapedText.replace(regex, '<mark style="background: rgba(73, 230, 11, 0.25); padding: 0 2px; border-radius: 2px;">$1</mark>');
}

// Highlight matching text using DOM (for safer innerHTML-free rendering)
function highlightTextDOM(text, query) {
  if (!query || !text) {
    const span = document.createElement('span');
    span.textContent = text || '';
    return span;
  }
  
  const fragment = document.createDocumentFragment();
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery);
  
  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
    }
    
    // Add highlighted match
    const mark = document.createElement('mark');
    mark.style.background = 'rgba(73, 230, 11, 0.25)';
    mark.style.padding = '0 2px';
    mark.style.borderRadius = '2px';
    mark.textContent = text.slice(index, index + query.length);
    fragment.appendChild(mark);
    
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  
  return fragment;
}

// Escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Debounce function
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSettings);

// Fallback
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSettings();
}
