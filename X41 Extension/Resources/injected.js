/**
 * X41 - Main World Script
 *
 * Runs in the main world (not isolated) to:
 * 1. Trigger React Router navigation via history.pushState
 * 2. Notify content script of SPA navigation (no polling needed)
 */

(function() {
    'use strict';

    // Intercept pushState/replaceState to notify content script of navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        window.postMessage({ type: 'X41_NAVIGATED' }, '*');
    };

    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        window.postMessage({ type: 'X41_NAVIGATED' }, '*');
    };

    // Handle navigation requests from content script
    window.addEventListener('message', function(event) {
        if (event.source !== window) return;
        if (event.origin !== location.origin) return;
        if (event.data?.type !== 'X41_NAVIGATE') return;

        const path = event.data.path;

        // Validate path: must be string starting with /, no protocol injection
        if (typeof path === 'string' &&
            path.startsWith('/') &&
            !path.includes('://') &&
            !path.includes('//') &&
            path.length < 2048) {
            history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
    });
})();
