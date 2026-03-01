# Features Overview

YouTabs provides a comprehensive set of features for tab management and page indexing.

## Tab Grouping & Organization

### Automatic Tab Grouping

YouTabs can automatically organize your tabs based on:

- **Domain** - Group tabs by website domain
- **Color** - Group tabs by assigned color
- **Time** - Group tabs by when they were opened
- **Custom Rules** - Define your own grouping logic

### Custom Groups

Create and manage your own custom groups:

1. Click the "+" button in the sidebar
2. Enter a group name
3. Assign a color (optional)
4. Start dragging tabs into the group

### Group Features

- **Collapsing** - Hide/show tabs within any group with a single click
- **Drag-and-Drop** - Easily move tabs between groups
- **Color Coding** - Assign colors to groups for visual identification
- **Renaming** - Double-click group name to rename
- **Deleting** - Right-click group for delete option

## Sound Management

### Mute/Unmute Controls

- Dedicated buttons to mute or unmute tabs with audio
- Works for all tabs including background tabs

### Visual Indicators

- Clear icons showing which tabs are playing audio
- Easy identification of noisy tabs

## Intelligent Page Indexing & Search

### How Indexing Works

YouTabs automatically indexes pages you visit:

1. **Page Visit** - Content script extracts page elements
2. **Data Extraction** - Headings, paragraphs, links, images are captured
3. **Storage** - Data is stored in IndexedDB
4. **Search** - Full-text search across all indexed content

### Indexed Content Types

| Type | Description |
|------|-------------|
| Headings (H1-H6) | All heading elements |
| Paragraphs | Text content from paragraphs |
| Links | Hyperlink text and URLs |
| Images | Alt text and image sources |
| Divs | Div container elements |
| UL Lists | Unordered list containers |
| OL Lists | Ordered list containers |
| LI Items | List items |
| Inputs | Input form elements |
| Videos | Video elements |
| Audio | Audio elements |
| IFrames | Embedded video frames |
| Spans | Span text elements |
| Custom Selection | User-selected text |

### Search Functionality

- **Full-Text Search** - Search through all indexed content
- **Heading Search** - Focus on specific sections
- **Real-Time Results** - Results update as you type
- **Filtered Search** - Filter by content type
- **Quick Navigation** - Click to scroll to location on page
- **Highlighted Terms** - Search terms highlighted in results

### Custom Text Indexing

You can manually add any text to the index:

1. Select text on any webpage
2. Right-click and choose "Add to YouTabs Index"
3. The text is now searchable

## Interface Options

### Sidebar

The main interface for comprehensive tab management:

- Full tab group management
- Advanced search operations
- Bulk organization
- Detailed settings

### Popup

Quick access window for rapid operations:

- Quick tab switching
- Simple group access
- Fast searches
- Minimal footprint

## Settings & Configuration

### Grouping Settings

- Automatic grouping mode selection
- Group behavior configuration
- Default group settings

### Search Settings

- Indexing options
- Search filters
- Result preferences

### Keyboard Shortcuts

- Customizable shortcuts
- Quick access to all functions

## Data Privacy

All data is stored locally:

- **No External Servers** - Data never leaves your device
- **IndexedDB Storage** - Persistent local storage
- **Privacy First** - Your browsing data stays private

## Version Information

Current Version: **1.0.0**

For feature requests or bug reports, please [open an issue on GitHub](https://github.com/AidSoul/YouTabs/issues).
