# Scrollable Container Detection

This document describes the enhanced scrollable container detection feature for the `scroll_page` tool in the Algonius Browser MCP.

## Overview

The `scroll_page` tool has been enhanced to automatically detect and prioritize scrollable containers on web pages. Instead of always scrolling the entire window, the tool now intelligently identifies the most appropriate scrollable element and performs scroll operations within that container.

## How It Works

### Container Detection Algorithm

1. **Element Scanning**: The tool scans all elements on the page to identify those that are scrollable
2. **Scrollability Check**: An element is considered scrollable if:
   - It has content that overflows its visible area (`scrollHeight > clientHeight` or `scrollWidth > clientWidth`)
   - Its CSS overflow properties allow scrolling (`overflow: auto/scroll` or `overflowY/overflowX: auto/scroll`)
3. **Viewport Filtering**: Prioritizes elements that are currently visible in the viewport
4. **Size-based Prioritization**: Among visible scrollable elements, selects the one with the largest area
5. **Container Type Preference**: Prefers specific container elements over `<body>` or `<html>` elements

### Fallback Behavior

If no suitable scrollable container is found, the tool falls back to traditional window scrolling behavior.

## Container Prioritization Logic

The selection algorithm follows this priority order:

1. **In-viewport scrollable containers** (excluding body/html) - sorted by area (largest first)
2. **First in-viewport scrollable container** (including body/html if no others exist)
3. **Largest out-of-viewport scrollable container** (excluding body/html)
4. **Window scrolling** (if no containers found)

## Supported Scroll Actions

All existing scroll actions work with container detection:

- `up` - Scrolls up within the detected container
- `down` - Scrolls down within the detected container  
- `to_top` - Scrolls to the top of the detected container
- `to_bottom` - Scrolls to the bottom of the detected container
- `to_element` - Scrolls to bring an element into view (uses existing behavior)

## Benefits

### Better User Experience
- More intuitive scrolling behavior on pages with multiple scrollable areas
- Automatically focuses on the main content container
- Reduces confusion when multiple scroll areas exist

### Improved Automation
- More reliable for automated testing and data extraction
- Better handling of modern web application layouts
- Consistent behavior across different page designs

## Examples

### Single Page Application with Sidebar
```html
<div class="app">
  <nav class="sidebar">...</nav>
  <main class="content" style="overflow-y: auto; height: 100vh;">
    <!-- Main scrollable content -->
  </main>
</div>
```
The tool will detect and scroll within the `.content` container rather than the window.

### Modal Dialog with Scrollable Content
```html
<div class="modal">
  <div class="modal-content" style="overflow-y: auto; max-height: 400px;">
    <!-- Scrollable modal content -->
  </div>
</div>
```
When the modal is open and in viewport, scrolling will operate within the modal content area.

### Data Table with Scrollable Rows
```html
<div class="table-container" style="overflow: auto; height: 300px;">
  <table>
    <!-- Many rows of data -->
  </table>
</div>
```
The tool will scroll within the table container to navigate through table rows.

## Testing

### Test Page
A comprehensive test page (`test-scrollable-container.html`) has been created with:
- Vertical scrollable containers
- Horizontal scrollable containers
- Nested scrollable containers
- Multiple container sizes and positions

### Integration Tests
Automated tests verify:
- Container detection accuracy
- Proper prioritization logic
- Scroll operation execution within containers
- Fallback behavior when no containers exist

### Manual Testing
1. Open the test page in a browser
2. Use the MCP scroll_page tool with different actions
3. Observe that scrolling occurs within the appropriate container
4. Verify visual feedback and scroll position changes

## Configuration

The container detection feature is automatically enabled and requires no configuration. The behavior is determined entirely by the page structure and CSS properties.

## Troubleshooting

### Container Not Detected
If the expected container isn't being used:
1. Verify the container has proper CSS overflow properties
2. Check that the container has scrollable content (content exceeds container size)
3. Ensure the container is visible in the viewport when scrolling
4. Confirm the container isn't `<body>` or `<html>` if other containers exist

### Unexpected Scroll Behavior
If scrolling doesn't work as expected:
1. Check browser console for any JavaScript errors
2. Verify the container can be relocated after the initial detection
3. Test with the `return_dom_state` parameter to see current page state
4. Use browser developer tools to inspect CSS overflow properties

## Implementation Details

### Chrome Extension (scroll-page-handler.ts)
- `findScrollableContainer()`: Identifies the best scrollable container
- `scrollContainer()`: Performs scroll operations within a specific container
- Updated scroll methods integrate container detection

### Container Information
When a container is detected, the following information is captured:
- Tag name
- Element ID (if present)
- CSS class names
- Scroll dimensions (scrollHeight, scrollWidth)
- Client dimensions (clientHeight, clientWidth)

This information is used to relocate the container for actual scroll operations.

## Future Enhancements

Potential improvements for future versions:
- User preference for container selection
- Manual container targeting by CSS selector
- Container detection caching for performance
- Support for horizontal scrolling prioritization
- Integration with element highlighting for container visualization
