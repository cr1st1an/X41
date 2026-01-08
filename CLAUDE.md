# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

X41 is a Safari Web Extension for iOS that provides a focused X.com experience. It replaces the native navigation with a custom tab bar (Profile, Notifications, Analytics) and redirects the home feed to notifications.

## Build & Development

Xcode project targeting iOS 17.0+.

```bash
# Build
xcodebuild -project X41.xcodeproj -scheme X41

# Or open in Xcode and Cmd+B
```

**Enable extension**: Settings → Apps → Safari → Extensions → X41

## Architecture

### Two Targets

1. **X41** (Container App) - SwiftUI onboarding UI
2. **X41 Extension** (Safari Web Extension) - The actual extension

### Key Files

- `X41/X41App.swift` - App entry point
- `X41/ContentView.swift` - Onboarding UI
- `X41 Extension/Resources/content.js` - Extension logic (~375 lines)
- `X41 Extension/Resources/manifest.json` - Manifest V3

### content.js Architecture

Simple, focused implementation following Control Panel for Twitter patterns:

```
Entry Point
├── Redirect / and /home → /notifications
├── Inject styles (hide native bars)
├── Patch history (SPA navigation)
└── main()
    ├── Wait for #layers
    ├── Get $reactRoot
    ├── Get username from Redux state (with retry)
    ├── Create tab bar
    └── Start DOM observer
```

**Core Functions:**
- `getState()` - Access X.com's Redux store via React props
- `getUserScreenName()` - Get logged-in username from state
- `getElement(selector)` - Wait for element using requestAnimationFrame
- `createTabBar()` - Build the 3-tab navigation
- `updateTabs()` - Sync active state with current path
- `observeDOM()` - Watch for badge updates, hide "Maybe later" buttons

**Patterns (from CPFT):**
- Wait for `#layers` before initialization
- Access state via `$reactRoot.firstElementChild.__reactProps$...`
- Use requestAnimationFrame for element polling
- Patch `history.pushState/replaceState` for SPA navigation

## Attribution

`getState`, `getUserScreenName` adapted from [Control Panel for Twitter](https://github.com/nickytonline/control-panel-for-twitter) (MIT).
