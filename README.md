# YouTabs - Firefox Extension

[![Telegram](https://img.shields.io/badge/Telegram-YouTabs-26A5E4?style=flat&logo=telegram)](https://t.me/YouTabs_EXT)
[![Download](https://img.shields.io/badge/addons-26A5E4?style=flat&logo=firefox)](https://addons.mozilla.org/ru/firefox/addon/you-tabs/)

## Changelog

### v1.3.3 (Current Version)

#### New Features

- **Incremental Page Indexing** — The extension now uses MutationObserver to detect changes to indexed pages in real-time. When page content changes (headings added, modified, or removed), the index is updated automatically without re-indexing the entire page. This significantly improves performance and keeps search results always up-to-date.

- **Group Color Inheritance** — When moving tabs or groups to a new parent group, the color now automatically inherits from the new parent group. This creates a more consistent visual hierarchy and makes it easier to organize nested groups with unified color coding.

- **Tab Usage Tracking** — The extension now tracks when each tab is activated and stores usage statistics. This enables future features like "recently used" sorting and smarter tab organization based on your browsing patterns.

- **Omnibox Integration** — Type `yt` in the Firefox address bar followed by your search query to quickly find indexed page headings without opening the sidebar.

- **Theme Support** — Choose between dark and light themes to customize the extension's appearance.

- **Enhanced Drag & Drop** — Improved drag-and-drop functionality with better visual feedback, group nesting support, and color inheritance.

#### Improvements

- **Enhanced Search Filtering** — Added more granular control over search filters with real-time count updates showing how many results match each content type (headings, paragraphs, links, images).

- **Action Buttons Left Panel** — Added new setting to toggle action buttons display on the left panel, giving users more control over the interface layout.

- **Better Tab Preview Positioning** — Improved the tab preview positioning algorithm for better accuracy and visibility.

- **Performance Optimizations** — Various internal optimizations to improve overall extension performance and reduce memory usage.

- **On-Page Highlighting** — Search terms are now highlighted directly on pages when navigating to indexed results, with keyboard navigation between matches.

---

## Previous Versions

<details>
<summary>Click to expand</summary>

### v1.3.1

- Initial release with core features

</details>

A powerful tab management extension for Firefox that provides advanced grouping, organization, and intelligent page indexing with full-text search capabilities.

## Overview

YouTabs transforms your browser's tab management experience by offering intelligent grouping, seamless organization, and powerful page indexing. Whether you have dozens of open tabs or just need better organization, YouTabs helps you find what you need instantly with its built-in search and indexing system.

## Features

### Tab Grouping & Organization

- **Automatic Tab Grouping** — Automatically sort tabs by domain, color, or time opened
- **Custom Groups** — Create and manage your own custom groups for personal organization
- **Group Collapsing** — Hide/show tabs within any group with a single click
- **Drag-and-Drop** — Easily move tabs between groups by dragging
- **Color-Coded Groups** — Assign colors to groups for visual identification

### Sound Management

- **Mute/Unmute Controls** — Dedicated buttons to mute or unmute tabs with audio content
- **Visual Indicators** — Clearly see which tabs are playing audio

### Intelligent Page Indexing & Search

YouTabs includes a powerful built-in indexing system that makes finding content across your visited pages effortless:

#### Page Indexing

The extension automatically indexes web pages you visit, extracting:

- **Headings** (H1-H6) — All heading elements are captured and indexed
- **Paragraphs** — Text content from paragraph elements
- **Links** — All hyperlink text and destinations
- **Images** — Image alt text and descriptions
- **Custom Text Selection** — You can manually select and add any text from a page to the index

The indexing process works as follows:

1. When you visit a page, the extension's content script automatically extracts all structural elements (headings, paragraphs, links, images, divs, lists)
2. This data is stored in IndexedDB for persistent storage
3. You can also manually highlight any text on a page and add it to the index for future searching
4. Each indexed page maintains its URL, title, and all extracted content

#### Search Functionality

The search system provides multiple ways to find content:

- **Full-Text Search** — Search through all indexed content including headings, paragraphs, and custom-added text
- **Heading-Focused Search** — Quickly find specific sections within pages by searching headings
- **Real-Time Results** — Search results update as you type
- **Filtered Search** — Filter search results by content type (headings, paragraphs, links, images, etc.)
- **Quick Navigation** — Click any search result to instantly scroll to that exact location on the page

The search features include:
- Search input with keyboard shortcuts (Ctrl+F to focus)
- Clear button to reset search
- Filter dropdown to select which content types to search
- Highlighted search terms when navigating to results
- URL-based indexing ensures each page is indexed once and updated on revisit

### Flexible Interface

YouTabs provides two primary interfaces:

- **Sidebar** — Full-featured main interface for comprehensive tab management
- **Popup** — Quick access window for rapid operations

### Settings & Configuration

- **Customizable Grouping Modes** — Choose how tabs are automatically grouped
- **Group Behavior Settings** — Configure how groups behave (collapse, expand, etc.)
- **Keyboard Shortcuts** — Quick access to all major functions

## Installation

### From Source

1. Download or clone the extension source code
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Navigate to the extension directory and select `manifest.json`

## Requirements

- Firefox 120.0 or higher
- IndexedDB support (enabled by default in Firefox)

## Permissions

The extension requires the following permissions:

- `tabs` — Access tab information and manage tabs
- `activeTab` — Access the currently active tab
- `sidebar` — Display the sidebar interface
- `storage` — Store extension settings and data
- `scripting` — Execute content scripts for page indexing
- `contextMenus` — Add context menu items
- `notifications` — Display system notifications
- `<all_urls>` — Index content from all websites

## Data Storage

All data is stored locally using IndexedDB:

- **Custom Groups** — Your defined tab groups
- **Group Metadata** — Information about group configurations
- **Page Index** — Indexed content from visited pages including headings, paragraphs, links, and custom-added text

No data is sent to external servers — everything stays on your device.

## Keyboard Shortcuts

YouTabs provides keyboard shortcuts for quick access to all major functions:

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Focus search input (in sidebar/popup) |
| `Alt+F` | Open indexed search popup |
| `Escape` | Close modals, clear search, remove highlights |
| `Enter` | Confirm actions, select items |
| `Arrow Up/Down` | Navigate through search results and highlights |
| `Arrow Left/Right` | Navigate through page highlights |

### Omnibox Integration

You can also use YouTabs directly from the Firefox address bar:

1. Type `yt` in the address bar and press `Space`
2. Start typing your search query
3. You'll see indexed page headings as suggestions
4. Select a result to navigate directly to that page and heading

## Theme Support

YouTabs supports both dark and light themes to match your browser preferences:

- **Dark Theme** — Easy on the eyes in low-light environments
- **Light Theme** — Clean, bright interface for daytime use

Theme can be changed in the extension settings. The theme applies to the sidebar, popup, and search interfaces.

## Context Menu Integration

YouTabs adds useful options to the browser context menu:

- **Add to YouTabs Index** — Manually add selected text from any page to the search index
- Quick access to tab management features

## Drag and Drop

YouTabs provides intuitive drag-and-drop functionality:

- **Tab Reordering** — Drag tabs within a group to reorder them
- **Move Between Groups** — Drag tabs between different groups
- **Group Nesting** — Drag groups onto other groups to create nested hierarchies
- **Visual Feedback** — Clear visual indicators show drop targets and positions
- **Group Color Inheritance** — When moving tabs/groups, colors automatically inherit from parent groups

## On-Page Text Highlighting

When searching through indexed pages, YouTabs can highlight matching text directly on the page:

- **Automatic Highlighting** — Search terms are highlighted on the page when navigating to results
- **Navigation Controls** — Use arrow keys to jump between highlighted matches
- **Match Counter** — See the total number of matches and current position
- **Quick Dismiss** — Press `Escape` to clear all highlights

## Notifications

YouTabs displays system notifications for:

- Successful indexing operations
- Error alerts
- Tab management actions

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Setup

To set up the development environment:

1. Clone the repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select the `manifest.json` file

## Support

- **Telegram Channel**: [YouTabs News & Updates](https://t.me/YouTabs_EXT)
- **Firefox Add-ons**: [YouTabs on AMO](https://addons.mozilla.org/ru/firefox/addon/you-tabs/)
- **GitHub Issues**: Report bugs and request features

---

Made with ❤️ by [AidSoul](https://github.com/AidSoul)
