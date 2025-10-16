// devtools/panel.js

const nodeCountEl = document.getElementById('node-count');
const maxDepthEl = document.getElementById('max-depth');
const logContainer = document.getElementById('mutation-log');

// Establish the connection to the Service Worker (defined in service-worker.js)
const backgroundPageConnection = chrome.runtime.connect({
    name: "dompulse-devtools"
});

// --- 1. HELPER FUNCTIONS ---

/**
 * Updates the metrics displayed in the header cards.
 * @param {object} metrics - The latest DOM metrics.
 */
function updateMetricsDisplay(metrics) {
    nodeCountEl.textContent = metrics.nodeCount.toLocaleString();
    maxDepthEl.textContent = metrics.maxDepth;
}

/**
 * Adds new mutation entries to the log display.
 * @param {Array<object>} logEntries - An array of new mutation objects.
 */
function updateLogDisplay(logEntries) {
    if (logContainer.firstElementChild && logContainer.firstElementChild.tagName === 'P') {
        logContainer.innerHTML = ''; // Clear the initial "Awaiting..." message
    }
    
    logEntries.reverse().forEach(entry => { // Display newest first
        const div = document.createElement('div');
        div.className = 'log-entry';
        
        const typeClass = entry.mutationType === 'ADD' ? 'log-type-add' : 'log-type-remove';
        const typeText = entry.mutationType === 'ADD' ? '➕ NODE ADDED' : '➖ NODE REMOVED';

        div.innerHTML = `
            <span class="${typeClass}">${typeText}</span> at 
            **${entry.target}** (Nodes: ${entry.metrics.nodeCount}, Depth: ${entry.metrics.maxDepth})
        `;
        
        // Insert at the beginning of the log
        logContainer.prepend(div);
    });

    // Simple cleanup to prevent the log from becoming too large in the UI
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}


// --- 2. MESSAGE HANDLER ---

// Listener for messages coming from the Service Worker
backgroundPageConnection.onMessage.addListener(message => {
    switch (message.action) {
        case "INITIAL_DATA":
            updateMetricsDisplay(message.metrics);
            updateLogDisplay(message.log);
            break;
        case "METRICS_UPDATE":
            updateMetricsDisplay(message.metrics);
            break;
        case "LOG_UPDATE":
            updateLogDisplay(message.log);
            updateMetricsDisplay(message.log[message.log.length - 1].metrics); // Update metrics from the latest mutation
            break;
    }
});


// --- 3. INITIAL REQUEST ---

// Get the ID of the current inspected window (tab)
chrome.devtools.inspectedWindow.onResourceAdded.addListener(() => {
    // Send a message to the Service Worker to request fresh metrics
    // This is useful for when the panel is opened *after* the page has loaded
    backgroundPageConnection.postMessage({
        action: 'REFRESH_DOM',
        tabId: chrome.devtools.inspectedWindow.tabId
    });
});