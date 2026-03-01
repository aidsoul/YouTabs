# Installation Guide

This guide will help you install YouTabs in your Firefox browser.

## Prerequisites

Before installing YouTabs, ensure you have:

- **Firefox 120.0** or higher
- **IndexedDB support** (enabled by default in Firefox)
- **Administrative privileges** (for some installation methods)

## Installation Methods

### Method 1: Load Temporary Add-on (Recommended for Testing)

This method installs the extension temporarily. It will be removed when Firefox closes.

1. **Download the Source Code**
   
   Download or clone the extension source code from GitHub:
   ```bash
   git clone https://github.com/AidSoul/YouTabs.git
   ```

2. **Open Firefox Debugging**
   
   Open Firefox and navigate to:
   ```
   about:debugging
   ```

3. **Load Temporary Add-on**
   
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on"

4. **Select Manifest**
   
   Navigate to the extension directory and select `manifest.json`

5. **Verify Installation**
   
   The YouTabs icon should appear in your Firefox toolbar.

> ⚠️ **Note:** Temporary add-ons are removed when Firefox closes. You'll need to reload them each time you restart Firefox.

### Method 2: Permanent Installation (Signed Add-on)

For permanent installation, you'll need to submit the extension to Mozilla Add-ons:

1. Create a signed `.xpi` package
2. Submit to [Mozilla Add-ons](https://addons.mozilla.org/)
3. Wait for review and approval
4. Install from the add-ons website

## Verifying Installation

After installation, verify that YouTabs is working:

1. Look for the YouTabs icon in your Firefox toolbar
2. Click the icon to open the popup
3. Right-click to access the sidebar option
4. Try creating a new tab group

## Troubleshooting

### Extension Not Loading

If the extension doesn't load:

1. Check Firefox version (must be 120.0+)
2. Verify manifest.json is valid
3. Check for JavaScript errors in Browser Console (Ctrl+Shift+J)
4. Try disabling other extensions that may conflict

### Missing Features

If some features don't work:

1. Grant necessary permissions when prompted
2. Ensure IndexedDB is enabled
3. Check that content scripts are loading

### Need Help?

- [Open an issue on GitHub](https://github.com/AidSoul/YouTabs/issues)
- [Check the FAQ](./faq.md)
- [Contact the developer](mailto:work-aidsoul@outlook.com)

## Next Steps

After installation, see the [Usage Guide](./usage.md) to learn how to use YouTabs effectively.
