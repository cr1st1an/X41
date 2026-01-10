/**
 * X41 - Main World Script
 *
 * Runs in the main world (not isolated) to access X.com's React Router.
 * Communicates with content.js via postMessage.
 */

window.addEventListener('message', function(event) {
    // Security: only accept messages from same window and origin
    if (event.source !== window) return;
    if (event.origin !== location.origin) return;
    if (event.data?.type !== 'X41_NAVIGATE') return;

    const path = event.data.path;

    // Validate path: must be string starting with /, no protocol injection, no double slashes
    if (typeof path === 'string' &&
        path.startsWith('/') &&
        !path.includes('://') &&
        !path.includes('//') &&
        path.length < 2048) {
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
});
