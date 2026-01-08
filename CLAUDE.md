# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X41 is a Safari Web Extension for iOS that provides a focused X.com experience. It replaces the native navigation with a custom 3-tab bar (Profile, Notifications, Analytics) and redirects `/` and `/home` to the user's previous page or notifications.

## Build Commands

```bash
# Build for simulator
xcodebuild -scheme X41 -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Build (any available simulator)
xcodebuild -scheme X41 -destination 'generic/platform=iOS Simulator' build
```

**Enable extension**: Settings → Apps → Safari → Extensions → X41 → Allow

## Architecture

### Two Targets

1. **X41** (Container App) - SwiftUI onboarding that guides users to enable the extension
2. **X41 Extension** (Safari Web Extension) - The actual extension with Manifest V3

### Extension Files

```
X41 Extension/Resources/
├── content.js       # Main extension logic (~440 lines), runs in isolated world
├── injected.js      # SPA navigation helper (~17 lines), runs in main world
├── manifest.json    # Manifest V3 configuration
└── _locales/        # i18n strings
```

### Two-World Architecture

Safari content scripts run in an **isolated world** - they cannot access X.com's JavaScript objects (React props, Redux state). This shapes the architecture:

| World | File | Purpose |
|-------|------|---------|
| Isolated | `content.js` | UI, styles, DOM queries, postMessage sender |
| Main | `injected.js` | Receives postMessage, triggers React Router via `history.pushState` |

**Communication flow:**
```
content.js (isolated) → postMessage → injected.js (main) → history.pushState → React Router
```

### content.js Structure

```
Entry Point (runs at document_start)
├── Redirect / and /home → /notifications
├── injectStyles() - hide native bars immediately
├── injectMainWorldScript() - load injected.js
├── watchNavigation() - poll for URL changes (100ms)
└── main() (on DOMContentLoaded)
    ├── Wait for #layers element
    ├── getUserScreenName() - parse from script tags
    ├── createTabBar() - 3 tabs with SVG icons
    └── observeDOM() - debounced badge updates
```

### Key Patterns

**Username detection**: React props (`__reactProps$`) are inaccessible in Safari's isolated world. Instead, parse inline `<script>` tags for `"screen_name":"username"`.

**SPA navigation**: Content scripts can't intercept X.com's `history.pushState`. Solution:
1. Poll `location.pathname` every 100ms
2. For tab clicks, post message to `injected.js` which runs in main world
3. `injected.js` calls `history.pushState` + dispatches `popstate` event

**Tab bar hiding**: Uses CSS `:has()` selector to hide tab bar when sheets/menus are open:
```css
body:has(#layers [data-testid="sheetDialog"]) #x41-tab-bar { opacity: 0; }
```

**Home redirect**: Intercepts `/` and `/home` navigation, redirects to `previousActivePath` (not current, to avoid loops with upsell screens).

## Safari Extension Limitations

- Content scripts are isolated from page JavaScript
- Cannot access React component props or Redux state
- Must use `web_accessible_resources` + script injection for main world access
- `history.pushState` patches in content script don't intercept page's calls

## Attribution

Username detection patterns adapted from [Control Panel for Twitter](https://github.com/nickytonline/control-panel-for-twitter) (MIT).
