// devtools/devtools.js

// Create the DevTools panel, referencing the HTML/JS files for the UI.
chrome.devtools.panels.create(
    "DomPulse",                        // Title for the panel tab
    "icons/48.png",                    // Icon (must exist in the extension directory)
    "devtools/panel.html",             // HTML page to display in the panel
    function(panel) {
        console.log("DomPulse panel successfully created.");
        // We can interact with the panel object here if needed, 
        // but for now, the communication is handled by panel.js connecting to the Service Worker.
    }
);