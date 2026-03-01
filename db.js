/**
 * IndexedDB Utility Module for YouTabs Extension
 * Handles persistent storage of customGroups and groupTabMetadata
 */

const DB_NAME = 'YouTabsDB';
const DB_VERSION = 5;
const STORE_CUSTOM_GROUPS = 'customGroups';
const STORE_GROUP_TAB_METADATA = 'groupTabMetadata';
const STORE_PAGES_INDEX = 'pagesIndex';
const STORE_PAGES = 'pages'; // Deprecated: table removed

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
        db.createObjectStore(STORE_CUSTOM_GROUPS, { keyPath: 'id' });
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
      db.createObjectStore(STORE_PAGES_INDEX, { keyPath: 'url' });
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
    
    // Clear existing data and add new data
    store.clear();
    
    for (const group of customGroups) {
      store.add(group);
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
 * @returns {Promise<Object>} - Returns object with tabId as keys and headings array as values
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
        pageIndex[item.tabId] = item.headings;
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
 * @returns {Promise<Object|null>} - Returns {headings, indexedAt} or null if not found
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
        resolve({ headings: result.headings, indexedAt: result.indexedAt });
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
 */
async function savePageHeadingsByUrl(url, tabId, headings) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    // Normalize URL to create a consistent key
    let urlKey = url;
    try {
      const urlObj = new URL(url);
      urlKey = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    } catch (e) {
      // Use original URL if parsing fails
    }
    
    const timestamp = Date.now();
    
    // Use only pagesIndex store (pages table removed)
    const transaction = db.transaction([STORE_PAGES_INDEX], 'readwrite');
    const pagesIndexStore = transaction.objectStore(STORE_PAGES_INDEX);
    
    // Save page headings with urlKey as key
    pagesIndexStore.put({ url: urlKey, headings: headings, indexedAt: timestamp });

    transaction.oncomplete = () => {
      resolve();
    };

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
    const pageIndexWithTimestamp = await getPagesIndexWithTimestamp();
    const now = Date.now();
    
    for (const [urlKey, data] of Object.entries(pageIndexWithTimestamp)) {
      if (data.indexedAt && (now - data.indexedAt > expirationMs)) {
        await deletePagesIndexByTabId(urlKey);
        console.log(`IndexedDB: Cleaned up expired pagesIndex for ${urlKey}`);
      }
    }
  } catch (error) {
    console.error('IndexedDB: Error cleaning up expired pagesIndex', error);
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
    migrateFromLocalStorage,
    migrateFromYouTabsHeadings,
    isIndexedDBAvailable
  };
}
