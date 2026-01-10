# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X41 is a Safari Web Extension for iOS that provides a focused X.com experience. It replaces the native navigation with a custom tab bar (Profile, Notifications, Analytics) and redirects `/` and `/home` to the user's previous page or notifications.

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
├── content.js       # Main extension logic (~510 lines), runs in isolated world
├── injected.js      # SPA navigation helper (~25 lines), runs in main world
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
    ├── Wait for #layers element (30s timeout)
    ├── getUserScreenName() - parse from script tags (5s retry)
    ├── createTabBar() - 2 or 3 tabs depending on username detection
    ├── startBadgePolling() - 2s interval badge updates
    └── cleanup() - clear intervals on page unload
```

### Key Patterns

**Username detection**: React props (`__reactProps$`) are inaccessible in Safari's isolated world. Instead, parse inline `<script>` tags for `"screen_name":"username"`. Falls back to profile link in DOM.

**Graceful degradation**: If username detection fails, shows 2-tab bar (Notifications + Analytics only). Profile tab requires username.

**SPA navigation**: Content scripts can't intercept X.com's `history.pushState`. Solution:
1. Poll `location.pathname` every 100ms
2. For tab clicks, post message to `injected.js` which runs in main world
3. `injected.js` validates path and calls `history.pushState` + dispatches `popstate` event

**Double-tap scroll**: Tapping an already-active tab within 300ms scrolls to top (iOS convention).

**Tab bar hiding**: Uses CSS `:has()` selector to hide tab bar when sheets/menus are open:
```css
body:has(#layers [data-testid="sheetDialog"]) #x41-tab-bar { opacity: 0; }
```

**Header visibility**: Header is shown on `/compose/`, `/intent/`, and `/messages/` routes.

**Home redirect**: Intercepts `/` and `/home` navigation, redirects to `previousActivePath` (not current, to avoid loops with upsell screens).

**Badge fallback**: If notification count can't be parsed, shows blue dot indicator instead of number.

**Interval cleanup**: Navigation and badge polling intervals are cleared on `beforeunload` to prevent memory leaks.

### injected.js Security

- Origin validation: Only accepts messages from same origin
- Path validation: Rejects paths with `://`, `//`, or over 2048 chars
- Prevents protocol injection and malicious navigation

## Safari Extension Limitations

- Content scripts are isolated from page JavaScript
- Cannot access React component props or Redux state
- Must use `web_accessible_resources` + script injection for main world access
- `history.pushState` patches in content script don't intercept page's calls

## Attribution

Username detection patterns adapted from [Control Panel for Twitter](https://github.com/nickytonline/control-panel-for-twitter) (MIT).
