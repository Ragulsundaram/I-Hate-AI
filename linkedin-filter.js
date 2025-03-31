// State management
let isFilterEnabled = false;
let scrollTimeout = null;
let lastScrollPosition = 0;

// Constants for DOM selectors
const POST_SELECTOR = '.feed-shared-update-v2:not([data-ai-scanned])';
const FEED_SELECTOR = '.core-rail, .feed-following-feed';
const VIEWPORT_THRESHOLD = 500; // Reduced for better performance

// DOM caches
const processedPosts = new WeakSet();
const overlayCache = new WeakMap();

// Simple pattern from original code that successfully detected casual AI mentions
const SIMPLE_AI_PATTERN = /(AI|A\.I\.|artificial intelligence|machine learning|deep learning|neural network|GPT-[34]|ChatGPT|LLM|SLM|Presidio|Azure AI|AI Bootcamp|Human-AI|HAI)s?\b/i;

// Skip phrases - now a Set for O(1) lookups
const SKIP_PHRASES = new Set([
  'air', 'aim', 'aid', 'aisle', 'airing', 'aint', 'paid',
  'metadata', 'meta-analysis', 'meta description', 'meta tag',
  'meta-learning', 'metaverse'
]);

// Ambiguous terms that need context verification - using Map for faster lookups
const AMBIGUOUS_TERMS = new Map([
  ['meta', /\b(?:facebook|zuckerberg|llama|company|platform)\b/i],
  ['rag', /\b(?:retrieval|augmented|generation|vector|embedding)\b/i],
  ['agi', /\b(?:artificial|general|intelligence|superintelligence)\b/i],
  ['sora', /\b(?:openai|video|generator|text-to-video|ai\s+model)\b/i],
  ['bard', /\b(?:google|ai|assistant|chatbot|language|model)\b/i]
]);

// Compile all AI filters into a single RegExp using alternation for better performance
const COMPREHENSIVE_AI_PATTERN = new RegExp([
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
  /\b(?:Facebook's|FB's|Zuckerberg's)?\s*Meta\s+AI\b/i,
  /\bMeta's\s+AI\b/i,
  /\bMeta\s+(?:Llama|AI\s+research|AI\s+lab|AI\s+team)\b/i,
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
  // Add casual AI mention patterns
  /\buse AI\b/i,
  /\busing AI\b/i,
  /\bgenerate with AI\b/i,
  /\bgenerated using AI\b/i,
  /\bAI-generated\b/i,
  /\bAI to generate\b/i
].map(regex => regex.source).join('|'), 'i');

// Create a template for overlay once and clone it for better performance
let overlayTemplate = null;

// Optimized IntersectionObserver with reduced threshold and smaller rootMargin
const postObserver = new IntersectionObserver(
  entries => {
    if (!isFilterEnabled) return;
    
    // Process visible entries in a single batch using requestIdleCallback
    if (window.requestIdleCallback) {
      requestIdleCallback(() => {
        for (const entry of entries) {
          if (entry.isIntersecting && !entry.target.hasAttribute('data-ai-scanned')) {
            scanPost(entry.target);
          }
        }
      }, { timeout: 100 });
    } else {
      // Fallback for browsers without requestIdleCallback
      for (const entry of entries) {
        if (entry.isIntersecting && !entry.target.hasAttribute('data-ai-scanned')) {
          scanPost(entry.target);
        }
      }
    }
  },
  {
    rootMargin: `${VIEWPORT_THRESHOLD}px 0px`,
    threshold: 0.1 // Reduced threshold for earlier detection
  }
);

/**
 * The original simple check for AI content that worked well
 * for detecting casual mentions of AI
 */
function simpleCasualAICheck(text) {
  if (!text) return false;
  
  // Check for simple AI mention using the original pattern
  return SIMPLE_AI_PATTERN.test(text);
}

/**
 * Advanced containsAIKeywords with optimized lookup strategy:
 * 1. First do a quick check with simple pattern (like original code)
 * 2. If that passes, handle skip phrases and false positives
 * 3. For ambiguous matches, verify with context checking
 */
function containsAIKeywords(text) {
  if (!text) return { matched: false };
  
  const lowerText = text.toLowerCase();
  
  // First check using simple pattern from original code
  if (simpleCasualAICheck(text)) {
    // If we have a match, check for skip phrases
    for (const phrase of SKIP_PHRASES) {
      if (lowerText.includes(phrase) && 
          !lowerText.includes(' ai ') && 
          !lowerText.includes('artificial intelligence') &&
          !lowerText.match(/\bai\b/i)) {
        return { matched: false };
      }
    }
    
    // Check for basic AI mention first
    const simpleMatch = SIMPLE_AI_PATTERN.exec(text);
    if (simpleMatch) {
      // Check ambiguous terms context if needed
      const matchedText = simpleMatch[0].toLowerCase();
      for (const [term, contextPattern] of AMBIGUOUS_TERMS.entries()) {
        if (matchedText.includes(term) && !contextPattern.test(lowerText)) {
          // Try comprehensive pattern as a fallback
          const comprehensiveMatch = COMPREHENSIVE_AI_PATTERN.exec(text);
          return comprehensiveMatch ? 
            { matched: true, pattern: comprehensiveMatch[0] } : 
            { matched: false };
        }
      }
      
      return { matched: true, pattern: simpleMatch[0] };
    }
    
    // If simple check failed, try comprehensive pattern
    const comprehensiveMatch = COMPREHENSIVE_AI_PATTERN.exec(text);
    return comprehensiveMatch ? 
      { matched: true, pattern: comprehensiveMatch[0] } : 
      { matched: false };
  }
  
  return { matched: false };
}

/**
 * Optimized post scanner that uses text extraction only once
 * and employs efficient text processing techniques
 */
function scanPost(post) {
  if (!post || processedPosts.has(post)) return;
  
  // Mark as processed immediately to prevent duplicate processing
  processedPosts.add(post);
  post.setAttribute('data-ai-scanned', 'true');
  
  // Extract text content only once and reuse
  const textElements = [
    post.querySelector('.feed-shared-update-v2__description'),
    post.querySelector('.article-content'),
    post.querySelector('.feed-shared-text'),
    post.querySelector('.update-components-text')
  ];
  
  // Join non-null text contents - use reduce for performance
  const textContent = textElements.reduce((acc, el) => {
    if (el && el.textContent) {
      acc.push(el.textContent);
    }
    return acc;
  }, []).join(' ');
  
  // Skip empty content
  if (!textContent) return;
  
  // Use the optimized AI detection
  if (containsAIKeywords(textContent).matched) {
    handleMatchedPost(post);
  }
}

/**
 * Get overlay from cache or create a new one using template cloning
 */
function handleMatchedPost(post) {
  // Check cache first
  let overlayContainer = overlayCache.get(post);
  
  if (!overlayContainer) {
    const isDarkMode = document.documentElement.classList.contains('theme--dark') || 
                        document.body.classList.contains('theme--dark');
    
    // Create overlay template once if not created
    if (!overlayTemplate) {
      overlayTemplate = document.createElement('div');
      overlayTemplate.className = 'ai-content-overlay';
      overlayTemplate.style.cssText = `
        background-color: rgba(0, 0, 0, 0.75);
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
      
      const icon = document.createElement('span');
      icon.innerHTML = '&#128683;';
      icon.style.cssText = `
        font-size: 24px;
        position: relative;
        z-index: 52;
        color: #E7E9EA;
      `;
      
      const message = document.createElement('div');
      message.textContent = 'AI Content Detected';
      message.style.cssText = `
        color: #E7E9EA;
        font-size: 16px;
        font-weight: bold;
        position: relative;
        z-index: 52;
      `;
      
      const showButton = document.createElement('button');
      showButton.textContent = 'Show Post';
      showButton.className = 'ai-show-button';
      showButton.style.cssText = `
        background-color: transparent;
        border: 1px solid #A8B4C2;
        color: #A8B4C2;
        padding: 8px 16px;
        border-radius: 16px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        position: relative;
        z-index: 52;
      `;
      
      overlayTemplate.appendChild(icon);
      overlayTemplate.appendChild(message);
      overlayTemplate.appendChild(showButton);
    }
    
    // Clone the template instead of creating new elements
    overlayContainer = overlayTemplate.cloneNode(true);
    
    // Update colors based on theme if needed
    if (!isDarkMode) {
      overlayContainer.style.backgroundColor = 'rgba(240, 240, 240, 0.75)';
      overlayContainer.querySelector('span').style.color = '#666';
      overlayContainer.querySelector('div').style.color = '#666';
      
      const showButton = overlayContainer.querySelector('.ai-show-button');
      showButton.style.borderColor = '#0a66c2';
      showButton.style.color = '#0a66c2';
    }
    
    // Add event listener to the button
    overlayContainer.querySelector('.ai-show-button').addEventListener('click', () => {
      overlayContainer.style.display = 'none';
    });
    
    // Cache the created overlay
    overlayCache.set(post, overlayContainer);
    
    // Add overlay to post
    post.style.position = 'relative';
    post.appendChild(overlayContainer);
  } else {
    // Use cached overlay
    overlayContainer.style.display = 'flex';
  }
}

/**
 * Optimized scroll handler using requestAnimationFrame and scroll position checking
 */
function scrollHandler() {
  if (!isFilterEnabled) return;
  
  const currentPosition = window.scrollY;
  
  // Only process if scrolled more than 100px
  if (Math.abs(currentPosition - lastScrollPosition) < 100) return;
  
  lastScrollPosition = currentPosition;
  
  cancelAnimationFrame(scrollTimeout);
  
  scrollTimeout = requestAnimationFrame(() => {
    const viewportBottom = window.innerHeight + currentPosition + VIEWPORT_THRESHOLD;
    const viewportTop = currentPosition - VIEWPORT_THRESHOLD;
    
    // Get posts that are now in the expanded viewport
    const posts = document.querySelectorAll(POST_SELECTOR);
    
    if (posts.length) {
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const rect = post.getBoundingClientRect();
        const postTop = rect.top + currentPosition;
        
        if (postTop < viewportBottom && postTop + rect.height > viewportTop) {
          scanPost(post);
        }
      }
    }
  });
}

/**
 * Optimized post observer setup
 */
function setupPostObserver() {
  // Using a more efficient selector strategy
  const feeds = document.querySelectorAll(FEED_SELECTOR);
  if (!feeds.length) return;
  
  const observer = new MutationObserver((mutations) => {
    if (!isFilterEnabled) return;
    
    let newPosts = [];
    
    // Collect new posts to process in a single batch
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        
        if (node.nodeType !== 1) continue; // Skip non-element nodes
        
        if (node.matches?.(POST_SELECTOR)) {
          newPosts.push(node);
        } else {
          // Check for posts inside the added node - use direct property access for speed
          const childPosts = node.querySelectorAll?.(POST_SELECTOR);
          if (childPosts && childPosts.length) {
            for (let j = 0; j < childPosts.length; j++) {
              newPosts.push(childPosts[j]);
            }
          }
        }
      }
    }
    
    // Process collected posts in a single batch
    if (newPosts.length) {
      if (window.requestIdleCallback) {
        requestIdleCallback(() => {
          for (const post of newPosts) {
            postObserver.observe(post);
            scanPost(post);
          }
        }, { timeout: 300 });
      } else {
        for (const post of newPosts) {
          postObserver.observe(post);
          scanPost(post);
        }
      }
    }
  });
  
  // Observe feeds with optimized options
  for (let i = 0; i < feeds.length; i++) {
    observer.observe(feeds[i], {
      childList: true,
      subtree: true
    });
  }
  
  // Store observer reference for cleanup
  window._aiFilterObserver = observer;
}

/**
 * Process all visible posts
 */
function hideAIPosts() {
  const posts = document.querySelectorAll(POST_SELECTOR);
  if (!posts.length) return;
  
  // Use batch processing for better performance
  const processBatch = (startIdx, batchSize) => {
    const endIdx = Math.min(startIdx + batchSize, posts.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const post = posts[i];
      const rect = post.getBoundingClientRect();
      
      // Only process posts that are in or near viewport
      if (rect.top < window.innerHeight + VIEWPORT_THRESHOLD) {
        postObserver.observe(post);
        scanPost(post);
      }
    }
    
    // Process next batch if there are more posts
    if (endIdx < posts.length) {
      if (window.requestIdleCallback) {
        requestIdleCallback(() => {
          processBatch(endIdx, batchSize);
        }, { timeout: 100 });
      } else {
        setTimeout(() => {
          processBatch(endIdx, batchSize);
        }, 0);
      }
    }
  };
  
  // Start processing in batches of 10
  processBatch(0, 10);
}

/**
 * Create toggle switch in header with optimized DOM operations
 */
function createHeaderToggle() {
  // First check if toggle already exists
  if (document.querySelector('.ai-filter-toggle')) return;
  
  // Create elements outside the interval for better performance
  const toggleContainer = document.createElement('div');
  toggleContainer.id = 'ai-filter-container';
  toggleContainer.style.cssText = `
    display: flex;
    align-items: center;
    margin-right: 16px;
    padding: 0 12px;
    height: 100%;
  `;
  
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
  
  const label = document.createElement('span');
  label.textContent = 'Hide AI';
  label.style.cssText = `
    color: #A4A5A7;
    font-size: 14px;
    margin-right: 8px;
    font-weight: 600;
  `;
  
  // Assemble components
  slider.appendChild(sliderButton);
  toggle.appendChild(input);
  toggle.appendChild(slider);
  toggleContainer.appendChild(label);
  toggleContainer.appendChild(toggle);
  
  // Add style only once
  if (!document.getElementById('ai-filter-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-filter-styles';
    style.textContent = `
      .ai-filter-toggle input:checked + span {
        background-color: #0a66c2 !important;
      }
      .ai-filter-toggle input:checked + span .slider-button {
        transform: translateX(20px);
      }
      .ai-show-button:hover {
        background-color: rgba(168, 180, 194, 0.1);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Set up more efficient event handler
  const updateFilterState = (enabled) => {
    if (enabled) {
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
  };
  
  // Enhanced change handler
  input.addEventListener('change', function() {
    isFilterEnabled = this.checked;
    
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ aiFilterEnabled: isFilterEnabled });
    }
    
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'toggleFilter',
        enabled: isFilterEnabled
      });
    }
    
    updateFilterState(isFilterEnabled);
  });
  
  // Listen for nav element to appear
  const waitForNav = setInterval(() => {
    const navSearch = document.querySelector('.global-nav__search');
    if (navSearch) {
      clearInterval(waitForNav);
      
      // Insert before search if not already present
      if (!document.querySelector('#ai-filter-container')) {
        navSearch.parentNode.insertBefore(toggleContainer, navSearch);
        
        // Load state after adding to DOM
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
    }
  }, 500);
}

/**
 * Listen for messages with optimized handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFilter') {
    isFilterEnabled = request.enabled;
    
    if (isFilterEnabled) {
      hideAIPosts();
    } else {
      document.querySelectorAll('.ai-content-overlay').forEach(overlay => {
        overlay.style.display = 'none';
      });
    }
  }
});

/**
 * Initialize with performance optimizations
 */
function initialize() {
  // Remove any existing observers
  if (window._aiFilterObserver) {
    window._aiFilterObserver.disconnect();
  }
  
  // Setup observers and UI
  setupPostObserver();
  createHeaderToggle();
  
  // Initial scan if enabled
  if (isFilterEnabled) {
    hideAIPosts();
  }
  
  // Use more efficient scroll listener
  if (window.removeEventListener) {
    window.removeEventListener('scroll', scrollHandler);
  }
  window.addEventListener('scroll', scrollHandler, { passive: true });
}

// Initialize efficiently based on document state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  requestAnimationFrame(initialize);
}