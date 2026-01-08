/**
 * X41 - Skip the Feed
 *
 * A focused X.com experience: Profile, Notifications, Analytics.
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================

    const TAB_BAR_HEIGHT = 49;
    const SAFE_AREA = 'env(safe-area-inset-bottom)';
    const Z_INDEX = 100; // Above page content; mask is shrunk to not overlap

    const ICONS = {
        profile: {
            outline: 'M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z',
            filled: 'M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z'
        },
        notifications: {
            outline: 'M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.864 16H5.134z',
            filled: 'M21.697 16.468c-.02-.016-2.14-1.64-2.103-6.03.02-2.532-.812-4.782-2.347-6.335C15.872 2.71 14.01 1.94 12.005 1.93h-.013c-2.004.01-3.866.78-5.242 2.174-1.534 1.553-2.368 3.802-2.346 6.334.037 4.33-2.02 5.967-2.102 6.03-.26.193-.366.53-.265.838.102.308.39.515.712.515h4.92c.102 2.31 1.997 4.16 4.33 4.16s4.226-1.85 4.327-4.16h4.922c.322 0 .61-.206.71-.514.103-.307-.003-.645-.263-.838zM12 20.478c-1.505 0-2.73-1.177-2.828-2.658h5.656c-.1 1.48-1.323 2.66-2.828 2.66z'
        },
        analytics: {
            default: 'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z'
        }
    };

    // ========================================
    // STATE
    // ========================================

    let $tabBar = null;
    let username = null;
    let previousActivePath = null;
    let currentActivePath = null;

    // ========================================
    // USERNAME DETECTION
    // Patterns adapted from Control Panel for Twitter (MIT)
    // https://github.com/nickytonline/control-panel-for-twitter
    // ========================================

    function getUserScreenName() {
        // Script tag parsing (React props not accessible in Safari's isolated world)
        const scripts = document.querySelectorAll('script:not([src])');
        for (const script of scripts) {
            const text = script.textContent || '';
            const match = text.match(/"screen_name"\s*:\s*"([a-zA-Z0-9_]+)"/);
            if (match) return match[1];
        }

        // Method 2: Profile link in DOM
        const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
        if (profileLink?.href) {
            const match = profileLink.href.match(/\/([a-zA-Z0-9_]+)$/);
            if (match) return match[1];
        }

        return null;
    }

    function getNotificationCount() {
        // Try to get from DOM badge
        const badge = document.querySelector('a[href="/notifications"] [aria-label]');
        if (badge) {
            const match = (badge.getAttribute('aria-label') || '').match(/(\d+)/);
            if (match) return parseInt(match[1], 10);
        }
        return 0;
    }

    // ========================================
    // UTILITIES
    // ========================================

    function getElement(selector, timeout = Infinity) {
        return new Promise(resolve => {
            const startTime = Date.now();
            let rafId;

            function check() {
                const el = document.querySelector(selector);
                if (el) {
                    resolve(el);
                } else if (timeout !== Infinity && Date.now() - startTime > timeout) {
                    resolve(null);
                } else {
                    rafId = requestAnimationFrame(check);
                }
            }
            check();
        });
    }

    function isDarkMode() {
        return matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // ========================================
    // STYLES
    // ========================================

    function injectStyles() {
        if (document.getElementById('x41-styles')) return;

        const dark = isDarkMode();
        const style = document.createElement('style');
        style.id = 'x41-styles';
        style.textContent = `
            :root {
                --x41-active: ${dark ? '255,255,255' : '0,0,0'};
                --x41-inactive: 142,142,147;
                --x41-bg: ${dark ? '0,0,0' : '255,255,255'};
                --x41-border: ${dark ? '56,56,58' : '209,209,214'};
            }
            [data-testid="BottomBar"] {
                visibility: hidden !important;
                pointer-events: none !important;
                position: fixed !important;
                bottom: -100px !important;
            }
            body:not(.x41-compose) [data-testid="TopNavBar"],
            body:not(.x41-compose) header[role="banner"] {
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                overflow: hidden !important;
            }
            [data-testid="primaryColumn"] {
                padding-bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA} + 20px) !important;
            }
            a[href="/compose/post"] {
                bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA}) !important;
            }
            /* Toast notifications - flush with tab bar */
            #layers [data-testid="toast"],
            #layers [role="alert"] {
                bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA}) !important;
            }
            /* Hide tab bar when sheets/menus/dropdowns are open */
            body:has(#layers [data-testid="sheetDialog"]) #x41-tab-bar,
            body:has(#layers [role="menu"]) #x41-tab-bar,
            body:has(#layers [data-testid="Dropdown"]) #x41-tab-bar {
                opacity: 0;
                pointer-events: none;
            }
            #x41-tab-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA});
                padding-bottom: ${SAFE_AREA};
                background: rgba(var(--x41-bg), 0.85);
                -webkit-backdrop-filter: blur(20px);
                backdrop-filter: blur(20px);
                border-top: 0.5px solid rgb(var(--x41-border));
                display: flex;
                z-index: ${Z_INDEX};
                font-family: -apple-system, system-ui, sans-serif;
                transition: opacity 0.15s ease-out;
            }
            .x41-tab {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                height: ${TAB_BAR_HEIGHT}px;
                color: rgb(var(--x41-inactive));
                text-decoration: none;
                -webkit-tap-highlight-color: transparent;
            }
            .x41-tab.active { color: rgb(var(--x41-active)); }
            .x41-tab:active { opacity: 0.6; }
            .x41-tab svg {
                width: 24px;
                height: 24px;
                fill: currentColor;
                pointer-events: none;
            }
            .x41-badge {
                position: absolute;
                top: 6px;
                margin-left: 12px;
                min-width: 16px;
                height: 16px;
                padding: 0 4px;
                background: rgb(29,155,240);
                color: white;
                font-size: 11px;
                font-weight: 700;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function updateThemeColors() {
        const dark = isDarkMode();
        const root = document.documentElement;
        root.style.setProperty('--x41-active', dark ? '255,255,255' : '0,0,0');
        root.style.setProperty('--x41-bg', dark ? '0,0,0' : '255,255,255');
        root.style.setProperty('--x41-border', dark ? '56,56,58' : '209,209,214');
    }

    // ========================================
    // TAB BAR
    // ========================================

    function createTabBar() {
        if ($tabBar) return;

        const tabs = [
            { id: 'profile', href: `/${username}`, icon: 'profile' },
            { id: 'notifications', href: '/notifications', icon: 'notifications' },
            { id: 'analytics', href: '/i/account_analytics', icon: 'analytics' }
        ];

        $tabBar = document.createElement('nav');
        $tabBar.id = 'x41-tab-bar';

        tabs.forEach(tab => {
            const a = document.createElement('a');
            a.href = tab.href;
            a.className = 'x41-tab';
            a.dataset.tab = tab.id;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            svg.appendChild(path);
            a.appendChild(svg);

            $tabBar.appendChild(a);
        });

        // SPA navigation - use touchend for faster mobile response
        $tabBar.addEventListener('touchend', handleTabTap, { passive: false });
        $tabBar.addEventListener('click', handleTabTap);

        document.body.appendChild($tabBar);
        updateTabs();
    }

    let lastTapTime = 0;

    function handleTabTap(e) {
        const tab = e.target.closest('.x41-tab');
        if (!tab) return;

        e.preventDefault();

        // Prevent double-firing (touchend + click within 300ms)
        const now = Date.now();
        if (now - lastTapTime < 300) return;
        lastTapTime = now;

        const href = tab.getAttribute('href');
        navigateSPA(href);
    }

    function navigateSPA(path) {
        // Send message to injected.js running in main world
        window.postMessage({ type: 'X41_NAVIGATE', path: path }, '*');
    }

    function injectMainWorldScript() {
        // Inject script that runs in main world (not isolated) to access React Router
        const script = document.createElement('script');
        script.src = browser.runtime.getURL('injected.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
    }

    function updateTabs() {
        if (!$tabBar) return;

        const path = location.pathname;
        $tabBar.querySelectorAll('.x41-tab').forEach(tab => {
            const id = tab.dataset.tab;
            let active = false;

            if (id === 'profile' && username) {
                active = path === `/${username}` || path.startsWith(`/${username}/`);
            } else if (id === 'notifications') {
                active = path.startsWith('/notifications');
            } else if (id === 'analytics') {
                active = path.startsWith('/i/account_analytics');
            }

            tab.classList.toggle('active', active);

            // Update icon
            const icon = ICONS[id];
            const pathEl = tab.querySelector('path');
            if (pathEl && icon) {
                pathEl.setAttribute('d', active ? (icon.filled || icon.default) : (icon.outline || icon.default));
            }
        });

        // Update badge
        updateBadge();
    }

    function updateBadge() {
        if (!$tabBar) return;

        const tab = $tabBar.querySelector('[data-tab="notifications"]');
        if (!tab) return;

        let badge = tab.querySelector('.x41-badge');
        const count = getNotificationCount();

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'x41-badge';
                tab.style.position = 'relative';
                tab.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else if (badge) {
            badge.remove();
        }
    }

    // ========================================
    // NAVIGATION
    // ========================================

    let lastPath = location.pathname;

    function onNavigate() {
        const path = location.pathname;

        // Intercept /home navigation - redirect to previous page (not current, to avoid loops)
        if (path === '/' || path === '/home') {
            const destination = previousActivePath || (username ? `/${username}` : '/notifications');
            navigateSPA(destination);
            return; // Don't update lastPath - let next cycle detect the change
        }

        if (path === lastPath) return;
        lastPath = path;

        // Track previous/current for future redirects (exclude compose/intent)
        if (!path.includes('/compose/') && !path.includes('/intent/')) {
            previousActivePath = currentActivePath;
            currentActivePath = path;
        }

        // Show header on compose pages
        document.body.classList.toggle('x41-compose',
            path.includes('/compose/') || path.includes('/intent/'));

        updateTabs();
    }

    function watchNavigation() {
        // Content scripts run in isolated world - can't intercept X.com's pushState
        // Poll for URL changes from SPA navigation
        setInterval(() => {
            if (location.pathname !== lastPath) onNavigate();
        }, 100);

        // Also catch back/forward
        window.addEventListener('popstate', onNavigate);
    }

    // ========================================
    // OBSERVERS
    // ========================================

    function observeDOM() {
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(updateBadge, 200);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    async function main() {
        // Wait for app to load
        await getElement('#layers');

        // Get username (retry up to 5 seconds)
        for (let i = 0; i < 10; i++) {
            username = getUserScreenName();
            if (username) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!username) return;

        // Create UI
        createTabBar();
        observeDOM();

        // Watch for theme changes
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeColors);
    }

    // ========================================
    // ENTRY POINT
    // ========================================

    // Redirect home to notifications
    if (location.pathname === '/' || location.pathname === '/home') {
        location.replace('/notifications');
        return;
    }

    // Inject styles early to hide bottom bar immediately
    injectStyles();

    // Inject main world script for SPA navigation
    injectMainWorldScript();

    // Watch for SPA navigation
    watchNavigation();

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
