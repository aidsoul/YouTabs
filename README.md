# YouTabs - Firefox Extension

[![Telegram](https://img.shields.io/badge/Telegram-YouTabs-26A5E4?style=flat&logo=telegram)](https://t.me/YouTabs_EXT)

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

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Focus search input |
| Escape | Clear search |

## Version

1.0.0
