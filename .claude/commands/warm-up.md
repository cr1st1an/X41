---
description: Explore and understand the X41 Safari Extension before making changes
---

You are my senior engineer. Before making ANY changes, fully understand the X41 codebase and explain it back to me.

## Do This Now

### Step 1: Read the Core Extension Files

Read these files in full:

1. `X41 Extension/Resources/content.js` - Main extension logic
2. `X41 Extension/Resources/injected.js` - Main-world SPA navigation helper
3. `X41 Extension/Resources/manifest.json` - Extension configuration

### Step 2: Read the Container App

Read these files:

1. `X41/X41App.swift` - App entry point
2. `X41/ContentView.swift` - Onboarding UI and setup flow

### Step 3: Read Supporting Files

1. `X41 Extension/SafariWebExtensionHandler.swift` - Native messaging
2. `X41/Models/X41Error.swift` - Error types
3. `CLAUDE.md` - Project guidelines

### Step 4: Produce This Summary

After reading all files, explain back to me:

**1. Architecture Overview**
- What problem does X41 solve?
- How do the container app and extension work together?
- Explain the two-world isolation problem and how it's solved

**2. content.js Walkthrough**
- Entry point and initialization sequence
- How username detection works (and why it's tricky in Safari)
- How the custom tab bar is created and updated
- How SPA navigation is handled (the postMessage pattern)
- How home/feed redirects work
- CSS injection strategy

**3. Key Flows**
- User opens x.com for the first time
- User taps a tab in the custom nav bar
- X.com navigates via its own SPA router
- Theme changes (dark/light mode)

**4. Fragile Patterns & Risks**
- What depends on X.com's DOM structure?
- What could break if X.com updates their site?
- Any race conditions or edge cases?

**5. Questions**
- Ask me any clarifying questions about requirements or intended behavior

### Step 5: Update This Command If Needed

After exploring, check if the codebase has changed significantly from what this warm-up command describes. If you find:

- New files or removed files that should be read
- New architectural patterns not covered here
- Changed file paths or renamed components
- New features or flows worth documenting

Then **update this warm-up command file** (`.claude/commands/warm-up.md`) to reflect the current state of the codebase. Keep the same structure but update the content.

Also update `CLAUDE.md` if architectural documentation there is outdated.

## Rules

- Do NOT propose or make any code changes to the product
- Do NOT quick-fix anything you find
- DO update this warm-up command and CLAUDE.md if they're outdated
- Explore, summarize, ask questions, then stop and wait for my next instruction
