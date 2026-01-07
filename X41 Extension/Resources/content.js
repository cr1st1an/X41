/**
 * X41 - Enhanced X.com Navigation
 *
 * Features:
 * - Custom tab bar with Profile, Notifications, Analytics
 * - Redirects home feed to notifications
 * - Matches X.com's actual theme (not just system preference)
 * - Notification badge mirroring
 * - Safe area support for iPhone
 * - Graceful degradation on failure
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        // Version for future compatibility checks
        VERSION: '2.0.0',

        // Performance
        NAVIGATION_DEBOUNCE_MS: 100,
        MAX_USERNAME_RETRIES: 15,
        USERNAME_RETRY_DELAY_MS: 200,
        BADGE_CHECK_INTERVAL_MS: 5000,

        // UI
        TAB_BAR_HEIGHT: 49,
        ICON_SIZE: 24,

        // Device-appropriate colors (light/dark only, based on system preference)
        COLORS: {
            light: {
                active: 'rgb(0, 0, 0)',           // Black
                inactive: 'rgb(142, 142, 147)',   // iOS system grey
                background: 'rgb(255, 255, 255)', // White
                border: 'rgb(209, 209, 214)',     // iOS separator grey
                hover: 'rgba(0, 0, 0, 0.05)'
            },
            dark: {
                active: 'rgb(255, 255, 255)',     // White
                inactive: 'rgb(142, 142, 147)',   // iOS system grey
                background: 'rgb(0, 0, 0)',       // Black
                border: 'rgb(56, 56, 58)',        // iOS dark separator
                hover: 'rgba(255, 255, 255, 0.05)'
            }
        },

        // Selectors with fallbacks for resilience
        SELECTORS: {
            topNavBar: '[data-testid="TopNavBar"], header[role="banner"] > div > div',
            headerBanner: 'header[role="banner"]',
            nativeTabBar: '[data-testid="BottomBar"], nav[aria-label="Bottom navigation"]',
            primaryColumn: '[data-testid="primaryColumn"], main[role="main"] > div',
            sidebarNav: 'nav[role="navigation"]',
            profileLink: 'a[data-testid="AppTabBar_Profile_Link"], a[href$="/profile"]',
            notificationBadge: '[data-testid="app-bar-notification-badge"], [aria-label*="notification"][aria-label*="unread"]'
        },

        // Z-index management
        Z_INDEX: {
            tabBar: 10000
        },

        // Storage keys
        STORAGE_KEYS: {
            username: 'x41_username',
            preferences: 'x41_preferences'
        }
    };

    // Default user preferences (for future features)
    const DEFAULT_PREFERENCES = {
        redirectHome: true,
        showHeader: false,
        tabs: ['profile', 'notifications', 'analytics']
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        // User data
        username: null,
        preferences: { ...DEFAULT_PREFERENCES },

        // Navigation
        currentPath: window.location.pathname,
        isComposePage: false,

        // UI elements
        tabBar: null,
        tabElements: new Map(), // Map for O(1) lookup
        styleElement: null,
        badgeElement: null,

        // Observers & listeners
        cleanupFunctions: [],
        badgeObserver: null,

        // State flags
        isInitialized: false,
        isDestroyed: false,

        // Notification count
        notificationCount: 0
    };

    // ========================================
    // UTILITIES
    // ========================================

    // Debug mode - set to false for production
    const DEBUG = false;

    /**
     * Log errors in debug mode
     */
    function logError(context, error) {
        if (DEBUG) {
            console.error(`[X41] ${context}:`, error);
        }
    }

    /**
     * Log info in debug mode
     */
    function logInfo(context, message) {
        if (DEBUG) {
            console.log(`[X41] ${context}:`, message);
        }
    }

    /**
     * Debounce function calls
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Safely set SVG content in a container
     */
    function setSVGContent(container, svgString) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const template = document.createElement('template');
        template.innerHTML = svgString.trim();
        const svg = template.content.firstChild;

        if (svg) {
            svg.style.width = CONFIG.ICON_SIZE + 'px';
            svg.style.height = CONFIG.ICON_SIZE + 'px';
            svg.style.fill = 'currentColor';
            container.appendChild(svg);
        }
    }

    /**
     * Check if element exists and is connected to DOM
     */
    function isConnected(element) {
        return element && element.isConnected;
    }

    // ========================================
    // STORAGE (with fallback)
    // ========================================

    /**
     * Save to storage with fallback to sessionStorage
     */
    async function saveToStorage(key, value) {
        try {
            if (typeof browser !== 'undefined' && browser.storage) {
                await browser.storage.local.set({ [key]: value });
            } else {
                sessionStorage.setItem(key, JSON.stringify(value));
            }
        } catch (e) {
            logError('saveToStorage', e);
        }
    }

    /**
     * Load from storage with fallback
     */
    async function loadFromStorage(key) {
        try {
            if (typeof browser !== 'undefined' && browser.storage) {
                const result = await browser.storage.local.get(key);
                return result[key];
            } else {
                const item = sessionStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            }
        } catch (e) {
            logError('loadFromStorage', e);
            return null;
        }
    }

    // ========================================
    // THEME (Device preference only - no flashing)
    // ========================================

    /**
     * Get device/system theme preference (instant, no DOM needed)
     */
    function getDeviceTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    /**
     * Get colors for current device theme
     */
    function getColors() {
        const theme = getDeviceTheme();
        return CONFIG.COLORS[theme] || CONFIG.COLORS.light;
    }

    // ========================================
    // USERNAME DETECTION (Improved)
    // ========================================

    /**
     * Extract username with multiple strategies and caching
     */
    async function detectUsername() {
        // Return cached if available
        if (state.username) {
            return state.username;
        }

        // Try loading from storage first
        const cached = await loadFromStorage(CONFIG.STORAGE_KEYS.username);
        if (cached && typeof cached === 'string' && cached.length > 0) {
            state.username = cached;
            logInfo('detectUsername', `Loaded from cache: ${cached}`);
            return cached;
        }

        // Method 1: Look for viewer/user data in scripts (most reliable)
        try {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent;
                if (!content) continue;

                // Look for authenticated user patterns
                // Pattern 1: "viewer":{"screen_name":"xxx"}
                const viewerMatch = content.match(/"viewer"\s*:\s*\{[^}]*"screen_name"\s*:\s*"([a-zA-Z0-9_]+)"/);
                if (viewerMatch && viewerMatch[1]) {
                    state.username = viewerMatch[1];
                    await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                    logInfo('detectUsername', `Found via viewer pattern: ${state.username}`);
                    return state.username;
                }

                // Pattern 2: "user":{"screen_name":"xxx"} near authentication context
                if (content.includes('isLoggedIn') || content.includes('authenticate')) {
                    const userMatch = content.match(/"screen_name"\s*:\s*"([a-zA-Z0-9_]+)"/);
                    if (userMatch && userMatch[1]) {
                        state.username = userMatch[1];
                        await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                        logInfo('detectUsername', `Found via auth context: ${state.username}`);
                        return state.username;
                    }
                }
            }
        } catch (e) {
            logError('detectUsername.scripts', e);
        }

        // Method 2: Check sidebar navigation profile link
        try {
            const profileLink = document.querySelector(CONFIG.SELECTORS.profileLink);
            if (profileLink) {
                const href = profileLink.getAttribute('href');
                if (href && href.startsWith('/')) {
                    const username = href.substring(1).split('/')[0];
                    if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
                        state.username = username;
                        await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                        logInfo('detectUsername', `Found via profile link: ${state.username}`);
                        return state.username;
                    }
                }
            }
        } catch (e) {
            logError('detectUsername.profileLink', e);
        }

        // Method 3: Check profile links with aria-label
        try {
            const links = document.querySelectorAll('a[href^="/"][aria-label*="Profile"]');
            for (const link of links) {
                const href = link.getAttribute('href');
                if (href) {
                    const segments = href.substring(1).split('/');
                    if (segments.length === 1 && /^[a-zA-Z0-9_]+$/.test(segments[0])) {
                        state.username = segments[0];
                        await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                        logInfo('detectUsername', `Found via aria-label: ${state.username}`);
                        return state.username;
                    }
                }
            }
        } catch (e) {
            logError('detectUsername.ariaLabel', e);
        }

        // Method 4: Retry with delay (last resort)
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const check = async () => {
                attempts++;

                // Retry script method
                try {
                    const scripts = document.querySelectorAll('script:not([src])');
                    for (const script of scripts) {
                        const content = script.textContent;
                        if (content && content.includes('screen_name')) {
                            const match = content.match(/"screen_name"\s*:\s*"([a-zA-Z0-9_]+)"/);
                            if (match && match[1]) {
                                state.username = match[1];
                                await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                                resolve(state.username);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    logError('detectUsername.retry', e);
                }

                // Retry profile link method
                try {
                    const profileLink = document.querySelector(CONFIG.SELECTORS.profileLink);
                    if (profileLink) {
                        const href = profileLink.getAttribute('href');
                        if (href) {
                            const username = href.substring(1).split('/')[0];
                            if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
                                state.username = username;
                                await saveToStorage(CONFIG.STORAGE_KEYS.username, state.username);
                                resolve(state.username);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    logError('detectUsername.retryLink', e);
                }

                if (attempts < CONFIG.MAX_USERNAME_RETRIES) {
                    setTimeout(check, CONFIG.USERNAME_RETRY_DELAY_MS);
                } else {
                    reject(new Error('Failed to detect username after ' + attempts + ' attempts'));
                }
            };

            check();
        });
    }

    // ========================================
    // NOTIFICATION BADGE
    // ========================================

    /**
     * Extract notification count from X.com's UI
     */
    function getNotificationCount() {
        try {
            // Try multiple selectors
            const selectors = [
                '[data-testid="app-bar-notification-badge"]',
                'a[href="/notifications"] [aria-label]',
                'nav a[href="/notifications"] span'
            ];

            for (const selector of selectors) {
                const badge = document.querySelector(selector);
                if (badge) {
                    const text = badge.textContent || badge.getAttribute('aria-label') || '';
                    const match = text.match(/(\d+)/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }
                }
            }
        } catch (e) {
            logError('getNotificationCount', e);
        }
        return 0;
    }

    /**
     * Update our notification badge
     */
    function updateNotificationBadge() {
        const count = getNotificationCount();
        if (count === state.notificationCount) return;

        state.notificationCount = count;

        const tabData = state.tabElements.get('notifications');
        if (!tabData) return;

        // Remove existing badge
        const existingBadge = tabData.element.querySelector('.x41-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add badge if count > 0
        if (count > 0) {
            const badge = document.createElement('div');
            badge.className = 'x41-badge';
            badge.textContent = count > 99 ? '99+' : count.toString();

            const colors = getColors();
            Object.assign(badge.style, {
                position: 'absolute',
                top: '6px',
                right: 'calc(50% - 20px)',
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                backgroundColor: 'rgb(29, 155, 240)', // X.com blue
                color: 'white',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                boxSizing: 'border-box'
            });

            tabData.element.appendChild(badge);
        }
    }

    /**
     * Watch for notification badge changes
     */
    function watchNotificationBadge() {
        // Initial check
        updateNotificationBadge();

        // Set up MutationObserver to watch for badge changes
        const observer = new MutationObserver(() => {
            updateNotificationBadge();
        });

        // Observe the navigation area
        const nav = document.querySelector('nav[role="navigation"]');
        if (nav) {
            observer.observe(nav, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Also check periodically as backup
        const intervalId = setInterval(updateNotificationBadge, CONFIG.BADGE_CHECK_INTERVAL_MS);

        state.badgeObserver = observer;
        state.cleanupFunctions.push(() => {
            observer.disconnect();
            clearInterval(intervalId);
        });
    }

    // ========================================
    // UI MODIFICATIONS
    // ========================================

    /**
     * Hide "Maybe later" buttons that navigate to home feed
     */
    function hideMaybeLaterButtons() {
        const hideButtons = () => {
            const buttons = document.querySelectorAll('button[type="button"]');
            buttons.forEach(button => {
                if (button.textContent.trim() === 'Maybe later') {
                    // Make invisible but preserve space
                    button.style.visibility = 'hidden';
                    button.style.pointerEvents = 'none';
                }
            });
        };

        // Run immediately
        hideButtons();

        // Watch for dynamically added buttons
        const observer = new MutationObserver(hideButtons);
        observer.observe(document.body, { childList: true, subtree: true });

        state.cleanupFunctions.push(() => observer.disconnect());
    }

    /**
     * Reposition toast notifications above our tab bar
     */
    function watchToasts() {
        const tabBarOffset = CONFIG.TAB_BAR_HEIGHT;

        const repositionToasts = () => {
            // Find toast container in #layers
            const layers = document.getElementById('layers');
            if (!layers) return;

            // X.com toasts are typically direct children of #layers with bottom positioning
            const toasts = layers.querySelectorAll('[role="alert"], [data-testid="toast"]');
            toasts.forEach(toast => {
                // Find the positioned ancestor
                let positioned = toast;
                while (positioned && positioned !== layers) {
                    const style = positioned.style;
                    if (style && style.bottom !== undefined && style.bottom !== '') {
                        const currentBottom = parseInt(style.bottom) || 0;
                        if (currentBottom < tabBarOffset) {
                            style.bottom = `calc(${tabBarOffset}px + env(safe-area-inset-bottom, 0px))`;
                        }
                        break;
                    }
                    positioned = positioned.parentElement;
                }
            });
        };

        // Watch #layers for changes
        const observeLayers = () => {
            const layers = document.getElementById('layers');
            if (!layers) {
                setTimeout(observeLayers, 500);
                return;
            }

            const observer = new MutationObserver(repositionToasts);
            observer.observe(layers, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

            state.cleanupFunctions.push(() => observer.disconnect());
        };

        observeLayers();
    }

    // ========================================
    // URL HANDLING
    // ========================================

    /**
     * Check and handle redirects
     */
    function handleRedirects() {
        if (!state.preferences.redirectHome) return false;

        const path = window.location.pathname;

        if (path === '/' || path === '/home') {
            window.location.replace('/notifications');
            return true;
        }

        return false;
    }

    /**
     * Check if current page is compose page
     */
    function isComposePage() {
        const path = window.location.pathname;
        return path.includes('/compose/') || path.includes('/intent/tweet');
    }

    // ========================================
    // CSS INJECTION
    // ========================================

    // Pre-generated CSS templates
    let cssTemplates = {
        base: null,
        compose: null,
        nonCompose: null
    };

    /**
     * Generate CSS templates once at initialization
     */
    function generateCSSTemplates() {
        const tabBarHeight = CONFIG.TAB_BAR_HEIGHT;

        cssTemplates.base = `
            /* X41 Extension Styles */

            /* Hide native bottom tab bar */
            ${CONFIG.SELECTORS.nativeTabBar} {
                display: none !important;
            }

            /* Add bottom padding for custom tab bar with safe area */
            ${CONFIG.SELECTORS.primaryColumn} {
                padding-bottom: calc(${tabBarHeight + 10}px + env(safe-area-inset-bottom, 0px)) !important;
            }

            /* Reposition floating compose button above tab bar */
            a[href="/compose/post"],
            a[data-testid="SideNav_NewTweet_Button"],
            a[aria-label*="Post"],
            button[data-testid="SideNav_NewTweet_Button"] {
                bottom: calc(${tabBarHeight}px + env(safe-area-inset-bottom, 0px)) !important;
            }

            /* Reposition toast/snackbar notifications above tab bar */
            [data-testid="toast"],
            #layers [role="alert"] {
                z-index: ${CONFIG.Z_INDEX.tabBar + 1} !important;
            }

            /* Tab bar base */
            #x41-tab-bar {
                opacity: 1;
                transition: opacity 0.2s ease;
            }

            /* Tab hover effect */
            .x41-tab:active {
                opacity: 0.7;
            }

            @media (hover: hover) {
                .x41-tab:hover .x41-icon {
                    background-color: var(--x41-hover-color, rgba(0,0,0,0.1));
                    border-radius: 50%;
                }
            }
        `;

        cssTemplates.nonCompose = `
            /* Hide header on non-compose pages */
            ${CONFIG.SELECTORS.topNavBar},
            ${CONFIG.SELECTORS.headerBanner} {
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }
        `;

        cssTemplates.compose = `
            /* Show header on compose pages */
            ${CONFIG.SELECTORS.topNavBar},
            ${CONFIG.SELECTORS.headerBanner} {
                visibility: visible !important;
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                pointer-events: auto !important;
            }
        `;
    }

    /**
     * Inject or update styles
     */
    function updateStyles() {
        try {
            const composePage = isComposePage();

            // Only update if page type changed or styles don't exist
            if (state.isComposePage === composePage && isConnected(state.styleElement)) {
                return;
            }

            state.isComposePage = composePage;

            // Remove existing style element
            if (isConnected(state.styleElement)) {
                state.styleElement.remove();
            }

            // Create new style element
            const style = document.createElement('style');
            style.id = 'x41-styles';
            style.textContent = cssTemplates.base + (composePage ? cssTemplates.compose : cssTemplates.nonCompose);

            // Inject into head
            (document.head || document.documentElement).appendChild(style);
            state.styleElement = style;
        } catch (e) {
            logError('updateStyles', e);
        }
    }

    // ========================================
    // TAB BAR
    // ========================================

    /**
     * Create custom tab bar
     */
    async function createTabBar() {
        // Check if already exists
        if (isConnected(state.tabBar)) {
            updateTabBar();
            return;
        }

        // Get username (required for profile tab)
        const username = await detectUsername();
        if (!username) {
            throw new Error('Cannot create tab bar without username');
        }

        // Get colors based on device theme
        const colors = getColors();

        // Create container
        const tabBar = document.createElement('div');
        tabBar.id = 'x41-tab-bar';
        tabBar.setAttribute('role', 'navigation');
        tabBar.setAttribute('aria-label', 'X41 navigation');

        // Apply styles with safe area support
        // Start hidden to prevent flash, will be shown after colors are applied
        Object.assign(tabBar.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            width: '100%',
            height: `calc(${CONFIG.TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backgroundColor: colors.background,
            borderTop: `0.5px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            zIndex: CONFIG.Z_INDEX.tabBar.toString(),
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxSizing: 'border-box',
            opacity: '0'
        });

        // Define tabs
        const tabs = [
            { id: 'profile', href: `/${username}`, icon: 'profile', label: 'Profile' },
            { id: 'notifications', href: '/notifications', icon: 'notifications', label: 'Notifications' },
            { id: 'analytics', href: '/i/account_analytics', icon: 'analytics', label: 'Analytics' }
        ];

        // Create tab elements
        state.tabElements.clear();
        tabs.forEach(tab => {
            const tabData = createTab(tab, colors);
            state.tabElements.set(tab.id, tabData);
            tabBar.appendChild(tabData.element);
        });

        // Store reference
        state.tabBar = tabBar;

        // Append to body
        document.body.appendChild(tabBar);

        // Update active state
        updateTabBar();

        // Start watching notification badge
        watchNotificationBadge();

        // Show tab bar now that it's fully styled
        tabBar.style.opacity = '1';
    }

    /**
     * Create a single tab element
     */
    function createTab(tab, colors) {
        const currentPath = window.location.pathname;
        const isActive = checkIfTabIsActive(currentPath, tab);

        // Create tab link
        const element = document.createElement('a');
        element.href = tab.href;
        element.className = 'x41-tab';
        element.setAttribute('aria-label', tab.label);
        element.setAttribute('aria-current', isActive ? 'page' : 'false');
        element.setAttribute('data-tab-id', tab.id);

        // Styles
        Object.assign(element.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1',
            textDecoration: 'none',
            padding: '0',
            paddingTop: '8px',
            position: 'relative',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            height: CONFIG.TAB_BAR_HEIGHT + 'px',
            '--x41-hover-color': colors.hover
        });

        // Icon container
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'x41-icon';
        Object.assign(iconWrapper.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            color: isActive ? colors.active : colors.inactive,
            transition: 'background-color 0.15s ease'
        });

        // Set icon
        setSVGContent(iconWrapper, getIconSVG(tab.icon, isActive));

        element.appendChild(iconWrapper);

        return {
            element,
            iconWrapper,
            id: tab.id,
            href: tab.href,
            iconKey: tab.icon,
            isActive
        };
    }

    /**
     * Check if a tab is currently active (improved specificity)
     */
    function checkIfTabIsActive(currentPath, tab) {
        // Exact match
        if (currentPath === tab.href) {
            return true;
        }

        // Profile tab: match profile and its sub-pages
        if (tab.id === 'profile' && state.username) {
            const profileBase = `/${state.username}`;
            if (currentPath === profileBase) return true;

            // Match specific profile sub-pages
            const profileSubpages = ['/with_replies', '/highlights', '/articles', '/media', '/likes'];
            for (const subpage of profileSubpages) {
                if (currentPath === profileBase + subpage) return true;
            }
        }

        // Notifications tab: match notification sub-pages
        if (tab.id === 'notifications') {
            if (currentPath.startsWith('/notifications')) return true;
        }

        // Analytics tab: match analytics sub-pages
        if (tab.id === 'analytics') {
            if (currentPath.startsWith('/i/account_analytics')) return true;
        }

        return false;
    }

    /**
     * Update tab bar active states
     */
    function updateTabBar() {
        if (!isConnected(state.tabBar) || !state.username) return;

        const currentPath = window.location.pathname;
        const colors = getColors();

        // Update tab bar colors
        state.tabBar.style.backgroundColor = colors.background;
        state.tabBar.style.borderTopColor = colors.border;

        // Update each tab
        state.tabElements.forEach((tabData) => {
            const isActive = checkIfTabIsActive(currentPath, tabData);

            // Update aria-current
            tabData.element.setAttribute('aria-current', isActive ? 'page' : 'false');

            // Update icon
            setSVGContent(tabData.iconWrapper, getIconSVG(tabData.iconKey, isActive));

            // Update color
            tabData.iconWrapper.style.color = isActive ? colors.active : colors.inactive;

            // Update hover color CSS variable
            tabData.element.style.setProperty('--x41-hover-color', colors.hover);

            tabData.isActive = isActive;
        });

        // Update notification badge
        updateNotificationBadge();
    }

    /**
     * Get SVG icon markup
     */
    function getIconSVG(iconKey, isActive) {
        const icons = {
            profile: {
                outline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z"/></svg>',
                filled: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/></svg>'
            },
            notifications: {
                outline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.864 16H5.134z"/></svg>',
                filled: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.697 16.468c-.02-.016-2.14-1.64-2.103-6.03.02-2.532-.812-4.782-2.347-6.335C15.872 2.71 14.01 1.94 12.005 1.93h-.013c-2.004.01-3.866.78-5.242 2.174-1.534 1.553-2.368 3.802-2.346 6.334.037 4.33-2.02 5.967-2.102 6.03-.26.193-.366.53-.265.838.102.308.39.515.712.515h4.92c.102 2.31 1.997 4.16 4.33 4.16s4.226-1.85 4.327-4.16h4.922c.322 0 .61-.206.71-.514.103-.307-.003-.645-.263-.838zM12 20.478c-1.505 0-2.73-1.177-2.828-2.658h5.656c-.1 1.48-1.323 2.66-2.828 2.66z"/></svg>'
            },
            analytics: {
                outline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>',
                filled: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>'
            }
        };

        return isActive ? icons[iconKey].filled : icons[iconKey].outline;
    }

    // ========================================
    // NAVIGATION HANDLING
    // ========================================

    /**
     * Handle navigation changes
     */
    const handleNavigation = debounce(() => {
        const newPath = window.location.pathname;

        if (newPath === state.currentPath) return;

        state.currentPath = newPath;

        // Update styles if page type changed
        updateStyles();

        // Update tab bar
        updateTabBar();
    }, CONFIG.NAVIGATION_DEBOUNCE_MS);

    /**
     * Intercept pushState and replaceState
     */
    function interceptNavigation() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            handleNavigation();
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            handleNavigation();
        };

        window.addEventListener('popstate', handleNavigation);

        state.cleanupFunctions.push(() => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', handleNavigation);
        });
    }

    // ========================================
    // THEME CHANGE HANDLING
    // ========================================

    /**
     * Watch for device theme changes only
     */
    function setupThemeWatcher() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = () => updateTabBar();
        mediaQuery.addEventListener('change', handleThemeChange);

        state.cleanupFunctions.push(() => {
            mediaQuery.removeEventListener('change', handleThemeChange);
        });
    }

    // ========================================
    // GRACEFUL DEGRADATION
    // ========================================

    /**
     * Restore native X.com UI
     */
    function restoreNativeUI() {
        logInfo('restoreNativeUI', 'Restoring native X.com UI');

        // Remove our style element
        if (isConnected(state.styleElement)) {
            state.styleElement.remove();
            state.styleElement = null;
        }

        // Remove our tab bar
        if (isConnected(state.tabBar)) {
            state.tabBar.remove();
            state.tabBar = null;
        }

        // Clear tab elements
        state.tabElements.clear();
    }

    // ========================================
    // LIFECYCLE MANAGEMENT
    // ========================================

    /**
     * Initialize extension
     */
    async function initialize() {
        if (state.isInitialized) return;

        try {
            logInfo('initialize', 'Starting initialization');

            // Generate CSS templates
            generateCSSTemplates();

            // Inject CSS immediately
            updateStyles();

            // Setup navigation interception
            interceptNavigation();

            // Setup theme watcher
            setupThemeWatcher();

            // Hide "Maybe later" buttons that lead to home feed
            hideMaybeLaterButtons();

            // Watch and reposition toast notifications
            watchToasts();

            // Create tab bar (waits for username)
            await createTabBar();

            // Mark as initialized
            state.isInitialized = true;
            logInfo('initialize', 'Initialization complete');

        } catch (error) {
            logError('initialize', error);

            // Graceful degradation: restore native UI if our initialization fails
            restoreNativeUI();
        }
    }

    /**
     * Cleanup function
     */
    function destroy() {
        if (state.isDestroyed) return;

        logInfo('destroy', 'Cleaning up');

        // Run all cleanup functions
        state.cleanupFunctions.forEach(fn => {
            try {
                fn();
            } catch (e) {
                logError('destroy.cleanup', e);
            }
        });

        // Restore native UI
        restoreNativeUI();

        state.isDestroyed = true;
    }

    // ========================================
    // ENTRY POINT
    // ========================================

    // Check for redirects first (before any UI changes)
    if (handleRedirects()) return;

    // Generate CSS templates
    generateCSSTemplates();

    // Inject CSS as early as possible
    updateStyles();

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
