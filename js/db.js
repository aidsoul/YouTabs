/**
 * IndexedDB Utility Module for YouTabs Extension
 * Handles persistent storage of customGroups and groupTabMetadata
 */

const DB_NAME = 'YouTabsDB';
const DB_VERSION = 7;
const STORE_CUSTOM_GROUPS = 'customGroups';
const STORE_GROUP_TAB_METADATA = 'groupTabMetadata';
const STORE_PAGES_INDEX = 'pagesIndex';
const STORE_SEARCH_HISTORY = 'searchHistory';

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

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      console.log('IndexedDB: Upgrading database from version', oldVersion, 'to', event.newVersion);
      
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
      }
    };
  });
}

/**
 * Get customGroups from IndexedDB
 * @returns {Promise<Array>}
 */
async function getCustomGroups() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CUSTOM_GROUPS], 'readonly');
    const store = transaction.objectStore(STORE_CUSTOM_GROUPS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
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
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CUSTOM_GROUPS], 'readwrite');
    const store = transaction.objectStore(STORE_CUSTOM_GROUPS);
    
    // Use put for all items in a single transaction (more efficient than clear + add)
    for (const group of customGroups) {
      store.put(group);
    }

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error('IndexedDB: Failed to save customGroups', transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get groupTabMetadata from IndexedDB
 * @returns {Promise<Object>}
 */
async function getGroupTabMetadata() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_GROUP_TAB_METADATA], 'readonly');
    const store = transaction.objectStore(STORE_GROUP_TAB_METADATA);
    const request = store.get('metadata');

    request.onsuccess = () => {
      resolve(request.result ? request.result.data : {});
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
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_GROUP_TAB_METADATA], 'readwrite');
    const store = transaction.objectStore(STORE_GROUP_TAB_METADATA);
    
    // Store with a fixed key 'metadata'
    store.put({ id: 'metadata', data: metadata });

    transaction.oncomplete = () => {
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
 * Save pagesIndex to IndexedDB
 * @param {Object} pagesIndex - Object with urlKey as keys and headings array as values
 */
async function savePagesIndex(pagesIndex) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const store = transaction.objectStore(STORE_PAGES_INDEX);
    
    // Clear existing data and add new data
    store.clear();
    
    const timestamp = Date.now();
    
    for (const [urlKey, headings] of Object.entries(pagesIndex)) {
      store.put({ url: urlKey, headings: headings, indexedAt: timestamp });
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
        pageIndex[item.url] = { headings: item.headings, indexedAt: item.indexedAt };
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
 * Also saves tabId -> URL mapping (deprecated - pages table removed)
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
    urlKey = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
  } catch (e) {
    // Use original URL if parsing fails
  }
  
  const timestamp = Date.now();
  
  // If incremental update, first get existing data to preserve indexedAt
  if (isIncremental) {
    const existingData = await new Promise((resolve, reject) => {
      const getTransaction = db.transaction([STORE_PAGES_INDEX], 'readonly');
      const getStore = getTransaction.objectStore(STORE_PAGES_INDEX);
      const getRequest = getStore.get(urlKey);
      
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => resolve(null);
    });
    
    const existingIndexedAt = existingData?.indexedAt || timestamp;
    
    // Now save with the existing indexedAt
    return new Promise((resolve, reject) => {
      const saveTransaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
      const saveStore = saveTransaction.objectStore(STORE_PAGES_INDEX);
      
      saveStore.put({ 
        url: urlKey, 
        headings: headings, 
        indexedAt: existingIndexedAt,
        lastIncrementalUpdate: timestamp
      });
      
      saveTransaction.oncomplete = () => resolve();
      saveTransaction.onerror = () => {
        console.error('IndexedDB: Failed to save incremental update', saveTransaction.error);
        reject(saveTransaction.error);
      };
    });
  }
  
  // Regular (full) index
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const pagesIndexStore = transaction.objectStore(STORE_PAGES_INDEX);
    
    pagesIndexStore.put({ url: urlKey, headings: headings, indexedAt: timestamp });
    
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
 * @param {number} maxPages - Maximum number of pages to keep (default: 1000)
 * @returns {Promise<number>} - Returns number of deleted entries
 */
async function cleanupMaxPages(maxPages = 1000) {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
      const store = transaction.objectStore(STORE_PAGES_INDEX);
      
      // Get all entries ordered by indexedAt (oldest first)
      const index = store.index('indexedAt');
      const request = index.openCursor(null, 'next');
      
      let totalCount = 0;
      let deleted = 0;
      let entriesChecked = 0;
      const urlsToDelete = [];
      
      // First pass: count total and collect URLs to delete
      const countRequest = index.getAll();
      countRequest.onsuccess = () => {
        const allEntries = countRequest.result;
        totalCount = allEntries.length;
        
        if (totalCount <= maxPages) {
          console.log(`IndexedDB: ${totalCount} pages, within limit of ${maxPages}`);
          resolve(0);
          return;
        }
        
        // Collect URLs of oldest entries to delete
        const deleteCount = totalCount - maxPages;
        const toDelete = allEntries.slice(0, deleteCount);
        urlsToDelete.push(...toDelete.map(e => e.url));
        
        // Second pass: delete collected URLs
        if (urlsToDelete.length > 0) {
          let deleteCompleted = 0;
          
          urlsToDelete.forEach(url => {
            const deleteReq = store.delete(url);
            deleteReq.onsuccess = () => {
              deleted++;
              deleteCompleted++;
            };
            deleteReq.onerror = () => {
              deleteCompleted++; // Count even failed deletes as processed
            };
          });
        }
      };
      
      transaction.oncomplete = () => {
        console.log(`IndexedDB: Cleanup complete. Deleted ${deleted} oldest entries. Remaining: ${totalCount - deleted}`);
        resolve(deleted);
      };
      
      transaction.onerror = () => {
        console.error('IndexedDB: Error during max pages cleanup', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB: Error cleaning up max pages', error);
    return 0;
  }
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
    deleteSearchHistoryItem
  };
}
