/**
 * SearchUtils.js - YouTabs Extension
 * Shared utilities for fuzzy search and text matching
 */

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} maxDist - Maximum distance for early termination
 * @returns {number} The Levenshtein distance
 */
function levenshteinDistance(str1, str2, maxDist = Infinity) {
  const m = str1.length;
  const n = str2.length;
  
  // Early termination: if length difference is too large, no need to compute
  if (Math.abs(m - n) > maxDist) {
    return maxDist + 1;
  }
  
  // Create matrix
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Perform fuzzy matching between query and text
 * @param {string} query - Search query
 * @param {string} text - Text to search in
 * @param {number} maxDistance - Maximum allowed distance for a match
 * @returns {Object} Match result with match, distance, and score properties
 */
function fuzzyMatch(query, text, maxDistance = 2) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Exact match
  if (lowerText.includes(lowerQuery)) {
    return { match: true, distance: 0, score: 1 };
  }
  
  // Word-based matching - check if query words are in text
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  const textWords = lowerText.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length > 0 && textWords.length > 0) {
    let allWordsFound = true;
    let totalWordDistance = 0;
    
    for (const qWord of queryWords) {
      let minDist = Infinity;
      
      for (const tWord of textWords) {
        // Exact word match - no need to compute distance
        if (tWord === qWord) {
          minDist = 0;
          break;
        }
        // Skip Levenshtein if length difference is too large
        if (Math.abs(tWord.length - qWord.length) <= maxDistance) {
          const dist = levenshteinDistance(qWord, tWord, maxDistance);
          if (dist < minDist) {
            minDist = dist;
          }
          // Early termination if exact match found
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
  
  // Check if entire query is close to text using Levenshtein
  if (lowerText.length > 0 && lowerQuery.length > 0 && 
      Math.abs(lowerText.length - lowerQuery.length) <= Math.max(lowerQuery.length * 0.5, maxDistance)) {
    const dist = levenshteinDistance(lowerQuery, lowerText, maxDistance);
    const maxAllowed = Math.max(maxDistance, Math.floor(lowerQuery.length * 0.4));
    
    if (dist <= maxAllowed) {
      const score = Math.max(0, 1 - dist / (maxAllowed + 1));
      return { match: true, distance: dist, score };
    }
  }
  
  return { match: false, distance: Infinity, score: 0 };
}

/**
 * Perform regex matching between pattern and text
 * @param {string} pattern - Regex pattern string
 * @param {string} text - Text to search in
 * @param {string} flags - Regex flags (default: 'i' for case-insensitive)
 * @returns {Object} Match result with match, matches, and error properties
 */
function regexMatch(pattern, text, flags = 'i') {
  if (!pattern || !text) {
    return { match: false, matches: [], error: null };
  }
  
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [];
    let match;
    
    // Find all matches
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        value: match[0],
        index: match.index,
        groups: match.slice(1),
        namedGroups: match.groups || {}
      });
      
      // Prevent infinite loop for zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    
    return {
      match: matches.length > 0,
      matches,
      error: null
    };
  } catch (error) {
    return {
      match: false,
      matches: [],
      error: error.message
    };
  }
}

/**
 * Validate if a string is a valid regex pattern
 * @param {string} pattern - Pattern to validate
 * @returns {Object} Validation result with valid boolean and error message
 */
function validateRegexPattern(pattern) {
  if (!pattern) {
    return { valid: false, error: 'Pattern is empty' };
  }
  
  try {
    new RegExp(pattern);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debounce, levenshteinDistance, fuzzyMatch, regexMatch, validateRegexPattern };
}

// Export to global scope for browser extension
window.SearchUtils = {
  debounce,
  levenshteinDistance,
  fuzzyMatch,
  regexMatch,
  validateRegexPattern
};
