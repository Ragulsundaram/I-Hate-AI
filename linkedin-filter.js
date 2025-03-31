let isFilterEnabled = false;

// Function to check if text contains AI-related keywords
function containsAIKeywords(text) {
    if (!text) return { matched: false };
    // Pre-compiled regex for maximum performance
    const pattern = /(AI|A\.I\.|artificial intelligence|machine learning|deep learning|neural network|GPT-[34]|ChatGPT|LLM)s?\b/i;
    const match = pattern.exec(text);
    return match ? { matched: true, pattern: match[0] } : { matched: false };
}

function hideAIPosts() {
    const posts = document.querySelectorAll('.feed-shared-update-v2:not([data-ai-scanned])');
    if (!posts.length) return;

    const processChunk = (startIndex) => {
        const chunk = Array.from(posts).slice(startIndex, startIndex + 10);
        if (!chunk.length) return;

        chunk.forEach(post => {
            post.setAttribute('data-ai-scanned', 'true');
            const text = post.querySelector('.feed-shared-update-v2__description')?.textContent || '';
            const result = containsAIKeywords(text);
            if (result.matched) handleMatchedPost(post, result);
        });

        if (startIndex + 10 < posts.length) {
            requestIdleCallback(() => processChunk(startIndex + 10), { timeout: 100 });
        }
    };

    requestAnimationFrame(() => processChunk(0));
}

function setupPostObserver() {
    const feedObserver = new MutationObserver((mutations) => {
        if (!isFilterEnabled) return;
        
        let shouldProcess = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                shouldProcess = true;
                break;
            }
        }
        
        if (shouldProcess) {
            cancelIdleCallback(window._aiFilterTimeout);
            window._aiFilterTimeout = requestIdleCallback(hideAIPosts, { timeout: 150 });
        }
    });

    // Observe the main feed with optimized options
    const observeTarget = document.querySelector('.core-rail') || document.querySelector('.feed-following-feed');
    if (observeTarget) {
        feedObserver.observe(observeTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }
}

// Add a more efficient initialization
function initialize() {
    setupPostObserver();
    createHeaderToggle();
    
    // Initial scan with slight delay to ensure DOM is ready
    if (document.readyState === 'complete') {
        hideAIPosts();
    } else {
        window.addEventListener('load', hideAIPosts);
    }
}

// Separate function to handle matched posts
function handleMatchedPost(post, result) {
    // Get all content elements including the caption
    const contentElements = post.querySelectorAll('.update-components-text.relative.update-components-update-v2__commentary, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text, .feed-shared-update-v2__content, .feed-shared-update-v2__media');
    if (!contentElements.length) return;

    // Create or get the overlay container
    let overlayContainer = post.querySelector('.ai-content-overlay');
    if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.className = 'ai-content-overlay';
        overlayContainer.style.cssText = `
            background-color: rgba(240, 240, 240, 0.75);
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
            z-index: 1000;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            min-height: 200px;
            height: 100%;
        `;

        // Add eye-slash icon with higher z-index
        const icon = document.createElement('span');
        icon.innerHTML = '&#128683;';
        icon.style.cssText = `
            font-size: 24px;
            position: relative;
            z-index: 1001;
        `;

        // Add message with higher z-index
        const message = document.createElement('div');
        message.textContent = 'AI Content Detected';
        message.style.cssText = `
            color: #666;
            font-size: 16px;
            font-weight: bold;
            position: relative;
            z-index: 1001;
        `;

        // Add show content button with higher z-index
        const showButton = document.createElement('button');
        showButton.textContent = 'Show Post';
        showButton.style.cssText = `
            background-color: transparent;
            border: 1px solid #0a66c2;
            color: #0a66c2;
            padding: 8px 16px;
            border-radius: 16px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            position: relative;
            z-index: 1001;
        `;

        showButton.addEventListener('mouseover', () => {
            showButton.style.backgroundColor = 'rgba(10, 102, 194, 0.1)';
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
    const waitForNav = setInterval(() => {
        const navSearch = document.querySelector('.global-nav__search');
        if (navSearch) {
            clearInterval(waitForNav);
            
            // Create toggle container
            const toggleContainer = document.createElement('div');
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

            // Update the click handling
            input.addEventListener('change', function() {
                isFilterEnabled = this.checked;
                chrome.storage.local.set({ aiFilterEnabled: isFilterEnabled });
                if (isFilterEnabled) {
                    hideAIPosts();
                } else {
                    document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
                        post.style.border = '';
                        post.style.backgroundColor = '';
                        const debugLabel = post.querySelector('.ai-filter-debug');
                        if (debugLabel) debugLabel.remove();
                    });
                }
            });

            // Set initial state from storage
            chrome.storage.local.get(['aiFilterEnabled'], function(result) {
                isFilterEnabled = result.aiFilterEnabled || false;
                input.checked = isFilterEnabled;
                if (isFilterEnabled) {
                    hideAIPosts();
                }
            });

            // Insert before search
            navSearch.parentNode.insertBefore(toggleContainer, navSearch);
        }
    }, 1000);
}

// Update initialization
function initialize() {
    // Set up observers first
    setupPostObserver();
    
    // Then create the header toggle
    createHeaderToggle();
    
    // Initial scan of posts
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