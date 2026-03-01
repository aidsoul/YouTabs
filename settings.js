/**
 * YouTabs Extension - Settings Script
 * Handles settings page interactions
 */

// Default settings
const defaultSettings = {
  showFavicon: true,
  showAudio: true,
  closeOnSelect: true,
  enablePageSearch: true,
  maxSearchResults: 15,
  // Index expiration settings (default: 3 days)
  indexExpirationDays: 3,
  indexExpirationHours: 0,
  indexExpirationMinutes: 0,
  // Index character limit
  maxIndexChars: 250,
  // Grouping settings
  enableGrouping: true,
  groupingType: 'custom', // 'domain', 'color', 'time', 'custom'
  collapsedGroups: [] // Array of collapsed group keys
};

// Load settings
async function loadSettings() {
  try {
    const stored = await browser.storage.local.get('settings');
    return { ...defaultSettings, ...stored.settings };
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    await browser.storage.local.set({ settings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Initialize settings page
async function initSettings() {
  const settings = await loadSettings();
  
  // Apply settings to toggles and selects - use single lookup per key
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
  
  // Update grouping type visibility based on enableGrouping
  updateGroupingTypeState(settings.enableGrouping);
  
  // Add click handlers to toggles
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      const setting = toggle.dataset.setting;
      const isActive = toggle.classList.toggle('active');
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = isActive;
      await saveSettings(currentSettings);
      
      // If enableGrouping changed, update grouping type state
      if (setting === 'enableGrouping') {
        updateGroupingTypeState(isActive);
      }
    });
  });
  
  // Add change handlers to select elements
  document.querySelectorAll('.grouping-select').forEach(select => {
    select.addEventListener('change', async () => {
      const setting = select.dataset.setting;
      const value = select.value;
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = value;
      await saveSettings(currentSettings);
    });
  });
  
  // Add change handlers to number inputs
  document.querySelectorAll('.max-results-input').forEach(input => {
    input.addEventListener('change', async () => {
      const setting = input.dataset.setting;
      let value = parseInt(input.value, 10);
      
      // Validate min/max
      const min = parseInt(input.min, 10) || 5;
      const max = parseInt(input.max, 10) || 50;
      value = Math.max(min, Math.min(max, value));
      
      // Update input value to valid range
      input.value = value;
      
      // Update settings
      const currentSettings = await loadSettings();
      currentSettings[setting] = value;
      await saveSettings(currentSettings);
    });
  });
  
  // Add change handlers to index settings inputs
  document.querySelectorAll('.index-setting-input').forEach(input => {
    input.addEventListener('change', async () => {
      const setting = input.dataset.setting;
      let value = parseInt(input.value, 10);
      
      // Validate min/max based on setting type
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
}

// Update grouping type select state based on enableGrouping
function updateGroupingTypeState(enabled) {
  const groupingTypeItem = document.getElementById('groupingTypeItem');
  const groupingTypeSelect = document.getElementById('groupingType');
  
  if (groupingTypeItem && groupingTypeSelect) {
    if (enabled) {
      groupingTypeItem.classList.remove('disabled');
      groupingTypeSelect.removeAttribute('disabled');
    } else {
      groupingTypeItem.classList.add('disabled');
      groupingTypeSelect.setAttribute('disabled', 'disabled');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSettings);

// Fallback
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSettings();
}
