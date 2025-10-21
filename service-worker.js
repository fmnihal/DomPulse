// service-worker.js

let devtoolsPort = null;
let latestMetrics = {};
let mutationLog = [];
const connections = {}; // New object to manage connections by tab ID

// --- 1. HANDLE DEVTOOLS CONNECTION ---

chrome.runtime.onConnect.addListener(port => {
    if (port.name !== "dompulse-devtools") return;
    
    // Listener for the initial handshake message from the panel (panel.js)
    port.onMessage.addListener(message => {
        if (message.action === 'INIT' && message.tabId) {
            // Store the port reference using the tab ID
            connections[message.tabId] = port;
            devtoolsPort = port; // Keep the global reference too
            
            console.log(`DomPulse DevTools connected for tab: ${message.tabId}.`);

            // Send stored data immediately to the newly opened panel
            port.postMessage({
                action: "INITIAL_DATA",
                metrics: latestMetrics,
                log: mutationLog
            });
        }
        
        // Listener for other messages (like REFRES_DOM)
        if (message.action === "REFRESH_DOM") {
            // Forward the refresh request to the content script of the active tab
            chrome.tabs.sendMessage(message.tabId, { action: "REQUEST_METRICS" });
        }
    });

    // Handle disconnection (CRITICAL for cleanup and worker sleep)
    port.onDisconnect.addListener(disconnectedPort => {
        // Find and remove the disconnected port from our connections list
        for (const tabId in connections) {
            if (connections[tabId] === disconnectedPort) {
                delete connections[tabId];
                console.log(`DomPulse DevTools disconnected for tab: ${tabId}.`);
                break;
            }
        }
        if (devtoolsPort === disconnectedPort) {
            devtoolsPort = null;
        }
    });
});


// --- 2. HANDLE CONTENT SCRIPT MESSAGES ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Note: Use sender.tab.id to determine which tab the message came from
    const tabId = sender.tab ? sender.tab.id : null;
    const port = tabId ? connections[tabId] : devtoolsPort; // Use the specific port or the global one

    if (request.action === "UPDATE_METRICS") {
        latestMetrics = request.data;
        
        if (port) { // Use the specific port if available
            // Forward the live update to the DevTools panel
            port.postMessage({
                action: "METRICS_UPDATE",
                metrics: latestMetrics
            });
        }
    } else if (request.action === "LOG_MUTATIONS") {
        mutationLog = mutationLog.concat(request.data).slice(-50);
        latestMetrics = request.data[request.data.length - 1].metrics; 
        
        if (port) { // Use the specific port if available
            // Forward the mutation log update to the DevTools panel
            port.postMessage({
                action: "LOG_UPDATE",
                log: request.data
            });
        }
    }
});