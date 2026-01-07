/**
 * X41 - Enhanced X.com Navigation
 *
 * Minimal, memory-efficient content script with:
 * - Zero polling (event-driven architecture)
 * - Instant username detection via X's internal state
 * - Proper cleanup and error handling
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const CONFIG = {
        // Performance
        NAVIGATION_DEBOUNCE_MS: 100,
        MAX_USERNAME_RETRIES: 10,
        USERNAME_RETRY_DELAY_MS: 200,

        // UI
        TAB_BAR_HEIGHT: 53,
        ICON_SIZE: 26,

        // Colors (matching X.com's design system)
        COLORS: {
            light: {
                active: 'rgb(15, 20, 25)',
                inactive: 'rgb(83, 100, 113)',
                background: 'rgb(255, 255, 255)',
                border: 'rgb(239, 243, 244)',
                hover: 'rgb(247, 249, 249)'
            },
            dark: {
                active: 'rgb(231, 233, 234)',
                inactive: 'rgb(113, 118, 123)',
                background: 'rgb(0, 0, 0)',
                border: 'rgb(47, 51, 54)',
                hover: 'rgb(22, 24, 28)'
            }
        },

        // Selectors (centralized for maintainability)
        SELECTORS: {
            topNavBar: '[data-testid="TopNavBar"]',
            headerBanner: 'header[role="banner"]',
            nativeTabBar: '[data-testid="BottomBar"]',
            primaryColumn: '[data-testid="primaryColumn"]'
        },

        // Z-index management
        Z_INDEX: {
            tabBar: 10000
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        // User data
        username: null,

        // Navigation
        currentPath: window.location.pathname,
        isComposePage: false,

        // UI elements
        tabBar: null,
        tabElements: [],
        styleElement: null,

        // Observers & listeners
        mediaQuery: null,
        cleanupFunctions: [],

        // State flags
        isInitialized: false,
        isDestroyed: false,
        theme: 'light'
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
     * Detect current theme
     */
    function detectTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    /**
     * Safely set SVG content in a container (avoids innerHTML XSS risk)
     * @param {HTMLElement} container - The container element
     * @param {string} svgString - The SVG markup string
     */
    function setSVGContent(container, svgString) {
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Parse SVG string safely using template element
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

    // ========================================
    // USERNAME DETECTION (Optimized)
    // ========================================

    /**
     * Extract username from X.com's internal state (instant)
     * Falls back to script tag parsing if needed
     */
    async function detectUsername() {
        if (state.username) return state.username;

        // Method 1: Check for X.com's React state in window object
        // X.com exposes user data in various global objects
        try {
            // Try to find username in page's initial state
            const initialStateScripts = document.querySelectorAll('script:not([src])');
            for (const script of initialStateScripts) {
                const content = script.textContent;

                // Look for screen_name in JSON structures
                if (content.includes('screen_name')) {
                    const match = content.match(/"screen_name":"([a-zA-Z0-9_]+)"/);
                    if (match && match[1]) {
                        state.username = match[1];
                        return state.username;
                    }
                }
            }
        } catch (e) {
            logError('detectUsername.scriptParsing', e);
        }

        // Method 2: Check profile links in DOM (faster than waiting)
        try {
            const profileLinks = document.querySelectorAll('a[href^="/"]');
            for (const link of profileLinks) {
                const href = link.getAttribute('href');
                // Check for single-segment path like "/username" (not "/path/to/page")
                if (href && href.startsWith('/') && href.length > 1) {
                    const pathSegments = href.substring(1).split('/');
                    if (pathSegments.length === 1) {
                        const ariaLabel = link.getAttribute('aria-label');
                        if (ariaLabel && ariaLabel.includes('Profile')) {
                            const username = pathSegments[0];
                            if (username && /^[a-zA-Z0-9_]+$/.test(username)) {
                                state.username = username;
                                return state.username;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            logError('detectUsername.profileLinks', e);
        }

        // Method 3: Wait for it to appear (last resort)
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const check = () => {
                attempts++;

                // Try script tag method
                try {
                    const scripts = document.querySelectorAll('script:not([src])');
                    for (const script of scripts) {
                        const content = script.textContent;
                        if (content && content.includes('screen_name')) {
                            const match = content.match(/"screen_name":"([a-zA-Z0-9_]+)"/);
                            if (match && match[1]) {
                                state.username = match[1];
                                resolve(state.username);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    logError('detectUsername.retry', e);
                }

                // Retry or give up
                if (attempts < CONFIG.MAX_USERNAME_RETRIES) {
                    setTimeout(check, CONFIG.USERNAME_RETRY_DELAY_MS);
                } else {
                    reject(new Error('Failed to detect username'));
                }
            };

            check();
        });
    }

    // ========================================
    // URL HANDLING
    // ========================================

    /**
     * Check and handle redirects
     */
    function handleRedirects() {
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
    // CSS INJECTION (Optimized)
    // ========================================

    /**
     * Inject or update styles
     * Only re-injects when page type changes (compose vs non-compose)
     */
    function updateStyles() {
        try {
            const composePage = isComposePage();

            // Only update if page type changed or styles don't exist
            if (state.isComposePage === composePage && state.styleElement && document.head.contains(state.styleElement)) {
                return;
            }

            state.isComposePage = composePage;

            // Remove only our style element if it exists
            if (state.styleElement && state.styleElement.parentNode) {
                state.styleElement.remove();
            }

            // Create new style element
            const style = document.createElement('style');
            style.id = 'x41-styles';
            style.textContent = generateCSS(composePage);

            // Inject into head
            (document.head || document.documentElement).appendChild(style);
            state.styleElement = style;
        } catch (e) {
            logError('updateStyles', e);
        }
    }

    /**
     * Generate CSS based on page type
     */
    function generateCSS(isCompose) {
        return `
            /* X41 Extension Styles - Minimal Version */

            /* Header visibility control */
            ${!isCompose ? `
            /* Hide header on non-compose pages (keep in DOM to avoid breaking X.com) */
            ${CONFIG.SELECTORS.topNavBar},
            ${CONFIG.SELECTORS.headerBanner} {
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }
            ` : ''}

            /* Hide native bottom tab bar */
            ${CONFIG.SELECTORS.nativeTabBar} {
                display: none !important;
            }

            /* Add bottom padding for custom tab bar */
            ${CONFIG.SELECTORS.primaryColumn} {
                padding-bottom: ${CONFIG.TAB_BAR_HEIGHT + 10}px !important;
            }

            /* Reposition floating compose button above tab bar */
            a[href="/compose/post"],
            a[data-testid="SideNav_NewTweet_Button"],
            a[aria-label*="Post"],
            button[data-testid="SideNav_NewTweet_Button"] {
                bottom: ${CONFIG.TAB_BAR_HEIGHT}px !important;
            }

            /* Tab bar */
            #x41-tab-bar {
                opacity: 1;
            }

            /* Tab interactions */
            .x41-tab:hover {
                background-color: var(--x41-hover-color);
            }
        `;
    }

    // ========================================
    // TAB BAR CREATION (Optimized)
    // ========================================

    /**
     * Create custom tab bar
     */
    async function createTabBar() {
        // Check if already exists
        if (state.tabBar && document.body.contains(state.tabBar)) {
            updateTabBar();
            return;
        }

        // Get username (required for profile tab)
        const username = await detectUsername();
        if (!username) {
            throw new Error('Cannot create tab bar without username');
        }

        // Detect theme
        const theme = detectTheme();
        state.theme = theme;
        const colors = CONFIG.COLORS[theme];

        // Create container
        const tabBar = document.createElement('div');
        tabBar.id = 'x41-tab-bar';
        tabBar.setAttribute('role', 'navigation');
        tabBar.setAttribute('aria-label', 'Main navigation');

        // Apply styles
        Object.assign(tabBar.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            width: '100%',
            height: CONFIG.TAB_BAR_HEIGHT + 'px',
            backgroundColor: colors.background,
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: CONFIG.Z_INDEX.tabBar.toString(),
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)'
        });

        // Define tabs
        const tabs = [
            { href: `/${username}`, icon: 'profile', label: 'Profile' },
            { href: '/notifications', icon: 'notifications', label: 'Notifications' },
            { href: '/i/account_analytics', icon: 'analytics', label: 'Analytics' }
        ];

        // Create tab elements
        state.tabElements = tabs.map(tab => createTab(tab, colors));

        // Append tabs to bar
        state.tabElements.forEach(({ element }) => tabBar.appendChild(element));

        // Store reference
        state.tabBar = tabBar;

        // Append to body
        document.body.appendChild(tabBar);

        // Update active state
        updateTabBar();
    }

    /**
     * Create a single tab element
     */
    function createTab(tab, colors) {
        const currentPath = window.location.pathname;
        const isActive = checkIfTabIsActive(currentPath, tab.href);

        // Create tab link
        const element = document.createElement('a');
        element.href = tab.href;
        element.className = 'x41-tab';
        element.setAttribute('aria-label', tab.label);
        element.setAttribute('aria-current', isActive ? 'page' : 'false');

        // Styles
        Object.assign(element.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1',
            textDecoration: 'none',
            padding: '0',
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
            width: '50px',
            height: '50px',
            color: isActive ? colors.active : colors.inactive
        });

        // Set icon safely (avoids innerHTML XSS risk)
        setSVGContent(iconWrapper, getIconSVG(tab.icon, isActive));

        element.appendChild(iconWrapper);

        return {
            element,
            iconWrapper,
            href: tab.href,
            iconKey: tab.icon,
            isActive
        };
    }

    /**
     * Check if a tab is currently active
     */
    function checkIfTabIsActive(currentPath, tabHref) {
        if (currentPath === tabHref) return true;
        if (state.username && tabHref === `/${state.username}` && currentPath.startsWith(`/${state.username}`)) {
            return true;
        }
        return false;
    }

    /**
     * Update tab bar active states
     */
    function updateTabBar() {
        if (!state.tabBar || !state.username) return;

        const currentPath = window.location.pathname;
        const theme = detectTheme();
        const colors = CONFIG.COLORS[theme];

        // Update theme if changed
        if (state.theme !== theme) {
            state.theme = theme;
            state.tabBar.style.backgroundColor = colors.background;
            state.tabBar.style.borderTopColor = colors.border;
        }

        // Update each tab
        state.tabElements.forEach(({ element, iconWrapper, href, iconKey }) => {
            const isActive = checkIfTabIsActive(currentPath, href);

            // Update aria-current
            element.setAttribute('aria-current', isActive ? 'page' : 'false');

            // Update icon safely
            setSVGContent(iconWrapper, getIconSVG(iconKey, isActive));

            // Update color
            iconWrapper.style.color = isActive ? colors.active : colors.inactive;
        });
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
    // NAVIGATION HANDLING (Event-Driven)
    // ========================================

    /**
     * Handle navigation changes
     * Called on popstate, pushState, replaceState
     */
    const handleNavigation = debounce(() => {
        const newPath = window.location.pathname;

        if (newPath === state.currentPath) return;

        state.currentPath = newPath;

        // Check for redirects
        if (handleRedirects()) return;

        // Update styles if page type changed
        updateStyles();

        // Update tab bar
        updateTabBar();
    }, CONFIG.NAVIGATION_DEBOUNCE_MS);

    /**
     * Intercept pushState and replaceState
     * This catches SPA navigation that doesn't trigger popstate
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

        // Also listen for popstate (back/forward buttons)
        window.addEventListener('popstate', handleNavigation);

        // Store cleanup
        state.cleanupFunctions.push(() => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', handleNavigation);
        });
    }

    // ========================================
    // THEME HANDLING
    // ========================================

    /**
     * Handle theme changes
     */
    function handleThemeChange(e) {
        const isDark = e.matches;
        state.theme = isDark ? 'dark' : 'light';
        updateTabBar();
    }

    /**
     * Setup theme listener
     */
    function setupThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', handleThemeChange);

        state.mediaQuery = mediaQuery;
        state.cleanupFunctions.push(() => {
            mediaQuery.removeEventListener('change', handleThemeChange);
        });
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
            // Inject CSS immediately
            updateStyles();

            // Setup navigation interception
            interceptNavigation();

            // Setup theme listener
            setupThemeListener();

            // Create tab bar (waits for username)
            await createTabBar();

            // Mark as initialized
            state.isInitialized = true;

        } catch (error) {
            logError('initialize', error);
        }
    }

    /**
     * Cleanup function
     */
    function destroy() {
        if (state.isDestroyed) return;

        // Run all cleanup functions
        state.cleanupFunctions.forEach(fn => {
            try {
                fn();
            } catch (e) {
                logError('destroy.cleanup', e);
            }
        });

        // Remove tab bar
        if (state.tabBar && state.tabBar.parentNode) {
            state.tabBar.remove();
        }

        // Remove styles
        if (state.styleElement && state.styleElement.parentNode) {
            state.styleElement.remove();
        }

        state.isDestroyed = true;
    }

    // ========================================
    // ENTRY POINT
    // ========================================

    // Check for redirects first
    if (handleRedirects()) return;

    // Inject CSS as early as possible
    updateStyles();

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
