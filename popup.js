document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('aiFilter');
    const statusText = document.getElementById('status');

    // Load saved state
    chrome.storage.local.get(['aiFilterEnabled'], function(result) {
        toggleSwitch.checked = result.aiFilterEnabled || false;
        updateStatus(result.aiFilterEnabled);
    });

    // Handle toggle changes
    toggleSwitch.addEventListener('change', function() {
        const isEnabled = toggleSwitch.checked;
        
        // Save state
        chrome.storage.local.set({ aiFilterEnabled: isEnabled });
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleFilter',
                enabled: isEnabled
            });
        });

        updateStatus(isEnabled);
    });

    function updateStatus(enabled) {
        statusText.textContent = enabled ? 
            "AI posts are being hidden" : 
            "AI posts are visible";
    }
});