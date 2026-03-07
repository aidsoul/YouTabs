// YouTabs Search Popup Script
// Uses SearchEngine for searching tabs and indexed data

// State
let tabs = [];
let filteredTabs = [];
let headingSearchResults = [];
let selectedIndex = -1;
let searchEngine = null;

// Get elements
const searchInput = document.getElementById('searchPopupInput');
const tabsList = document.getElementById('tabsList');
const tabCountEl = document.getElementById('tabCount');

// Escape HTML helper
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
async function init() {
  try {
    // Get settings
    const settingsManager = new SettingsManager();
    const settings = await settingsManager.getAll();

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

    // Load indexed page headings from IndexedDB
    await searchEngine.loadPageHeadings();

    // Initial render with all tabs
    renderTabs(tabs, []);

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

// Handle search results from SearchEngine
function handleSearchResults(results) {
  filteredTabs = results.filteredTabs || [];
  headingSearchResults = results.headingResults || [];
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
          <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
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
            <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
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
          <div class="heading-search-item" data-index="${globalIndex}" data-type="heading" data-url="${escapeHtml(pageUrl)}" data-tab-id="${tabId}" data-heading-id="${result.heading?.id || ''}" data-heading-type="${type}">
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
  tabsList.querySelectorAll('.heading-search-item').forEach(item => {
    item.addEventListener('click', async () => {
      const url = item.dataset.url;
      const tabId = item.dataset.tabId;
      const headingId = item.dataset.headingId;
      const headingType = item.dataset.headingType;
      
      const searchQuery = searchInput?.value.trim() || '';
      
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
      // Show all tabs when query is empty
      filteredTabs = tabs;
      headingSearchResults = [];
      renderTabs(tabs, []);
      return;
    }

    // Use SearchEngine for searching
    searchEngine.setSearchQuery(query);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const totalItems = filteredTabs.length + headingSearchResults.length;
      selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        openResult(selectedIndex);
      }
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

// Initialize on load
init();
