let isFilterEnabled = false;

// Function to check if text contains AI-related keywords
// Pre-compile the regex pattern once


function containsAIKeywords(text) {
    if (!text) return { matched: false };
    const match = AI_PATTERN.exec(text);
    return match ? { matched: true, pattern: match[0] } : { matched: false };
}

// Pre-compile all regex and selectors for better performance
// Pre-compile all patterns and cache DOM queries
// Add this near the top of the file with other constants
const AI_PATTERN = /(AI|A\.I\.|artificial intelligence|machine learning|deep learning|neural network|GPT-[34]|ChatGPT|LLM)s?\b/i;
const POST_SELECTOR = '.feed-shared-update-v2:not([data-ai-scanned])';
const FEED_SELECTOR = '.core-rail, .feed-following-feed';
const VIEWPORT_THRESHOLD = 500;

// Initialize WeakSet for processed posts
const processedPosts = new WeakSet();

// Use Intersection Observer for better performance
// Update the IntersectionObserver options for more responsive detection
const postObserver = new IntersectionObserver((entries) => {
    if (!isFilterEnabled) return;
    
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.hasAttribute('data-ai-scanned')) {
            // Use immediate execution instead of requestAnimationFrame
            scanPost(entry.target);
        }
    });
}, {
    rootMargin: `${VIEWPORT_THRESHOLD}px 0px`,
    threshold: [0, 0.1, 0.5], // Multiple thresholds for better detection
});

function scanPost(post) {
    if (processedPosts.has(post)) return;
    
    processedPosts.add(post);
    post.setAttribute('data-ai-scanned', 'true');
    
    // Immediate text scan without animation frame delay
    const textContent = post.querySelector('.feed-shared-update-v2__description')?.textContent || '';
    if (AI_PATTERN.test(textContent)) {
        handleMatchedPost(post);
    }
}

// Add passive scroll listener for continuous detection
document.addEventListener('scroll', () => {
    if (isFilterEnabled) {
        const unscannedPosts = document.querySelectorAll(POST_SELECTOR);
        unscannedPosts.forEach(post => {
            const rect = post.getBoundingClientRect();
            if (rect.top < window.innerHeight + VIEWPORT_THRESHOLD) {
                scanPost(post);
            }
        });
    }
}, { passive: true });

// Remove the old scroll listener with debounce
// window.addEventListener('scroll', debounce(() => {...}), 500));

function hideAIPosts() {
    // Observe new posts immediately
    document.querySelectorAll(POST_SELECTOR).forEach(post => {
        postObserver.observe(post);
        scanPost(post);
    });
}

function setupPostObserver() {
    const observer = new MutationObserver((mutations) => {
        if (!isFilterEnabled) return;
        
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.matches?.(POST_SELECTOR)) {
                    postObserver.observe(node);
                    scanPost(node);
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
}

// Remove scroll listener as we're using IntersectionObserver
// Initialize immediately without waiting
function initialize() {
    if (document.readyState !== 'loading') {
        setupPostObserver();
        createHeaderToggle();
        if (isFilterEnabled) hideAIPosts();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setupPostObserver();
            createHeaderToggle();
            if (isFilterEnabled) hideAIPosts();
        });
    }
}

// Remove scroll listener and debounce
initialize();

// Separate function to handle matched posts
function handleMatchedPost(post, result) {
    // Get all content elements including the caption
    const contentElements = post.querySelectorAll('.update-components-text.relative.update-components-update-v2__commentary, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text, .feed-shared-update-v2__content, .feed-shared-update-v2__media');
    if (!contentElements.length) return;

    // Create or get the overlay container
    let overlayContainer = post.querySelector('.ai-content-overlay');
    if (!overlayContainer) {
        // Add dark mode detection here
        const isDarkMode = document.documentElement.classList.contains('theme--dark') || 
                          document.body.classList.contains('theme--dark') ||
                          window.matchMedia('(prefers-color-scheme: dark)').matches;

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
    }

    // Show the overlay
    overlayContainer.style.display = 'flex';
}

// Remove duplicate code block after handleMatchedPost



// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleFilter') {
        isFilterEnabled = request.enabled;
        if (isFilterEnabled) {
            hideAIPosts();
        } else {
            // Show all posts
            document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
                post.style.display = '';
            });
        }
    }
});

function createHeaderToggle() {
    // First check if toggle already exists to prevent duplicates
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

            // Update the click handling with improved state management
            // Update the toggle handler in createHeaderToggle function
            input.addEventListener('change', function() {
                isFilterEnabled = this.checked;
                chrome.storage.local.set({ aiFilterEnabled: isFilterEnabled }, () => {
                    // Notify other parts of the extension about the state change
                    chrome.runtime.sendMessage({
                        action: 'toggleFilter',
                        enabled: isFilterEnabled
                    });
                    
                    if (isFilterEnabled) {
                        // Remove all data-ai-scanned attributes to force rescan
                        document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
                            post.removeAttribute('data-ai-scanned');
                            processedPosts.delete(post);
                        });
                        // Run the scan
                        hideAIPosts();
                    } else {
                        // Remove overlays from all posts
                        document.querySelectorAll('.ai-content-overlay').forEach(overlay => {
                            overlay.remove();
                        });
                    }
                });
            });

            // Set initial state from storage with improved sync
            chrome.storage.local.get(['aiFilterEnabled'], function(result) {
                isFilterEnabled = result.aiFilterEnabled || false;
                input.checked = isFilterEnabled;
                if (isFilterEnabled) {
                    hideAIPosts();
                }
            });

            // Insert before search if not already present
            if (!document.querySelector('#ai-filter-container')) {
                navSearch.parentNode.insertBefore(toggleContainer, navSearch);
            }
        }
    }, 1000);
}

// Update initialization to prevent multiple instances
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