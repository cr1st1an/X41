/**
 * X41 - Main World Script
 *
 * Runs in the main world (not isolated) to access X.com's React Router.
 * Communicates with content.js via postMessage.
 */

window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data?.type !== 'X41_NAVIGATE') return;

    const path = event.data.path;
    if (typeof path === 'string' && path.startsWith('/')) {
        history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
});
