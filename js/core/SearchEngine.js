/**
 * SearchEngine.js - YouTabs Extension
 * Manages all search functionality: fuzzy matching, tab filtering, page content indexing and search
 * 
 * This module handles:
 * - Fuzzy search with Levenshtein distance
 * - Tab filtering by title, URL, custom names, and group hierarchy
 * - Page content indexing and search via Web Worker
 * - Search result enrichment and ranking
 */

class SearchEngine {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.settings - Settings object with search configuration
   * @param {Function} options.getTabs - Callback to get current tabs
   * @param {Function} options.getCustomTabNames - Callback to get custom tab names
   * @param {Function} options.getGroupHierarchyNames - Callback to get group hierarchy for a tab
   * @param {Function} options.onSearchResults - Callback when search results change
   * @param {Function} options.onError - Callback for errors
   * @param {StateManager} options.stateManager - Optional StateManager instance for centralized state
   */
  constructor(options = {}) {
    this.options = {
      settings: {},
      getTabs: () => [],
      getCustomTabNames: () => ({}),
      getGroupHierarchyNames: () => [],
      onSearchResults: null,
      onError: (error) => console.error('SearchEngine error:', error),
      ...options
    };
    
    // Search state
    this.searchQuery = '';
    this.filteredTabs = [];
    this.headingSearchResults = [];
    
    // Filter state
    this.filterTabs = true;
    this.filterHeadingTypes = ['heading', 'paragraph', 'link', 'image', 'div', 'ul', 'ol', 'li', 'input', 'video', 'audio', 'iframe', 'span', 'table', 'section', 'article', 'aside', 'nav', 'footer', 'header', 'blockquote', 'code', 'pre', 'cite', 'abbr', 'time', 'mark', 'button', 'textarea', 'select', 'label', 'figure', 'details', 'summary', 'meta', 'aria', 'data'];
    this.totalFilterTypes = this.filterHeadingTypes.length;
    this.hasActiveFilter = false;
    
    // Indexed page headings for search
    this.pageHeadings = {}; // { urlKey: [{ id: string, text: string, level: number, url: string }] }
    
    // Mapping from tabId to urlKey for search
    this.tabIdToUrlKey = {}; // { tabId: urlKey }
    
    // Indexing queue and throttling
    this._indexQueue = [];
    this._isIndexing = false;
    this._lastIndexTime = 0;
    
    // Web Worker for search
    this._indexWorker = null;
    this._workerAvailable = false;
    
    // Debounced search
    this._debouncedPerformSearch = this._debounce((query) => this._performSearch(query), 150);
    
    // Search result cache
    this._searchCache = new Map();
    this._cacheMaxSize = 50;
    this._cacheVersion = 0; // Increment to invalidate cache when tabs change
    
    // StateManager integration
    this.stateManager = options.stateManager || null;
    this._syncWithStateManager = options.syncWithStateManager !== false;
    
    // Initialize worker
    this._initWorker();
  }
  
  // ==================== Static Fuzzy Search Helpers ====================
  // Now uses global SearchUtils from search-utils.js (loaded in manifest)

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @param {number} maxDist - Maximum distance for early termination
   * @returns {number} The Levenshtein distance
   */
  static levenshteinDistance(str1, str2, maxDist = Infinity) {
    return window.SearchUtils?.levenshteinDistance(str1, str2, maxDist) ?? 
      SearchEngine._inlineLevenshtein(str1, str2, maxDist);
  }

  /**
   * Inline Levenshtein implementation as fallback
   * @private
   */
  static _inlineLevenshtein(str1, str2, maxDist = Infinity) {
    const m = str1.length;
    const n = str2.length;
    if (Math.abs(m - n) > maxDist) return maxDist + 1;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  /**
   * Perform fuzzy matching between query and text
   * @param {string} query - Search query
   * @param {string} text - Text to search in
   * @param {number} maxDistance - Maximum allowed distance for a match
   * @returns {Object} Match result with match, distance, and score properties
   */
  static fuzzyMatch(query, text, maxDistance = 2) {
    return window.SearchUtils?.fuzzyMatch(query, text, maxDistance) ?? 
      SearchEngine._inlineFuzzyMatch(query, text, maxDistance);
  }

  /**
   * Inline fuzzy match implementation as fallback
   * @private
   */
  static _inlineFuzzyMatch(query, text, maxDistance = 2) {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    if (lowerText.includes(lowerQuery)) return { match: true, distance: 0, score: 1 };
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
    const textWords = lowerText.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length > 0 && textWords.length > 0) {
      let allWordsFound = true;
      let totalWordDistance = 0;
      for (const qWord of queryWords) {
        let minDist = Infinity;
        for (const tWord of textWords) {
          if (tWord === qWord) { minDist = 0; break; }
          if (Math.abs(tWord.length - qWord.length) <= maxDistance) {
            const dist = SearchEngine._inlineLevenshtein(qWord, tWord, maxDistance);
            if (dist < minDist) { minDist = dist; }
            if (minDist === 0) break;
          }
        }
        if (minDist <= maxDistance) { totalWordDistance += minDist; }
        else { allWordsFound = false; break; }
      }
      if (allWordsFound) {
        const avgDistance = totalWordDistance / queryWords.length;
        return { match: true, distance: avgDistance, score: Math.max(0, 1 - avgDistance / (maxDistance + 1)) };
      }
    }
    if (lowerText.length > 0 && lowerQuery.length > 0 && 
        Math.abs(lowerText.length - lowerQuery.length) <= Math.max(lowerQuery.length * 0.5, maxDistance)) {
      const dist = SearchEngine._inlineLevenshtein(lowerQuery, lowerText, maxDistance);
      const maxAllowed = Math.max(maxDistance, Math.floor(lowerQuery.length * 0.4));
      if (dist <= maxAllowed) {
        return { match: true, distance: dist, score: Math.max(0, 1 - dist / (maxAllowed + 1)) };
      }
    }
    return { match: false, distance: Infinity, score: 0 };
  }
  
  // ==================== Debounce Utility ====================
  
  _debounce(func, wait) {
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
  
  // ==================== Web Worker Management ====================
  
  _initWorker() {
    try {
      // Check if we're in a browser extension context
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
        const workerUrl = browser.runtime.getURL('js/indexer-worker.js');
        this._indexWorker = new Worker(workerUrl);
        this._workerAvailable = true;
        
        this._indexWorker.onerror = (error) => {
          console.warn('SearchEngine: Indexer worker error:', error);
          this._workerAvailable = false;
        };
      }
    } catch (error) {
      console.warn('SearchEngine: Failed to initialize worker:', error);
      this._workerAvailable = false;
    }
  }
  
  terminateWorker() {
    if (this._indexWorker) {
      this._indexWorker.terminate();
      this._indexWorker = null;
      this._workerAvailable = false;
    }
  }
  
  /**
   * Set StateManager instance
   * @param {StateManager} manager - StateManager instance
   * @param {boolean} sync - Whether to sync state changes
   */
  setStateManager(manager, sync = true) {
    this.stateManager = manager;
    this._syncWithStateManager = sync;
    
    // Sync current state immediately
    if (sync && manager) {
      this.stateManager.setSearchState({
        query: this.searchQuery,
        filteredTabs: this.filteredTabs,
        headingResults: this.headingSearchResults
      });
    }
  }
  
  // ==================== Public Search API ====================
  
  /**
   * Set the search query and trigger search
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    this._debouncedPerformSearch(query);
  }
  
  /**
   * Get current search query
   * @returns {string} Current search query
   */
  getSearchQuery() {
    return this.searchQuery;
  }
  
  /**
   * Check if there's an active search
   * @returns {boolean} True if searching
   */
  isSearching() {
    return this.searchQuery.length > 0;
  }
  
  /**
   * Get filtered tabs from current search
   * @returns {Array} Filtered tabs
   */
  getFilteredTabs() {
    return this.filteredTabs;
  }
  
  /**
   * Get heading search results
   * @returns {Array} Heading search results
   */
  getHeadingSearchResults() {
    return this.headingSearchResults;
  }
  
  /**
   * Clear the current search
   */
  clearSearch() {
    this.searchQuery = '';
    this.filteredTabs = [];
    this.headingSearchResults = [];
    
    if (this.options.onSearchResults) {
      this.options.onSearchResults({
        query: '',
        filteredTabs: [],
        headingResults: []
      });
    }
    
    // Sync with StateManager if enabled
    if (this._syncWithStateManager && this.stateManager) {
      this.stateManager.clearSearch();
    }
  }
  
  /**
   * Invalidate search cache (call when tabs change)
   */
  invalidateCache() {
    this._cacheVersion++;
    this._searchCache.clear();
  }
  
  /**
   * Get tabs to display based on search state
   * @returns {Array} Tabs to display
   */
  getTabsToDisplay() {
    // If filterTabs is false, return empty array during search
    if (this.searchQuery && !this.filterTabs) {
      return [];
    }
    if (this.searchQuery && this.filteredTabs.length > 0) {
      return this.filteredTabs;
    }
    return this.options.getTabs();
  }
  
  // ==================== Internal Search Implementation ====================
  
  async _performSearch(query) {
    const lowerQuery = query?.toLowerCase() || '';
    this.searchQuery = lowerQuery;
    
    const tabs = this.options.getTabs();
    const tabsVersion = this._cacheVersion;
    
    // Check cache first
    if (lowerQuery && this.filterTabs) {
      const cacheKey = `${lowerQuery}:${tabs.length}:${tabsVersion}`;
      const cached = this._searchCache.get(cacheKey);
      if (cached) {
        this.filteredTabs = cached;
      } else {
        // Apply filter
        this.filteredTabs = this._filterTabsList(tabs, lowerQuery);
        
        // Add to cache
        if (this._searchCache.size >= this._cacheMaxSize) {
          const firstKey = this._searchCache.keys().next().value;
          this._searchCache.delete(firstKey);
        }
        this._searchCache.set(cacheKey, this.filteredTabs);
      }
    } else {
      this.filteredTabs = [];
    }
    
    // Also search page headings if enabled and has heading types selected
    this.headingSearchResults = [];
    if (lowerQuery && this.options.settings.enablePageSearch && this.filterHeadingTypes.length > 0) {
      try {
        this.headingSearchResults = await this.searchHeadings(lowerQuery);
      } catch (error) {
        this.options.onError(error);
      }
    }
    
    // Notify listener
    if (this.options.onSearchResults) {
      this.options.onSearchResults({
        query: lowerQuery,
        filteredTabs: this.filteredTabs,
        headingResults: this.headingSearchResults
      });
    }
    
    // Sync with StateManager if enabled
    if (this._syncWithStateManager && this.stateManager) {
      this.stateManager.setSearchState({
        query: lowerQuery,
        filteredTabs: this.filteredTabs,
        headingResults: this.headingSearchResults
      });
    }
  }
  
  /**
   * Invalidate search cache (call when tabs change)
   */
  invalidateCache() {
    this._cacheVersion++;
    this._searchCache.clear();
  }
  
  _filterTabsList(tabs, query) {
    if (!query) return tabs;
    
    const customTabNames = this.options.getCustomTabNames();
    
    return tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      
      // Get custom tab name for this tab
      const numericTabId = Number(tab.id);
      const customTabName = customTabNames[numericTabId]?.customName?.toLowerCase() || '';
      
      // Get group and subgroup names for this tab
      const groupNames = this.options.getGroupHierarchyNames(tab.id);
      const groupNameSearch = groupNames.join(' ').toLowerCase();
      
      return title.includes(query) || url.includes(query) || customTabName.includes(query) || groupNameSearch.includes(query);
    });
  }
  
  // ==================== Page Headings Search ====================
  
  /**
   * Search page headings (uses Web Worker when available)
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchHeadings(query) {
    if (!query || !this.options.settings.enablePageSearch || this.filterHeadingTypes.length === 0) {
      return [];
    }
    
    // Try to use Web Worker for search if available
    if (this._workerAvailable && this._indexWorker) {
      try {
        const results = await this._searchHeadingsInWorker(query);
        return results;
      } catch (error) {
        console.warn('SearchEngine: Worker search failed, falling back to main thread:', error);
      }
    }
    
    // Fallback to synchronous search on main thread
    return this._searchHeadingsSync(query);
  }
  
  _searchHeadingsInWorker(query) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker search timeout'));
      }, 5000);
      
      const handleMessage = (e) => {
        const { type, results, error } = e.data;
        
        if (type === 'searchCompleted') {
          clearTimeout(timeout);
          this._indexWorker.removeEventListener('message', handleMessage);
          
          // Enrich results with tab info
          const enrichedResults = this._enrichSearchResults(results);
          resolve(enrichedResults);
        } else if (type === 'error') {
          clearTimeout(timeout);
          this._indexWorker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        }
      };
      
      this._indexWorker.addEventListener('message', handleMessage);
      
      // Send search request to worker
      this._indexWorker.postMessage({
        type: 'searchHeadings',
        data: {
          query: query,
          pageHeadings: this.pageHeadings,
          filterHeadingTypes: this.filterHeadingTypes,
          maxResults: this.options.settings.maxSearchResults || 15
        }
      });
    });
  }
  
  _enrichSearchResults(results) {
    const openTabs = this.options.getTabs();
    
    return results.map(result => {
      const pageUrl = result.pageUrl;
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
      
      // Adjust relevance for open tabs
      let relevance = result.relevance;
      if (isTabOpen) {
        relevance += 5;
      }
      
      return {
        ...result,
        tabId: matchingTab ? matchingTab.id : null,
        tab: matchingTab,
        isTabOpen: isTabOpen,
        relevance: relevance
      };
    });
  }
  
  _searchHeadingsSync(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    const maxResults = this.options.settings.maxSearchResults || 15;
    
    // Get list of currently open tabs for URL matching
    const openTabs = this.options.getTabs();
    
    // Search through all indexed headings (including closed tabs)
    for (const [urlKey, headings] of Object.entries(this.pageHeadings)) {
      for (const heading of headings) {
        // Filter by heading type
        if (!this.filterHeadingTypes.includes(heading.type)) {
          continue;
        }
        
        // Use fuzzy matching for search
        const lowerText = heading.text.toLowerCase();
        let fuzzyResult = SearchEngine.fuzzyMatch(lowerQuery, lowerText, 2);
        
        // Also search by name field (for images and other elements with filenames)
        if (!fuzzyResult.match && heading.name) {
          const lowerName = heading.name.toLowerCase();
          fuzzyResult = SearchEngine.fuzzyMatch(lowerQuery, lowerName, 2);
        }
        
        // Also search by fileType field (for images and other elements with file types)
        if (!fuzzyResult.match && heading.fileType) {
          const lowerFileType = heading.fileType.toLowerCase();
          fuzzyResult = SearchEngine.fuzzyMatch(lowerQuery, lowerFileType, 2);
        }
        
        if (fuzzyResult.match) {
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
          
          // Calculate relevance score using fuzzy match results
          let relevance = 0;
          
          if (fuzzyResult.distance === 0) {
            relevance = 100;
          } else if (fuzzyResult.distance <= 1) {
            relevance = 80 + (1 - fuzzyResult.distance) * 10;
          } else {
            relevance = 30 + fuzzyResult.score * 40;
          }
          
          if (heading.type === 'heading') {
            relevance += 20;
          } else if (heading.type === 'paragraph') {
            relevance += 10;
          }
          
          if (isTabOpen) {
            relevance += 5;
          }
          
          results.push({
            tabId: tabId,
            tab: matchingTab,
            isTabOpen: isTabOpen,
            pageUrl: pageUrl,
            heading: heading,
            relevance: relevance,
            fuzzyScore: fuzzyResult.score
          });
        }
      }
    }
    
    // Sort by relevance (descending) and limit results
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, maxResults);
  }
  
  // ==================== Page Indexing ====================
  
  /**
   * Index all tabs for search
   */
  async indexAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      console.log('SearchEngine: Indexing all tabs:', tabs.length);
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
          console.log('SearchEngine: Skipping URL:', tab.url);
        }
      }
      console.log('SearchEngine: Indexing complete for all tabs');
    } catch (error) {
      console.error('SearchEngine: Error indexing all tabs:', error);
    }
  }
  
  /**
   * Clear indexed data for all open tabs
   */
  async clearIndexForAllTabs() {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      console.log('SearchEngine: Clearing index for all tabs:', tabs.length);
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
      console.log('SearchEngine: Cleared index for all tabs');
    } catch (error) {
      console.error('SearchEngine: Error clearing index for all tabs:', error);
    }
  }
  
  /**
   * Index page headings for a specific tab
   * @param {number} tabId - Tab ID to index
   */
  async indexPageHeadings(tabId) {
    console.log('SearchEngine: indexPageHeadings called for tab', tabId);
    
    // Apply throttling based on settings
    const throttleMs = this.options.settings?.indexThrottleMs || 1000;
    const now = Date.now();
    if (now - this._lastIndexTime < throttleMs) {
      console.log('SearchEngine: Throttled, waiting', throttleMs - (now - this._lastIndexTime), 'ms');
      this._indexQueue.push({ tabId, timestamp: now + throttleMs });
      return;
    }
    this._lastIndexTime = now;
    
    try {
      const tab = await browser.tabs.get(tabId);
      console.log('SearchEngine: Got tab', tab?.url);
      if (!tab || !tab.url) {
        console.log('SearchEngine: No tab or url');
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
        console.log('SearchEngine: Skipping unsupported URL:', tab.url);
        return;
      }
      
      // Check if page URL is already indexed and doesn't need re-indexing
      const shouldIndex = await this.shouldReindexPageByUrl(tab.url);
      console.log('SearchEngine: shouldIndex =', shouldIndex);
      
      if (!shouldIndex) {
        console.log('SearchEngine: Skipping, already indexed');
        return;
      }
      
      // Try to extract headings via content script
      let headings = null;
      const contentScriptHeadings = await this.extractHeadingsViaContentScript(tabId);
      
      if (contentScriptHeadings && contentScriptHeadings.length > 0) {
        console.log('SearchEngine: Got headings via content script:', contentScriptHeadings.length);
        headings = contentScriptHeadings;
      } else {
        // Fallback to executeScript
        const maxChars = this.options.settings?.maxIndexChars || 250;
        console.log('SearchEngine: Trying executeScript');
        try {
          const results = await browser.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: this._extractHeadingsForScript,
            args: [this.options.settings]
          });
          if (results && results[0] && results[0].result) {
            headings = results[0].result;
          }
        } catch (scriptError) {
          console.error('SearchEngine: scripting.executeScript error:', scriptError.message);
        }
      }
      
      if (headings && headings.length > 0) {
        // Filter out duplicates before storing
        headings = this.filterDuplicateHeadings(headings);
        console.log('SearchEngine: After filter', headings.length, 'headings');
        
        // Store by URL instead of tabId
        const urlKey = this.getUrlKey(tab.url);
        this.pageHeadings[urlKey] = headings;
        await window.YouTabsDB.savePageHeadingsByUrl(tab.url, tabId, headings);
        console.log('SearchEngine: Saved for', urlKey, 'with', headings.length, 'headings');
      } else {
        console.log('SearchEngine: No results for', tab.url);
      }
    } catch (error) {
      console.error('SearchEngine: Error for', tab?.url, error.message);
    }
    
    // Process queued indexing operations
    this._processIndexQueue();
  }
  
  /**
   * Extract headings via content script message
   * @param {number} tabId - Tab ID
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Array|null>} Extracted headings
   */
  async extractHeadingsViaContentScript(tabId, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await browser.tabs.sendMessage(tabId, { action: 'extractHeadings' });
        if (response && response.headings && response.headings.length > 0) {
          console.log('SearchEngine: extractHeadingsViaContentScript got', response.headings.length, 'headings on attempt', attempt + 1);
          return response.headings;
        }
        if (attempt < maxRetries) {
          console.log('SearchEngine: extractHeadingsViaContentScript no results, retrying...');
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        console.log('SearchEngine: extractHeadingsViaContentScript attempt', attempt + 1, 'failed:', error.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    console.log('SearchEngine: extractHeadingsViaContentScript all attempts failed');
    return null;
  }
  
  /**
   * Get headings for a specific tab by tabId
   * @param {number} tabId - Tab ID
   * @returns {Array|null} Headings for the tab
   */
  getHeadingsForTab(tabId) {
    const numericTabId = Number(tabId);
    const tabs = this.options.getTabs();
    const tab = tabs.find(t => t.id === numericTabId);
    if (!tab) {
      return null;
    }
    
    const urlKey = this.getUrlKey(tab.url);
    return this.pageHeadings[urlKey] || null;
  }
  
  /**
   * Filter out duplicate headings
   * @param {Array} headings - Headings to filter
   * @returns {Array} Filtered headings
   */
  filterDuplicateHeadings(headings) {
    const seen = new Map();
    const uniqueHeadings = [];
    
    for (const heading of headings) {
      let key;
      
      if (heading.type === 'image') {
        key = `image:${heading.text || ''}:${heading.imgUrl || ''}`;
      } else if (heading.type === 'video' || heading.type === 'videoEmbed') {
        key = `${heading.type}:${heading.text || ''}:${heading.videoUrl || ''}`;
      } else if (heading.type === 'audio') {
        key = `audio:${heading.text || ''}:${heading.audioUrl || ''}`;
      } else {
        key = `${heading.type || ''}:${heading.text || ''}:${heading.url || ''}`;
      }
      
      if (!seen.has(key)) {
        seen.set(key, true);
        uniqueHeadings.push(heading);
      }
    }
    
    return uniqueHeadings;
  }
  
  /**
   * Get a URL key for indexing (normalizes the URL)
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL key
   */
  getUrlKey(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    } catch (e) {
      console.log('SearchEngine: getUrlKey failed to parse URL:', url, e);
      return url;
    }
  }
  
  /**
   * Check if a page should be re-indexed
   * @param {string} url - Page URL
   * @returns {Promise<boolean>} True if should reindex
   */
  async shouldReindexPageByUrl(url) {
    try {
      const urlKey = this.getUrlKey(url);
      console.log('SearchEngine: shouldReindexPageByUrl checking URL:', urlKey);
      
      if (!window.YouTabsDB || !window.YouTabsDB.isIndexedDBAvailable()) {
        console.log('SearchEngine: shouldReindexPageByUrl no DB, should index');
        return true;
      }
      
      await window.YouTabsDB.openDatabase();
      
      const pageIndexWithTimestamp = await window.YouTabsDB.getPagesIndexByUrl(urlKey);
      console.log('SearchEngine: shouldReindexPageByUrl result:', pageIndexWithTimestamp);
      
      if (!pageIndexWithTimestamp || !pageIndexWithTimestamp.indexedAt) {
        console.log('SearchEngine: shouldReindexPageByUrl not indexed, should index');
        return true;
      }
      
      const now = Date.now();
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      const timeSinceIndex = now - pageIndexWithTimestamp.indexedAt;
      
      if (pageIndexWithTimestamp.lastIncrementalUpdate) {
        const timeSinceIncremental = now - pageIndexWithTimestamp.lastIncrementalUpdate;
        if (timeSinceIncremental < FIVE_MINUTES_MS) {
          console.log('SearchEngine: shouldReindexPageByUrl incremental update recently, skip');
          return false;
        }
      }
      
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;
      
      if (timeSinceIndex >= THIRTY_MINUTES_MS) {
        console.log('SearchEngine: shouldReindexPageByUrl expired, should re-index');
        return true;
      }
      
      console.log('SearchEngine: shouldReindexPageByUrl indexed recently, skip');
      return false;
    } catch (error) {
      console.error('SearchEngine: shouldReindexPageByUrl error:', error);
      return true;
    }
  }
  
  async _processIndexQueue() {
    if (this._isIndexing || this._indexQueue.length === 0) {
      return;
    }
    
    const maxQueueSize = this.options.settings?.maxQueueSize || 50;
    if (this._indexQueue.length > maxQueueSize) {
      console.warn('SearchEngine: Queue too large, trimming from', this._indexQueue.length);
      this._indexQueue = this._indexQueue.slice(-maxQueueSize);
    }
    
    this._isIndexing = true;
    const throttleMs = this.options.settings?.indexThrottleMs || 1000;
    
    try {
      while (this._indexQueue.length > 0) {
        const now = Date.now();
        const nextItem = this._indexQueue[0];
        
        if (nextItem.timestamp <= now) {
          this._indexQueue.shift();
          this._lastIndexTime = Date.now();
          
          try {
            await this._indexSinglePage(nextItem.tabId);
          } catch (e) {
            console.error('SearchEngine: Error indexing tab', nextItem.tabId, e.message);
          }
          
          await new Promise(resolve => setTimeout(resolve, throttleMs));
        } else {
          await new Promise(resolve => setTimeout(resolve, Math.min(nextItem.timestamp - now, throttleMs)));
        }
      }
    } finally {
      this._isIndexing = false;
    }
  }
  
  async _indexSinglePage(tabId) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab || !tab.url) return;
      
      if (tab.url.startsWith('about:') || 
          tab.url.startsWith('chrome:') ||
          tab.url.startsWith('moz-extension:') ||
          tab.url.startsWith('file:') ||
          tab.url.startsWith('javascript:') ||
          tab.url.startsWith('data:') ||
          tab.url.startsWith('blob:')) {
        return;
      }
      
      const shouldIndex = await this.shouldReindexPageByUrl(tab.url);
      if (!shouldIndex) return;
      
      let headings = null;
      const contentScriptHeadings = await this.extractHeadingsViaContentScript(tabId);
      
      if (contentScriptHeadings && contentScriptHeadings.length > 0) {
        headings = contentScriptHeadings;
      } else {
        const maxChars = this.options.settings?.maxIndexChars || 250;
        try {
          const results = await browser.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: this._extractHeadingsForScript,
            args: [this.options.settings]
          });
          if (results && results[0] && results[0].result) {
            headings = results[0].result;
          }
        } catch (scriptError) {
          console.error('SearchEngine: scripting error:', scriptError.message);
        }
      }
      
      if (headings && headings.length > 0) {
        headings = this.filterDuplicateHeadings(headings);
        const urlKey = this.getUrlKey(tab.url);
        this.pageHeadings[urlKey] = headings;
        await window.YouTabsDB.savePageHeadingsByUrl(tab.url, tabId, headings);
      }
    } catch (error) {
      console.error('SearchEngine: Error for tab', tabId, error.message);
    }
  }
  
  /**
   * Save page headings to IndexedDB
   */
  async savePageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.savePagesIndex(this.pageHeadings);
      }
    } catch (error) {
      console.error('SearchEngine: Error saving page headings:', error);
    }
  }
  
  /**
   * Load page headings from IndexedDB
   */
  async loadPageHeadings() {
    try {
      if (window.YouTabsDB && window.YouTabsDB.isIndexedDBAvailable()) {
        await window.YouTabsDB.openDatabase();
        
        const pagesIndex = await window.YouTabsDB.getPagesIndexWithTimestamp();
        
        this.pageHeadings = {};
        for (const [urlKey, data] of Object.entries(pagesIndex)) {
          if (data.headings && data.headings.length > 0) {
            this.pageHeadings[urlKey] = this.filterDuplicateHeadings(data.headings);
          }
        }
        
        this.tabIdToUrlKey = {};
      }
    } catch (error) {
      console.error('SearchEngine: Error loading page headings:', error);
    }
  }
  
  /**
   * Internal function for executeScript - extracts headings from page
   * @param {Object} settings - Settings object
   * @returns {Array} Extracted headings
   * @private
   */
  _extractHeadingsForScript(settings) {
    // This function runs in the page context via executeScript
    // It should match the extractHeadings function in content-extractor.js
    if (typeof ContentExtractor !== 'undefined') {
      return ContentExtractor.extract(settings);
    }
    return [];
  }
  
  // ==================== Filter Management ====================
  
  /**
   * Apply search filter options
   * @param {Object} filterOptions - Filter options
   * @param {boolean} filterOptions.filterTabs - Whether to filter tabs
   * @param {Array} filterOptions.filterHeadingTypes - Types of headings to include
   */
  applyFilter(filterOptions) {
    if (filterOptions.filterTabs !== undefined) {
      this.filterTabs = filterOptions.filterTabs;
    }
    if (filterOptions.filterHeadingTypes !== undefined) {
      this.filterHeadingTypes = filterOptions.filterHeadingTypes;
    }
    
    this.hasActiveFilter = !this.filterTabs || this.filterHeadingTypes.length < this.totalFilterTypes;
    
    // Re-run search if there's an active search query
    if (this.searchQuery) {
      this.setSearchQuery(this.searchQuery);
    }
  }
  
  /**
   * Get current filter state
   * @returns {Object} Filter state
   */
  getFilterState() {
    return {
      filterTabs: this.filterTabs,
      filterHeadingTypes: this.filterHeadingTypes,
      hasActiveFilter: this.hasActiveFilter
    };
  }
  
  /**
   * Reset filter to default values
   */
  resetFilter() {
    this.filterTabs = true;
    this.filterHeadingTypes = ['heading', 'paragraph', 'link', 'image', 'div', 'ul', 'ol', 'li', 'input', 'video', 'audio', 'iframe', 'span', 'table', 'section', 'article', 'aside', 'nav', 'footer', 'header', 'blockquote', 'code', 'pre', 'cite', 'abbr', 'time', 'mark', 'button', 'textarea', 'select', 'label', 'figure', 'details', 'summary', 'meta', 'aria', 'data'];
    this.hasActiveFilter = false;
    
    if (this.searchQuery) {
      this.setSearchQuery(this.searchQuery);
    }
  }
  
  /**
   * Update settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.options.settings = { ...this.options.settings, ...settings };
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this.terminateWorker();
    this.clearSearch();
    this._indexQueue = [];
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchEngine;
}