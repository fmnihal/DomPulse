// content-script.js

// --- 1. CORE DOM ANALYSIS FUNCTIONS ---

/**
 * Calculates the total number of nodes and the maximum nesting depth of the DOM.
 * @returns {object} An object containing nodeCount and maxDepth.
 */
function analyzeDOM() {
    let nodeCount = 0;
    let maxDepth = 0;

    // Fast way to get total node count
    const allElements = document.getElementsByTagName('*');
    nodeCount = allElements.length;

    // Calculate max depth via recursive traversal
    function getDepth(element, currentDepth) {
        maxDepth = Math.max(maxDepth, currentDepth);
        for (const child of element.children) {
            getDepth(child, currentDepth + 1);
        }
    }

    if (document.body) {
        getDepth(document.body, 1);
    }

    return { nodeCount, maxDepth };
}

// --- 2. MUTATION OBSERVER SETUP ---

/**
 * Sets up a MutationObserver to track and log DOM changes.
 */
function setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
        const changes = [];
        mutations.forEach(mutation => {
            // Only log simple additions/removals for the MVP
            if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                
                // Recalculate full DOM metrics after a change
                const currentMetrics = analyzeDOM();
                
                changes.push({
                    type: 'DOM_MUTATION',
                    mutationType: mutation.addedNodes.length > 0 ? 'ADD' : 'REMOVE',
                    target: mutation.target.tagName || 'Document',
                    timestamp: performance.now(),
                    metrics: currentMetrics // Send updated metrics with the mutation log
                });
            }
        });

        if (changes.length > 0) {
            // Send the batch of mutations and the latest metrics to the Service Worker
            chrome.runtime.sendMessage({
                action: "LOG_MUTATIONS",
                data: changes
            });
        }
    });

    // Configuration for the observer: watch for changes to children of the body, and descendants.
    observer.observe(document.body, { childList: true, subtree: true });
}

// --- 3. INITIALIZATION AND PERIODIC CHECK ---

/**
 * Sends the current DOM metrics to the Service Worker.
 */
function sendInitialMetrics() {
    const metrics = analyzeDOM();
    chrome.runtime.sendMessage({
        action: "UPDATE_METRICS",
        data: metrics
    });
}

// Send initial metrics immediately
sendInitialMetrics();

// Set up a periodic check (e.g., every 5 seconds) to ensure the DevTools panel gets a fresh report
setInterval(sendInitialMetrics, 5000);

// Setup the change tracker once the document is fully loaded
window.addEventListener('load', setupMutationObserver);

// Re-send metrics if the service worker requests them (e.g., when the DevTools panel is opened)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "REQUEST_METRICS") {
        sendInitialMetrics();
    }
});