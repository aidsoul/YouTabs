// YouTabs Search Popup Script
// Uses SearchEngine for searching tabs and indexed data
// Note: DOMUtils is available via window.DOMUtils

// State
let tabs = [];
let filteredTabs = [];
let headingSearchResults = [];
let selectedIndex = -1;
let searchEngine = null;
let settings = null;
let searchHistory = [];
let isShowingHistory = false;

// Get elements
const searchInput = document.getElementById('searchPopupInput');
const tabsList = document.getElementById('tabsList');
const tabCountEl = document.getElementById('tabCount');
const searchRegexBtn = document.getElementById('searchRegexBtn');
const searchClearBtn = document.getElementById('searchClearBtn');

// Initialize
async function init() {
  try {
    // Get settings
    const settingsManager = new SettingsManager();
    settings = await settingsManager.getAll();

    // Load tabs
    tabs = await browser.tabs.query({});

    // Initialize SearchEngine
    searchEngine = new SearchEngine({
      settings: settings,
      getTabs: () => tabs,
      getCustomTabNames: () => ({}),
      getGroupHierarchyNames: () => [],
      onSearchResults: handleSearchResults,
      onError: (error) => console.error('SearchEngine error:', error)
    });
    
    // Setup regex button if exists
    if (searchRegexBtn) {
      searchRegexBtn.addEventListener('click', () => {
        if (!searchEngine) return;
        const currentMode = searchEngine.getRegexMode();
        searchEngine.setRegexMode(!currentMode);
        searchRegexBtn.classList.toggle('active', !currentMode);
        
        // Re-run search with new mode
        if (searchInput && searchInput.value) {
          searchEngine.setSearchQuery(searchInput.value);
        }
      });
    }

    // Setup clear button
    if (searchClearBtn && searchInput) {
      // Show/hide clear button based on input content
      const updateClearButtonVisibility = () => {
        if (searchInput.value.length > 0) {
          searchClearBtn.classList.add('visible');
        } else {
          searchClearBtn.classList.remove('visible');
        }
      };
      
      // Initial state
      updateClearButtonVisibility();
      
      // Update on input change
      searchInput.addEventListener('input', updateClearButtonVisibility);
      
      // Clear input on button click
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        updateClearButtonVisibility();
        
        // Trigger search with empty query
        if (searchEngine) {
          searchEngine.setSearchQuery('');
        }
        
        // Show history
        isShowingHistory = true;
        renderSearchHistory();
      });
      
      // Clear on Escape key
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          updateClearButtonVisibility();
          
          if (searchEngine) {
            searchEngine.setSearchQuery('');
          }
          
          isShowingHistory = true;
          renderSearchHistory();
        }
      });
      
      // Show tabs and groups when losing focus
      searchInput.addEventListener('blur', () => {
        // Small delay to allow button clicks to register first
        setTimeout(() => {
          if (searchInput && searchInput.value.trim() === '') {
            isShowingHistory = false;
            renderTabs(tabs, []);
          }
        }, 150);
      });
    }

    // Load indexed page headings from IndexedDB
    await searchEngine.loadPageHeadings();

    // Load page tags from IndexedDB
    await searchEngine.loadPageTags();

    // Load search history
    await loadSearchHistory();

    // Initial render - always try to show history when input is empty
    const initialQuery = searchInput?.value?.trim() || '';
    if (!initialQuery) {
      renderSearchHistory();
    } else {
      renderTabs(tabs, []);
    }

    // Focus input
    searchInput.focus();
  } catch (error) {
    console.error('Init error:', error);
    if (tabsList) {
      tabsList.innerHTML = `
        <div class="search-no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p>Error loading tabs</p>
        </div>
      `;
    }
  }
}

// Load search history
async function loadSearchHistory() {
  try {
    if (window.YouTabsDB && window.YouTabsDB.getSearchHistory) {
      searchHistory = await window.YouTabsDB.getSearchHistory(30);
      console.log('Search history loaded:', searchHistory.length, 'items');
    } else {
      console.warn('YouTabsDB.getSearchHistory not available');
      searchHistory = [];
    }
  } catch (error) {
    console.error('Error loading search history:', error);
    searchHistory = [];
  }
}

// Save search query to history
async function saveSearchQuery(query) {
  if (!query || query.trim().length === 0) return;
  
  try {
    if (window.YouTabsDB && window.YouTabsDB.addSearchQuery) {
      await window.YouTabsDB.addSearchQuery(query.trim());
      // Reload history after saving
      await loadSearchHistory();
    }
  } catch (error) {
    console.error('Error saving search query:', error);
  }
}

// Render search history dropdown
function renderSearchHistory(filter = '') {
  if (!tabsList) return;
  
  // Filter history based on input
  let filteredHistory = searchHistory;
  if (filter && filter.length > 0) {
    filteredHistory = searchHistory.filter(item => 
      item.query.toLowerCase().includes(filter.toLowerCase())
    );
  }
  
  // Show empty state message if no history
  if (filteredHistory.length === 0) {
    // If there's a filter, show "no results" for filter
    // Otherwise show "no recent searches" message
    tabsList.innerHTML = `
      <div class="search-history-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>${filter ? 'No matching searches' : 'No recent searches'}</p>
        <span class="search-history-hint">${filter ? 'Try a different search term' : 'Your search history will appear here'}</span>
      </div>
    `;
    if (tabCountEl) tabCountEl.textContent = filter ? 'No results' : 'No history';
    return;
  }
  
  isShowingHistory = true;
  
  const html = `
    <div class="search-history-container">
      <div class="search-history-header">
        <span>Recent Searches</span>
        <button class="clear-history-btn" id="clearHistoryBtn" title="Clear history">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
      <div class="search-history-list">
        ${filteredHistory.map((item, index) => `
          <div class="search-history-item" data-query="${escapeHtml(item.query)}" data-id="${item.id}">
            <svg class="history-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="history-query">${escapeHtml(item.query)}</span>
            <span class="history-count">${item.count > 1 ? `×${item.count}` : ''}</span>
            <button class="delete-history-item" data-id="${item.id}" title="Remove">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  tabsList.innerHTML = html;
  
  // Add event listeners for history items
  tabsList.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-history-item')) return;
      const query = item.dataset.query;
      if (searchInput) {
        searchInput.value = query;
        // Trigger search
        searchEngine.setSearchQuery(query);
        isShowingHistory = false;
      }
    });
  });
  
  // Add event listener for delete buttons
  tabsList.querySelectorAll('.delete-history-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      try {
        if (window.YouTabsDB && window.YouTabsDB.deleteSearchHistoryItem) {
          await window.YouTabsDB.deleteSearchHistoryItem(id);
          await loadSearchHistory();
          // Re-render with current filter
          const currentFilter = searchInput?.value.trim() || '';
          renderSearchHistory(currentFilter);
        }
      } catch (error) {
        console.error('Error deleting history item:', error);
      }
    });
  });
  
  // Add event listener for clear history button
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (window.YouTabsDB && window.YouTabsDB.clearSearchHistory) {
          await window.YouTabsDB.clearSearchHistory();
          searchHistory = [];
          isShowingHistory = false;
          // Re-render tabs
          renderTabs(tabs, []);
        }
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    });
  }
}

// Handle search results from SearchEngine
function handleSearchResults(results) {
  filteredTabs = results.filteredTabs || [];
  headingSearchResults = results.headingResults || [];
  
  // Update regex button state if exists
  if (searchRegexBtn) {
    if (results.useRegex && results.regexError) {
      searchRegexBtn.classList.add('error');
      searchRegexBtn.title = `Regex Error: ${results.regexError}`;
    } else {
      searchRegexBtn.classList.remove('error');
      searchRegexBtn.title = results.useRegex ? 'Regex Search (.*) - ON' : 'Regex Search (.*)';
    }
  }
  
  renderTabs(filteredTabs, headingSearchResults);
}

// Render tabs
function renderTabs(tabsToRender, headings) {
  if (!tabsList) return;

  // If we have heading results, show them in categorized format
  if (headings && headings.length > 0) {
    renderHeadingSearchResults(tabsToRender, headings);
    return;
  }

  // Otherwise use simple tab rendering
  renderSimpleTabs(tabsToRender);
}

// Render tabs without heading results (simple view)
function renderSimpleTabs(tabsToRender) {
  if (tabsToRender.length === 0) {
    tabsList.innerHTML = `
      <div class="search-no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
          <path d="M8 8l6 6M14 8l-6 6"/>
        </svg>
        <p>No results found</p>
      </div>
    `;
    if (tabCountEl) tabCountEl.textContent = '0 results';
    return;
  }

  // Update count
  if (tabCountEl) tabCountEl.textContent = `${tabsToRender.length} result${tabsToRender.length !== 1 ? 's' : ''}`;

  // Render tabs
  tabsList.innerHTML = tabsToRender.map((tab, index) => {
    const favicon = tab.faviconIcon 
      ? `<img class="tab-favicon" src="${escapeHtml(tab.faviconIcon)}" alt="">`
      : `<div class="tab-favicon-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 9h6M9 13h6M9 17h4"/>
          </svg>
        </div>`;

    return `
      <div class="tab-item" data-index="${index}" data-type="tab" data-url="${escapeHtml(tab.url)}" data-tab-id="${tab.id}">
        ${favicon}
        <div class="tab-info">
          ${settings?.showTabTitle !== false ? `<div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>` : ''}
          <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Reset selection
  selectedIndex = -1;

  // Add click handlers
  tabsList.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      openResultByElement(item);
    });
  });
}

// Render heading search results with categories and subcategories
function renderHeadingSearchResults(tabsToRender, headings) {
  // Get current search query for data attributes
  const currentQuery = searchInput?.value.trim() || '';
  const escapedQuery = escapeHtml(currentQuery);
  
  // Group heading results by type
  const groupedResults = {};
  const typeLabels = {
    'heading': 'Headings',
    'paragraph': 'Paragraphs',
    'link': 'Links',
    'image': 'Images',
    'div': 'Divs',
    'list': 'Lists',
    'listItem': 'List Items',
    'file': 'File Inputs',
    'fileDownload': 'Downloads',
    'video': 'Videos',
    'audio': 'Audio',
    'videoEmbed': 'Embedded Videos',
    'span': 'Spans',
    'table': 'Tables',
    'section': 'Sections',
    'article': 'Articles',
    'aside': 'Asides',
    'nav': 'Navigation',
    'footer': 'Footers',
    'header': 'Headers',
    'blockquote': 'Blockquotes',
    'code': 'Code',
    'pre': 'Preformatted',
    'cite': 'Citations',
    'abbr': 'Abbreviations',
    'time': 'Time',
    'mark': 'Highlighted',
    'button': 'Buttons',
    'textarea': 'Textareas',
    'select': 'Selects',
    'label': 'Labels',
    'figure': 'Figures',
    'details': 'Details',
    'summary': 'Summary'
  };

  headings.forEach((heading) => {
    const headingType = heading.heading?.type || 'heading';
    if (!groupedResults[headingType]) {
      groupedResults[headingType] = [];
    }
    groupedResults[headingType].push(heading);
  });

  // Sort types by total relevance
  const sortedTypes = Object.entries(groupedResults)
    .filter(([type, results]) => results.length > 0)
    .sort((a, b) => {
      const totalRelevanceA = a[1].reduce((sum, result) => sum + (result.relevance || 0), 0);
      const totalRelevanceB = b[1].reduce((sum, result) => sum + (result.relevance || 0), 0);
      return totalRelevanceB - totalRelevanceA;
    });

  // Update count
  const headingCount = headings.length;
  if (tabCountEl) {
    tabCountEl.textContent = `${tabsToRender.length} / ${tabs.length}` + (headingCount > 0 ? ` (+${headingCount} headings)` : '');
  }

  // Build HTML
  let html = '';

  // Render tabs first (if any)
  if (tabsToRender.length > 0) {
    html += '<div class="search-tabs-section">';
    html += tabsToRender.map((tab, index) => {
      const favicon = tab.faviconIcon 
        ? `<img class="tab-favicon" src="${escapeHtml(tab.faviconIcon)}" alt="">`
        : `<div class="tab-favicon-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 9h6M9 13h6M9 17h4"/>
            </svg>
          </div>`;

      return `
        <div class="tab-item" data-index="${index}" data-type="tab" data-url="${escapeHtml(tab.url)}" data-tab-id="${tab.id}">
          ${favicon}
          <div class="tab-info">
            ${settings?.showTabTitle !== false ? `<div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>` : ''}
            <div class="tab-url">${escapeHtml(tab.url)}</div>
          </div>
        </div>
      `;
    }).join('');
    html += '</div>';
  }

  // Render heading results with categories
  if (headings.length > 0) {
    html += '<div class="heading-search-results" data-no-group="true">';
    
    sortedTypes.forEach(([type, results]) => {
      html += `<div class="heading-search-subcategory">`;
      
      // Subcategory header
      html += `
        <div class="heading-search-subcategory-header">
          <span class="heading-search-subcategory-toggle">−</span>
          <span class="heading-search-subcategory-title">${typeLabels[type] || type}</span>
          <span class="heading-search-subcategory-count">${results.length}</span>
        </div>
      `;
      
      // Subcategory items
      html += '<div class="heading-search-subcategory-items">';
      
      results.forEach((result, idx) => {
        const globalIndex = tabsToRender.length + headings.indexOf(result);
        const pageUrl = result.pageUrl || result.heading?.url || result.url || '';
        const tabId = result.tabId || '';
        const headingText = result.heading?.text || result.text || '';
        const headingImgUrl = result.heading?.imgUrl || result.imgUrl || '';
        const headingVideoUrl = result.heading?.videoUrl || result.videoUrl || '';
        const headingAudioUrl = result.heading?.audioUrl || result.audioUrl || '';
        const parentTitle = result.parentTitle || result.heading?.parentTitle || '';
        
        // Truncate text if > 48 chars
        let displayText = headingText;
        if (displayText.length > 48) {
          displayText = displayText.substring(0, 45) + '...';
        }
        
        // Build item content with thumbnail for images
        let itemContent = '';
        
        // Image thumbnail
        if (type === 'image' && headingImgUrl) {
          itemContent += `
            <div class="heading-search-item-thumbnail clickable" data-img-url="${escapeHtml(headingImgUrl)}">
              <img src="${escapeHtml(headingImgUrl)}" alt="${escapeHtml(displayText)}" loading="lazy" />
            </div>
          `;
        }
        
        // Video preview
        if ((type === 'video' || type === 'videoEmbed') && headingVideoUrl) {
          itemContent += `
            <div class="heading-search-item-thumbnail clickable video-preview" data-video-url="${escapeHtml(headingVideoUrl)}">
              <span class="video-icon">▶</span>
              <span class="video-label">${escapeHtml(displayText || 'Video')}</span>
            </div>
          `;
        }
        
        // Audio preview
        if (type === 'audio' && headingAudioUrl) {
          itemContent += `
            <div class="heading-search-item-thumbnail clickable audio-preview" data-audio-url="${escapeHtml(headingAudioUrl)}">
              <span class="audio-icon">♪</span>
              <span class="audio-label">${escapeHtml(displayText || 'Audio')}</span>
            </div>
          `;
        }
        
        itemContent += `
          <div class="heading-search-item-content">
            <span class="heading-text">${escapeHtml(displayText)}</span>
          </div>
        `;
        
        html += `
          <div class="heading-search-item" data-index="${globalIndex}" data-type="heading" data-url="${escapeHtml(pageUrl)}" data-tab-id="${tabId}" data-heading-id="${result.heading?.id || ''}" data-heading-type="${type}" data-search-query="${escapedQuery}">
            ${itemContent}
            ${parentTitle ? `<div class="heading-tab-info"><span class="heading-tab-title">${escapeHtml(parentTitle)}</span></div>` : ''}
          </div>
        `;
      });
      
      html += '</div>';
      html += '</div>';
    });
    
    html += '</div>';
  }

  const totalResults = tabsToRender.length + headings.length;
  if (totalResults === 0) {
    tabsList.innerHTML = `
      <div class="search-no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
          <path d="M8 8l6 6M14 8l-6 6"/>
        </svg>
        <p>No results found</p>
      </div>
    `;
    if (tabCountEl) tabCountEl.textContent = '0 results';
    return;
  }

  tabsList.innerHTML = html;

  // Reset selection
  selectedIndex = -1;

  // Add click handlers for tab items
  tabsList.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', () => {
      openResultByElement(item);
    });
  });

  // Add click handlers for heading items
  const currentSearchQuery = searchInput?.value.trim() || '';
  tabsList.querySelectorAll('.heading-search-item').forEach(item => {
    item.addEventListener('click', async () => {
      const url = item.dataset.url;
      const tabId = item.dataset.tabId;
      const headingId = item.dataset.headingId;
      const headingType = item.dataset.headingType;
      
      // Get search query from data attribute (set at render time) or current input value
      // Note: browser automatically decodes HTML entities in data attributes
      const searchQuery = item.dataset.searchQuery || currentSearchQuery || searchInput?.value.trim() || '';
      
      try {
        if (tabId) {
          // Activate existing tab
          await browser.tabs.update(parseInt(tabId), { active: true });
          const tab = await browser.tabs.get(parseInt(tabId));
          await browser.windows.update(tab.windowId, { focused: true });
          
          // Send message to content script to scroll to heading
          if (headingId) {
            try {
              await browser.tabs.sendMessage(parseInt(tabId), {
                action: 'scrollToHeading',
                headingId: headingId,
                elementType: headingType,
                searchQuery: searchQuery
              });
            } catch (e) {
              console.debug('Could not scroll to heading:', e.message);
            }
          }
        } else if (url) {
          // Open URL in new tab
          const newTab = await browser.tabs.create({ url: url, active: true });
          
          const loadListener = (tabId, info) => {
            if (tabId === newTab.id && info.status === 'complete') {
              browser.tabs.onUpdated.removeListener(loadListener);
              setTimeout(async () => {
                if (headingId) {
                  try {
                    await browser.tabs.sendMessage(newTab.id, {
                      action: 'scrollToHeading',
                      headingId: headingId,
                      elementType: headingType,
                      searchQuery: searchQuery
                    });
                  } catch (e) {
                    console.debug('Could not scroll to heading in new tab:', e.message);
                  }
                }
              }, 100);
            }
          };
          browser.tabs.onUpdated.addListener(loadListener);
        }

        // Save search query to history
        if (searchQuery) {
          saveSearchQuery(searchQuery);
        }

        // Close popup
        window.close();
      } catch (error) {
        console.error('Error opening result:', error);
      }
    });
  });

  // Add click handlers for image/video/audio thumbnails
  tabsList.querySelectorAll('.heading-search-item-thumbnail.clickable').forEach(thumbnail => {
    thumbnail.addEventListener('click', (e) => {
      e.stopPropagation();
      const imgUrl = thumbnail.dataset.imgUrl;
      const videoUrl = thumbnail.dataset.videoUrl;
      const audioUrl = thumbnail.dataset.audioUrl;
      
      if (imgUrl) {
        browser.tabs.create({ url: imgUrl });
      } else if (videoUrl) {
        browser.tabs.create({ url: videoUrl });
      } else if (audioUrl) {
        browser.tabs.create({ url: audioUrl });
      }
    });
  });

  // Add toggle handlers for subcategories
  tabsList.querySelectorAll('.heading-search-subcategory-header').forEach(header => {
    header.addEventListener('click', () => {
      const subcategory = header.closest('.heading-search-subcategory');
      subcategory.classList.toggle('collapsed');
      const toggle = header.querySelector('.heading-search-subcategory-toggle');
      if (toggle) {
        toggle.textContent = subcategory.classList.contains('collapsed') ? '+' : '−';
      }
    });
  });
}

// Open selected result by element
async function openResultByElement(item) {
  if (!item) return;

  const url = item.dataset.url;
  const tabId = item.dataset.tabId;

  try {
    if (tabId) {
      // Activate existing tab
      await browser.tabs.update(parseInt(tabId), { active: true });
      const tab = await browser.tabs.get(parseInt(tabId));
      await browser.windows.update(tab.windowId, { focused: true });
    } else if (url) {
      // Open URL
      await browser.tabs.create({ url: url, active: true });
    }

    // Save search query to history
    const query = searchInput?.value.trim();
    if (query) {
      saveSearchQuery(query);
    }

    // Close popup
    window.close();
  } catch (error) {
    console.error('Error opening result:', error);
  }
}

// Setup search input handler
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (!query) {
      // Show tabs when input becomes empty (not history)
      filteredTabs = tabs;
      headingSearchResults = [];
      isShowingHistory = false;
      renderTabs(tabs, []);
      if (tabCountEl) tabCountEl.textContent = `${tabs.length} tabs`;
      return;
    }

    // Hide history, show search results
    isShowingHistory = false;
    
    // Use SearchEngine for searching
    searchEngine.setSearchQuery(query);
  });

  searchInput.addEventListener('focus', (e) => {
    const query = e.target.value.trim();
    
    // Show history when input is empty on focus
    if (!query && searchHistory.length > 0) {
      renderSearchHistory();
      if (tabCountEl) tabCountEl.textContent = 'Recent searches';
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isShowingHistory) {
        // Navigate history items
        const historyItems = tabsList?.querySelectorAll('.search-history-item');
        if (historyItems && historyItems.length > 0) {
          selectedIndex = Math.min(selectedIndex + 1, historyItems.length - 1);
          updateHistorySelection(historyItems);
        }
      } else {
        const totalItems = filteredTabs.length + headingSearchResults.length;
        selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
        updateSelection();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isShowingHistory) {
        const historyItems = tabsList?.querySelectorAll('.search-history-item');
        if (historyItems && historyItems.length > 0) {
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateHistorySelection(historyItems);
        }
      } else {
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (isShowingHistory) {
        // Select current history item
        const historyItems = tabsList?.querySelectorAll('.search-history-item');
        if (historyItems && historyItems[selectedIndex]) {
          const query = historyItems[selectedIndex].dataset.query;
          searchInput.value = query;
          searchEngine.setSearchQuery(query);
          isShowingHistory = false;
        }
      } else if (selectedIndex >= 0) {
        openResult(selectedIndex);
        // Save search query after opening result
        const query = searchInput.value.trim();
        if (query) {
          saveSearchQuery(query);
        }
      } else {
        // Save search query even if no result selected
        const query = searchInput.value.trim();
        if (query) {
          saveSearchQuery(query);
        }
      }
    }
  });
}

// Update history item selection
function updateHistorySelection(historyItems) {
  historyItems.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
    if (index === selectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// Update selection
function updateSelection() {
  const tabItems = tabsList?.querySelectorAll('.tab-item');
  const headingItems = tabsList?.querySelectorAll('.heading-search-item');
  
  // Reset all selections
  tabItems?.forEach(item => item.classList.remove('selected'));
  headingItems?.forEach(item => item.classList.remove('selected'));
  
  const totalTabs = filteredTabs.length;
  
  // Find the selected item
  if (selectedIndex < totalTabs && tabItems && tabItems[selectedIndex]) {
    tabItems[selectedIndex].classList.add('selected');
    tabItems[selectedIndex].scrollIntoView({ block: 'nearest' });
  } else if (selectedIndex >= totalTabs) {
    const headingIndex = selectedIndex - totalTabs;
    if (headingItems && headingItems[headingIndex]) {
      headingItems[headingIndex].classList.add('selected');
      headingItems[headingIndex].scrollIntoView({ block: 'nearest' });
    }
  }
}

// Open selected result by index
async function openResult(index) {
  const totalTabs = filteredTabs.length;
  
  if (index < totalTabs) {
    // It's a tab
    const item = tabsList?.querySelectorAll('.tab-item')[index];
    if (item) {
      openResultByElement(item);
    }
  } else {
    // It's a heading result
    const headingIndex = index - totalTabs;
    const item = tabsList?.querySelectorAll('.heading-search-item')[headingIndex];
    if (item) {
      // Trigger click on heading item
      item.click();
    }
  }
}

// Close history when clicking outside
document.addEventListener('click', (e) => {
  if (isShowingHistory && !e.target.closest('.search-history-container') && e.target !== searchInput) {
    const query = searchInput?.value.trim();
    if (!query) {
      // Refresh history to ensure it's still current
      loadSearchHistory().then(() => {
        renderSearchHistory();
      });
    } else {
      isShowingHistory = false;
    }
  }
});

// Initialize on load
init();
