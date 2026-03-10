/**
 * YouTabs Extension - Settings Manager
 * Centralized class for managing extension settings
 */

class SettingsManager {
  // Default settings
    static defaultSettings = {
    // Theme settings
    theme: 'light', // 'light' or 'dark'
    
    // Display settings
    showFavicon: true,
    showTabTitle: true,
    showAudio: true,
    closeOnSelect: true,
    enablePageSearch: true,
    maxSearchResults: 15,
    // Search panel on page
    showSearchPanel: false,
    // Index expiration settings (default: 3 days)
    indexExpirationDays: 3,
    indexExpirationHours: 0,
    indexExpirationMinutes: 0,
    // Index character limit
    maxIndexChars: 250,
    // Element extraction limits
    maxTextLength: 1000,
    maxParagraphs: 100,
    maxLinks: 100,
    maxImages: 50,
    maxDivs: 50,
    maxLists: 50,
    maxLIs: 100,
    maxFileInputs: 20,
    maxDownloadLinks: 20,
    maxVideos: 20,
    maxAudios: 20,
    maxIframes: 20,
    maxSpans: 100,
    maxTables: 30,
    maxSections: 30,
    maxArticles: 20,
    maxAsides: 15,
    maxNavs: 10,
    maxFooters: 10,
    maxHeaders: 10,
    maxBlockquotes: 50,
    maxCode: 200,
    maxPre: 100,
    maxCites: 30,
    maxAbbr: 30,
    maxTime: 30,
    maxMarks: 50,
    maxButtons: 50,
    maxTextareas: 30,
    maxSelects: 30,
    maxLabels: 50,
    maxFigures: 30,
    maxDetails: 30,
    maxSummaries: 30,
    maxAriaElements: 200,
    maxDataElements: 200,
    maxQueueSize: 50,
    // Performance settings
    indexThrottleMs: 1000,
    maxIndexedPages: 1000,
    lazyLoadGroups: false,
    // Auto-discard settings (default: 5 minutes)
    autoDiscardEnabled: false,
    autoDiscardMinutes: 5,
    // Grouping settings
    enableGrouping: true,
    groupingType: 'custom',
    collapsedGroups: [],
    // Action buttons panel
    enableActionButtonsLeft: false
  };

  constructor() {
    this._settings = null;
    this._cachedSettings = null; // Cache for merged settings
    this._listeners = [];
  }

  /**
   * Get all settings (with defaults merged)
   * @returns {Promise<Object>} Settings object
   */
  async getAll() {
    if (this._cachedSettings !== null) {
      return this._cachedSettings;
    }

    try {
      const stored = await browser.storage.local.get('settings');
      this._settings = stored.settings || {};
      this._cachedSettings = { ...SettingsManager.defaultSettings, ...this._settings };
      return this._cachedSettings;
    } catch (error) {
      console.error('SettingsManager: Error loading settings:', error);
      return { ...SettingsManager.defaultSettings };
    }
  }

  /**
   * Invalidate the settings cache
   * Call this after saving settings to ensure fresh data
   * @private
   */
  _invalidateCache() {
    this._cachedSettings = null;
  }

  /**
   * Get a single setting by key
   * @param {string} key - Setting key
   * @returns {Promise<*>} Setting value
   */
  async get(key) {
    const settings = await this.getAll();
    return settings[key];
  }

  /**
   * Save settings to browser storage
   * @param {Object} settings - Settings object to save
   * @returns {Promise<void>}
   */
  async save(settings) {
    try {
      await browser.storage.local.set({ settings });
      this._settings = settings;
      this._invalidateCache(); // Clear cached merged settings
      this._notifyListeners('save', settings);
    } catch (error) {
      console.error('SettingsManager: Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Update a single setting
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @returns {Promise<Object>} Updated settings
   */
  async update(key, value) {
    const settings = await this.getAll();
    settings[key] = value;
    await this.save(settings);
    return settings;
  }

  /**
   * Update multiple settings at once
   * @param {Object} updates - Object with key-value pairs to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateMany(updates) {
    const settings = await this.getAll();
    Object.assign(settings, updates);
    await this.save(settings);
    return settings;
  }

  /**
   * Reset all settings to defaults
   * @returns {Promise<Object>} Default settings
   */
  async reset() {
    await this.save({ ...SettingsManager.defaultSettings });
    return { ...SettingsManager.defaultSettings };
  }

  /**
   * Check if a setting exists
   * @param {string} key - Setting key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const settings = await this.getAll();
    return key in settings;
  }

  /**
   * Add a listener for settings changes
   * @param {Function} callback - Callback function (eventType, settings)
   */
  addListener(callback) {
    this._listeners.push(callback);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    const index = this._listeners.indexOf(callback);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of changes
   * @param {string} eventType - Type of event
   * @param {Object} settings - Current settings
   * @private
   */
  _notifyListeners(eventType, settings) {
    this._listeners.forEach(callback => {
      try {
        callback(eventType, settings);
      } catch (error) {
        console.error('SettingsManager: Error in listener callback:', error);
      }
    });
  }

  /**
   * Force reload settings from storage
   * @returns {Promise<Object>} Reloaded settings
   */
  async reload() {
    this._settings = null;
    return this.getAll();
  }

  /**
   * Initialize storage change listener
   * This should be called once at startup
   */
  initStorageListener() {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        this._settings = changes.settings.newValue;
        this._notifyListeners('change', this._settings);
      }
    });
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
}

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}
