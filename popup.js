document.addEventListener('DOMContentLoaded', function() {
    const statusText = document.getElementById('status');

    // Load saved state
    chrome.storage.local.get(['aiFilterEnabled'], function(result) {
        updateStatus(result.aiFilterEnabled || false);
    });

    function updateStatus(enabled) {
        statusText.textContent = enabled ? 
            "I Hate AI is active" : 
            "I Hate AI is inactive";
    }
});