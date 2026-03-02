/**
 * YouTabs Extension - Content Script
 * Handles messages from the sidebar to scroll to headings and other elements
 */

// Listen for messages from the extension
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle extract headings request from background script
  if (message.action === 'extractHeadings') {
    const headings = extractPageHeadings();
    sendResponse({ headings: headings });
    return true;
  }
  
  if (message.action === 'scrollToHeading') {
    const headingId = message.headingId;
    const elementType = message.elementType;
    const searchQuery = message.searchQuery;
    
    if (headingId) {
      let element = null;
      
      // Try to find element by ID
      element = document.getElementById(headingId);
      
      // If not found by ID, try to find by looking for anchors
      if (!element) {
        const anchors = document.querySelectorAll(`a[id="${headingId}"], a[name="${headingId}"]`);
        if (anchors.length > 0) {
          element = anchors[0];
        }
      }
      
      // If still not found, try to find by element type and text
      if (!element) {
        const selector = getSelectorForType(elementType, headingId);
        if (selector) {
          element = document.querySelector(selector);
        }
      }
      
      if (element) {
        scrollToElement(element);
        // Highlight search query text on the page
        if (searchQuery) {
          highlightSearchText(searchQuery);
        }
        sendResponse({ success: true });
      } else {
        // Even if element not found, try to highlight search text
        if (searchQuery) {
          highlightSearchText(searchQuery);
        }
        sendResponse({ success: element !== null, error: element ? null : 'Element not found' });
      }
    } else {
      sendResponse({ success: false, error: 'No element ID provided' });
    }
  }
  
  // Handle adding selected text to indexing
  if (message.action === 'addToIndexing') {
    const selectedText = message.text;
    const pageUrl = message.url;
    
    // Validate text length
    const MAX_TEXT_LENGTH = 10000;
    if (!selectedText || selectedText.length === 0) {
      sendResponse({ success: false, error: 'No text provided' });
      return true;
    }
    if (selectedText.length > MAX_TEXT_LENGTH) {
      sendResponse({ success: false, error: 'Text exceeds maximum length of ' + MAX_TEXT_LENGTH });
      return true;
    }
    
    // Validate URL
    if (!pageUrl) {
      sendResponse({ success: false, error: 'No URL provided' });
      return true;
    }
    try {
      new URL(pageUrl);
    } catch (e) {
      sendResponse({ success: false, error: 'Invalid URL' });
      return true;
    }
    
    if (selectedText && pageUrl) {
      addSelectedTextToIndex(selectedText, pageUrl).then(result => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response
    }
  }
  
  // Handle updating the entire page index
  if (message.action === 'updateIndex') {
    const pageUrl = message.url;
    
    if (!pageUrl) {
      sendResponse({ success: false, error: 'No URL provided' });
      return true;
    }
    
    try {
      new URL(pageUrl);
    } catch (e) {
      sendResponse({ success: false, error: 'Invalid URL' });
      return true;
    }
    
    // Extract all headings from the page
    const headings = extractPageHeadings();
    
    // Save to IndexedDB
    updatePageIndex(pageUrl, headings).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
  
  return true; // Keep the message channel open for async response
});

// Get CSS selector based on element type
function getSelectorForType(type, id) {
  if (!type || !id) return null;
  
  // For headings, try to find by ID or text
  if (type === 'heading') {
    const level = id.replace('heading-', '');
    if (!isNaN(level)) {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings[parseInt(level)]) {
        return getPathTo(headings[parseInt(level)]);
      }
    }
    return null;
  }
  
  // For paragraphs
  if (type === 'paragraph') {
    const index = parseInt(id.replace('p-', ''));
    if (!isNaN(index)) {
      const paragraphs = document.querySelectorAll('p');
      if (paragraphs[index]) {
        return getPathTo(paragraphs[index]);
      }
    }
    return null;
  }
  
  // For links
  if (type === 'link') {
    const index = parseInt(id.replace('a-', ''));
    if (!isNaN(index)) {
      const links = document.querySelectorAll('a');
      if (links[index]) {
        return getPathTo(links[index]);
      }
    }
    return null;
  }
  
  // For images
  if (type === 'image') {
    const index = parseInt(id.replace('img-', ''));
    if (!isNaN(index)) {
      const images = document.querySelectorAll('img');
      if (images[index]) {
        return getPathTo(images[index]);
      }
    }
    return null;
  }
  
  // For divs
  if (type === 'div') {
    const index = parseInt(id.replace('div-', ''));
    if (!isNaN(index)) {
      const divs = document.querySelectorAll('div');
      if (divs[index]) {
        return getPathTo(divs[index]);
      }
    }
    return null;
  }
  
  // For lists (ul, ol)
  if (type === 'list') {
    const index = parseInt(id.replace('list-', ''));
    if (!isNaN(index)) {
      const lists = document.querySelectorAll('ul, ol');
      if (lists[index]) {
        return getPathTo(lists[index]);
      }
    }
    return null;
  }
  
  // For list items (li)
  if (type === 'listItem') {
    const index = parseInt(id.replace('li-', ''));
    if (!isNaN(index)) {
      const listItems = document.querySelectorAll('li');
      if (listItems[index]) {
        return getPathTo(listItems[index]);
      }
    }
    return null;
  }
  
  // For file inputs
  if (type === 'file') {
    const index = parseInt(id.replace('file-', ''));
    if (!isNaN(index)) {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      if (fileInputs[index]) {
        return getPathTo(fileInputs[index]);
      }
    }
    return null;
  }
  
  // For span elements
  if (type === 'span') {
    const index = parseInt(id.replace('span-', ''));
    if (!isNaN(index)) {
      const spans = document.querySelectorAll('span');
      if (spans[index]) {
        return getPathTo(spans[index]);
      }
    }
    return null;
  }
  
  // For table elements
  if (type === 'table') {
    const index = parseInt(id.replace('table-', ''));
    if (!isNaN(index)) {
      const tables = document.querySelectorAll('table');
      if (tables[index]) {
        return getPathTo(tables[index]);
      }
    }
    return null;
  }
  
  // For download links
  if (type === 'fileDownload') {
    const index = parseInt(id.replace('download-', ''));
    if (!isNaN(index)) {
      const downloadLinks = document.querySelectorAll('a[download]');
      if (downloadLinks[index]) {
        return getPathTo(downloadLinks[index]);
      }
    }
    return null;
  }
  
  // For video elements
  if (type === 'video') {
    const index = parseInt(id.replace('video-', ''));
    if (!isNaN(index)) {
      const videos = document.querySelectorAll('video');
      if (videos[index]) {
        return getPathTo(videos[index]);
      }
    }
    return null;
  }
  
  // For audio elements
  if (type === 'audio') {
    const index = parseInt(id.replace('audio-', ''));
    if (!isNaN(index)) {
      const audios = document.querySelectorAll('audio');
      if (audios[index]) {
        return getPathTo(audios[index]);
      }
    }
    return null;
  }
  
  // For embedded videos (iframe)
  if (type === 'videoEmbed') {
    const index = parseInt(id.replace('iframe-video-', ''));
    if (!isNaN(index)) {
      const iframes = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[src*="video"]');
      if (iframes[index]) {
        return getPathTo(iframes[index]);
      }
    }
    return null;
  }

  // Table
  if (type === 'table') {
    const index = parseInt(id.replace('table-', ''));
    if (!isNaN(index)) {
      const tables = document.querySelectorAll('table');
      if (tables[index]) {
        return getPathTo(tables[index]);
      }
    }
    return null;
  }

  // Section
  if (type === 'section') {
    const index = parseInt(id.replace('section-', ''));
    if (!isNaN(index)) {
      const sections = document.querySelectorAll('section');
      if (sections[index]) {
        return getPathTo(sections[index]);
      }
    }
    return null;
  }

  // Article
  if (type === 'article') {
    const index = parseInt(id.replace('article-', ''));
    if (!isNaN(index)) {
      const articles = document.querySelectorAll('article');
      if (articles[index]) {
        return getPathTo(articles[index]);
      }
    }
    return null;
  }

  // Aside
  if (type === 'aside') {
    const index = parseInt(id.replace('aside-', ''));
    if (!isNaN(index)) {
      const asides = document.querySelectorAll('aside');
      if (asides[index]) {
        return getPathTo(asides[index]);
      }
    }
    return null;
  }

  // Nav
  if (type === 'nav') {
    const index = parseInt(id.replace('nav-', ''));
    if (!isNaN(index)) {
      const navs = document.querySelectorAll('nav');
      if (navs[index]) {
        return getPathTo(navs[index]);
      }
    }
    return null;
  }

  // Footer
  if (type === 'footer') {
    const index = parseInt(id.replace('footer-', ''));
    if (!isNaN(index)) {
      const footers = document.querySelectorAll('footer');
      if (footers[index]) {
        return getPathTo(footers[index]);
      }
    }
    return null;
  }

  // Header (HTML element)
  if (type === 'header') {
    const index = parseInt(id.replace('header-', ''));
    if (!isNaN(index)) {
      const headers = document.querySelectorAll('header');
      if (headers[index]) {
        return getPathTo(headers[index]);
      }
    }
    return null;
  }

  // Blockquote
  if (type === 'blockquote') {
    const index = parseInt(id.replace('blockquote-', ''));
    if (!isNaN(index)) {
      const blockquotes = document.querySelectorAll('blockquote');
      if (blockquotes[index]) {
        return getPathTo(blockquotes[index]);
      }
    }
    return null;
  }

  // Code
  if (type === 'code') {
    const index = parseInt(id.replace('code-', ''));
    if (!isNaN(index)) {
      const codes = document.querySelectorAll('code');
      if (codes[index]) {
        return getPathTo(codes[index]);
      }
    }
    return null;
  }

  // Pre
  if (type === 'pre') {
    const index = parseInt(id.replace('pre-', ''));
    if (!isNaN(index)) {
      const pres = document.querySelectorAll('pre');
      if (pres[index]) {
        return getPathTo(pres[index]);
      }
    }
    return null;
  }

  // Cite
  if (type === 'cite') {
    const index = parseInt(id.replace('cite-', ''));
    if (!isNaN(index)) {
      const cites = document.querySelectorAll('cite');
      if (cites[index]) {
        return getPathTo(cites[index]);
      }
    }
    return null;
  }

  // Abbr
  if (type === 'abbr') {
    const index = parseInt(id.replace('abbr-', ''));
    if (!isNaN(index)) {
      const abbrs = document.querySelectorAll('abbr');
      if (abbrs[index]) {
        return getPathTo(abbrs[index]);
      }
    }
    return null;
  }

  // Time
  if (type === 'time') {
    const index = parseInt(id.replace('time-', ''));
    if (!isNaN(index)) {
      const times = document.querySelectorAll('time');
      if (times[index]) {
        return getPathTo(times[index]);
      }
    }
    return null;
  }

  // Mark
  if (type === 'mark') {
    const index = parseInt(id.replace('mark-', ''));
    if (!isNaN(index)) {
      const marks = document.querySelectorAll('mark');
      if (marks[index]) {
        return getPathTo(marks[index]);
      }
    }
    return null;
  }

  // Button
  if (type === 'button') {
    const index = parseInt(id.replace('button-', ''));
    if (!isNaN(index)) {
      const buttons = document.querySelectorAll('button');
      if (buttons[index]) {
        return getPathTo(buttons[index]);
      }
    }
    return null;
  }

  // Textarea
  if (type === 'textarea') {
    const index = parseInt(id.replace('textarea-', ''));
    if (!isNaN(index)) {
      const textareas = document.querySelectorAll('textarea');
      if (textareas[index]) {
        return getPathTo(textareas[index]);
      }
    }
    return null;
  }

  // Select
  if (type === 'select') {
    const index = parseInt(id.replace('select-', ''));
    if (!isNaN(index)) {
      const selects = document.querySelectorAll('select');
      if (selects[index]) {
        return getPathTo(selects[index]);
      }
    }
    return null;
  }

  // Label
  if (type === 'label') {
    const index = parseInt(id.replace('label-', ''));
    if (!isNaN(index)) {
      const labels = document.querySelectorAll('label');
      if (labels[index]) {
        return getPathTo(labels[index]);
      }
    }
    return null;
  }

  // Figure
  if (type === 'figure') {
    const index = parseInt(id.replace('figure-', ''));
    if (!isNaN(index)) {
      const figures = document.querySelectorAll('figure');
      if (figures[index]) {
        return getPathTo(figures[index]);
      }
    }
    return null;
  }

  // Details
  if (type === 'details') {
    const index = parseInt(id.replace('details-', ''));
    if (!isNaN(index)) {
      const details = document.querySelectorAll('details');
      if (details[index]) {
        return getPathTo(details[index]);
      }
    }
    return null;
  }

  // Summary
  if (type === 'summary') {
    const index = parseInt(id.replace('summary-', ''));
    if (!isNaN(index)) {
      const summaries = document.querySelectorAll('summary');
      if (summaries[index]) {
        return getPathTo(summaries[index]);
      }
    }
    return null;
  }

  return null;
}

// Generate a unique CSS path to an element
function getPathTo(element) {
  if (element.id) {
    return '#' + CSS.escape(element.id);
  }
  
  let path = [];
  while (element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += '#' + CSS.escape(element.id);
      path.unshift(selector);
      break;
    } else {
      let sib = element, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth > 1) {
        selector += ':nth-of-type('+nth+')';
      }
    }
    path.unshift(selector);
    element = element.parentNode;
  }
  return path.join(' > ');
}

// Scroll to element with highlight
function scrollToElement(element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Add a temporary highlight
  const originalBackgroundColor = element.style.backgroundColor;
  const originalTransition = element.style.transition;
  element.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
  element.style.transition = 'background-color 0.5s ease';
  
  setTimeout(() => {
    element.style.backgroundColor = originalBackgroundColor;
    element.style.transition = originalTransition;
  }, 1500);
}

// Highlight search text on the page
function highlightSearchText(query) {
  if (!query || query.length < 2) return;
  
  // Remove any existing highlights first
  removeHighlights();
  
  // Create marker element to walk through the DOM
  const marker = document.createElement('div');
  marker.style.display = 'none';
  document.body.appendChild(marker);
  
  // Use TreeWalker to find text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style, and already highlighted elements
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (tagName === 'script' || 
            tagName === 'style' || 
            tagName === 'noscript' || 
            tagName === 'textarea' || 
            tagName === 'input' ||
            parent.classList.contains('yt-highlight-mark')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Only accept nodes with searchable text
        if (node.textContent.trim().length > 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Search and highlight matches
  const regex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
  let matchesFound = 0;
  const maxHighlights = 100; // Limit to prevent performance issues
  
  for (const textNode of textNodes) {
    if (matchesFound >= maxHighlights) break;
    
    const text = textNode.textContent;
    if (regex.test(text)) {
      regex.lastIndex = 0; // Reset regex state
      
      const span = document.createElement('span');
      // Use DOMParser to safely parse HTML
      const originalText = text.replace(regex, '<mark class="yt-highlight-mark">$1</mark>');
      const parser = new DOMParser();
      const doc = parser.parseFromString(originalText, 'text/html');
      const tempDiv = doc.body;
      // Transfer all child nodes to our span
      while (tempDiv.firstChild) {
        span.appendChild(tempDiv.firstChild);
      }
      
      // Replace the text node with the highlighted span
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(span, textNode);
        matchesFound++;
      }
    }
  }
  
  // Clean up marker
  marker.remove();
  
  // Scroll to first match if found
  if (matchesFound > 0) {
    const firstHighlight = document.querySelector('.yt-highlight-mark');
    if (firstHighlight) {
      // Delay slightly to allow rendering
      setTimeout(() => {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add flash animation to first highlight
        firstHighlight.classList.add('yt-highlight-flash');
        setTimeout(() => {
          firstHighlight.classList.remove('yt-highlight-flash');
        }, 2000);
      }, 100);
    }
  }
}

// Remove all highlight marks
function removeHighlights() {
  const marks = document.querySelectorAll('.yt-highlight-mark');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
  });
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add selected text to page indexing
async function addSelectedTextToIndex(text, pageUrl) {
  try {
    // Get URL key for indexing
    const urlKey = getUrlKey(pageUrl);
    
    // Try to use YouTabsDB if available
    if (window.YouTabsDB) {
      const pageIndex = await window.YouTabsDB.getPagesIndexByUrl(urlKey);
      
      let headings = [];
      if (pageIndex && pageIndex.headings) {
        headings = pageIndex.headings;
      }
      
      // Add the selected text as a custom heading
      const customHeading = {
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        text: text,
        level: 0, // 0 indicates custom indexed text
        isCustom: true
      };
      
      headings.push(customHeading);
      await window.YouTabsDB.savePageHeadingsByUrl(pageUrl, null, headings);
      
      return { success: true, message: 'Text added to indexing' };
    }
    
    // Fallback: use local storage
    const storageKey = 'pagesIndex_' + urlKey;
    const stored = await browser.storage.local.get(storageKey);
    let headings = [];
    
    if (stored[storageKey] && stored[storageKey].headings) {
      headings = stored[storageKey].headings;
    }
    
    // Add the selected text as a custom heading
    const customHeading = {
      id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      text: text,
      level: 0, // 0 indicates custom indexed text
      isCustom: true
    };
    
    headings.push(customHeading);
    
    await browser.storage.local.set({
      [storageKey]: {
        url: pageUrl,
        headings: headings,
        indexedAt: Date.now()
      }
    });
    
    return { success: true, message: 'Text added to indexing' };
  } catch (error) {
    console.error('Error adding to indexing:', error);
    return { success: false, error: error.message };
  }
}

// Update the entire page index with fresh headings
async function updatePageIndex(pageUrl, headings) {
  try {
    // Get URL key for indexing
    const urlKey = getUrlKey(pageUrl);
    
    // Try to use YouTabsDB if available
    if (window.YouTabsDB) {
      await window.YouTabsDB.savePageHeadingsByUrl(pageUrl, null, headings);
      
      return { 
        success: true, 
        message: 'Index updated successfully',
        count: headings.length
      };
    }
    
    // Fallback: use local storage
    const storageKey = 'pagesIndex_' + urlKey;
    
    await browser.storage.local.set({
      [storageKey]: {
        url: pageUrl,
        headings: headings,
        indexedAt: Date.now()
      }
    });
    
    return { 
      success: true, 
      message: 'Index updated successfully',
      count: headings.length
    };
  } catch (error) {
    console.error('Error updating index:', error);
    return { success: false, error: error.message };
  }
}

// Generate URL key for indexing
function getUrlKey(url) {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash and fragment
    let key = urlObj.origin + urlObj.pathname;
    if (key.endsWith('/')) {
      key = key.slice(0, -1);
    }
    return key;
  } catch (e) {
    return url;
  }
}

// Extract headings and content from the page (used by background script)
function extractPageHeadings() {
  const MAX_LENGTH = 250;
  const headings = [];
  
  const truncate = (text) => {
    const trimmed = text.trim();
    if (trimmed.length > MAX_LENGTH) {
      return trimmed.substring(0, MAX_LENGTH - 3) + '...';
    }
    return trimmed;
  };
  
  // Extract h1-h6 headings
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headingElements.forEach((element, index) => {
    let id = element.id;
    if (!id) {
      id = 'heading-' + index;
      const anchor = element.querySelector('a[id], a[name]');
      if (anchor) {
        id = anchor.id || anchor.getAttribute('name');
      }
    }
    
    const text = truncate(element.textContent);
    if (text) {
      headings.push({
        id: id,
        text: text,
        level: parseInt(element.tagName.substring(1)),
        type: 'heading',
        url: window.location.href
      });
    }
  });
  
  // Extract <p> tags
  const pElements = document.querySelectorAll('p');
  pElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text) {
      headings.push({
        id: 'p-' + index,
        text: text,
        type: 'paragraph',
        url: window.location.href
      });
    }
  });
  
  // Extract <a> tags with text
  const aElements = document.querySelectorAll('a');
  aElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    const href = element.href;
    if (text || href) {
      headings.push({
        id: 'a-' + index,
        text: text,
        type: 'link',
        url: href || window.location.href,
        linkUrl: href
      });
    }
  });
  
  // Extract <img> tags with alt text
  const imgElements = document.querySelectorAll('img');
  imgElements.forEach((element, index) => {
    const alt = truncate(element.alt);
    const src = element.src;
    if (alt || src) {
      headings.push({
        id: 'img-' + index,
        text: alt,
        type: 'image',
        url: window.location.href,
        imgUrl: src
      });
    }
  });
  
  // Extract <div> tags with text content (limit to prevent performance issues)
  const MAX_DIVS = 50;
  const divElements = document.querySelectorAll('div');
  const divArray = Array.from(divElements).slice(0, MAX_DIVS);
  divArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    // Only index divs with meaningful text (more than just whitespace)
    if (text && text.length > 2) {
      headings.push({
        id: 'div-' + index,
        text: text,
        type: 'div',
        url: window.location.href
      });
    }
  });
  
  // Extract <span> tags with text content (limit to prevent performance issues)
  const MAX_SPANS = 100;
  const spanElements = document.querySelectorAll('span');
  const spanArray = Array.from(spanElements).slice(0, MAX_SPANS);
  spanArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    // Only index spans with meaningful text (more than just whitespace)
    if (text && text.length > 2) {
      headings.push({
        id: 'span-' + index,
        text: text,
        type: 'span',
        url: window.location.href
      });
    }
  });
  
  // Extract <table> tags with headers and captions
  const tableElements = document.querySelectorAll('table');
  tableElements.forEach((element, index) => {
    // Get table caption if available
    const caption = element.querySelector('caption');
    const captionText = caption ? truncate(caption.textContent) : '';
    
    // Get table headers
    const headers = [];
    const headerCells = element.querySelectorAll('th');
    headerCells.forEach(th => {
      const headerText = truncate(th.textContent);
      if (headerText) {
        headers.push(headerText);
      }
    });
    
    // Get first row data as preview
    const firstRow = element.querySelector('tr');
    let previewText = '';
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td, th');
      const cellTexts = [];
      cells.forEach(cell => {
        const cellText = truncate(cell.textContent);
        if (cellText) {
          cellTexts.push(cellText);
        }
      });
      previewText = cellTexts.join(' | ');
    }
    
    // Get row count
    const rowCount = element.querySelectorAll('tr').length;
    
    headings.push({
      id: 'table-' + index,
      text: captionText || previewText || 'Table ' + (index + 1),
      type: 'table',
      url: window.location.href,
      tableCaption: captionText,
      tableHeaders: headers,
      tablePreview: previewText,
      tableRows: rowCount
    });
  });
  
  // Extract <section> tags with text content
  const MAX_SECTIONS = 30;
  const sectionElements = document.querySelectorAll('section');
  const sectionArray = Array.from(sectionElements).slice(0, MAX_SECTIONS);
  sectionArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'section-' + index,
        text: text,
        type: 'section',
        url: window.location.href
      });
    }
  });
  
  // Extract <article> tags with text content
  const MAX_ARTICLES = 20;
  const articleElements = document.querySelectorAll('article');
  const articleArray = Array.from(articleElements).slice(0, MAX_ARTICLES);
  articleArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'article-' + index,
        text: text,
        type: 'article',
        url: window.location.href
      });
    }
  });
  
  // Extract <aside> tags with text content
  const MAX_ASIDES = 15;
  const asideElements = document.querySelectorAll('aside');
  const asideArray = Array.from(asideElements).slice(0, MAX_ASIDES);
  asideArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'aside-' + index,
        text: text,
        type: 'aside',
        url: window.location.href
      });
    }
  });
  
  // Extract <nav> tags with text content
  const MAX_NAVS = 10;
  const navElements = document.querySelectorAll('nav');
  const navArray = Array.from(navElements).slice(0, MAX_NAVS);
  navArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'nav-' + index,
        text: text,
        type: 'nav',
        url: window.location.href
      });
    }
  });
  
  // Extract <footer> tags with text content
  const MAX_FOOTERS = 10;
  const footerElements = document.querySelectorAll('footer');
  const footerArray = Array.from(footerElements).slice(0, MAX_FOOTERS);
  footerArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'footer-' + index,
        text: text,
        type: 'footer',
        url: window.location.href
      });
    }
  });
  
  // Extract <header> tags with text content
  const MAX_HEADERS = 10;
  const headerHtmlElements = document.querySelectorAll('header');
  const headerArray = Array.from(headerHtmlElements).slice(0, MAX_HEADERS);
  headerArray.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'header-' + index,
        text: text,
        type: 'header',
        url: window.location.href
      });
    }
  });
  
  // Extract <blockquote> tags
  const blockquoteElements = document.querySelectorAll('blockquote');
  blockquoteElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'blockquote-' + index,
        text: text,
        type: 'blockquote',
        url: window.location.href
      });
    }
  });
  
  // Extract <code> tags
  const codeElements = document.querySelectorAll('code');
  codeElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'code-' + index,
        text: text,
        type: 'code',
        url: window.location.href
      });
    }
  });
  
  // Extract <pre> tags
  const preElements = document.querySelectorAll('pre');
  preElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'pre-' + index,
        text: text,
        type: 'pre',
        url: window.location.href
      });
    }
  });
  
  // Extract <cite> tags
  const citeElements = document.querySelectorAll('cite');
  citeElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'cite-' + index,
        text: text,
        type: 'cite',
        url: window.location.href
      });
    }
  });
  
  // Extract <abbr> tags (title attribute)
  const abbrElements = document.querySelectorAll('abbr');
  abbrElements.forEach((element, index) => {
    const title = element.getAttribute('title');
    const text = truncate(title || element.textContent);
    if (text && text.length > 0) {
      headings.push({
        id: 'abbr-' + index,
        text: text,
        type: 'abbr',
        url: window.location.href
      });
    }
  });
  
  // Extract <time> tags (datetime attribute)
  const timeElements = document.querySelectorAll('time');
  timeElements.forEach((element, index) => {
    const datetime = element.getAttribute('datetime');
    const text = truncate(datetime || element.textContent);
    if (text && text.length > 0) {
      headings.push({
        id: 'time-' + index,
        text: text,
        type: 'time',
        url: window.location.href
      });
    }
  });
  
  // Extract <mark> tags
  const markElements = document.querySelectorAll('mark');
  markElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'mark-' + index,
        text: text,
        type: 'mark',
        url: window.location.href
      });
    }
  });
  
  // Extract <button> tags
  const buttonElements = document.querySelectorAll('button');
  buttonElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    const value = element.value;
    if (text || value) {
      headings.push({
        id: 'button-' + index,
        text: text || value,
        type: 'button',
        url: window.location.href
      });
    }
  });
  
  // Extract <textarea> tags
  const textareaElements = document.querySelectorAll('textarea');
  textareaElements.forEach((element, index) => {
    const placeholder = element.getAttribute('placeholder');
    const name = element.name || element.id || 'Textarea';
    if (placeholder) {
      headings.push({
        id: 'textarea-' + index,
        text: truncate(placeholder),
        type: 'textarea',
        url: window.location.href
      });
    } else {
      headings.push({
        id: 'textarea-' + index,
        text: truncate(name),
        type: 'textarea',
        url: window.location.href
      });
    }
  });
  
  // Extract <select> tags
  const selectElements = document.querySelectorAll('select');
  selectElements.forEach((element, index) => {
    const name = element.name || element.id || 'Select';
    const options = [];
    element.querySelectorAll('option').forEach(opt => {
      const optText = truncate(opt.textContent);
      if (optText) {
        options.push(optText);
      }
    });
    headings.push({
      id: 'select-' + index,
      text: options.length > 0 ? options.join(', ') : name,
      type: 'select',
      url: window.location.href
    });
  });
  
  // Extract <label> tags
  const labelElements = document.querySelectorAll('label');
  labelElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 0) {
      headings.push({
        id: 'label-' + index,
        text: text,
        type: 'label',
        url: window.location.href
      });
    }
  });
  
  // Extract <figure> tags with figcaption
  const figureElements = document.querySelectorAll('figure');
  figureElements.forEach((element, index) => {
    const figcaption = element.querySelector('figcaption');
    const figcaptionText = figcaption ? truncate(figcaption.textContent) : '';
    
    // Get img src if available
    const img = element.querySelector('img');
    const imgSrc = img ? img.src : '';
    
    const text = truncate(element.textContent);
    if (text && text.length > 2) {
      headings.push({
        id: 'figure-' + index,
        text: figcaptionText || text,
        type: 'figure',
        url: window.location.href,
        imgUrl: imgSrc
      });
    }
  });
  
  // Extract <details> tags
  const detailsElements = document.querySelectorAll('details');
  detailsElements.forEach((element, index) => {
    const summary = element.querySelector('summary');
    const summaryText = summary ? truncate(summary.textContent) : '';
    const text = truncate(element.textContent);
    
    if (summaryText || (text && text.length > 2)) {
      headings.push({
        id: 'details-' + index,
        text: summaryText || text,
        type: 'details',
        url: window.location.href
      });
    }
  });
  
  // Extract <summary> tags
  const summaryElements = document.querySelectorAll('summary');
  summaryElements.forEach((element, index) => {
    const text = truncate(element.textContent);
    if (text && text.length > 0) {
      headings.push({
        id: 'summary-' + index,
        text: text,
        type: 'summary',
        url: window.location.href
      });
    }
  });

  return headings;
}
