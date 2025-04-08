document.addEventListener('DOMContentLoaded', function() {
    const statusText = document.getElementById('status');

    // Load saved state
    chrome.storage.local.get(['aiFilterEnabled'], function(result) {
        updateStatus(result.aiFilterEnabled || false);
    });

    function updateStatus(enabled) {
        statusText.textContent = enabled ? 
            "Mute AI is active" : 
            "Mute AI is inactive";
    }
});