// service-worker.js

let devtoolsPort = null;
let latestMetrics = {};
let mutationLog = [];

// --- 1. HANDLE DEVTOOLS CONNECTION ---

// This listener handles the connection established by devtools/devtools.js
chrome.runtime.onConnect.addListener(port => {
    if (port.name !== "dompulse-devtools") return;
    
    devtoolsPort = port;
    console.log("DomPulse DevTools connected.");

    // Send any stored data immediately to the newly opened panel
    devtoolsPort.postMessage({
        action: "INITIAL_DATA",
        metrics: latestMetrics,
        log: mutationLog
    });

    // Listener for messages coming *from* the DevTools Panel (e.g., requesting a refresh)
    devtoolsPort.onMessage.addListener(msg => {
        if (msg.action === "REFRESH_DOM") {
            // Forward the refresh request to the content script of the active tab
            chrome.tabs.sendMessage(msg.tabId, { action: "REQUEST_METRICS" });
        }
    });

    // Handle disconnection (e.g., when the user closes DevTools)
    port.onDisconnect.addListener(() => {
        devtoolsPort = null;
        console.log("DomPulse DevTools disconnected.");
    });
});


// --- 2. HANDLE CONTENT SCRIPT MESSAGES ---

// This listener handles messages coming *from* the Content Script (content-script.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Requires an active tab ID to send a reply back, but we don't need one here for DevTools piping.
    
    if (request.action === "UPDATE_METRICS") {
        latestMetrics = request.data;
        
        if (devtoolsPort) {
            // Forward the live update to the DevTools panel
            devtoolsPort.postMessage({
                action: "METRICS_UPDATE",
                metrics: latestMetrics
            });
        }
    } else if (request.action === "LOG_MUTATIONS") {
        // Add new mutations to the log (keep log size reasonable, e.g., last 50)
        mutationLog = mutationLog.concat(request.data).slice(-50);
        latestMetrics = request.data[request.data.length - 1].metrics; // Update metrics from the last mutation
        
        if (devtoolsPort) {
            // Forward the mutation log update to the DevTools panel
            devtoolsPort.postMessage({
                action: "LOG_UPDATE",
                log: request.data
            });
        }
    }
});