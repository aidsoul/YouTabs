// IndexedDB indexes management page script

let indexesData = [];
let selectedUrl = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadIndexes();
  setupEventListeners();
});

// Load indexes from IndexedDB 
async function loadIndexes() {
  try {
    const pageIndex = await getPagesIndexWithTimestamp();
    
    // Convert object to array
    indexesData = Object.entries(pageIndex).map(([url, data]) => {
      return {
        url: url,
        headingsCount: data.headings ? data.headings.length : 0,
        indexedAt: data.indexedAt,
        lastIncrementalUpdate: data.lastIncrementalUpdate || null
      };
    });
    
    // Sort by indexedAt descending
    indexesData.sort((a, b) => b.indexedAt - a.indexedAt);
    
    renderTable();
  } catch (error) {
    console.error('Failed to load indexes:', error);
    const tbody = document.getElementById('indexesTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading indexes</td></tr>';
  }
}

// Render the table
function renderTable() {
  const tbody = document.getElementById('indexesTableBody');
  
  if (indexesData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No indexed pages found</td></tr>';
    return;
  }
  
  tbody.innerHTML = indexesData.map((item, index) => `
    <tr data-url="${item.url}" data-index="${index}">
      <td class="indexes-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</td>
      <td>${item.headingsCount}</td>
      <td>${formatDate(item.indexedAt)}</td>
      <td>${item.lastIncrementalUpdate ? formatDate(item.lastIncrementalUpdate) : '-'}</td>
    </tr>
  `).join('');
  
  // Add click listeners for context menu
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    row.addEventListener('contextmenu', handleContextMenu);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Delete all button
  document.getElementById('deleteAllBtn').addEventListener('click', handleDeleteAll);
  
  // Context menu buttons
  document.getElementById('updateIndexBtn').addEventListener('click', handleUpdateIndex);
  document.getElementById('deleteIndexBtn').addEventListener('click', handleDeleteIndex);
  
  // Close context menu on click outside
  document.addEventListener('click', (e) => {
    const contextMenu = document.getElementById('contextMenu');
    // Only hide if click is outside the context menu
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
  
  // Prevent context menu from closing when clicking inside
  document.getElementById('contextMenu').addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Handle context menu
function handleContextMenu(e) {
  e.preventDefault();
  
  const row = e.target.closest('tr');
  if (!row) return;
  
  selectedUrl = row.dataset.url;
  
  const contextMenu = document.getElementById('contextMenu');
  contextMenu.style.display = 'block';
  
  // Position the menu
  const x = e.pageX;
  const y = e.pageY;
  
  // Adjust if menu goes off screen
  const menuRect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = x;
  let top = y;
  
  if (x + menuRect.width > viewportWidth) {
    left = viewportWidth - menuRect.width - 10;
  }
  
  if (y + menuRect.height > viewportHeight) {
    top = viewportHeight - menuRect.height - 10;
  }
  
  contextMenu.style.left = left + 'px';
  contextMenu.style.top = top + 'px';
}

// Hide context menu
function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
  selectedUrl = null;
}

// Handle delete all
async function handleDeleteAll() {
  if (!confirm('Are you sure you want to delete all indexed pages?')) {
    return;
  }
  
  try {
    // Delete each index
    for (const item of indexesData) {
      await deletePagesIndexByUrl(item.url);
    }
    
    // Reload the table
    await loadIndexes();
  } catch (error) {
    console.error('Failed to delete all indexes:', error);
    alert('Failed to delete all indexes');
  }
}

// Handle update index (reload and re-index)
async function handleUpdateIndex() {
  if (!selectedUrl) return;
  
  // Store selectedUrl before hiding context menu
  const urlToUpdate = selectedUrl;
  
  hideContextMenu();
  
  try {
    // First, check if there's an existing tab with this URL
    // Use more flexible matching to handle URL variations
    const tabs = await browser.tabs.query({});
    
    // Find a tab that matches the selected URL
    let matchingTab = null;
    for (const tab of tabs) {
      if (tab.url && (tab.url === urlToUpdate || tab.url.startsWith(urlToUpdate) || urlToUpdate.startsWith(tab.url))) {
        matchingTab = tab;
        break;
      }
    }
    
    if (matchingTab) {
      // Use existing tab - reload it
      const tab = matchingTab;
      await browser.tabs.reload(tab.id);
      
      // Wait for the tab to load
      await new Promise(resolve => {
        browser.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            browser.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      
      // Get the page content using the new scripting API
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML
      });
      
      if (results && results[0] && results[0].result) {
        // Use the indexer worker to extract headings
        const headings = await extractHeadings(results[0].result);
        
        // Save the new headings (use incremental=true to preserve indexedAt and set lastIncrementalUpdate)
        await savePageHeadingsByUrl(urlToUpdate, tab.id, headings, true);
        
        // Reload the table
        await loadIndexes();
        
        alert('Index updated successfully');
      } else {
        throw new Error('Failed to get page content');
      }
    } else {
      // No existing tab - delete the index and inform the user
      await deletePagesIndexByUrl(urlToUpdate);
      await loadIndexes();
      
      alert('Index deleted. Please visit the page to re-index it.');
    }
  } catch (error) {
    console.error('Failed to update index:', error);
    alert('Failed to update index: ' + error.message);
  }
}

// Helper function to extract headings directly (DOMParser not available in worker)
async function extractHeadings(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = [];
    const maxChars = 250;
    
    // Extract all heading elements (h1-h6)
    for (let level = 1; level <= 6; level++) {
      const elements = doc.querySelectorAll(`h${level}`);
      elements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text) {
          headings.push({
            id: `h${level}-${index}`,
            text: text.substring(0, maxChars),
            level: level,
            tag: `h${level}`
          });
        }
      });
    }
    
    return headings;
  } catch (error) {
    console.error('Error extracting headings:', error);
    return [];
  }
}

// Handle delete single index
async function handleDeleteIndex() {
  if (!selectedUrl) return;
  
  // Store selectedUrl before hiding context menu
  const urlToDelete = selectedUrl;
  
  hideContextMenu();
  
  if (!confirm(`Are you sure you want to delete the index for ${urlToDelete}?`)) {
    return;
  }
  
  try {
    await deletePagesIndexByUrl(urlToDelete);
    await loadIndexes();
  } catch (error) {
    console.error('Failed to delete index:', error);
    alert('Failed to delete index');
  }
}

// Helper functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString();
}
