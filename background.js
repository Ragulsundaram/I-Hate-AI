// Background service worker for LinkedIn AI Filter

console.log('LinkedIn AI Filter service worker initialized');

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message);
  
  if (message.action === 'toggleFilter') {
    console.log('AI Filter toggle state changed to:', message.enabled ? 'active' : 'inactive');
    
    // Broadcast the toggle state to all tabs with LinkedIn open
    chrome.tabs.query({url: "*://www.linkedin.com/*"}, (tabs) => {
      console.log(`Broadcasting toggle state to ${tabs.length} LinkedIn tabs`);
      
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateFilterState',
          enabled: message.enabled
        }).catch(err => console.log('Tab communication error:', err));
      });
    });
  }
  
  // Always return true for asynchronous response
  return true;
});

// Listen for installation events
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  const previousVersion = details.previousVersion;
  
  if (details.reason === 'install') {
    chrome.storage.local.set({ aiFilterEnabled: false });
  } else if (details.reason === 'update') {
    // Handle version updates if needed
    console.log(`Updated from ${previousVersion} to ${currentVersion}`);
  }
});

console.log('LinkedIn AI Filter service worker setup complete');