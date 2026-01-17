# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X41 is a Safari Web Extension for iOS that provides a focused X.com experience. It replaces the native navigation with a custom tab bar (Profile, Notifications, Analytics) and redirects `/` and `/home` to `/compose/post` on initial load, or to the last visited root tab during SPA navigation.

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

### Home Screen Quick Actions

Long-press the app icon to access shortcuts:

| Action | URL |
|--------|-----|
| Post | `x.com/compose/post` |
| Profile | `x.com/i/profile` |
| Notifications | `x.com/notifications` |
| Analytics | `x.com/i/account_analytics` |

Defined in `Info.plist` (`UIApplicationShortcutItems`), handled by `AppDelegate` in `X41App.swift`.

### Extension Files

```
X41 Extension/Resources/
├── content.js       # Main extension logic (~670 lines), runs in isolated world
├── injected.js      # SPA navigation helper (~50 lines), runs in main world
├── manifest.json    # Manifest V3 configuration (targets x.com only, no subdomains)
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
├── Redirect / and /home → /compose/post
├── injectStyles() - hide native bars immediately
├── injectMainWorldScript() - load injected.js
├── watchNavigation() - listen for X41_NAVIGATED messages from injected.js
└── main() (on DOMContentLoaded)
    ├── Wait for #layers element (30s timeout)
    ├── getUserScreenName() - parse from script tags (5s retry)
    ├── Set initial activeTab based on URL
    ├── createTabBar() - always 3 tabs (profile uses /i/profile if username unknown)
    ├── startBadgePolling() - 5s interval badge updates
    └── cleanup() - clear intervals on page unload
```

### State Model

```javascript
activeTab: 'profile' | 'notifications' | 'analytics' | null  // Currently highlighted tab
lastRootTabPath: string | null  // Last visited root path (for fallback navigation)
lastPath: string | null  // Last processed path (dedup)
pendingUsernameCapture: boolean  // Flag for lazy username detection via /i/profile
```

**Path constants** (defined in `PATHS` object):
```javascript
PATHS.profile: '/i/profile'       // X.com redirect to logged-in user
PATHS.notifications: '/notifications'
PATHS.analytics: '/i/account_analytics'
```

**Helper**: `getProfilePath()` returns `/${username}` if known, otherwise `PATHS.profile`

### Key Patterns

**Username detection**: React props (`__reactProps$`) are inaccessible in Safari's isolated world. Instead, parse inline `<script>` tags for `"screen_name":"username"`. Falls back to profile link in DOM.

**Profile tab resilience**: Profile tab always shows. If username detection fails on load, the tab navigates to `/i/profile` (X.com's internal redirect to the logged-in user's profile). When `/i/profile` redirects to `/${username}`, the extension captures the username lazily for future use.

**SPA navigation**: Content scripts can't intercept X.com's `history.pushState`. Solution:
1. `injected.js` patches `history.pushState`/`replaceState` and notifies content.js via postMessage
2. For tab clicks, content.js posts message to `injected.js` which runs in main world
3. `injected.js` validates path and calls `history.pushState` + dispatches `popstate` event

**Active tab persistence**: The highlighted tab (`activeTab`) persists during deep navigation. If user is on `/notifications` and clicks a tweet, notifications stays highlighted. Tapping the highlighted tab navigates back to root.

**Tab navigation behavior**:
- Tap inactive tab → navigate to root, make active
- Tap active tab when deep → navigate to root
- Tap active tab when at root (single) → nothing
- Tap active tab when at root (double within 500ms) → scroll to top

**Tab bar visibility**: Tab bar is hidden on modal pages (compose, intent, messages) where the header is shown. Uses CSS `:has()` selector to also hide when sheets/menus are open:
```css
body.x41-show-header #x41-tab-bar { display: none; }
body:has(#layers [data-testid="sheetDialog"]) #x41-tab-bar { opacity: 0; }
```

**Header visibility**: Header is shown on `/compose/`, `/intent/`, and `/messages/` routes. Tab bar is hidden on these routes.

**Home redirect**:
- Initial page load to `/` or `/home` → redirects to `/compose/post`
- SPA navigation to `/` or `/home` → redirects to `lastRootTabPath`, or `/i/profile`, or `/notifications`

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
