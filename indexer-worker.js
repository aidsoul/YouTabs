/**
 * YouTabs Indexing Web Worker
 * Handles heavy indexing operations in background to avoid blocking UI
 */

// Message handler
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'extractHeadings':
      await extractHeadingsInWorker(data);
      break;
    case 'processBatch':
      await processBatch(data);
      break;
    default:
      self.postMessage({ type: 'error', error: 'Unknown message type' });
  }
};

// Extract headings from page content
async function extractHeadingsInWorker({ html, maxChars = 250 }) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = [];
    
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
    
    // Extract paragraphs
    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach((el, index) => {
      const text = el.textContent?.trim();
      if (text && text.length > 10) { // Skip short paragraphs
        headings.push({
          id: `p-${index}`,
          text: text.substring(0, maxChars),
          level: 0,
          tag: 'paragraph'
        });
      }
    });
    
    // Extract links - limit to first 30
    const links = doc.querySelectorAll('a');
    const maxLinks = Math.min(links.length, 30);
    for (let i = 0; i < maxLinks; i++) {
      const el = links[i];
      const text = el.textContent?.trim();
      const href = el.getAttribute('href');
      if (text) {
        headings.push({
          id: `link-${i}`,
          text: text.substring(0, maxChars),
          level: 0,
          tag: 'link',
          href: href
        });
      }
    }
    
    // Extract images with alt text - limit to first 20
    const images = doc.querySelectorAll('img');
    const maxImages = Math.min(images.length, 20);
    for (let i = 0; i < maxImages; i++) {
      const el = images[i];
      const alt = el.getAttribute('alt');
      const src = el.getAttribute('src');
      if (alt) {
        headings.push({
          id: `img-${i}`,
          text: alt.substring(0, maxChars),
          level: 0,
          tag: 'image',
          src: src
        });
      }
    }
    
    // Extract divs with meaningful content - limit to first 50 to avoid performance issues
    const divs = doc.querySelectorAll('div');
    const maxDivs = Math.min(divs.length, 50); // Limit processing
    for (let i = 0; i < maxDivs; i++) {
      const el = divs[i];
      const text = el.textContent?.trim();
      // Only include divs with substantial content
      if (text && text.length > 50 && text.length < 500) {
        headings.push({
          id: `div-${i}`,
          text: text.substring(0, maxChars),
          level: 0,
          tag: 'div'
        });
      }
    }
    
    self.postMessage({ 
      type: 'headingsExtracted', 
      headings: headings,
      count: headings.length
    });
    
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error.message 
    });
  }
}

// Process a batch of URLs for indexing
async function processBatch({ pages, maxChars = 250 }) {
  const results = [];
  
  for (const page of pages) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(page.html, 'text/html');
      
      const headings = [];
      
      // Extract headings
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
      
      results.push({
        url: page.url,
        headings: headings,
        success: true
      });
      
    } catch (error) {
      results.push({
        url: page.url,
        error: error.message,
        success: false
      });
    }
  }
  
  self.postMessage({ 
    type: 'batchProcessed', 
    results: results 
  });
}
