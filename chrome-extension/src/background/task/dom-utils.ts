/**
 * Shared DOM utilities for MCP Host RPC Handlers
 *
 * This file provides common utilities for finding DOM elements by their highlightIndex,
 * ensuring consistent behavior across all task handlers.
 */

import type { DOMElementNode } from '../dom/views';

/**
 * Find a DOM element by its highlightIndex in the element tree
 *
 * This function traverses the DOM tree and finds the element with the specified
 * highlightIndex. This ensures consistency with how elements are displayed in
 * the DOM state API.
 *
 * @param page The page instance to get DOM state from
 * @param targetHighlightIndex The highlightIndex to search for
 * @returns Promise resolving to the DOMElementNode if found, null otherwise
 */
export async function findElementByHighlightIndex(
  page: any,
  targetHighlightIndex: number,
): Promise<DOMElementNode | null> {
  // Get current DOM state
  const state = await page.getState(false, false);

  // Recursively search for element with matching highlightIndex
  const findElement = (node: any): DOMElementNode | null => {
    // Check if this node has the target highlightIndex
    if (node.highlightIndex === targetHighlightIndex) {
      return node;
    }

    // Recursively search children
    if (node.children) {
      for (const child of node.children) {
        const found = findElement(child);
        if (found) {
          return found; // Early return when found
        }
      }
    }

    return null;
  };

  return findElement(state.elementTree);
}
