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
    const Z_INDEX = 100;
    const ELEMENT_TIMEOUT = 30000; // 30s timeout for element detection
    const USERNAME_RETRY_ATTEMPTS = 10;
    const USERNAME_RETRY_DELAY = 500;

    // Tab root paths
    const PATHS = {
        profile: '/i/profile',      // X.com internal redirect to logged-in user's profile
        notifications: '/notifications',
        analytics: '/i/account_analytics'
    };

    // Reserved paths that should not be captured as usernames
    const RESERVED_PATHS = [
        'home', 'explore', 'search', 'notifications', 'messages', 'compose',
        'i', 'settings', 'login', 'logout', 'signup', 'tos', 'privacy'
    ];

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
    let activeTab = null;               // Currently highlighted tab: 'profile' | 'notifications' | 'analytics' | null
    let lastRootTabPath = null;         // Last visited ROOT path (for /home redirect fallback)
    let lastPath = null;                // Last processed path (to avoid duplicate processing)
    let lastTapTime = 0;
    let lastTappedTab = null;
    let badgeIntervalId = null;
    let pendingUsernameCapture = false; // Flag for lazy username detection via /i/profile redirect

    // ========================================
    // HELPERS
    // ========================================

    /**
     * Returns the profile path - direct username path if known, otherwise /i/profile fallback
     */
    function getProfilePath() {
        return username ? `/${username}` : PATHS.profile;
    }

    // ========================================
    // USERNAME DETECTION
    // Patterns adapted from Control Panel for Twitter (MIT)
    // https://github.com/nickytonline/control-panel-for-twitter
    // ========================================

    function getUserScreenName() {
        // Method 1: Script tag parsing (React props not accessible in Safari's isolated world)
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

    function getNotificationBadgeInfo() {
        // Try to get from DOM badge
        const badge = document.querySelector('a[href="/notifications"] [aria-label]');
        if (badge) {
            const ariaLabel = badge.getAttribute('aria-label') || '';
            const match = ariaLabel.match(/(\d+)/);
            if (match) {
                return { hasNotifications: true, count: parseInt(match[1], 10) };
            }
            // Badge element exists but can't parse count - has notifications but unknown count
            if (ariaLabel.length > 0) {
                return { hasNotifications: true, count: null };
            }
        }
        return { hasNotifications: false, count: 0 };
    }

    // ========================================
    // UTILITIES
    // ========================================

    function getElement(selector, timeout = ELEMENT_TIMEOUT) {
        return new Promise(resolve => {
            const startTime = Date.now();
            let rafId;

            function check() {
                const el = document.querySelector(selector);
                if (el) {
                    resolve(el);
                } else if (Date.now() - startTime > timeout) {
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
    // TAB STATE HELPERS
    // ========================================

    function getRootPath(tabId) {
        if (tabId === 'profile') return getProfilePath();
        if (tabId === 'notifications') return PATHS.notifications;
        if (tabId === 'analytics') return PATHS.analytics;
        return null;
    }

    function getTabForPath(path) {
        // Returns tab ID if path exactly matches a root path
        const lowerPath = path.toLowerCase();
        if (username && lowerPath === `/${username.toLowerCase()}`) return 'profile';
        if (path === PATHS.notifications) return 'notifications';
        if (path === PATHS.analytics) return 'analytics';
        return null;
    }

    function getRedirectPath() {
        // When escaping, return user to a DIFFERENT root tab path
        // Priority: last root tab > profile > notifications
        // Must skip current path to avoid redirect loops (e.g., modal on analytics)
        const currentPath = location.pathname.toLowerCase();

        if (lastRootTabPath && lastRootTabPath.toLowerCase() !== currentPath) {
            return lastRootTabPath;
        }
        const profilePath = getProfilePath();
        if (profilePath.toLowerCase() !== currentPath) {
            return profilePath;
        }
        if (PATHS.notifications !== currentPath) {
            return PATHS.notifications;
        }
        // Edge case: on notifications
        return PATHS.analytics;
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
            /* Hide native bottom bar */
            [data-testid="BottomBar"] {
                visibility: hidden !important;
                pointer-events: none !important;
                position: fixed !important;
                bottom: -100px !important;
            }
            /* Hide header on content pages (not modal pages) */
            body:not(.x41-show-header) [data-testid="TopNavBar"],
            body:not(.x41-show-header) header[role="banner"] {
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                overflow: hidden !important;
            }
            /* Add padding for tab bar - always applied to avoid layout shifts */
            [data-testid="primaryColumn"] {
                padding-bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA} + 20px) !important;
            }
            /* Adjust FAB position */
            [data-testid="FloatingActionButtons_Tweet_Button"] {
                bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA}) !important;
            }
            /* Adjust toast position */
            #layers [data-testid="toast"] {
                bottom: calc(${TAB_BAR_HEIGHT}px + ${SAFE_AREA}) !important;
            }
            /* Hide tab bar on modal pages (compose, intent, messages) */
            body.x41-show-header #x41-tab-bar {
                opacity: 0 !important;
                pointer-events: none !important;
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
                position: relative;
                height: ${TAB_BAR_HEIGHT}px;
                color: rgb(var(--x41-inactive));
                text-decoration: none;
                -webkit-tap-highlight-color: transparent;
                transition: color 0.15s ease-out, transform 0.1s ease-out, opacity 0.1s ease-out;
            }
            .x41-tab.active { color: rgb(var(--x41-active)); }
            .x41-tab:active {
                opacity: 0.6;
                transform: scale(0.92);
            }
            .x41-tab svg {
                width: 24px;
                height: 24px;
                fill: currentColor;
                pointer-events: none;
            }
            .x41-badge {
                position: absolute;
                top: 6px;
                left: calc(50% + 2px);
                min-width: 16px;
                height: 16px;
                box-sizing: border-box;
                background: rgb(29,155,240);
                color: white;
                font-size: 11px;
                font-weight: 500;
                border-radius: 9999px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
            }
            .x41-badge.x41-badge-dot {
                width: 8px;
                height: 8px;
                min-width: 8px;
                padding: 0;
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

        // Build tabs - profile uses /i/profile if username unknown (X.com will redirect)
        const tabs = [
            { id: 'profile', href: getProfilePath(), icon: 'profile' },
            { id: 'notifications', href: PATHS.notifications, icon: 'notifications' },
            { id: 'analytics', href: PATHS.analytics, icon: 'analytics' }
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

        // touchend for immediate touch response + double-tap detection
        // click for VoiceOver accessibility (blocked if touch just handled it)
        $tabBar.addEventListener('touchend', handleTabTap, { passive: false });
        $tabBar.addEventListener('click', handleTabTap);

        document.body.appendChild($tabBar);
        updateTabs();
    }

    function handleTabTap(e) {
        const tab = e.target.closest('.x41-tab');
        if (!tab) return;

        e.preventDefault();

        const now = Date.now();
        const tabId = tab.dataset.tab;
        const rootPath = getRootPath(tabId);

        // Block click if touch just handled it (within 500ms)
        if (e.type === 'click' && now - lastTapTime < 500) {
            return;
        }

        const isActiveTab = activeTab === tabId;
        const currentTabAtPath = getTabForPath(location.pathname);
        const atRoot = currentTabAtPath === tabId;
        const isDoubleTap = lastTappedTab === tabId && (now - lastTapTime) < 500;

        lastTapTime = now;
        lastTappedTab = tabId;

        if (isActiveTab && atRoot) {
            // At root of active tab - only scroll on double tap
            if (isDoubleTap) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        // Navigate to root (either switching tabs or going from deep to root)
        activeTab = tabId;
        lastRootTabPath = rootPath;  // Track for /home redirect fallback

        // Enable lazy username capture if navigating to profile without known username
        if (tabId === 'profile' && !username) {
            pendingUsernameCapture = true;
        }

        updateTabs();  // Update icon immediately for instant feedback
        navigateSPA(rootPath);
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

        $tabBar.querySelectorAll('.x41-tab').forEach(tab => {
            const id = tab.dataset.tab;
            const isActive = activeTab === id;

            tab.classList.toggle('active', isActive);

            // Accessibility: mark current page
            if (isActive) {
                tab.setAttribute('aria-current', 'page');
            } else {
                tab.removeAttribute('aria-current');
            }

            // Update icon (filled when active, outline when not)
            const icon = ICONS[id];
            const pathEl = tab.querySelector('path');
            if (pathEl && icon) {
                pathEl.setAttribute('d', isActive ? (icon.filled || icon.default) : (icon.outline || icon.default));
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
        const onNotifications = location.pathname.startsWith(PATHS.notifications);
        const { hasNotifications, count } = getNotificationBadgeInfo();

        if (hasNotifications && !onNotifications) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'x41-badge';
                badge.setAttribute('aria-live', 'polite');
                tab.appendChild(badge);
            }

            if (count !== null && count > 0) {
                // Show count
                const label = count === 1 ? '1 unread item' : `${count > 99 ? '99+' : count} unread items`;
                badge.setAttribute('aria-label', label);
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('x41-badge-dot');
            } else {
                // Show dot fallback (can't parse count but has notifications)
                badge.setAttribute('aria-label', 'Unread notifications');
                badge.textContent = '';
                badge.classList.add('x41-badge-dot');
            }
        } else if (badge) {
            badge.remove();
        }
    }

    // ========================================
    // PREMIUM UPSELL MODAL HANDLER
    // ========================================

    function setupPremiumModalHandler() {
        // Intercept X Premium upsell modal dismiss buttons on analytics page
        // Without this, clicking Close/Maybe later reloads the page and shows the modal again
        document.addEventListener('click', (e) => {
            if (location.pathname !== PATHS.analytics) return;

            const modal = document.querySelector('[data-testid="sheetDialog"]');
            if (!modal) return;

            // Check if click is on Close button or Maybe later button inside the modal
            const closeBtn = e.target.closest('[data-testid="app-bar-close"]');
            const maybeLaterBtn = e.target.closest('button');
            const isMaybeLater = maybeLaterBtn?.textContent?.includes('Maybe later');

            if ((closeBtn || isMaybeLater) && modal.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                // Navigate away using same fallback as /home redirect
                navigateSPA(getRedirectPath());
            }
        }, true); // Capture phase to intercept before X.com's handlers
    }

    // ========================================
    // NAVIGATION
    // ========================================

    function onNavigate() {
        const path = location.pathname;

        // Intercept home/feed - redirect to previous content page (avoid feed)
        if (path === '/' || path === '/home') {
            navigateSPA(getRedirectPath());
            return;
        }

        // Lazy username capture: when /i/profile redirects to /${username}
        if (pendingUsernameCapture) {
            pendingUsernameCapture = false;
            const match = path.match(/^\/([a-zA-Z0-9_]+)$/);
            if (match) {
                const captured = match[1];
                // Validate it's not a reserved path
                if (!RESERVED_PATHS.includes(captured.toLowerCase())) {
                    username = captured;
                    // Update lastRootTabPath to actual profile path
                    lastRootTabPath = `/${username}`;
                    console.log(`[X41] Detected username: ${username}`);
                }
            }
        }

        if (path === lastPath) return;
        lastPath = path;

        // Determine if this is a modal page (header shown, tab bar hidden)
        const isModalPage = path.includes('/compose/') ||
                            path.includes('/intent/') ||
                            path.includes('/messages/');

        // Auto-switch active tab ONLY on exact root path match
        // This preserves the "origin tab" during deep navigation
        if (!isModalPage) {
            const tabAtPath = getTabForPath(path);
            if (tabAtPath) {
                activeTab = tabAtPath;
                lastRootTabPath = path;  // Only track ROOT paths for redirect
            }
        }

        // Toggle header visibility
        const hasHeaderClass = document.body.classList.contains('x41-show-header');
        if (isModalPage !== hasHeaderClass) {
            document.body.classList.toggle('x41-show-header', isModalPage);
        }

        updateTabs();
    }

    function watchNavigation() {
        // Listen for navigation events from injected.js (intercepts pushState/replaceState)
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;
            if (event.data?.type !== 'X41_NAVIGATED') return;
            onNavigate();
        });

        // Also catch back/forward
        window.addEventListener('popstate', onNavigate);
    }

    // ========================================
    // BADGE POLLING
    // ========================================

    function startBadgePolling() {
        // Prevent multiple intervals
        if (badgeIntervalId) return;
        badgeIntervalId = setInterval(updateBadge, 5000);
    }

    // ========================================
    // CLEANUP & VISIBILITY
    // ========================================

    function stopBadgePolling() {
        if (badgeIntervalId) {
            clearInterval(badgeIntervalId);
            badgeIntervalId = null;
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            stopBadgePolling();
        } else {
            startBadgePolling();
            updateBadge();
        }
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    async function main() {
        // Wait for app to load (with timeout)
        const layers = await getElement('#layers');
        if (!layers) {
            console.warn('[X41] Timeout waiting for X.com to load');
            return;
        }

        // Get username (retry up to 5 seconds)
        for (let i = 0; i < USERNAME_RETRY_ATTEMPTS; i++) {
            username = getUserScreenName();
            if (username) break;
            await new Promise(r => setTimeout(r, USERNAME_RETRY_DELAY));
        }

        if (!username) {
            console.log('[X41] Username not detected on load, will capture on first profile visit');
        }

        // Set initial active tab based on current URL
        const path = location.pathname;
        const initialTab = getTabForPath(path);
        if (initialTab) {
            // Starting on a root tab path
            activeTab = initialTab;
            lastRootTabPath = path;
        } else {
            // Check if we're in a tab's "deep" area (preserve origin context)
            const lowerPath = path.toLowerCase();
            if (username && lowerPath.startsWith(`/${username.toLowerCase()}/`)) {
                activeTab = 'profile';
                lastRootTabPath = `/${username}`;  // Set to root, not deep path
            } else if (lowerPath.startsWith(PATHS.notifications + '/')) {
                activeTab = 'notifications';
                lastRootTabPath = PATHS.notifications;
            } else if (lowerPath.startsWith(PATHS.analytics + '/')) {
                activeTab = 'analytics';
                lastRootTabPath = PATHS.analytics;
            }
            // If none match (e.g., on /compose), activeTab stays null
        }

        // Create UI (profile tab uses /i/profile fallback if username unknown)
        createTabBar();
        startBadgePolling();
        setupPremiumModalHandler();

        // Watch for theme changes
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeColors);

        // Pause polling when tab is hidden (saves memory/CPU)
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup on page unload
        window.addEventListener('beforeunload', stopBadgePolling);

        // Set initial navigation state (handles first page load)
        onNavigate();
    }

    // ========================================
    // ENTRY POINT
    // ========================================

    // Redirect home to compose
    if (location.pathname === '/' || location.pathname === '/home') {
        location.replace('/compose/post');
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
