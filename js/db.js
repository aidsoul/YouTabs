/**
 * IndexedDB Utility Module for YouTabs Extension
 * Handles persistent storage of customGroups and groupTabMetadata
 * 
 * Performance optimizations implemented:
 * - LRU Cache for frequently accessed data
 * - Composite indexes for searchHistory
 * - Batch processing with setTimeout
 * - Cursor-based range deletions
 * - Data compression for large arrays
 * - Versioned migrations
 */

const DB_NAME = 'YouTabsDB';
const DB_VERSION = 9; // Incremented for new composite index
const STORE_CUSTOM_GROUPS = 'customGroups';
const STORE_GROUP_TAB_METADATA = 'groupTabMetadata';
const STORE_PAGES_INDEX = 'pagesIndex';
const STORE_SEARCH_HISTORY = 'searchHistory';
const STORE_PAGE_TAGS = 'pageTags';

// ==================== LRU Cache Implementation ====================

/**
 * LRU Cache class for caching frequently read data in memory
 * @template T
 */
class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of items to cache
   */
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {T|undefined}
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    this.hits++;
    return value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {T} value - Value to cache
   */
  set(key, value) {
    // Delete if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add to end (most recently used)
    this.cache.set(key, value);
    
    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * @returns {{size: number, hits: number, misses: number, hitRate: number}}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }
}

// Global LRU cache instances for frequently accessed data
const customGroupsCache = new LRUCache(10);
const groupTabMetadataCache = new LRUCache(5);
const pagesIndexCache = new LRUCache(20);

// ==================== Compression Utilities ====================

/**
 * Compress data using LZ-string compression
 * Recommended for large arrays like headings
 * @param {any} data - Data to compress
 * @returns {string} - Base64 encoded compressed string
 */
function compress(data) {
  try {
    const jsonString = JSON.stringify(data);
    // Use simple compression if LZ-string is not available
    if (typeof LZString !== 'undefined') {
      return LZString.compressToBase64(jsonString);
    }
    // Fallback: use btoa with UTF-8 handling
    return btoa(encodeURIComponent(jsonString));
  } catch (error) {
    console.error('Compression failed:', error);
    return null;
  }
}

/**
 * Decompress data
 * @param {string} compressedData - Base64 encoded compressed string
 * @returns {any} - Decompressed data
 */
function decompress(compressedData) {
  try {
    if (!compressedData) return null;
    
    let jsonString;
    if (typeof LZString !== 'undefined') {
      jsonString = LZString.decompressFromBase64(compressedData);
    } else {
      // Fallback: use atob with UTF-8 handling
      jsonString = decodeURIComponent(atob(compressedData));
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decompression failed:', error);
    return null;
  }
}

/**
 * Check if data should be compressed based on size
 * @param {any} data - Data to check
 * @param {number} threshold - Size threshold in bytes (default: 10000)
 * @returns {boolean}
 */
function shouldCompress(data, threshold = 10000) {
  try {
    const size = new Blob([JSON.stringify(data)]).size;
    return size > threshold;
  } catch {
    return false;
  }
}

// ==================== Versioned Migrations ====================

/**
 * Database migration definitions
 * Each migration runs only once when upgrading from the previous version
 */
const migrations = {
  // Migration from version 8 to 9: Add composite index for searchHistory
  9: async (db) => {
    console.log('IndexedDB: Running migration to version 9 - Adding composite index');
    
    if (db.objectStoreNames.contains(STORE_SEARCH_HISTORY)) {
      const store = db.transaction(STORE_SEARCH_HISTORY, 'versionchange').objectStore(STORE_SEARCH_HISTORY);
      
      // Create composite index on ['query', 'timestamp'] for efficient history searches
      // This allows fast queries like "find all searches for 'foo' sorted by time"
      if (!store.indexNames.contains('queryTimestamp')) {
        store.createIndex('queryTimestamp', ['query', 'timestamp'], { unique: false });
      }
    }
    
    console.log('IndexedDB: Migration to version 9 complete');
  }
};

/**
 * Run all pending migrations
 * @param {IDBDatabase} db - The database instance
 * @param {number} oldVersion - Current database version
 */
async function runMigrations(db, oldVersion) {
  for (let version = oldVersion + 1; version <= DB_VERSION; version++) {
    if (migrations[version]) {
      try {
        await migrations[version](db);
      } catch (error) {
        console.error(`IndexedDB: Migration ${version} failed:`, error);
        throw error;
      }
    }
  }
}

// Database instance
let dbInstance = null;

/**
 * Open or create the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB: Failed to open database', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('IndexedDB: Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = async (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      console.log('IndexedDB: Upgrading database from version', oldVersion, 'to', event.newVersion);
      
      // Run migrations for intermediate versions
      await runMigrations(db, oldVersion);
      
      // Create customGroups store
      if (!db.objectStoreNames.contains(STORE_CUSTOM_GROUPS)) {
        const customGroupsStore = db.createObjectStore(STORE_CUSTOM_GROUPS, { keyPath: 'id' });
        // Add indexes for frequently queried fields
        customGroupsStore.createIndex('name', 'name', { unique: false });
        customGroupsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Create groupTabMetadata store
      if (!db.objectStoreNames.contains(STORE_GROUP_TAB_METADATA)) {
        // Using a single key 'metadata' since it's a single object
        db.createObjectStore(STORE_GROUP_TAB_METADATA, { keyPath: 'id' });
      }
      
      // Recreate pagesIndex store with url as keyPath (old tabId-based data is not migrated)
      if (db.objectStoreNames.contains(STORE_PAGES_INDEX)) {
        db.deleteObjectStore(STORE_PAGES_INDEX);
      }
      const pagesIndexStore = db.createObjectStore(STORE_PAGES_INDEX, { keyPath: 'url' });
      // Add secondary index on indexedAt for efficient expiration cleanup
      pagesIndexStore.createIndex('indexedAt', 'indexedAt', { unique: false });

      // Create searchHistory store
      if (!db.objectStoreNames.contains(STORE_SEARCH_HISTORY)) {
        const searchHistoryStore = db.createObjectStore(STORE_SEARCH_HISTORY, { keyPath: 'id', autoIncrement: true });
        // Add indexes for querying
        searchHistoryStore.createIndex('query', 'query', { unique: false });
        searchHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
        // Composite index for efficient combined query + time-based searches
        searchHistoryStore.createIndex('queryTimestamp', ['query', 'timestamp'], { unique: false });
      }
      
      // Create pageTags store for storing tags associated with pages/URLs
      if (!db.objectStoreNames.contains(STORE_PAGE_TAGS)) {
        const pageTagsStore = db.createObjectStore(STORE_PAGE_TAGS, { keyPath: 'url' });
        // Add index on tags for efficient tag-based searching
        pageTagsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
    };
  });
}

/**
 * Get customGroups from IndexedDB (with LRU cache)
 * @returns {Promise<Array>}
 */
async function getCustomGroups() {
  // Check cache first
  const cached = customGroupsCache.get('all');
  if (cached !== undefined) {
    return cached;
  }
  
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CUSTOM_GROUPS], 'readonly');
    const store = transaction.objectStore(STORE_CUSTOM_GROUPS);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = request.result || [];
      // Store in cache
      customGroupsCache.set('all', result);
      resolve(result);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get customGroups', request.error);
      reject(request.error);
    };
  });
}

/**
 * Save customGroups to IndexedDB
 * @param {Array} customGroups - Array of custom group objects
 */
async function saveCustomGroups(customGroups) {
  // Invalidate cache on save
  customGroupsCache.delete('all');
  
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CUSTOM_GROUPS], 'readwrite');
    const store = transaction.objectStore(STORE_CUSTOM_GROUPS);
    
    // Use put for all items in a single transaction (more efficient than clear + add)
    for (const group of customGroups) {
      store.put(group);
    }

    transaction.oncomplete = () => {
      // Update cache after successful save
      customGroupsCache.set('all', customGroups);
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save customGroups', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get groupTabMetadata from IndexedDB (with LRU cache)
 * @returns {Promise<Object>}
 */
async function getGroupTabMetadata() {
  // Check cache first
  const cached = groupTabMetadataCache.get('metadata');
  if (cached !== undefined) {
    return cached;
  }
  
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_GROUP_TAB_METADATA], 'readonly');
    const store = transaction.objectStore(STORE_GROUP_TAB_METADATA);
    const request = store.get('metadata');

    request.onsuccess = () => {
      const result = request.result ? request.result.data : {};
      // Store in cache
      groupTabMetadataCache.set('metadata', result);
      resolve(result);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get groupTabMetadata', request.error);
      reject(request.error);
    };
  });
}

/**
 * Save groupTabMetadata to IndexedDB
 * @param {Object} metadata - Group tab metadata object
 */
async function saveGroupTabMetadata(metadata) {
  // Invalidate cache on save
  groupTabMetadataCache.delete('metadata');
  
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_GROUP_TAB_METADATA], 'readwrite');
    const store = transaction.objectStore(STORE_GROUP_TAB_METADATA);
    
    // Store with a fixed key 'metadata'
    store.put({ id: 'metadata', data: metadata });

    transaction.oncomplete = () => {
      // Update cache after successful save
      groupTabMetadataCache.set('metadata', metadata);
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save groupTabMetadata', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get pagesIndex from IndexedDB
 * @returns {Promise<Object>} - Returns object with url as keys and headings array as values
 */
async function getPagesIndex() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readonly');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      const pageIndex = {};
      for (const item of results) {
        // Use url as key (matching the keyPath in the store)
        pageIndex[item.url] = item.headings;
      }
      resolve(pageIndex);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get pageIndex', request.error);
      reject(request.error);
    };
  });
}

/**
 * Save pagesIndex to IndexedDB with batch processing
 * Uses setTimeout to prevent UI blocking
 * @param {Object} pagesIndex - Object with urlKey as keys and headings array as values
 * @param {boolean} compressLarge - If true, compresses large heading arrays
 */
async function savePagesIndex(pagesIndex, compressLarge = false) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    
    // Clear existing data
    store.clear();
    
    const timestamp = Date.now();
    const entries = Object.entries(pagesIndex);
    const BATCH_SIZE = 50; // Process in batches to prevent UI blocking
    let batchIndex = 0;
    
    // Invalidate cache
    pagesIndexCache.clear();
    
    function processBatch() {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, entries.length);
      
      for (let i = start; i < end; i++) {
        const [urlKey, headings] = entries[i];
        
        // Optional: compress large heading arrays
        let dataToStore = headings;
        if (compressLarge && shouldCompress(headings)) {
          dataToStore = compress(headings);
        }
        
        store.put({ url: urlKey, headings: dataToStore, indexedAt: timestamp });
      }
      
      batchIndex++;
      
      // Schedule next batch with setTimeout to yield to UI
      if (batchIndex * BATCH_SIZE < entries.length) {
        setTimeout(processBatch, 0);
      }
    }
    
    // Start processing
    if (entries.length > 0) {
      processBatch();
    }

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save pageIndex', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Delete a tab's pagesIndex entry
 * @param {number} tabId - The tab ID to delete
 */
async function deletePagesIndex(tabId) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    store.delete(tabId);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to delete pageIndex', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Delete a single pagesIndex entry by URL key (for scheduled deletion)
 * @param {string} urlKey - The URL key to delete
 */
async function deletePagesIndexByUrl(urlKey) {
  const db = await openDatabase();
  
  // Use the URL key directly - it's already normalized when saved
  // Just ensure it's not empty
  if (!urlKey || typeof urlKey !== 'string') {
    console.error('Invalid URL key for deletion:', urlKey);
    return Promise.reject(new Error('Invalid URL key'));
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    store.delete(urlKey);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to delete pageIndex by URL', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get pagesIndex with timestamps from IndexedDB
 * @returns {Promise<Object>} - Returns object with url as keys and {headings, indexedAt} as values
 */
async function getPagesIndexWithTimestamp() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readonly');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      const pageIndex = {};
      for (const item of results) {
        pageIndex[item.url] = { headings: item.headings, indexedAt: item.indexedAt, lastIncrementalUpdate: item.lastIncrementalUpdate };
      }
      resolve(pageIndex);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get pageIndex with timestamp', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all pages (tabId -> url mapping)
 * @returns {Promise<Object>} - Returns object with tabId as keys and {url, urlKey} as values
 */
async function getAllPages() {
  // pages table removed - return empty object
  return {};
}

/**
 * Get pagesIndex by URL from IndexedDB
 * @param {string} urlKey - The normalized URL key
 * @returns {Promise<Object|null>} - Returns {headings, indexedAt, lastIncrementalUpdate} or null if not found
 */
async function getPagesIndexByUrl(urlKey) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readonly');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    const request = store.get(urlKey);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve({ 
          headings: result.headings, 
          indexedAt: result.indexedAt,
          lastIncrementalUpdate: result.lastIncrementalUpdate || null
        });
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get pageIndex by URL', request.error);
      reject(request.error);
    };
  });
}

/**
 * Save page URL to pages store (deprecated - pages table removed)
 * @param {number} tabId - The tab ID
 * @param {string} url - The page URL
 */
async function savePage(tabId, url) {
  // pages table removed - no-op
  return;
}

/**
 * Get page URL by tabId (deprecated - pages table removed)
 * @param {number} tabId - The tab ID
 * @returns {Promise<Object|null>} - Returns {url, urlKey} or null if not found
 */
async function getPage(tabId) {
  // pages table removed - return null
  return null;
}

/**
 * Get page by normalized URL key (deprecated - pages table removed)
 * @param {string} urlKey - The normalized URL key
 * @returns {Promise<Object|null>} - Returns {tabId, url, urlKey} or null if not found
 */
async function getPageByUrlKey(urlKey) {
  // pages table removed - return null
  return null;
}

/**
 * Delete page by tabId (deprecated - pages table removed)
 * @param {number} tabId - The tab ID to delete
 */
async function deletePage(tabId) {
  // pages table removed - no-op
  return;
}

/**
 * Save page headings by URL to IndexedDB
 * Optimized: uses single transaction with get() + put() in same transaction
 * @param {string} url - The page URL
 * @param {number} tabId - The tab ID
 * @param {Array} headings - Array of headings to store
 * @param {boolean} isIncremental - If true, preserves existing indexedAt timestamp
 */
async function savePageHeadingsByUrl(url, tabId, headings, isIncremental = false) {
  const db = await openDatabase();
  
  // Normalize URL to create a consistent key
  let urlKey = url;
  try {
    const urlObj = new URL(url);
    urlKey = urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
  } catch (e) {
    // Use original URL if parsing fails
  }
  
  const timestamp = Date.now();
  
  return new Promise((resolve, reject) => {
    // Use single transaction for both get and put operations
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    
    // First, get existing data within the same transaction
    const getRequest = store.get(urlKey);
    
    getRequest.onsuccess = () => {
      let existingIndexedAt;
      
      if (isIncremental && getRequest.result) {
        // Preserve existing indexedAt timestamp for incremental updates
        existingIndexedAt = getRequest.result.indexedAt || timestamp;
      } else {
        existingIndexedAt = timestamp;
      }
      
      // Now put the new data within the same transaction
      const record = { 
        url: urlKey, 
        headings: headings, 
        indexedAt: existingIndexedAt
      };
      
      if (isIncremental) {
        record.lastIncrementalUpdate = timestamp;
      }
      
      store.put(record);
      
      // Invalidate cache
      pagesIndexCache.delete(urlKey);
    };
    
    getRequest.onerror = () => {
      // If get fails, try to put anyway with new timestamp
      store.put({ url: urlKey, headings: headings, indexedAt: timestamp });
    };
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save page headings', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get URL for a tab from the pages table (deprecated - pages table removed)
 * @param {number} tabId - The tab ID
 * @returns {Promise<Object|null>} - Returns {url, urlKey} or null if not found
 */
async function getUrlForTab(tabId) {
  // pages table removed - return null
  return null;
}

/**
 * Delete page by tabId (deprecated - pages table removed)
 * @param {number} tabId - The tab ID to delete
 */
async function deleteTabUrlMapping(tabId) {
  // pages table removed - no-op
  return;
}

/**
 * Delete a single pagesIndex entry by URL key (for scheduled deletion)
 * @param {string} urlKey - The URL key to delete
 */
async function deletePagesIndexByTabId(urlKey) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    store.delete(urlKey);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to delete pageIndex by urlKey', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Clean up expired pagesIndex entries based on expiration time
 * @param {number} expirationMs - Expiration time in milliseconds (default: 3 days = 259200000 ms)
 */
async function cleanupExpiredPagesIndex(expirationMs = 259200000) {
  try {
    const db = await openDatabase();
    const now = Date.now();
    const expirationThreshold = now - expirationMs;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
      const store = transaction.objectStore(STORE_PAGES_INDEX);
      
      // Use the indexedAt index to efficiently query records up to expiration threshold
      const index = store.index('indexedAt');
      const range = IDBKeyRange.upperBound(expirationThreshold);
      const request = index.openCursor(range);
      
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Delete the expired record
          cursor.delete();
          deletedCount++;
          console.log(`IndexedDB: Cleaned up expired pagesIndex for ${cursor.value.url}`);
          // Continue to next record
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => {
        console.log(`IndexedDB: Cleanup complete. Deleted ${deletedCount} expired entries.`);
        resolve(deletedCount);
      };
      
      transaction.onerror = () => {
        console.error('IndexedDB: Error during cleanup', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB: Error cleaning up expired pagesIndex', error);
  }
}

/**
 * Clean up oldest pagesIndex entries when exceeding max limit
 * Uses cursor-based deletion for efficiency
 * @param {number} maxPages - Maximum number of pages to keep (default: 1000)
 * @returns {Promise<number>} - Returns number of deleted entries
 */
async function cleanupMaxPages(maxPages = 1000) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
      const store = transaction.objectStore(STORE_PAGES_INDEX);
      
      // First, get total count
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        const totalCount = countRequest.result;
        
        if (totalCount <= maxPages) {
          console.log(`IndexedDB: ${totalCount} pages, within limit of ${maxPages}`);
          resolve(0);
          return;
        }
        
        // Use cursor to delete oldest entries efficiently
        const index = store.index('indexedAt');
        const request = index.openCursor(null, 'next');
        
        let deleted = 0;
        const deleteCount = totalCount - maxPages;
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
        
        transaction.oncomplete = () => {
          console.log(`IndexedDB: Cleanup complete. Deleted ${deleted} oldest entries.`);
          resolve(deleted);
        };
        
        transaction.onerror = () => {
          console.error('IndexedDB: Error during max pages cleanup', transaction.error);
          reject(transaction.error);
        };
      };
      
      countRequest.onerror = () => reject(countRequest.error);
    });
  } catch (error) {
    console.error('IndexedDB: Error cleaning up max pages', error);
    return 0;
  }
}

/**
 * Efficiently delete old search history entries using cursor and IDBKeyRange
 * @param {number} olderThan - Timestamp threshold for deletion
 * @returns {Promise<number>} - Number of deleted entries
 */
async function deleteOldSearchHistory(olderThan) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SEARCH_HISTORY], 'readwrite');
    const store = transaction.objectStore(STORE_SEARCH_HISTORY);
    const index = store.index('timestamp');
    
    // Use IDBKeyRange for efficient range query
    const range = IDBKeyRange.upperBound(olderThan);
    const request = index.openCursor(range);
    
    let deleted = 0;
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => {
      console.log(`IndexedDB: Deleted ${deleted} old search history entries`);
      resolve(deleted);
    };
    
    transaction.onerror = () => {
      console.error('IndexedDB: Failed to delete old search history', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Migrate data from localStorage to IndexedDB
 * @returns {Promise<boolean>} - Returns true if migration was performed
 */
async function migrateFromLocalStorage() {
  try {
    // Check if data already exists in IndexedDB
    const existingGroups = await getCustomGroups();
    if (existingGroups.length > 0) {
      console.log('IndexedDB: Data already exists, skipping migration');
      return false;
    }

    // Get data from localStorage (browser.storage.local)
    const storedGroups = await browser.storage.local.get('customGroups');
    const storedMetadata = await browser.storage.local.get('groupTabMetadata');

    let migrated = false;

    // Migrate customGroups
    if (storedGroups.customGroups && storedGroups.customGroups.length > 0) {
      await saveCustomGroups(storedGroups.customGroups);
      console.log('IndexedDB: Migrated customGroups from localStorage');
      
      // Remove from localStorage after successful migration
      await browser.storage.local.remove('customGroups');
      migrated = true;
    }

    // Migrate groupTabMetadata
    if (storedMetadata.groupTabMetadata && Object.keys(storedMetadata.groupTabMetadata).length > 0) {
      await saveGroupTabMetadata(storedMetadata.groupTabMetadata);
      console.log('IndexedDB: Migrated groupTabMetadata from localStorage');
      
      // Remove from localStorage after successful migration
      await browser.storage.local.remove('groupTabMetadata');
      migrated = true;
    }

    if (migrated) {
      console.log('IndexedDB: Migration completed successfully');
    }

    return migrated;
  } catch (error) {
    console.error('IndexedDB: Migration failed', error);
    return false;
  }
}

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
function isIndexedDBAvailable() {
  return 'indexedDB' in window;
}

/**
 * Add a search query to search history
 * @param {string} query - The search query to save
 * @returns {Promise<number>} - Returns the ID of the inserted record
 */
async function addSearchQuery(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return Promise.resolve(null);
  }
  
  const db = await openDatabase();
  const trimmedQuery = query.trim();
  const timestamp = Date.now();
  const MAX_HISTORY = 30;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SEARCH_HISTORY], 'readwrite');
    const store = transaction.objectStore(STORE_SEARCH_HISTORY);
    
    // First, check if this query already exists
    const index = store.index('query');
    const getRequest = index.get(trimmedQuery);
    
    getRequest.onsuccess = () => {
      const existingRecord = getRequest.result;
      
      if (existingRecord) {
        // Update existing record's timestamp
        const updateRequest = store.put({
          id: existingRecord.id,
          query: trimmedQuery,
          timestamp: timestamp,
          count: (existingRecord.count || 1) + 1
        });
        
        updateRequest.onsuccess = () => {
          // Clean up old entries after update
          cleanupOldEntries(store, MAX_HISTORY);
          resolve(existingRecord.id);
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        // Add new record
        const addRequest = store.add({
          query: trimmedQuery,
          timestamp: timestamp,
          count: 1
        });
        
        addRequest.onsuccess = () => {
          // Clean up old entries after adding
          cleanupOldEntries(store, MAX_HISTORY);
          resolve(addRequest.result);
        };
        addRequest.onerror = () => reject(addRequest.error);
      }
    };
    
    getRequest.onerror = () => {
      // If we can't check existing, just add new
      const addRequest = store.add({
        query: trimmedQuery,
        timestamp: timestamp,
        count: 1
      });
      
      addRequest.onsuccess = () => {
        // Clean up old entries after adding
        cleanupOldEntries(store, MAX_HISTORY);
        resolve(addRequest.result);
      };
      addRequest.onerror = () => reject(addRequest.error);
    };
  });
}

/**
 * Clean up old search history entries to keep only the most recent ones
 * @param {IDBObjectStore} store - The search history object store
 * @param {number} maxEntries - Maximum number of entries to keep
 */
function cleanupOldEntries(store, maxEntries) {
  const index = store.index('timestamp');
  const request = index.openCursor(null, 'prev');
  
  let count = 0;
  const toDelete = [];
  
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      count++;
      if (count > maxEntries) {
        toDelete.push(cursor.primaryKey);
      }
      cursor.continue();
    }
  };
  
  request.transaction.oncomplete = () => {
    // Delete old entries
    if (toDelete.length > 0) {
      toDelete.forEach(id => store.delete(id));
    }
  };
}

/**
 * Get search history
 * @param {number} limit - Maximum number of entries to return (default: 30)
 * @param {string} filter - Optional filter string to search in history
 * @returns {Promise<Array>} - Returns array of search history entries
 */
async function getSearchHistory(limit = 30, filter = '') {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SEARCH_HISTORY], 'readonly');
    const store = transaction.objectStore(STORE_SEARCH_HISTORY);
    const index = store.index('timestamp');
    
    // Get all entries ordered by timestamp (newest first)
    const request = index.openCursor(null, 'prev');
    
    const results = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      
      if (cursor) {
        const record = cursor.value;
        
        // Apply filter if provided
        if (filter && filter.length > 0) {
          if (record.query.toLowerCase().includes(filter.toLowerCase())) {
            results.push(record);
          }
        } else {
          results.push(record);
        }
        
        // Only continue if we haven't reached the limit
        if (results.length < limit) {
          cursor.continue();
        }
      }
    };
    
    transaction.oncomplete = () => {
      resolve(results);
    };
    
    transaction.onerror = () => {
      console.error('IndexedDB: Failed to get search history', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Clear all search history
 * @returns {Promise<void>}
 */
async function clearSearchHistory() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SEARCH_HISTORY], 'readwrite');
    const store = transaction.objectStore(STORE_SEARCH_HISTORY);
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('IndexedDB: Search history cleared');
      resolve();
    };
    
    request.onerror = () => {
      console.error('IndexedDB: Failed to clear search history', request.error);
      reject(request.error);
    };
  });
}

/**
 * Delete a single search history item by ID
 * @param {number} id - The ID of the search history item to delete
 * @returns {Promise<void>}
 */
async function deleteSearchHistoryItem(id) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SEARCH_HISTORY], 'readwrite');
    const store = transaction.objectStore(STORE_SEARCH_HISTORY);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      console.error('IndexedDB: Failed to delete search history item', request.error);
      reject(request.error);
    };
  });
}

/**
 * Migrate from old YouTabsHeadings IndexedDB to YouTabsDB
 * @returns {Promise<boolean>} - Returns true if migration was performed
 */
async function migrateFromYouTabsHeadings() {
  try {
    // Delete old database
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('YouTabsHeadings');
      request.onsuccess = () => {
        console.log('IndexedDB: Old YouTabsHeadings database deleted');
        resolve(true);
      };
      request.onerror = () => {
        console.error('IndexedDB: Failed to delete old YouTabsHeadings database');
        resolve(false);
      };
    });
  } catch (error) {
    console.error('IndexedDB: Migration from YouTabsHeadings failed', error);
    return false;
  }
}

// ==================== Page Tags Functions ====================

/**
 * Save tags for a specific URL
 * @param {string} url - The URL to save tags for
 * @param {Array<string>} tags - Array of tag strings
 * @returns {Promise<void>}
 */
async function savePageTags(url, tags) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readwrite');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    
    // Normalize tags: lowercase and trim
    const normalizedTags = (tags || []).map(tag => tag.toLowerCase().trim()).filter(tag => tag.length > 0);
    
    store.put({ url: url, tags: normalizedTags, updatedAt: Date.now() });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save page tags', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get tags for a specific URL
 * @param {string} url - The URL to get tags for
 * @returns {Promise<Array<string>>}
 */
async function getPageTags(url) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readonly');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    const request = store.get(url);

    request.onsuccess = () => {
      resolve(request.result ? request.result.tags : []);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get page tags', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all page tags (URL to tags mapping)
 * @returns {Promise<Object>} - Object with url as keys and tags array as values
 */
async function getAllPageTags() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readonly');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      const pageTags = {};
      for (const item of results) {
        pageTags[item.url] = item.tags;
      }
      resolve(pageTags);
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get all page tags', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all unique tags
 * @returns {Promise<Array<string>>}
 */
async function getAllUniqueTags() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readonly');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      const uniqueTags = new Set();
      for (const item of results) {
        for (const tag of (item.tags || [])) {
          uniqueTags.add(tag);
        }
      }
      resolve(Array.from(uniqueTags).sort());
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to get all unique tags', request.error);
      reject(request.error);
    };
  });
}

/**
 * Search pages by tag
 * @param {string} tag - Tag to search for
 * @returns {Promise<Array<string>>} - Array of URLs with matching tags
 */
async function searchPagesByTag(tag) {
  const db = await openDatabase();
  const normalizedTag = tag.toLowerCase().trim();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readonly');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    const index = store.index('tags');
    const request = index.getAll(normalizedTag);

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(item => item.url));
    };

    request.onerror = () => {
      console.error('IndexedDB: Failed to search pages by tag', request.error);
      reject(request.error);
    };
  });
}

/**
 * Delete tags for a specific URL
 * @param {string} url - The URL to delete tags for
 * @returns {Promise<void>}
 */
async function deletePageTags(url) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGE_TAGS], 'readwrite');
    const store = transaction.objectStore(STORE_PAGE_TAGS);
    store.delete(url);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to delete page tags', transaction.error);
      reject(transaction.error);
    };
  });
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
  window.YouTabsDB = {
    openDatabase,
    getCustomGroups,
    saveCustomGroups,
    getGroupTabMetadata,
    saveGroupTabMetadata,
    getPagesIndex,
    getPagesIndexWithTimestamp,
    getAllPages,
    getPagesIndexByUrl,
    savePageHeadingsByUrl,
    getUrlForTab,
    deleteTabUrlMapping,
    savePagesIndex,
    deletePagesIndexByTabId,
    deletePagesIndexByUrl,
    cleanupExpiredPagesIndex,
    cleanupMaxPages,
    migrateFromLocalStorage,
    migrateFromYouTabsHeadings,
    isIndexedDBAvailable,
    // Search history functions
    addSearchQuery,
    getSearchHistory,
    clearSearchHistory,
    deleteSearchHistoryItem,
    deleteOldSearchHistory,
    // Page tags functions
    savePageTags,
    getPageTags,
    getAllPageTags,
    getAllUniqueTags,
    searchPagesByTag,
    deletePageTags,
    // Utility functions
    LRUCache,
    compress,
    decompress,
    shouldCompress,
    // Cache instances and stats
    customGroupsCache,
    groupTabMetadataCache,
    pagesIndexCache
  };
}
