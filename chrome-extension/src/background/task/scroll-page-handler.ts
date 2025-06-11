/**
 * Scroll Page Handler for MCP Host RPC Requests
 *
 * This file implements the scroll_page RPC method handler for the browser extension.
 * It responds to requests from the MCP Host that need to scroll the page in various ways.
 */

import type BrowserContext from '../browser/context';
import { createLogger } from '../log';
import type { RpcHandler, RpcRequest, RpcResponse } from '../mcp/host-manager';
import { findElementByHighlightIndex } from './dom-utils';

/**
 * Handler for the 'scroll_page' RPC method
 *
 * This handler processes scroll requests from the MCP Host and performs
 * the appropriate scrolling action on the current page.
 */
export class ScrollPageHandler {
  private logger = createLogger('ScrollPageHandler');

  /**
   * Creates a new ScrollPageHandler instance
   *
   * @param browserContext The browser context for accessing page scrolling methods
   */
  constructor(private readonly browserContext: BrowserContext) {}

  /**
   * Find the most appropriate scrollable container on the page
   * Returns null if only window scrolling should be used
   */
  private async findScrollableContainer(page: any): Promise<any> {
    if (!page._puppeteerPage) {
      return null;
    }

    return await page._puppeteerPage.evaluate(() => {
      // Function to check if an element is scrollable
      function isScrollable(element: Element): boolean {
        const style = window.getComputedStyle(element);
        const overflowX = style.overflowX;
        const overflowY = style.overflowY;
        const overflow = style.overflow;

        // Check if element has scroll overflow
        const hasVerticalScroll = element.scrollHeight > element.clientHeight;
        const hasHorizontalScroll = element.scrollWidth > element.clientWidth;

        // Check if overflow allows scrolling
        const allowsVerticalScroll =
          overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll';
        const allowsHorizontalScroll =
          overflowX === 'auto' || overflowX === 'scroll' || overflow === 'auto' || overflow === 'scroll';

        return (hasVerticalScroll && allowsVerticalScroll) || (hasHorizontalScroll && allowsHorizontalScroll);
      }

      // Function to check if element is in viewport
      function isInViewport(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
      }

      // Function to get element area
      function getElementArea(element: Element): number {
        const rect = element.getBoundingClientRect();
        return rect.width * rect.height;
      }

      // Find all scrollable elements
      const allElements = Array.from(document.querySelectorAll('*'));
      const scrollableElements = allElements.filter(isScrollable);

      if (scrollableElements.length === 0) {
        return null; // No scrollable containers found, use window scrolling
      }

      // Prioritize scrollable elements that are:
      // 1. In viewport
      // 2. Have larger area (more prominent)
      // 3. Are not the body or html element (prefer specific containers)

      const inViewportScrollable = scrollableElements.filter(isInViewport);

      if (inViewportScrollable.length === 0) {
        // If no scrollable elements in viewport, use the largest scrollable element
        const largestScrollable = scrollableElements.reduce((largest, current) => {
          return getElementArea(current) > getElementArea(largest) ? current : largest;
        });

        // Don't use body or html as preferred containers unless they're the only option
        if (largestScrollable.tagName === 'BODY' || largestScrollable.tagName === 'HTML') {
          return null;
        }

        return {
          element: largestScrollable,
          tagName: largestScrollable.tagName,
          id: largestScrollable.id,
          className: largestScrollable.className,
          scrollHeight: largestScrollable.scrollHeight,
          scrollWidth: largestScrollable.scrollWidth,
          clientHeight: largestScrollable.clientHeight,
          clientWidth: largestScrollable.clientWidth,
        };
      }

      // Find the most appropriate scrollable element in viewport
      const bestScrollable =
        inViewportScrollable
          .filter(el => el.tagName !== 'BODY' && el.tagName !== 'HTML') // Prefer specific containers
          .sort((a, b) => getElementArea(b) - getElementArea(a))[0] || // Sort by area, largest first
        inViewportScrollable[0]; // Fallback to first in-viewport element

      return {
        element: bestScrollable,
        tagName: bestScrollable.tagName,
        id: bestScrollable.id,
        className: bestScrollable.className,
        scrollHeight: bestScrollable.scrollHeight,
        scrollWidth: bestScrollable.scrollWidth,
        clientHeight: bestScrollable.clientHeight,
        clientWidth: bestScrollable.clientWidth,
      };
    });
  }

  /**
   * Scroll within a specific container element
   */
  private async scrollContainer(page: any, containerInfo: any, action: string, pixels?: number): Promise<string> {
    if (!page._puppeteerPage) {
      throw new Error('Puppeteer page not available');
    }

    return await page._puppeteerPage.evaluate(
      (containerData: any, scrollAction: string, scrollPixels?: number) => {
        // Find the container element again (we can't pass the actual element reference)
        let container: Element | null = null;

        if (containerData.id) {
          container = document.getElementById(containerData.id);
        }

        if (!container && containerData.className) {
          const elements = document.getElementsByClassName(containerData.className);
          if (elements.length > 0) {
            container = elements[0];
          }
        }

        if (!container) {
          // Fallback: find by tag name and properties
          const elements = document.getElementsByTagName(containerData.tagName);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.scrollHeight === containerData.scrollHeight && el.clientHeight === containerData.clientHeight) {
              container = el;
              break;
            }
          }
        }

        if (!container) {
          throw new Error('Could not relocate scrollable container');
        }

        const scrollAmount = scrollPixels || 300;
        let result = '';

        switch (scrollAction) {
          case 'up':
            container.scrollTop -= scrollAmount;
            result = `Scrolled up ${scrollAmount} pixels in container (${containerData.tagName}${containerData.id ? '#' + containerData.id : ''})`;
            break;
          case 'down':
            container.scrollTop += scrollAmount;
            result = `Scrolled down ${scrollAmount} pixels in container (${containerData.tagName}${containerData.id ? '#' + containerData.id : ''})`;
            break;
          case 'to_top':
            container.scrollTop = 0;
            result = `Scrolled to top of container (${containerData.tagName}${containerData.id ? '#' + containerData.id : ''})`;
            break;
          case 'to_bottom':
            container.scrollTop = container.scrollHeight;
            result = `Scrolled to bottom of container (${containerData.tagName}${containerData.id ? '#' + containerData.id : ''})`;
            break;
          default:
            throw new Error(`Unsupported container scroll action: ${scrollAction}`);
        }

        return result;
      },
      containerInfo,
      action,
      pixels,
    );
  }

  /**
   * Handle a scroll_page RPC request
   *
   * @param request RPC request with scroll parameters
   * @returns Promise resolving to an RPC response confirming the scroll action
   */
  public handleScrollPage: RpcHandler = async (request: RpcRequest): Promise<RpcResponse> => {
    this.logger.debug('Received scroll_page request:', request);

    try {
      const { action, pixels, element_index } = request.params || {};

      if (!action) {
        return {
          error: {
            code: -32602,
            message: 'Missing required parameter: action',
          },
        };
      }

      // Validate action type
      const validActions = ['up', 'down', 'to_element', 'to_top', 'to_bottom'];
      if (!validActions.includes(action)) {
        return {
          error: {
            code: -32602,
            message: `Invalid action: ${action}. Valid actions are: ${validActions.join(', ')}`,
          },
        };
      }

      // Get current page
      const currentPage = await this.browserContext.getCurrentPage();
      if (!currentPage) {
        return {
          error: {
            code: -32000,
            message: 'No active page available',
          },
        };
      }

      let result: string;

      // Execute the appropriate scroll action
      switch (action) {
        case 'up':
          await this.scrollUp(currentPage, pixels);
          result = `Scrolled up ${pixels || 300} pixels`;
          break;

        case 'down':
          await this.scrollDown(currentPage, pixels);
          result = `Scrolled down ${pixels || 300} pixels`;
          break;

        case 'to_element':
          if (element_index === undefined || element_index === null) {
            return {
              error: {
                code: -32602,
                message: 'Missing required parameter: element_index for to_element action',
              },
            };
          }
          await this.scrollToElement(currentPage, element_index);
          result = `Scrolled to element at index ${element_index}`;
          break;

        case 'to_top':
          await this.scrollToTop(currentPage);
          result = 'Scrolled to top of page';
          break;

        case 'to_bottom':
          await this.scrollToBottom(currentPage);
          result = 'Scrolled to bottom of page';
          break;

        default:
          return {
            error: {
              code: -32602,
              message: `Unsupported scroll action: ${action}`,
            },
          };
      }

      this.logger.debug('Scroll action completed:', result);

      return {
        result: {
          success: true,
          message: result,
        },
      };
    } catch (error) {
      this.logger.error('Error performing scroll action:', error);

      return {
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Unknown error performing scroll action',
          data: { stack: error instanceof Error ? error.stack : undefined },
        },
      };
    }
  };

  /**
   * Scroll up by the specified number of pixels
   *
   * @param page The page instance to scroll
   * @param pixels Number of pixels to scroll (default: 300)
   */
  private async scrollUp(page: any, pixels?: number): Promise<void> {
    const scrollAmount = pixels || 300;

    // Try to find a scrollable container first
    const container = await this.findScrollableContainer(page);

    if (container) {
      // Use container scrolling
      await this.scrollContainer(page, container, 'up', scrollAmount);
    } else {
      // Fall back to window scrolling
      await page.scrollUp(scrollAmount);
    }

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Scroll down by the specified number of pixels
   *
   * @param page The page instance to scroll
   * @param pixels Number of pixels to scroll (default: 300)
   */
  private async scrollDown(page: any, pixels?: number): Promise<void> {
    const scrollAmount = pixels || 300;

    // Try to find a scrollable container first
    const container = await this.findScrollableContainer(page);

    if (container) {
      // Use container scrolling
      await this.scrollContainer(page, container, 'down', scrollAmount);
    } else {
      // Fall back to window scrolling
      await page.scrollDown(scrollAmount);
    }

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Scroll to a specific element by its index
   *
   * @param page The page instance to scroll
   * @param elementIndex The index of the element to scroll to
   */
  private async scrollToElement(page: any, elementIndex: number): Promise<void> {
    // Get the DOM element by highlightIndex using shared utility
    const domElement = await findElementByHighlightIndex(page, elementIndex);
    if (!domElement) {
      throw new Error(`Element with highlightIndex ${elementIndex} not found`);
    }

    // Locate the element and scroll it into view
    const elementHandle = await page.locateElement(domElement);
    if (!elementHandle) {
      throw new Error(`Element with index ${elementIndex} could not be located on the page`);
    }

    // Scroll the element into view
    await elementHandle.evaluate((el: Element) => {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Scroll to the top of the page
   *
   * @param page The page instance to scroll
   */
  private async scrollToTop(page: any): Promise<void> {
    // Try to find a scrollable container first
    const container = await this.findScrollableContainer(page);

    if (container) {
      // Use container scrolling
      await this.scrollContainer(page, container, 'to_top');
    } else {
      // Fall back to window scrolling
      if (page._puppeteerPage) {
        await page._puppeteerPage.evaluate(() => {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth',
          });
        });
      }
    }

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Scroll to the bottom of the page
   *
   * @param page The page instance to scroll
   */
  private async scrollToBottom(page: any): Promise<void> {
    // Try to find a scrollable container first
    const container = await this.findScrollableContainer(page);

    if (container) {
      // Use container scrolling
      await this.scrollContainer(page, container, 'to_bottom');
    } else {
      // Fall back to window scrolling
      if (page._puppeteerPage) {
        await page._puppeteerPage.evaluate(() => {
          window.scrollTo({
            top: document.body.scrollHeight,
            left: 0,
            behavior: 'smooth',
          });
        });
      }
    }

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
