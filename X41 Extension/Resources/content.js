// X41 - Use X.COM in single player mode
// Opinionated, curated X experience

(function() {
    'use strict';

    console.log('[X41] Opinionated mode loaded on:', window.location.href);

    // ===== STATE MANAGEMENT =====
    const state = {
        username: null,
        currentPath: window.location.pathname,
        isComposePage: false,
        tabBar: null,
        tabElements: [],
        observer: null
    };

    // ===== URL REDIRECTS =====
    function handleRedirects() {
        const path = window.location.pathname;

        if (path === '/' || path === '/home') {
            console.log('[X41] Redirecting to /notifications');
            window.location.replace('/notifications');
            return true;
        }
        return false;
    }

    // Check redirects immediately
    if (handleRedirects()) {
        return; // Stop execution if redirecting
    }

    // ===== GET CURRENT USER PROFILE =====
    async function getCurrentUsername() {
        // Return cached username if available
        if (state.username) {
            return state.username;
        }

        // Wait for username to be available in DOM
        return new Promise((resolve) => {
            const checkUsername = () => {
                try {
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = script.textContent;
                        if (content && content.includes('screen_name')) {
                            const match = content.match(/"screen_name":"([a-zA-Z0-9_]+)"/);
                            if (match && match[1]) {
                                state.username = match[1];
                                console.log('[X41] Username found:', state.username);
                                resolve(state.username);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    console.log('[X41] Error getting username:', e.message);
                }

                // Retry after delay if not found
                setTimeout(checkUsername, 500);
            };

            checkUsername();
        });
    }

    // ===== CSS INJECTION =====
    function updateStyles() {
        const isComposePage = window.location.pathname.includes('/compose/');

        // Only re-inject if page type changed
        if (state.isComposePage === isComposePage && document.getElementById('x41-styles')) {
            return;
        }

        state.isComposePage = isComposePage;

        // Remove existing styles
        const existingStyle = document.getElementById('x41-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = 'x41-styles';

        style.textContent = `
            /* X41 - Hide headers on all pages EXCEPT compose */
            ${!isComposePage ? `
            header[role="banner"],
            header,
            [role="banner"],
            nav[role="navigation"],
            div[data-testid*="header"],
            div[data-testid*="Header"],
            div.css-175oi2r.r-1h3ijdo.r-136ojw6 {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
            }
            ` : ''}

            /* Always hide back buttons */
            [aria-label*="Back"],
            button[aria-label*="Back"],
            div[data-testid*="app-bar-back"] {
                display: none !important;
            }

            /* Hide native bottom tab bar */
            [data-testid="BottomBar"] {
                display: none !important;
            }

            /* X.com's exact method: Add spacing to prevent content from hiding behind custom tab bar */
            [data-testid="primaryColumn"] {
                padding-bottom: 60px !important;
            }

            /* Reposition X.com's floating compose button (FAB) above our tab bar */
            a[href="/compose/post"],
            a[data-testid*="floatingActionButton"],
            a[aria-label*="Post"] {
                bottom: 70px !important;
            }
        `;

        (document.head || document.documentElement).appendChild(style);
        console.log('[X41] ✅ Injected CSS styles');
    }

    // ===== THEME MANAGEMENT =====
    const colors = {
        light: {
            active: 'rgb(0, 0, 0)',
            inactive: 'rgb(83, 100, 113)',
            background: 'rgb(255, 255, 255)',
            border: 'rgb(239, 243, 244)'
        },
        dark: {
            active: 'rgb(255, 255, 255)',
            inactive: 'rgb(113, 118, 123)',
            background: 'rgb(0, 0, 0)',
            border: 'rgb(47, 51, 54)'
        }
    };

    function updateTheme(isDark) {
        if (!state.tabBar) return;

        const theme = isDark ? 'dark' : 'light';
        const currentPath = window.location.pathname;

        // Update tab bar background and border
        state.tabBar.style.backgroundColor = colors[theme].background;
        state.tabBar.style.borderTopColor = colors[theme].border;

        // Update all tab icon colors
        state.tabElements.forEach(({ iconWrapper, href }) => {
            // Recalculate isActive based on current path
            const isActive = currentPath === href ||
                           (state.username && href === `/${state.username}` && currentPath.startsWith(`/${state.username}`));
            const color = isActive ? colors[theme].active : colors[theme].inactive;
            iconWrapper.style.color = color;
        });
    }

    // ===== TAB BAR - UPDATE ACTIVE STATE =====
    function updateActiveTab() {
        if (!state.username || !state.tabBar) return;

        const currentPath = window.location.pathname;
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = isDark ? 'dark' : 'light';

        state.tabElements.forEach(({ iconWrapper, svg, tabEl, iconKey, href }) => {
            const isActive = currentPath === href ||
                           (href === `/${state.username}` && currentPath.startsWith(`/${state.username}`));

            // Update icon (filled vs outlined)
            const icons = {
                profile: {
                    outlined: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z"></path></g></svg>`,
                    filled: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"></path></g></svg>`
                },
                notifications: {
                    outlined: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.864 16H5.134z"></path></g></svg>`,
                    filled: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M21.697 16.468c-.02-.016-2.14-1.64-2.103-6.03.02-2.532-.812-4.782-2.347-6.335C15.872 2.71 14.01 1.94 12.005 1.93h-.013c-2.004.01-3.866.78-5.242 2.174-1.534 1.553-2.368 3.802-2.346 6.334.037 4.33-2.02 5.967-2.102 6.03-.26.193-.366.53-.265.838.102.308.39.515.712.515h4.92c.102 2.31 1.997 4.16 4.33 4.16s4.226-1.85 4.327-4.16h4.922c.322 0 .61-.206.71-.514.103-.307-.003-.645-.263-.838zM12 20.478c-1.505 0-2.73-1.177-2.828-2.658h5.656c-.1 1.48-1.323 2.66-2.828 2.66z"></path></g></svg>`
                },
                analytics: {
                    outlined: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></g></svg>`,
                    filled: `<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></g></svg>`
                }
            };

            // Update icon SVG
            const iconSVG = isActive ? icons[iconKey].filled : icons[iconKey].outlined;
            iconWrapper.innerHTML = iconSVG;

            // Re-style the new SVG
            const newSvg = iconWrapper.querySelector('svg');
            if (newSvg) {
                newSvg.style.width = '26px';
                newSvg.style.height = '26px';
                newSvg.style.fill = 'currentColor';
            }

            // Update color
            const color = isActive ? colors[theme].active : colors[theme].inactive;
            iconWrapper.style.color = color;

            // Store updated state
            iconWrapper._isActive = isActive;
        });

        console.log('[X41] Updated active tab');
    }

    // ===== TAB BAR - CREATE =====
    async function createCustomTabBar() {
        // Check if tab bar already exists
        if (state.tabBar && document.body.contains(state.tabBar)) {
            console.log('[X41] Tab bar already exists, updating active state');
            updateActiveTab();
            return;
        }

        // Get username (waits until available)
        const username = await getCurrentUsername();

        console.log('[X41] Creating tab bar for user:', username);

        // Create tab bar container
        const tabBar = document.createElement('div');
        tabBar.id = 'x41-tab-bar';

        // Detect current theme
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = isDark ? 'dark' : 'light';

        tabBar.style.cssText = `
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 53px !important;
            background-color: ${colors[theme].background};
            border-top: 1px solid ${colors[theme].border};
            display: flex !important;
            justify-content: space-around;
            align-items: center;
            z-index: 999999 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
        `;

        // Tab definitions
        const tabs = [
            { href: `/${username}`, iconKey: 'profile', ariaLabel: 'Profile' },
            { href: '/notifications', iconKey: 'notifications', ariaLabel: 'Notifications' },
            { href: '/i/account_analytics', iconKey: 'analytics', ariaLabel: 'Analytics' }
        ];

        // Create tabs
        state.tabElements = [];
        tabs.forEach(tab => {
            const tabEl = document.createElement('a');
            tabEl.href = tab.href;
            tabEl.setAttribute('aria-label', tab.ariaLabel);
            tabEl.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 1;
                text-decoration: none;
                padding: 0;
                position: relative;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
                height: 53px;
            `;

            const iconWrapper = document.createElement('div');
            iconWrapper.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                width: 50px;
                height: 50px;
            `;

            tabEl.appendChild(iconWrapper);
            tabBar.appendChild(tabEl);

            // Store reference
            state.tabElements.push({
                iconWrapper,
                svg: null,
                tabEl,
                iconKey: tab.iconKey,
                href: tab.href,
                isActive: false
            });
        });

        // Store reference
        state.tabBar = tabBar;

        // Append to body
        document.body.appendChild(tabBar);
        console.log('[X41] Created custom tab bar');

        // Update active state and theme
        updateActiveTab();
        updateTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // ===== NAVIGATION HANDLING =====
    function handleNavigation() {
        const newPath = window.location.pathname;

        if (newPath === state.currentPath) return;

        console.log('[X41] Navigation detected:', state.currentPath, '->', newPath);
        state.currentPath = newPath;

        // Check for redirects
        if (handleRedirects()) return;

        // Update styles if page type changed
        updateStyles();

        // Update tab bar active state
        updateActiveTab();
    }

    // ===== MUTATION OBSERVER FOR DOM CHANGES =====
    function startObserver() {
        if (state.observer) return;

        let observerTimeout;
        state.observer = new MutationObserver(() => {
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // Re-inject styles if removed
                if (!document.getElementById('x41-styles')) {
                    console.log('[X41] Styles removed, re-injecting...');
                    updateStyles();
                }

                // Recreate tab bar if removed
                if (!document.getElementById('x41-tab-bar')) {
                    console.log('[X41] Tab bar removed, recreating...');
                    createCustomTabBar();
                }
            }, 100);
        });

        if (document.body) {
            state.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('[X41] Started observing DOM changes');
        }
    }

    // ===== INITIALIZATION =====
    async function initialize() {
        console.log('[X41] Initializing opinionated mode');

        // Inject CSS immediately
        updateStyles();

        // Create custom tab bar (waits for username)
        await createCustomTabBar();

        // Start mutation observer
        startObserver();

        // Listen for dark mode changes
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeQuery.addEventListener('change', (e) => updateTheme(e.matches));

        // Listen for navigation changes (SPA)
        // Use interval since X.com doesn't properly fire popstate events
        setInterval(handleNavigation, 500);

        console.log('[X41] ✅ Initialization complete');
    }

    // ===== START =====
    // Inject CSS immediately - even before DOM is ready
    updateStyles();

    // Wait for DOM to be ready, then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
