let isFilterEnabled = false;

// Refined AI filters with extensive pattern list
const refinedAiFilters = [
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
    // Specific pattern for Meta AI with company context
    /\b(?:Facebook's|FB's|Zuckerberg's)?\s*Meta\s+AI\b/i,
    /\bMeta's\s+AI\b/i,
    /\bMeta\s+(?:Llama|AI\s+research|AI\s+lab|AI\s+team)\b/i
];

// Special cases that require additional context verification
const ambiguousTerms = {
    'meta': /\b(?:facebook|zuckerberg|llama|company|platform)\b/i,
    'rag': /\b(?:retrieval|augmented|generation|vector|embedding)\b/i,
    'agi': /\b(?:artificial|general|intelligence|superintelligence)\b/i,
    'sora': /\b(?:openai|video|generator|text-to-video|ai\s+model)\b/i,
    'bard': /\b(?:google|ai|assistant|chatbot|language|model)\b/i
};

// Skip phrases that are common false positives
const skipPhrases = [
    'air',
    'aim',
    'aid',
    'aisle',
    'airing',
    'aint',
    'paid',
    'metadata',
    'meta-analysis',
    'meta description',
    'meta tag',
    'meta-learning',
    'metaverse'
];

// Pre-compile all regex and selectors for better performance
const POST_SELECTOR = '.feed-shared-update-v2:not([data-ai-scanned])';
const FEED_SELECTOR = '.core-rail, .feed-following-feed';
const VIEWPORT_THRESHOLD = 1000; // Increased for better pre-loading

// Use WeakMap for better performance with DOM elements
const processedPosts = new WeakSet();
const overlayCache = new WeakMap();

// Improved AI keyword detection with context analysis
function containsAIKeywords(text) {
    if (!text) return { matched: false };
    
    // Skip common false positive phrases
    const lowerText = text.toLowerCase();
    if (skipPhrases.some(phrase => lowerText.includes(phrase) && !lowerText.includes('ai'))) {
        return { matched: false };
    }

    // Loop through all patterns
    for (const pattern of refinedAiFilters) {
        const match = pattern.exec(text);
        if (match) {
            // For ambiguous terms, check additional context
            const matchedTerm = match[0].toLowerCase();
            for (const [term, contextPattern] of Object.entries(ambiguousTerms)) {
                if (matchedTerm.includes(term) && !contextPattern.test(text)) {
                    // If term is ambiguous and required context not found, skip
                    return { matched: false };
                }
            }
            return { matched: true, pattern: match[0] };
        }
    }

    return { matched: false };
}

// Optimized IntersectionObserver
const postObserver = new IntersectionObserver((entries) => {
    if (!isFilterEnabled) return;
    
    for (const entry of entries) {
        if (entry.isIntersecting && !entry.target.hasAttribute('data-ai-scanned')) {
            queueMicrotask(() => scanPost(entry.target));
        }
    }
}, {
    rootMargin: `${VIEWPORT_THRESHOLD}px 0px`,
    threshold: 0
});

// Enhanced post scanning function
function scanPost(post) {
    if (processedPosts.has(post)) return;
    processedPosts.add(post);
    post.setAttribute('data-ai-scanned', 'true');
    
    // Scan both post description and article content
    const textContent = [
        post.querySelector('.feed-shared-update-v2__description')?.textContent,
        post.querySelector('.article-content')?.textContent,
        post.querySelector('.feed-shared-text')?.textContent
    ].filter(Boolean).join(' ');

    // Check for AI keywords with improved context
    if (textContent) {
        const result = containsAIKeywords(textContent);
        if (result.matched) {
            handleMatchedPost(post);
        }
    }
}

// Optimized post handling
function handleMatchedPost(post) {
    let overlayContainer = overlayCache.get(post);
    
    if (!overlayContainer) {
        const isDarkMode = document.documentElement.classList.contains('theme--dark') || 
                          document.body.classList.contains('theme--dark');
        
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
        
        // Add overlay to the entire post
        post.style.position = 'relative';
        post.appendChild(overlayContainer);
        
        // Store in cache
        overlayCache.set(post, overlayContainer);
    }
    
    overlayContainer.style.display = 'flex';
}

// Optimized scroll handler with throttle
let scrollTimeout;
const scrollHandler = () => {
    if (scrollTimeout || !isFilterEnabled) return;
    
    scrollTimeout = setTimeout(() => {
        const unscannedPosts = document.querySelectorAll(POST_SELECTOR);
        if (unscannedPosts.length) {
            unscannedPosts.forEach(post => {
                const rect = post.getBoundingClientRect();
                if (rect.top < window.innerHeight + VIEWPORT_THRESHOLD) {
                    scanPost(post);
                }
            });
        }
        scrollTimeout = null;
    }, 100);
};

// Use passive scroll listener
document.addEventListener('scroll', scrollHandler, { passive: true });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleFilter') {
        isFilterEnabled = request.enabled;
        if (isFilterEnabled) {
            hideAIPosts();
        } else {
            // Show all posts
            document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
                const overlay = post.querySelector('.ai-content-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }
            });
        }
    }
});

function createHeaderToggle() {
    // First check if toggle already exists
    if (document.querySelector('.ai-filter-toggle')) {
        return;
    }

    const waitForNav = setInterval(() => {
        const navSearch = document.querySelector('.global-nav__search');
        if (navSearch) {
            clearInterval(waitForNav);
            
            // Create toggle container
            const toggleContainer = document.createElement('div');
            toggleContainer.id = 'ai-filter-container'; // Add unique ID
            toggleContainer.style.cssText = `
                display: flex;
                align-items: center;
                margin-right: 16px;
                padding: 0 12px;
                height: 100%;
            `;

            // Create toggle switch with updated styles
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

            // Create label text with updated styling
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

            // Update the toggle handler with improved state management
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
                        
                        updateFilterState(isFilterEnabled);
                    });
                } else {
                    // Fallback if storage is not available
                    updateFilterState(isFilterEnabled);
                }
            });

            // Safe initial state loading
            if (chrome?.storage?.local) {
                chrome.storage.local.get(['aiFilterEnabled'], function(result) {
                    isFilterEnabled = result.aiFilterEnabled || false;
                    input.checked = isFilterEnabled;
                    if (isFilterEnabled) {
                        hideAIPosts();
                    }
                });
            }

            // Helper function to update filter state
            function updateFilterState(enabled) {
                if (enabled) {
                    document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
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

            // Insert before search if not already present
            if (!document.querySelector('#ai-filter-container')) {
                navSearch.parentNode.insertBefore(toggleContainer, navSearch);
            }
        }
    }, 1000);
}

// Setup post observer
function setupPostObserver() {
    const observer = new MutationObserver((mutations) => {
        if (!isFilterEnabled) return;
        
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.matches?.(POST_SELECTOR)) {
                        postObserver.observe(node);
                        scanPost(node);
                    } else {
                        // Check for posts inside the added node
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
}

function hideAIPosts() {
    document.querySelectorAll(POST_SELECTOR).forEach(post => {
        postObserver.observe(post);
        scanPost(post);
    });
}

function initialize() {
    // Remove any existing observers before setting up new ones
    if (window._aiFilterObserver) {
        window._aiFilterObserver.disconnect();
    }
    
    setupPostObserver();
    createHeaderToggle();
    
    if (isFilterEnabled) {
        hideAIPosts();
    }
}

// Initialize when the DOM is ready or when it's already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Add a scroll event listener to handle lazy-loaded content
window.addEventListener('scroll', debounce(() => {
    if (isFilterEnabled) {
        hideAIPosts();
    }
}, 500));

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}