# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X41 is a Safari Web Extension for iOS that modifies the X.com (Twitter) mobile web experience. It provides a "single player mode" by replacing the native navigation with a custom tab bar focused on Profile, Notifications, and Analytics.

## Build & Development

This is an Xcode project targeting iOS 17.0+. Open `X41.xcodeproj` in Xcode to build and run.

- **Build**: Cmd+B in Xcode or `xcodebuild -project X41.xcodeproj -scheme X41`
- **Run**: Build and run on iOS 17+ simulator or device via Xcode (Cmd+R)
- **Enable extension**: After installing, enable in iOS Settings → Safari → Extensions → X41

## Architecture

### Two Targets

1. **X41** (Container App) - `X41/`
   - SwiftUI-based iOS app that hosts the extension
   - Shows onboarding UI with instructions for enabling the extension
   - Entry point: `X41App.swift` with `ContentView.swift`

2. **X41 Extension** (Safari Web Extension) - `X41 Extension/`
   - The browser extension that runs on x.com
   - `SafariWebExtensionHandler.swift` - Native message handler (minimal echo response)
   - `Resources/` - Web extension files (manifest, content script)

### Container App Files (`X41/`)

- `X41App.swift` - SwiftUI app entry point (@main)
- `ContentView.swift` - Onboarding UI with settings navigation
- `Models/X41Error.swift` - Custom error types
- `PrivacyInfo.xcprivacy` - Privacy manifest (required for App Store)

### Extension Files (`X41 Extension/Resources/`)

- `manifest.json` - Extension manifest (Manifest V3), targets `*://x.com/*`
- `content.js` - Main extension logic, injected at `document_start`
- `_locales/en/messages.json` - Localization strings

### Content Script Behavior (`content.js`)

The content script is self-contained and implements:
- **Redirect**: `/` and `/home` redirect to `/notifications`
- **Custom Tab Bar**: Fixed bottom navigation with Profile, Notifications, Analytics tabs
- **Header Hiding**: Hides X.com's top navigation bar (except on compose pages)
- **Native Tab Bar Hiding**: Hides X.com's native bottom bar
- **Theme Support**: Matches system light/dark mode via `prefers-color-scheme`
- **Username Detection**: Extracts logged-in username from page scripts or DOM for profile link
- **SPA Navigation**: Intercepts `pushState`/`replaceState` for navigation updates

Key design patterns in `content.js`:
- Event-driven (no polling)
- Uses debouncing for navigation handling
- All selectors centralized in `CONFIG.SELECTORS`
- Error logging via `logError()` helper (DEBUG flag controls output)
- Safe SVG insertion via `setSVGContent()` to avoid innerHTML XSS risks

## Tech Stack

- **iOS**: Swift 6, SwiftUI, iOS 17.0+
- **Extension**: JavaScript (ES6+), Manifest V3
- **Build**: Xcode 16+
