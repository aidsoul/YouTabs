/**
 * ContentExtractor - Extracts headings and content from web pages
 * Unified class used by both content.js and tabs-core.js
 */

class ContentExtractor {
  constructor(settings = {}) {
    this.settings = {
      maxIndexChars: settings.maxIndexChars || 250,
      maxParagraphs: settings.maxParagraphs || 100,
      maxLinks: settings.maxLinks || 100,
      maxImages: settings.maxImages || 50,
      maxDivs: settings.maxDivs || 50,
      maxSpans: settings.maxSpans || 100,
      maxTables: settings.maxTables || 30,
      maxSections: settings.maxSections || 30,
      maxArticles: settings.maxArticles || 20,
      maxAsides: settings.maxAsides || 15,
      maxNavs: settings.maxNavs || 10,
      maxFooters: settings.maxFooters || 10,
      maxHeaders: settings.maxHeaders || 10,
      maxBlockquotes: settings.maxBlockquotes || 50,
      maxCode: settings.maxCode || 200,
      maxPre: settings.maxPre || 100,
      maxCites: settings.maxCites || 30,
      maxAbbr: settings.maxAbbr || 30,
      maxTime: settings.maxTime || 30,
      maxMarks: settings.maxMarks || 50,
      maxButtons: settings.maxButtons || 50,
      maxTextareas: settings.maxTextareas || 30,
      maxSelects: settings.maxSelects || 30,
      maxLabels: settings.maxLabels || 50,
      maxFigures: settings.maxFigures || 30,
      maxDetails: settings.maxDetails || 30,
      maxSummaries: settings.maxSummaries || 30,
      maxLists: settings.maxLists || 30,
      maxLIs: settings.maxLIs || 100,
      maxFileInputs: settings.maxFileInputs || 10,
      maxDownloadLinks: settings.maxDownloadLinks || 30,
      maxVideos: settings.maxVideos || 10,
      maxAudios: settings.maxAudios || 10,
      maxIframes: settings.maxIframes || 20,
      maxAriaElements: settings.maxAriaElements || 50,
      maxDataElements: settings.maxDataElements || 50
    };
    this.headings = [];
  }

  /**
   * Helper to truncate text based on settings
   */
  truncate(text) {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.length > this.settings.maxIndexChars) {
      return trimmed.substring(0, this.settings.maxIndexChars - 3) + '...';
    }
    return trimmed;
  }

  /**
   * Get direct text nodes only (no nested element text)
   */
  getDirectText(element) {
    let text = '';
    let hasTextNodes = false;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        hasTextNodes = true;
        text += node.textContent;
      }
    }
    if (!hasTextNodes && element.textContent) {
      return this.truncate(element.textContent);
    }
    return this.truncate(text);
  }

  /**
   * Extract filename from URL
   */
  getFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return decodeURIComponent(filename) || '';
    } catch (e) {
      const parts = url.split('/');
      return parts.pop() || '';
    }
  }

  /**
   * Extract video identifier from embed URLs
   */
  extractVideoIdentifier(url) {
    try {
      const urlObj = new URL(url);
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return 'YouTube: ' + videoId;
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1]) {
          return 'YouTube: ' + pathParts[1];
        }
      }
      if (url.includes('vimeo.com')) {
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1]) {
          return 'Vimeo: ' + pathParts[1];
        }
      }
      if (url.includes('dailymotion.com')) {
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1]) {
          return 'Dailymotion: ' + pathParts[1];
        }
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Extract meta tags (description, keywords, og:*, twitter:*)
   */
  extractMetaTags() {
    const metaSelectors = [
      'meta[name="description"]',
      'meta[name="keywords"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[property="og:url"]',
      'meta[property="og:site_name"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]'
    ];
    
    const metaElements = document.querySelectorAll(metaSelectors.join(', '));
    metaElements.forEach((element, index) => {
      const content = element.getAttribute('content');
      const name = element.getAttribute('name') || element.getAttribute('property');
      if (content) {
        this.headings.push({
          id: 'meta-' + index,
          text: this.truncate(content),
          type: 'meta',
          metaName: name,
          url: window.location.origin + window.location.pathname
        });
      }
    });
  }

  /**
   * Extract h1-h6 headings
   */
  extractHeadings() {
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
      
      const text = this.truncate(element.textContent);
      if (text) {
        this.headings.push({
          id: id,
          text: text,
          level: parseInt(element.tagName.substring(1)),
          type: 'heading',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract paragraph tags
   */
  extractParagraphs() {
    const pElements = document.querySelectorAll('p');
    const pArray = Array.from(pElements).slice(0, this.settings.maxParagraphs);
    pArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text) {
        this.headings.push({
          id: 'p-' + index,
          text: text,
          type: 'paragraph',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract anchor tags with text
   */
  extractLinks() {
    const aElements = document.querySelectorAll('a');
    const aArray = Array.from(aElements).slice(0, this.settings.maxLinks);
    aArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      const href = element.href;
      if (text || href) {
        this.headings.push({
          id: 'a-' + index,
          text: text,
          type: 'link',
          url: href || window.location.href,
          linkUrl: href
        });
      }
    });
  }

  /**
   * Extract image tags with alt text
   */
  extractImages() {
    const imgElements = document.querySelectorAll('img');
    const imgArray = Array.from(imgElements).slice(0, this.settings.maxImages);
    imgArray.forEach((element, index) => {
      const alt = this.truncate(element.alt);
      const src = element.src;
      if (alt || src) {
        // Extract filename from imgUrl for search by name
        const name = src ? this.getFilenameFromUrl(src) : '';
        // Extract file type/extension from filename
        const fileType = name ? this.getFileExtension(name) : '';
        this.headings.push({
          id: 'img-' + index,
          text: alt,
          type: 'image',
          url: window.location.href,
          imgUrl: src,
          name: name,
          fileType: fileType
        });
      }
    });
  }

  /**
   * Extract file extension from filename
   */
  getFileExtension(filename) {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1).toLowerCase() : '';
  }

  /**
   * Extract div tags with text content
   */
  extractDivs() {
    const divElements = document.querySelectorAll('div');
    const divArray = Array.from(divElements).slice(0, this.settings.maxDivs);
    divArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'div-' + index,
          text: text,
          type: 'div',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract span tags with text content
   */
  extractSpans() {
    const spanElements = document.querySelectorAll('span');
    const spanArray = Array.from(spanElements).slice(0, this.settings.maxSpans);
    spanArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'span-' + index,
          text: text,
          type: 'span',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract table tags with headers and captions
   */
  extractTables() {
    const tableElements = document.querySelectorAll('table');
    const tableArray = Array.from(tableElements).slice(0, this.settings.maxTables);
    tableArray.forEach((element, index) => {
      const caption = element.querySelector('caption');
      const captionText = caption ? this.truncate(caption.textContent) : '';
      const headers = [];
      const headerCells = element.querySelectorAll('th');
      headerCells.forEach(th => {
        const headerText = this.truncate(th.textContent);
        if (headerText) headers.push(headerText);
      });
      const firstRow = element.querySelector('tr');
      let previewText = '';
      if (firstRow) {
        const cells = firstRow.querySelectorAll('td, th');
        const cellTexts = [];
        cells.forEach(cell => {
          const cellText = this.truncate(cell.textContent);
          if (cellText) cellTexts.push(cellText);
        });
        previewText = cellTexts.join(' | ');
      }
      const rowCount = element.querySelectorAll('tr').length;
      this.headings.push({
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
  }

  /**
   * Extract section tags
   */
  extractSections() {
    const sectionElements = document.querySelectorAll('section');
    const sectionArray = Array.from(sectionElements).slice(0, this.settings.maxSections);
    sectionArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'section-' + index,
          text: text,
          type: 'section',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract article tags
   */
  extractArticles() {
    const articleElements = document.querySelectorAll('article');
    const articleArray = Array.from(articleElements).slice(0, this.settings.maxArticles);
    articleArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'article-' + index,
          text: text,
          type: 'article',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract aside tags
   */
  extractAsides() {
    const asideElements = document.querySelectorAll('aside');
    const asideArray = Array.from(asideElements).slice(0, this.settings.maxAsides);
    asideArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'aside-' + index,
          text: text,
          type: 'aside',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract nav tags
   */
  extractNavs() {
    const navElements = document.querySelectorAll('nav');
    const navArray = Array.from(navElements).slice(0, this.settings.maxNavs);
    navArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'nav-' + index,
          text: text,
          type: 'nav',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract footer tags
   */
  extractFooters() {
    const footerElements = document.querySelectorAll('footer');
    const footerArray = Array.from(footerElements).slice(0, this.settings.maxFooters);
    footerArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'footer-' + index,
          text: text,
          type: 'footer',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract header tags
   */
  extractHeaders() {
    const headerHtmlElements = document.querySelectorAll('header');
    const headerArray = Array.from(headerHtmlElements).slice(0, this.settings.maxHeaders);
    headerArray.forEach((element, index) => {
      const text = this.getDirectText(element);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'header-' + index,
          text: text,
          type: 'header',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract blockquote tags
   */
  extractBlockquotes() {
    const blockquoteElements = document.querySelectorAll('blockquote');
    const blockquoteArray = Array.from(blockquoteElements).slice(0, this.settings.maxBlockquotes);
    blockquoteArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'blockquote-' + index,
          text: text,
          type: 'blockquote',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract code tags
   */
  extractCodes() {
    const codeElements = document.querySelectorAll('code');
    const codeArray = Array.from(codeElements).slice(0, this.settings.maxCode);
    codeArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'code-' + index,
          text: text,
          type: 'code',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract pre tags
   */
  extractPres() {
    const preElements = document.querySelectorAll('pre');
    const preArray = Array.from(preElements).slice(0, this.settings.maxPre);
    preArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'pre-' + index,
          text: text,
          type: 'pre',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract cite tags
   */
  extractCites() {
    const citeElements = document.querySelectorAll('cite');
    const citeArray = Array.from(citeElements).slice(0, this.settings.maxCites);
    citeArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'cite-' + index,
          text: text,
          type: 'cite',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract abbr tags
   */
  extractAbbrs() {
    const abbrElements = document.querySelectorAll('abbr');
    const abbrArray = Array.from(abbrElements).slice(0, this.settings.maxAbbr);
    abbrArray.forEach((element, index) => {
      const title = element.getAttribute('title');
      const text = this.truncate(title || element.textContent);
      if (text && text.length > 0) {
        this.headings.push({
          id: 'abbr-' + index,
          text: text,
          type: 'abbr',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract time tags
   */
  extractTimes() {
    const timeElements = document.querySelectorAll('time');
    const timeArray = Array.from(timeElements).slice(0, this.settings.maxTime);
    timeArray.forEach((element, index) => {
      const datetime = element.getAttribute('datetime');
      const text = this.truncate(datetime || element.textContent);
      if (text && text.length > 0) {
        this.headings.push({
          id: 'time-' + index,
          text: text,
          type: 'time',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract mark tags
   */
  extractMarks() {
    const markElements = document.querySelectorAll('mark');
    const markArray = Array.from(markElements).slice(0, this.settings.maxMarks);
    markArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'mark-' + index,
          text: text,
          type: 'mark',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract button tags
   */
  extractButtons() {
    const buttonElements = document.querySelectorAll('button');
    const buttonArray = Array.from(buttonElements).slice(0, this.settings.maxButtons);
    buttonArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      const value = element.value;
      if (text || value) {
        this.headings.push({
          id: 'button-' + index,
          text: text || value,
          type: 'button',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract textarea tags
   */
  extractTextareas() {
    const textareaElements = document.querySelectorAll('textarea');
    const textareaArray = Array.from(textareaElements).slice(0, this.settings.maxTextareas);
    textareaArray.forEach((element, index) => {
      const placeholder = element.getAttribute('placeholder');
      const name = element.name || element.id || 'Textarea';
      this.headings.push({
        id: 'textarea-' + index,
        text: this.truncate(placeholder || name),
        type: 'textarea',
        url: window.location.href
      });
    });
  }

  /**
   * Extract select tags
   */
  extractSelects() {
    const selectElements = document.querySelectorAll('select');
    const selectArray = Array.from(selectElements).slice(0, this.settings.maxSelects);
    selectArray.forEach((element, index) => {
      const name = element.name || element.id || 'Select';
      const options = [];
      element.querySelectorAll('option').forEach(opt => {
        const optText = this.truncate(opt.textContent);
        if (optText) options.push(optText);
      });
      this.headings.push({
        id: 'select-' + index,
        text: options.length > 0 ? options.join(', ') : name,
        type: 'select',
        url: window.location.href
      });
    });
  }

  /**
   * Extract label tags
   */
  extractLabels() {
    const labelElements = document.querySelectorAll('label');
    const labelArray = Array.from(labelElements).slice(0, this.settings.maxLabels);
    labelArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 0) {
        this.headings.push({
          id: 'label-' + index,
          text: text,
          type: 'label',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract figure tags with figcaption
   */
  extractFigures() {
    const figureElements = document.querySelectorAll('figure');
    const figureArray = Array.from(figureElements).slice(0, this.settings.maxFigures);
    figureArray.forEach((element, index) => {
      const figcaption = element.querySelector('figcaption');
      const figcaptionText = figcaption ? this.truncate(figcaption.textContent) : '';
      const img = element.querySelector('img');
      const imgSrc = img ? img.src : '';
      const text = this.truncate(element.textContent);
      if (text && text.length > 2) {
        this.headings.push({
          id: 'figure-' + index,
          text: figcaptionText || text,
          type: 'figure',
          url: window.location.href,
          imgUrl: imgSrc
        });
      }
    });
  }

  /**
   * Extract details tags
   */
  extractDetails() {
    const detailsElements = document.querySelectorAll('details');
    const detailsArray = Array.from(detailsElements).slice(0, this.settings.maxDetails);
    detailsArray.forEach((element, index) => {
      const summary = element.querySelector('summary');
      const summaryText = summary ? this.truncate(summary.textContent) : '';
      const text = this.truncate(element.textContent);
      if (summaryText || (text && text.length > 2)) {
        this.headings.push({
          id: 'details-' + index,
          text: summaryText || text,
          type: 'details',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract summary tags
   */
  extractSummaries() {
    const summaryElements = document.querySelectorAll('summary');
    const summaryArray = Array.from(summaryElements).slice(0, this.settings.maxSummaries);
    summaryArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 0) {
        this.headings.push({
          id: 'summary-' + index,
          text: text,
          type: 'summary',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract list tags (ul, ol)
   */
  extractLists() {
    const listElements = document.querySelectorAll('ul, ol');
    const listArray = Array.from(listElements).slice(0, this.settings.maxLists);
    listArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      const listType = element.tagName.toLowerCase();
      if (text && text.length > 2) {
        this.headings.push({
          id: 'list-' + index,
          text: text,
          type: 'list',
          listType: listType,
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract list item tags
   */
  extractListItems() {
    const liElements = document.querySelectorAll('li');
    const liArray = Array.from(liElements).slice(0, this.settings.maxLIs);
    liArray.forEach((element, index) => {
      const text = this.truncate(element.textContent);
      if (text && text.length > 0) {
        this.headings.push({
          id: 'li-' + index,
          text: text,
          type: 'listItem',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract file input tags
   */
  extractFileInputs() {
    const fileInputElements = document.querySelectorAll('input[type="file"]');
    const fileInputArray = Array.from(fileInputElements).slice(0, this.settings.maxFileInputs);
    fileInputArray.forEach((element, index) => {
      const text = element.name || element.id || 'File input';
      const accept = element.accept || '';
      this.headings.push({
        id: 'file-' + index,
        text: text,
        type: 'file',
        fileTypes: accept,
        url: window.location.href
      });
    });
  }

  /**
   * Extract download link tags
   */
  extractDownloadLinks() {
    const downloadLinkElements = document.querySelectorAll('a[download]');
    const downloadLinkArray = Array.from(downloadLinkElements).slice(0, this.settings.maxDownloadLinks);
    downloadLinkArray.forEach((element, index) => {
      const text = this.truncate(element.textContent) || element.download;
      const href = element.href;
      if (text || href) {
        this.headings.push({
          id: 'download-' + index,
          text: text,
          type: 'fileDownload',
          url: href || window.location.href,
          linkUrl: href
        });
      }
    });
  }

  /**
   * Extract video tags
   */
  extractVideos() {
    const videoElements = document.querySelectorAll('video');
    const videoArray = Array.from(videoElements).slice(0, this.settings.maxVideos);
    videoArray.forEach((element, index) => {
      const src = element.src || (element.querySelector('source')?.src || '');
      let text = element.title || element.alt || '';
      if (!text && src) {
        text = this.getFilenameFromUrl(src);
      }
      this.headings.push({
        id: 'video-' + index,
        text: this.truncate(text),
        type: 'video',
        url: src || window.location.href,
        videoUrl: src
      });
    });
  }

  /**
   * Extract audio tags
   */
  extractAudio() {
    const audioElements = document.querySelectorAll('audio');
    const audioArray = Array.from(audioElements).slice(0, this.settings.maxAudios);
    audioArray.forEach((element, index) => {
      const src = element.src || (element.querySelector('source')?.src || '');
      let text = element.title || element.alt || '';
      if (!text && src) {
        text = this.getFilenameFromUrl(src);
      }
      this.headings.push({
        id: 'audio-' + index,
        text: this.truncate(text),
        type: 'audio',
        url: src || window.location.href,
        audioUrl: src
      });
    });
  }

  /**
   * Extract iframe video embeds
   */
  extractIframes() {
    const iframeElements = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[src*="video"]');
    const iframeArray = Array.from(iframeElements).slice(0, this.settings.maxIframes);
    iframeArray.forEach((element, index) => {
      const src = element.src;
      let text = element.title || '';
      if (!text && src) {
        text = this.extractVideoIdentifier(src) || this.getFilenameFromUrl(src);
      }
      if (text || src) {
        this.headings.push({
          id: 'iframe-video-' + index,
          text: this.truncate(text),
          type: 'videoEmbed',
          url: window.location.href,
          videoUrl: src
        });
      }
    });
  }

  /**
   * Extract ARIA labels and descriptions
   */
  extractAriaElements() {
    const ariaElements = document.querySelectorAll('[aria-label], [aria-description]');
    const ariaArray = Array.from(ariaElements).slice(0, this.settings.maxAriaElements);
    ariaArray.forEach((element, index) => {
      const label = element.getAttribute('aria-label') || element.getAttribute('aria-description');
      if (label && label.length > 2) {
        this.headings.push({
          id: 'aria-' + index,
          text: this.truncate(label),
          type: 'aria',
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract data-* attributes
   */
  extractDataElements() {
    const dataAttributes = ['data-title', 'data-tooltip', 'data-content', 'data-label', 'data-text', 'data-name', 'data-value', 'data-description', 'data-placeholder'];
    const dataSelector = dataAttributes.map(attr => '[' + attr + ']').join(', ');
    const dataElements = document.querySelectorAll(dataSelector);
    const dataArray = Array.from(dataElements).slice(0, this.settings.maxDataElements);
    
    dataArray.forEach((element, index) => {
      let dataText = '';
      let dataAttr = '';
      
      for (const attr of dataAttributes) {
        const value = element.getAttribute(attr);
        if (value && value.trim().length > 0) {
          dataText = value.trim();
          dataAttr = attr.replace('data-', '');
          break;
        }
      }
      
      if (dataText && dataText.length > 0) {
        this.headings.push({
          id: 'data-' + index,
          text: this.truncate(dataText),
          type: 'data',
          dataAttr: dataAttr,
          url: window.location.href
        });
      }
    });
  }

  /**
   * Extract all content from the page (including meta tags)
   * @returns {Array} Array of extracted content items
   */
  extractAll() {
    this.headings = [];
    
    this.extractMetaTags();
    this.extractHeadings();
    this.extractParagraphs();
    this.extractLinks();
    this.extractImages();
    this.extractDivs();
    this.extractSpans();
    this.extractTables();
    this.extractSections();
    this.extractArticles();
    this.extractAsides();
    this.extractNavs();
    this.extractFooters();
    this.extractHeaders();
    this.extractBlockquotes();
    this.extractCodes();
    this.extractPres();
    this.extractCites();
    this.extractAbbrs();
    this.extractTimes();
    this.extractMarks();
    this.extractButtons();
    this.extractTextareas();
    this.extractSelects();
    this.extractLabels();
    this.extractFigures();
    this.extractDetails();
    this.extractSummaries();
    this.extractLists();
    this.extractListItems();
    this.extractFileInputs();
    this.extractDownloadLinks();
    this.extractVideos();
    this.extractAudio();
    this.extractIframes();
    this.extractAriaElements();
    this.extractDataElements();
    
    return this.headings;
  }

  /**
   * Extract content without meta tags (legacy compatibility)
   * @returns {Array} Array of extracted content items
   */
  extractAllWithoutMeta() {
    this.headings = [];
    
    this.extractHeadings();
    this.extractParagraphs();
    this.extractLinks();
    this.extractImages();
    this.extractDivs();
    this.extractSpans();
    this.extractTables();
    this.extractSections();
    this.extractArticles();
    this.extractAsides();
    this.extractNavs();
    this.extractFooters();
    this.extractHeaders();
    this.extractBlockquotes();
    this.extractCodes();
    this.extractPres();
    this.extractCites();
    this.extractAbbrs();
    this.extractTimes();
    this.extractMarks();
    this.extractButtons();
    this.extractTextareas();
    this.extractSelects();
    this.extractLabels();
    this.extractFigures();
    this.extractDetails();
    this.extractSummaries();
    this.extractLists();
    this.extractListItems();
    this.extractFileInputs();
    this.extractDownloadLinks();
    this.extractVideos();
    this.extractAudio();
    this.extractIframes();
    this.extractAriaElements();
    this.extractDataElements();
    
    return this.headings;
  }

  /**
   * Static method to extract content including meta tags
   * @param {Object} settings - Extraction settings
   * @returns {Array} Array of extracted content items
   */
  static extract(settings = {}) {
    const extractor = new ContentExtractor(settings);
    return extractor.extractAll();
  }

  /**
   * Static method to extract content without meta tags (legacy)
   * @param {Object} settings - Extraction settings
   * @returns {Array} Array of extracted content items
   */
  static extractWithoutMeta(settings = {}) {
    const extractor = new ContentExtractor(settings);
    return extractor.extractAllWithoutMeta();
  }
}

// Legacy function for backward compatibility
function extractHeadings(settings) {
  return ContentExtractor.extract(settings);
}

// Legacy function for backward compatibility (without meta tags)
// Note: This is used for incremental indexing where meta tags are handled separately
function extractPageHeadingsWithoutMeta(settings) {
  return ContentExtractor.extractWithoutMeta(settings);
}
