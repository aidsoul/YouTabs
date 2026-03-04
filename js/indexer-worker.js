/**
 * YouTabs Indexing Web Worker
 * Handles heavy indexing operations in background to avoid blocking UI
 */

// Fuzzy match implementation for worker (avoids loading entire YouTabsCore)
function fuzzyMatch(query, text, maxDistance = 2) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Exact match
  if (lowerText.includes(lowerQuery)) {
    return { match: true, distance: 0, score: 1 };
  }
  
  // Word-based matching
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  const textWords = lowerText.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length > 0 && textWords.length > 0) {
    let allWordsFound = true;
    let totalWordDistance = 0;
    
    for (const qWord of queryWords) {
      let minDist = Infinity;
      
      for (const tWord of textWords) {
        if (tWord === qWord) {
          minDist = 0;
          break;
        }
        if (Math.abs(tWord.length - qWord.length) <= maxDistance) {
          const dist = levenshteinDistance(qWord, tWord, maxDistance);
          if (dist < minDist) {
            minDist = dist;
          }
          if (minDist === 0) break;
        }
      }
      
      if (minDist <= maxDistance) {
        totalWordDistance += minDist;
      } else {
        allWordsFound = false;
        break;
      }
    }
    
    if (allWordsFound) {
      const avgDistance = totalWordDistance / queryWords.length;
      const score = Math.max(0, 1 - avgDistance / (maxDistance + 1));
      return { match: true, distance: avgDistance, score };
    }
  }
  
  return { match: false, distance: Infinity, score: 0 };
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2, maxDist = Infinity) {
  const m = str1.length;
  const n = str2.length;
  
  if (Math.abs(m - n) > maxDist) {
    return maxDist + 1;
  }
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }
  
  return dp[m][n];
}

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
    case 'searchHeadings':
      await searchHeadingsInWorker(data);
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

// Search headings in worker to avoid blocking UI
async function searchHeadingsInWorker({ query, pageHeadings, filterHeadingTypes, maxResults = 15 }) {
  try {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [urlKey, headings] of Object.entries(pageHeadings)) {
      for (const heading of headings) {
        // Filter by heading type
        if (!filterHeadingTypes.includes(heading.type)) {
          continue;
        }
        
        // Use fuzzy matching for search
        const lowerText = heading.text.toLowerCase();
        const fuzzyResult = fuzzyMatch(lowerQuery, lowerText, 2);
        
        if (fuzzyResult.match) {
          // Calculate relevance score
          let relevance = 0;
          
          if (fuzzyResult.distance === 0) {
            relevance = 100;
          } else if (fuzzyResult.distance <= 1) {
            relevance = 80 + (1 - fuzzyResult.distance) * 10;
          } else {
            relevance = 30 + fuzzyResult.score * 40;
          }
          
          // Give higher priority to headings (h1-h6) and paragraphs
          if (heading.type === 'heading') {
            relevance += 20;
          } else if (heading.type === 'paragraph') {
            relevance += 10;
          }
          
          results.push({
            pageUrl: heading.url || urlKey,
            heading: heading,
            relevance: relevance,
            fuzzyScore: fuzzyResult.score
          });
        }
      }
    }
    
    // Sort by relevance and limit results
    results.sort((a, b) => b.relevance - a.relevance);
    const limitedResults = results.slice(0, maxResults);
    
    self.postMessage({
      type: 'searchCompleted',
      results: limitedResults,
      count: limitedResults.length
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
}
