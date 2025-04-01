let isFilterEnabled = false;
let scrollTimeout = null;

// Constants
const POST_SELECTOR = '.feed-shared-update-v2:not([data-ai-scanned])';
const FEED_SELECTOR = '.core-rail, .feed-following-feed';
const VIEWPORT_THRESHOLD = 500;

// DOM caches
const processedPosts = new WeakSet();
const overlayCache = new WeakMap();

// False positive handling for common Hindi words
const HINDI_FALSE_POSITIVES = new Set([
  'kaise', 'bhai', 'aisa', 'kaisa', 'baigan', 'main',
  'nahi', 'jaise', 'waisa', 'saiyaan', 'ghai', 'chai'
]);

// AI pattern list
const AI_PATTERNS = [
    /\bartificial intelligence\b/i,
    /\bmachine learning\b/i,
    /\bdeep learning\b/i,
    /\bneural networks?\b/i,
    /\bnatural language processing\b/i,
    /\bcomputer vision\b/i,
    /\breinforcement learning\b/i,
    /\bgenerative AI\b/i,
    /\bpredictive analytics\b/i,
    /\bdata science\b/i,
    /\bautonomous agents?\b/i,
    /\btransformer models?\b/i,
    /\bdiffusion models?\b/i,
    /\bvector database\b/i,
    /\bRAG\b/i,
    /\bGPT-?[345](\.5)?\b/i,
    /\bChatGPT\b/i,
    /\bOpenAI\b/i,
    /\bAnthropic\b/i,
    /\bDeepMind\b/i,
    /\bClaude\b/i,
    /\bBard\b/i,
    /\bGemini\b/i,
    /\bSora\b/i,
    /\bMidjourney\b/i,
    /\bDALL[\\-\\s]?E\b/i,
    /\bStable Diffusion\b/i,
    /\bLlama[\s-]?2\b/i,
    /\bPaLM\b/i,
    /\bMeta\s+AI\b/i,
    /\bPerplexity\b/i,
    /\bCopilot\b/i,
    /\bAuto-?GPT\b/i,
    /\bBabyAGI\b/i,
    /\bAgentGPT\b/i,
    /\bLangChain\b/i,
    /\bHugging\s?Face\b/i,
    /\bTensorFlow\b/i,
    /\bPyTorch\b/i,
    /\bKeras\b/i,
    /\bscikit-learn\b/i,
    /\bAzure AI\b/i,
    /\bAWS AI\b/i,
    /\bIBM Watson\b/i,
    /\bchatbot(s)?\b/i,
    /\bvoice assistant(s)?\b/i,
    /\bimage recognition\b/i,
    /\brecommendation engine(s)?\b/i,
    /\bsemantic search\b/i,
    /\bknowledge graph(s)?\b/i,
    /\bprompt engineering\b/i,
    /\bAI ethics\b/i,
    /\bAI safety\b/i,
    /\bAI bias\b/i,
    /\bSingularity\b/i,
    /\bAGI\b/i,
    /\bfoundation models\b/i,
    /\bAI (?:in|for) (business|marketing|development|innovation|research|healthcare|finance|education|etc)\b/i,
    /\bAI[-\s]?(powered|driven|enabled|based|revolution|systems?)\b/i,
    /\b(powered|driven|enabled|based|revolution|systems?)[\s-]?AI\b/i,
    /\bAI\s+(app|tool|model|system|solution)\b/i,
    /\bAI\s+revolution\b/i,
    /\b(revolutionizing|revolutionized by)\s+AI\b/i,
    /\bdisruptive AI\b/i,
    /\bAI\s+game[-\s]?changer\b/i,
    /\btransformative AI\b/i,
    /\bharnessing AI\b/i,
    /\bthe future of AI\b/i,
    /\bAI is taking over\b/i,
    /\b(age of|era of) AI\b/i,
    /\bsuperintelligence\b/i,
    /\b(just built|just launched|created|built with|launched my) an? AI (app|tool|model|system|solution)\b/i,
    /\bexcited to (share|announce) my new AI (app|tool|model|system|solution)\b/i,
    /\bmy take on (the|how|why|what|impact|benefits|challenges) .*AI\b/i,
    /\bthe power of AI (to|in|for) (business|marketing|development|innovation|research|healthcare|finance|education|etc)\b/i,
    // Extra patterns to catch AI-native and other variants
    /\bAI[-\s]?native\b/i,
    /\bDeepScribe\b/i
];

// Simple and standalone AI pattern for checking standard mentions
const STANDALONE_AI_PATTERN = /\b(AI|A\.I\.)\b/i;

// Intersection Observer for efficient post detection
const postObserver = new IntersectionObserver(
  entries => {
    if (!isFilterEnabled) return;
    
    for (const entry of entries) {
      if (entry.isIntersecting && !entry.target.hasAttribute('data-ai-scanned')) {
        scanPost(entry.target);
      }
    }
  },
  {
    rootMargin: `${VIEWPORT_THRESHOLD}px 0px`,
    threshold: 0.1
  }
);

/**
 * Check if text contains AI-related content
 */
function containsAIContent(text) {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // First check against our comprehensive patterns list
  for (const pattern of AI_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Then check for standalone AI mentions
  const aiMatches = text.match(STANDALONE_AI_PATTERN);
  if (aiMatches) {
    // Check if this is a false positive from Hindi words
    const hasHindiWords = Array.from(HINDI_FALSE_POSITIVES).some(word => 
      lowerText.includes(word)
    );
    
    if (hasHindiWords) {
      // Only consider it a match if there are multiple AI mentions
      // or explicit AI context that outweighs the false positives
      return aiMatches.length >= 3 || 
             lowerText.includes('artificial intelligence') ||
             /\b(using|with|by|powered|driven)\s+ai\b/i.test(lowerText);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Scan a post for AI content
 */
function scanPost(post) {
  if (!post || processedPosts.has(post)) return;
  
  // Mark as processed immediately
  processedPosts.add(post);
  post.setAttribute('data-ai-scanned', 'true');
  
  try {
    // Extract text content from all relevant elements
    const textElements = [
      post.querySelector('.feed-shared-update-v2__description'),
      post.querySelector('.article-content'),
      post.querySelector('.feed-shared-text'),
      post.querySelector('.update-components-text'),
      post.querySelector('.feed-shared-update-v2__commentary'),
      post.querySelector('.feed-shared-inline-show-more-text'),
      post.querySelector('.feed-shared-text__text-view')
    ];
    
    // Join non-null text contents
    const textContent = textElements.reduce((acc, el) => {
      if (el && el.textContent) {
        acc.push(el.textContent);
      }
      return acc;
    }, []).join(' ');
    
    // Skip empty content
    if (!textContent) return;
    
    // Check for AI content
    if (containsAIContent(textContent)) {
      handleMatchedPost(post);
    }
  } catch (error) {
    console.error("Error scanning post:", error);
  }
}

/**
 * Handle a post that contains AI content
 */
function handleMatchedPost(post) {
  // Check if we already have an overlay for this post
  let overlayContainer = overlayCache.get(post);
  
  if (!overlayContainer) {
    try {
      const isDarkMode = document.documentElement.classList.contains('theme--dark') || 
                         document.body.classList.contains('theme--dark');
      
      // STEP 1: Find the content portion to cover
      // Look for the caption element with the specific class
      const captionElement = post.querySelector('.lWcOorZdsBUnyCPoSYDMFPiRbASVlQcyD') || 
                             post.querySelector('.feed-shared-update-v2__description') ||
                             post.querySelector('.update-components-text');
      
      // If no caption found, fall back to covering the whole post
      if (!captionElement) {
        // Create overlay for whole post as fallback
        overlayContainer = document.createElement('div');
        overlayContainer.className = 'ai-content-overlay';
        overlayContainer.style.cssText = `
          background-color: ${isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(240, 240, 240, 0.75)'};
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 51;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          min-height: 200px;
          height: 100%;
        `;
        
        post.style.position = 'relative';
        post.appendChild(overlayContainer);
      } else {
        // STEP 2: Create a content overlay that only covers from caption down
        // First, get the position of the caption element relative to the post
        const postRect = post.getBoundingClientRect();
        const captionRect = captionElement.getBoundingClientRect();
        
        // Calculate the top position relative to the post
        const topOffset = captionRect.top - postRect.top;
        
        // Create overlay that starts from caption
        overlayContainer = document.createElement('div');
        overlayContainer.className = 'ai-content-overlay';
        overlayContainer.style.cssText = `
          background-color: ${isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(240, 240, 240, 0.75)'};
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          position: absolute;
          top: ${topOffset}px;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 51;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          min-height: 120px;
        `;
        
        post.style.position = 'relative';
        post.appendChild(overlayContainer);
      }
      
      // STEP 3: Add the warning and button elements
      const icon = document.createElement('span');
      icon.innerHTML = '&#128683;';
      icon.style.cssText = `
        font-size: 24px;
        position: relative;
        z-index: 52;
        color: ${isDarkMode ? '#E7E9EA' : '#666'};
      `;
      
      const message = document.createElement('div');
      message.textContent = 'AI Content Detected';
      message.style.cssText = `
        color: ${isDarkMode ? '#E7E9EA' : '#666'};
        font-size: 16px;
        font-weight: bold;
        position: relative;
        z-index: 52;
      `;
      
      const showButton = document.createElement('button');
      showButton.textContent = 'Show Post';
      showButton.style.cssText = `
        background-color: transparent;
        border: 1px solid ${isDarkMode ? '#A8B4C2' : '#0a66c2'};
        color: ${isDarkMode ? '#A8B4C2' : '#0a66c2'};
        padding: 8px 16px;
        border-radius: 16px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        position: relative;
        z-index: 52;
      `;
      
      showButton.addEventListener('mouseover', () => {
        showButton.style.backgroundColor = isDarkMode ? 
          'rgba(168, 180, 194, 0.1)' : 'rgba(10, 102, 194, 0.1)';
      });
      
      showButton.addEventListener('mouseout', () => {
        showButton.style.backgroundColor = 'transparent';
      });
      
      showButton.addEventListener('click', () => {
        overlayContainer.style.display = 'none';
      });
      
      overlayContainer.appendChild(icon);
      overlayContainer.appendChild(message);
      overlayContainer.appendChild(showButton);
      
      // Store overlay in cache
      overlayCache.set(post, overlayContainer);
    } catch (error) {
      console.error("Error creating overlay:", error);
    }
  } else {
    overlayContainer.style.display = 'flex';
  }
}

/**
 * Handle scroll events to detect new posts
 */
function scrollHandler() {
  if (scrollTimeout || !isFilterEnabled) return;
  
  scrollTimeout = setTimeout(() => {
    try {
      const unscannedPosts = document.querySelectorAll(POST_SELECTOR);
      if (unscannedPosts.length) {
        unscannedPosts.forEach(post => {
          const rect = post.getBoundingClientRect();
          if (rect.top < window.innerHeight + VIEWPORT_THRESHOLD) {
            postObserver.observe(post);
            scanPost(post);
          }
        });
      }
    } catch (error) {
      console.error("Error in scroll handler:", error);
    }
    scrollTimeout = null;
  }, 100);
}

/**
 * Set up observer for new posts
 */
function setupPostObserver() {
  try {
    const observer = new MutationObserver((mutations) => {
      if (!isFilterEnabled) return;
      
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.matches?.(POST_SELECTOR)) {
              postObserver.observe(node);
              scanPost(node);
            } else {
              const posts = node.querySelectorAll?.(POST_SELECTOR);
              if (posts && posts.length) {
                posts.forEach(post => {
                  postObserver.observe(post);
                  scanPost(post);
                });
              }
            }
          }
        });
      }
    });
    
    document.querySelectorAll(FEED_SELECTOR).forEach(feed => {
      if (feed) {
        observer.observe(feed, {
          childList: true,
          subtree: true
        });
      }
    });
    
    // Store observer reference for cleanup
    window._aiFilterObserver = observer;
  } catch (error) {
    console.error("Error setting up post observer:", error);
  }
}

/**
 * Process all visible posts
 */
function hideAIPosts() {
  try {
    const posts = document.querySelectorAll(POST_SELECTOR);
    posts.forEach(post => {
      postObserver.observe(post);
      scanPost(post);
    });
  } catch (error) {
    console.error("Error hiding AI posts:", error);
  }
}

/**
 * Create toggle switch in header
 */
function createHeaderToggle() {
  // First check if toggle already exists
  if (document.querySelector('.ai-filter-toggle')) {
    return;
  }

  try {
    const waitForNav = setInterval(() => {
      const navSearch = document.querySelector('.global-nav__search');
      if (navSearch) {
        clearInterval(waitForNav);
        
        // Create toggle container
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'ai-filter-container';
        toggleContainer.style.cssText = `
          display: flex;
          align-items: center;
          margin-right: 16px;
          padding: 0 12px;
          height: 100%;
        `;
        
        // Create toggle switch
        const toggle = document.createElement('label');
        toggle.className = 'ai-filter-toggle';
        toggle.style.cssText = `
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
          margin-left: 8px;
        `;
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.style.cssText = `
          opacity: 0;
          width: 0;
          height: 0;
        `;
        
        const slider = document.createElement('span');
        slider.style.cssText = `
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 20px;
          display: block;
        `;
        
        const sliderButton = document.createElement('span');
        sliderButton.className = 'slider-button';
        sliderButton.style.cssText = `
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
          display: block;
        `;
        slider.appendChild(sliderButton);
        
        // Create label text
        const label = document.createElement('span');
        label.textContent = 'Hide AI';
        label.style.cssText = `
          color: #A4A5A7;
          font-size: 14px;
          margin-right: 8px;
          font-weight: 600;
        `;
        
        // Assemble toggle
        toggle.appendChild(input);
        toggle.appendChild(slider);
        toggleContainer.appendChild(label);
        toggleContainer.appendChild(toggle);
        
        // Add style for checked state
        const style = document.createElement('style');
        style.textContent = `
          .ai-filter-toggle input:checked + span {
            background-color: #0a66c2 !important;
          }
          .ai-filter-toggle input:checked + span .slider-button {
            transform: translateX(20px);
          }
        `;
        document.head.appendChild(style);
        
        // Handle toggle changes
        input.addEventListener('change', function() {
          isFilterEnabled = this.checked;
          
          // Safe storage access
          if (chrome?.storage?.local) {
            chrome.storage.local.set({ aiFilterEnabled: isFilterEnabled }, () => {
              if (chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                  action: 'toggleFilter',
                  enabled: isFilterEnabled
                });
              }
              
              updateFilterState();
            });
          } else {
            updateFilterState();
          }
        });
        
        // Helper function to update filter state
        function updateFilterState() {
          if (isFilterEnabled) {
            document.querySelectorAll('.feed-shared-update-v2[data-ai-scanned]').forEach(post => {
              post.removeAttribute('data-ai-scanned');
              processedPosts.delete(post);
            });
            hideAIPosts();
          } else {
            document.querySelectorAll('.ai-content-overlay').forEach(overlay => {
              overlay.style.display = 'none';
            });
          }
        }
        
        // Insert before search
        navSearch.parentNode.insertBefore(toggleContainer, navSearch);
        
        // Load initial state
        if (chrome?.storage?.local) {
          chrome.storage.local.get(['aiFilterEnabled'], function(result) {
            isFilterEnabled = result.aiFilterEnabled || false;
            input.checked = isFilterEnabled;
            if (isFilterEnabled) {
              hideAIPosts();
            }
          });
        }
      }
    }, 1000);
  } catch (error) {
    console.error("Error creating header toggle:", error);
  }
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFilter') {
    isFilterEnabled = request.enabled;
    
    if (isFilterEnabled) {
      hideAIPosts();
    } else {
      // Show all posts
      document.querySelectorAll('.ai-content-overlay').forEach(overlay => {
        overlay.style.display = 'none';
      });
    }
  }
});

/**
 * Initialize the extension
 */
function initialize() {
  try {
    // Remove any existing observers
    if (window._aiFilterObserver) {
      window._aiFilterObserver.disconnect();
    }
    
    setupPostObserver();
    createHeaderToggle();
    
    if (isFilterEnabled) {
      hideAIPosts();
    }
  } catch (error) {
    console.error("Error initializing AI filter:", error);
  }
}

// Initialize when the DOM is ready or when it's already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Add a scroll event listener to handle lazy-loaded content
window.addEventListener('scroll', scrollHandler, { passive: true });

// Helper function for more dynamic content recognition
function setupElementObserver() {
  // This ensures we catch dynamic class changes in LinkedIn
  const classObserver = new MutationObserver((mutations) => {
    if (!isFilterEnabled) return;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // If we see a new caption element, check if its post needs processing
        if (mutation.target.classList.contains('lWcOorZdsBUnyCPoSYDMFPiRbASVlQcyD')) {
          const post = mutation.target.closest('.feed-shared-update-v2');
          if (post && !post.hasAttribute('data-ai-scanned')) {
            scanPost(post);
          }
        }
      }
    });
  });
  
  // Observe the whole document for class changes
  classObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });
  
  // Store for cleanup
  window._aiClassObserver = classObserver;
}

// Call this during initialization
document.addEventListener('DOMContentLoaded', setupElementObserver);