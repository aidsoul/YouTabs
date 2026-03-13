// IndexedDB indexes management page script

let indexesData = [];
let filteredData = [];
let selectedUrl = null;

// Pagination
const ITEMS_PER_PAGE = 50;
let currentPage = 1;
let totalPages = 1;

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
    
    // Apply current search filter if any
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    if (searchTerm) {
      filteredData = indexesData.filter(item => item.url.toLowerCase().includes(searchTerm));
    } else {
      filteredData = [...indexesData];
    }
    
    // Initialize pagination
    totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    if (totalPages < 1) totalPages = 1;
    
    // Adjust current page if it's out of range after data change
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) currentPage = 1;
    
    renderTable();
    renderPagination();
  } catch (error) {
    console.error('Failed to load indexes:', error);
    const tbody = document.getElementById('indexesTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading indexes</td></tr>';
  }
}

// Render the table
function renderTable() {
  const tbody = document.getElementById('indexesTableBody');
  
  if (filteredData.length === 0) {
    const searchTerm = document.getElementById('searchInput').value.trim();
    if (searchTerm) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No matching URLs found</td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No indexed pages found</td></tr>';
    }
    return;
  }
  
  // Calculate start and end indices for current page
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
  const pageData = filteredData.slice(startIndex, endIndex);
  
  tbody.innerHTML = pageData.map((item, index) => `
    <tr data-url="${item.url}" data-index="${startIndex + index}">
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

// Render pagination controls
function renderPagination() {
  const paginationContainer = document.getElementById('paginationContainer');
  
  if (filteredData.length <= ITEMS_PER_PAGE) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let paginationHtml = '';
  
  // Previous button
  paginationHtml += `<button class="pagination-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;
  
  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    paginationHtml += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      paginationHtml += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHtml += `<span class="pagination-ellipsis">...</span>`;
    }
    paginationHtml += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }
  
  // Next button
  paginationHtml += `<button class="pagination-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
  
  // Info text
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length);
  paginationHtml += `<span class="pagination-info">${startItem}-${endItem} of ${filteredData.length}</span>`;
  
  paginationContainer.innerHTML = paginationHtml;
  
  // Add event listeners
  document.getElementById('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
  
  document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page)));
  });
}

// Go to specific page
function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  renderPagination();
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  
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

// Handle search
function handleSearch() {
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  
  // Filter the data
  if (searchTerm) {
    filteredData = indexesData.filter(item => item.url.toLowerCase().includes(searchTerm));
  } else {
    filteredData = [...indexesData];
  }
  
  // Reset to first page
  currentPage = 1;
  
  // Update pagination
  totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  if (totalPages < 1) totalPages = 1;
  
  renderTable();
  renderPagination();
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
      if (tab.url) {
        // Use URL normalization for proper comparison
        try {
          const tabUrlObj = new URL(tab.url);
          const targetUrlObj = new URL(urlToUpdate);
          const tabUrlKey = tabUrlObj.origin + tabUrlObj.pathname.replace(/\/$/, '');
          const targetUrlKey = targetUrlObj.origin + targetUrlObj.pathname.replace(/\/$/, '');
          
          if (tabUrlKey === targetUrlKey) {
            matchingTab = tab;
            break;
          }
        } catch (e) {
          // Fallback to string comparison if URL parsing fails
          if (tab.url === urlToUpdate) {
            matchingTab = tab;
            break;
          }
        }
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
      
      // Additional wait to ensure page content is fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
