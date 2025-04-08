# Mute AI - LinkedIn Content Filter

A Chrome extension that helps you filter AI-related content from your LinkedIn feed, providing a cleaner, more focused browsing experience.

## Features

- **Smart Content Detection**: Automatically identifies posts containing AI-related content using advanced pattern matching
- **Non-Destructive Filtering**: Posts are hidden behind an overlay rather than removed, allowing you to view them when desired
- **Easy Toggle**: Convenient toggle switch in the LinkedIn header to enable/disable filtering
- **Dark Mode Support**: Seamlessly integrates with LinkedIn's light and dark themes
- **Performance Optimized**: Efficient post scanning with minimal impact on browsing experience

## How It Works

1. **Content Analysis**: 
   - Scans posts for AI-related keywords and phrases
   - Includes comprehensive pattern matching for AI technologies, tools, and common phrases
   - Handles false positives, especially for non-English content

2. **Visual Feedback**:
   - Shows an overlay on detected AI posts
   - Displays a warning icon and "AI Content Detected" message
   - Provides a "Show Post" button to reveal hidden content

3. **Smart Detection**:
   - Recognizes various AI-related terms and contexts
   - Supports multiple post formats and content types
   - Updates dynamically as you scroll through your feed

## Installation

1. Download the extension from the Chrome Web Store
2. Click the extension icon to access settings
3. Visit LinkedIn and use the "Mute AI" toggle in the navigation bar

## Usage

- Toggle the filter on/off using the "Mute AI" switch in the LinkedIn header
- Click "Show Post" on any hidden content to reveal it
- Extension state persists across browser sessions

## Privacy

- Works entirely client-side
- No data collection or external communication
- No modification of LinkedIn's core functionality

## Technical Details

- Built for Chrome using Manifest V3
- Uses MutationObserver for dynamic content detection
- Implements efficient caching and post processing
- Supports LinkedIn's dynamic content loading

## License

MIT License - See LICENSE file for details