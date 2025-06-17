/**
 * Type Value Handler for MCP Host RPC Requests
 *
 * This file implements the type_value RPC method handler for the browser extension.
 * It responds to requests from the MCP Host that need to type text or simulate keyboard input on interactive elements.
 */

import type BrowserContext from '../browser/context';
import { createLogger } from '../log';
import type { RpcHandler, RpcRequest, RpcResponse } from '../mcp/host-manager';
import { DOMElementNode } from '../dom/views';
import { findElementByHighlightIndex } from './dom-utils';
import { type KeyInput } from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';

/**
 * Interface for keyboard operation
 */
interface KeyboardOperation {
  type: 'text' | 'specialKey' | 'modifierCombination';
  content?: string;
  key?: string;
  modifiers?: string[];
}

/**
 * Interface for input strategy determination
 */
interface InputStrategy {
  elementType: string;
  method: string;
  canHandle: boolean;
}

/**
 * Handler for the 'type_value' RPC method
 *
 * This handler processes typing requests from the MCP Host and performs
 * intelligent value setting and keyboard input simulation on interactive elements.
 */
export class TypeValueHandler {
  private logger = createLogger('TypeValueHandler');

  /**
   * Restore escaped curly braces
   */
  private restoreEscapedBraces(text: string): string {
    return text.replace(/§LEFTBRACE§/g, '{').replace(/§RIGHTBRACE§/g, '}');
  }

  /**
   * Verify if the given key content is a valid special key or modifier combination.
   */
  private isValidSpecialKey(keyContent: string): boolean {
    // Check single special key
    const normalizedKey = keyContent.toLowerCase();
    if (this.specialKeyMap[normalizedKey]) {
      return true;
    }

    // Check modifier combination (e.g., Ctrl+A, Shift+Tab)
    if (keyContent.includes('+')) {
      const parts = keyContent.split('+').map(p => p.trim());
      if (parts.length >= 2) {
        const modifiers = parts.slice(0, -1);
        const key = parts[parts.length - 1];

        // Verify all modifiers are valid
        const validModifiers = modifiers.every(mod => this.modifierKeyMap[mod.toLowerCase()] !== undefined);

        // Verify the main key is a valid special key or a single character key
        const validKey =
          this.specialKeyMap[key.toLowerCase()] !== undefined ||
          /^[a-zA-Z0-9]$/.test(key) || // Alphanumeric keys
          key === ' '; // Space key

        return validModifiers && validKey;
      }
    }
    return false;
  }

  /**
   * Generate DOM snapshot for change detection
   * Enhanced to capture more comprehensive DOM state including button states and content changes
   */
  private async generateDOMSnapshot(): Promise<string> {
    try {
      // Get current browser state with vision enabled
      const browserState = await this.browserContext.getState(true);

      if (!browserState.elementTree) {
        return 'no_dom';
      }

      // Extract interactive elements using enhanced logic
      const interactiveElements = this.extractInteractiveElements(browserState.elementTree);

      // Also capture button states and important UI elements that might change
      const buttonStates = this.extractButtonStates(browserState.elementTree);
      const contentElements = this.extractContentElements(browserState.elementTree);

      // Generate comprehensive snapshot
      const snapshot = this.generateEnhancedElementSnapshot(interactiveElements, buttonStates, contentElements);

      return snapshot;
    } catch (error) {
      this.logger.warning('Failed to generate DOM snapshot:', error);
      return 'snapshot_error';
    }
  }

  /**
   * Extract interactive elements from DOM tree
   * Enhanced to include potential interactive elements for better DOM change detection
   */
  private extractInteractiveElements(tree: DOMElementNode): any[] {
    const interactiveElements: any[] = [];
    const queue: DOMElementNode[] = [tree];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;

      // Add interactive elements with highlight indices (existing logic)
      if (node.isInteractive && node.highlightIndex !== null) {
        interactiveElements.push(this.createElementSnapshot(node, 'interactive'));
      }
      // Add potential interactive elements (button, input, etc., even if currently disabled/non-interactive)
      else if (this.isPotentialInteractiveElement(node)) {
        interactiveElements.push(this.createElementSnapshot(node, 'potential'));
      }

      // Add children to queue
      for (const child of node.children) {
        if (child instanceof DOMElementNode) {
          queue.push(child);
        }
      }
    }

    return interactiveElements;
  }

  /**
   * Check if an element is potentially interactive
   * This includes elements that may become interactive or lose interactivity
   */
  private isPotentialInteractiveElement(node: DOMElementNode): boolean {
    const tagName = node.tagName?.toLowerCase();
    if (!tagName) return false;

    // Standard interactive element types
    const interactiveTagNames = new Set(['button', 'input', 'select', 'textarea', 'a', 'option']);

    // Check tag name
    if (interactiveTagNames.has(tagName)) {
      return true;
    }

    // Check for elements with interactive roles
    const interactiveRoles = new Set([
      'button',
      'link',
      'checkbox',
      'radio',
      'textbox',
      'combobox',
      'listbox',
      'option',
    ]);

    if (node.attributes.role && interactiveRoles.has(node.attributes.role.toLowerCase())) {
      return true;
    }

    // Check for elements with click handlers or interactive attributes
    if (
      node.attributes.onclick ||
      node.attributes.onsubmit ||
      node.attributes.tabindex !== undefined ||
      node.attributes.contenteditable === 'true'
    ) {
      return true;
    }

    // Check for form-related elements that might become interactive
    if (tagName === 'div' || tagName === 'span') {
      const className = node.attributes.class || '';
      const id = node.attributes.id || '';

      // Common patterns for interactive elements
      const interactivePatterns = [/button/i, /btn/i, /submit/i, /click/i, /interactive/i, /action/i];

      return interactivePatterns.some(pattern => pattern.test(className) || pattern.test(id));
    }

    return false;
  }

  /**
   * Create element snapshot for DOM change detection
   */
  private createElementSnapshot(node: DOMElementNode, elementStatus: 'interactive' | 'potential'): any {
    return {
      // Use a consistent identifier for potential elements
      index: node.highlightIndex ?? -1,
      tagName: node.tagName,
      text: node.getAllTextTillNextClickableElement(),
      id: node.attributes.id || '',
      class: node.attributes.class || '',
      type: node.attributes.type || '',
      href: node.attributes.href || '',
      value: node.attributes.value || '',
      isInViewport: node.isInViewport,
      // New fields to track element state
      elementStatus: elementStatus,
      disabled: node.attributes.disabled !== undefined,
      readonly: node.attributes.readonly !== undefined,
      isInteractive: node.isInteractive,
      // Add a unique identifier for consistent tracking
      elementKey: this.generateElementKey(node),
    };
  }

  /**
   * Generate a unique key for an element for consistent tracking
   */
  private generateElementKey(node: DOMElementNode): string {
    const parts = [
      node.tagName || '',
      node.attributes.id || '',
      node.attributes.name || '',
      node.attributes.class || '',
      (node.getAllTextTillNextClickableElement() || '').substring(0, 30),
    ];
    return parts.join(':');
  }

  /**
   * Generate element snapshot hash for change detection
   */
  private generateElementSnapshot(elements: any[]): string {
    if (elements.length === 0) {
      return '0:';
    }

    // Generate stable keys for each element
    const elementKeys = elements.map(el => {
      const keyParts = [
        el.tagName || '',
        el.index?.toString() || '',
        el.id || '',
        el.class || '',
        (el.text || '').substring(0, 50), // Limit text length to avoid large changes
        el.type || '',
        el.href || '',
        el.value || '',
      ];
      return keyParts.join(':');
    });

    // Sort for consistency
    elementKeys.sort();
    const hash = elementKeys.join('|');

    return `${elements.length}:${hash}`;
  }

  /**
   * Generate enhanced element snapshot that includes button states and content elements
   */
  private generateEnhancedElementSnapshot(
    interactiveElements: any[],
    buttonStates: any[],
    contentElements: any[],
  ): string {
    const parts = [];

    // Interactive elements count and hash
    if (interactiveElements.length > 0) {
      const interactiveKeys = interactiveElements.map(el => {
        const keyParts = [
          el.tagName || '',
          el.index?.toString() || '',
          el.id || '',
          el.class || '',
          (el.text || '').substring(0, 50),
          el.type || '',
          el.disabled?.toString() || 'false',
          el.isInteractive?.toString() || 'false',
        ];
        return keyParts.join(':');
      });
      interactiveKeys.sort();
      parts.push(`I${interactiveElements.length}:${interactiveKeys.join('|')}`);
    } else {
      parts.push('I0:');
    }

    // Button states
    if (buttonStates.length > 0) {
      const buttonKeys = buttonStates.map(btn => {
        return `${btn.text}:${btn.disabled}:${btn.class}`;
      });
      buttonKeys.sort();
      parts.push(`B${buttonStates.length}:${buttonKeys.join('|')}`);
    } else {
      parts.push('B0:');
    }

    // Content elements (for character counters, warnings, etc.)
    if (contentElements.length > 0) {
      const contentKeys = contentElements.map(el => {
        return `${el.class}:${el.text.substring(0, 30)}`;
      });
      contentKeys.sort();
      parts.push(`C${contentElements.length}:${contentKeys.join('|')}`);
    } else {
      parts.push('C0:');
    }

    return parts.join('###');
  }

  /**
   * Extract button states for DOM change detection
   */
  private extractButtonStates(tree: DOMElementNode): any[] {
    const buttons: any[] = [];
    const queue: DOMElementNode[] = [tree];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;

      // Capture all buttons and their states
      if (
        node.tagName?.toLowerCase() === 'button' ||
        (node.tagName?.toLowerCase() === 'div' && node.attributes.role === 'button') ||
        (node.tagName?.toLowerCase() === 'a' && node.attributes.role === 'button')
      ) {
        const buttonText = node.getAllTextTillNextClickableElement() || '';
        const isDisabled =
          node.attributes.disabled !== undefined ||
          node.attributes['aria-disabled'] === 'true' ||
          (node.attributes.class || '').includes('disabled');

        buttons.push({
          text: buttonText.substring(0, 50), // Limit text length
          disabled: isDisabled,
          class: node.attributes.class || '',
          tagName: node.tagName,
          role: node.attributes.role || '',
        });
      }

      // Add children to queue
      for (const child of node.children) {
        if (child instanceof DOMElementNode) {
          queue.push(child);
        }
      }
    }

    return buttons;
  }

  /**
   * Extract content elements that might change (counters, warnings, etc.)
   */
  private extractContentElements(tree: DOMElementNode): any[] {
    const contentElements: any[] = [];
    const queue: DOMElementNode[] = [tree];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;

      const className = node.attributes.class || '';
      const text = node.getAllTextTillNextClickableElement() || '';

      // Look for elements that typically indicate UI state changes
      const isStateElement =
        className.includes('counter') ||
        className.includes('warning') ||
        className.includes('error') ||
        className.includes('limit') ||
        className.includes('character') ||
        className.includes('premium') ||
        className.includes('upgrade') ||
        text.includes('character') ||
        text.includes('Premium') ||
        text.includes('upgrade') ||
        /\d+\s*(character|char|left|remaining)/.test(text.toLowerCase());

      if (isStateElement && text.trim().length > 0) {
        contentElements.push({
          text: text.substring(0, 50),
          class: className,
          tagName: node.tagName || '',
          id: node.attributes.id || '',
        });
      }

      // Add children to queue
      for (const child of node.children) {
        if (child instanceof DOMElementNode) {
          queue.push(child);
        }
      }
    }

    return contentElements;
  }

  /**
   * Smart DOM comparison that detects significant changes in enhanced snapshot format
   */
  private isDOMSignificantlyChanged(before: string, after: string): boolean {
    if (before === after) return false;

    // Handle enhanced snapshot format: "I<count>:<hash>###B<count>:<hash>###C<count>:<hash>"
    if (before.includes('###') && after.includes('###')) {
      return this.compareEnhancedSnapshots(before, after);
    }

    // Fallback to legacy format for backward compatibility
    const [beforeCount, beforeHash] = before.split(':', 2);
    const [afterCount, afterHash] = after.split(':', 2);

    // Element count change is significant
    if (beforeCount !== afterCount) {
      this.logger.debug('DOM element count changed', {
        before: beforeCount,
        after: afterCount,
      });
      return true;
    }

    // Hash difference indicates property changes
    if (beforeHash !== afterHash) {
      this.logger.debug('DOM element properties changed');
      return true;
    }

    return false;
  }

  /**
   * Compare enhanced snapshots for more accurate change detection
   */
  private compareEnhancedSnapshots(before: string, after: string): boolean {
    const beforeParts = before.split('###');
    const afterParts = after.split('###');

    if (beforeParts.length !== afterParts.length) {
      this.logger.debug('Enhanced snapshot structure changed');
      return true;
    }

    let changesDetected = false;
    const changeDetails: string[] = [];

    // Compare each part (Interactive, Buttons, Content)
    for (let i = 0; i < beforeParts.length; i++) {
      const beforePart = beforeParts[i];
      const afterPart = afterParts[i];

      if (beforePart !== afterPart) {
        const partType = beforePart.charAt(0); // I, B, or C
        const partName = partType === 'I' ? 'Interactive' : partType === 'B' ? 'Buttons' : 'Content';

        // Extract counts for comparison
        const beforeMatch = beforePart.match(/^([IBC])(\d+):/);
        const afterMatch = afterPart.match(/^([IBC])(\d+):/);

        if (beforeMatch && afterMatch) {
          const beforeCount = parseInt(beforeMatch[2]);
          const afterCount = parseInt(afterMatch[2]);

          if (beforeCount !== afterCount) {
            changeDetails.push(`${partName} count: ${beforeCount} → ${afterCount}`);
            changesDetected = true;
          } else {
            changeDetails.push(`${partName} properties changed`);
            changesDetected = true;
          }
        } else {
          changeDetails.push(`${partName} structure changed`);
          changesDetected = true;
        }
      }
    }

    if (changesDetected) {
      this.logger.debug('Enhanced DOM changes detected', { changes: changeDetails });
    }

    return changesDetected;
  }

  /**
   * Special key mappings for standardized keyboard input
   */
  private readonly specialKeyMap: Record<string, string> = {
    // Navigation keys
    enter: 'Enter',
    tab: 'Tab',
    esc: 'Escape',
    escape: 'Escape',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    space: ' ',

    // Arrow keys
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',

    // Navigation
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',

    // Function keys
    f1: 'F1',
    f2: 'F2',
    f3: 'F3',
    f4: 'F4',
    f5: 'F5',
    f6: 'F6',
    f7: 'F7',
    f8: 'F8',
    f9: 'F9',
    f10: 'F10',
    f11: 'F11',
    f12: 'F12',

    // Editing keys
    insert: 'Insert',
    ins: 'Insert',
  };

  /**
   * Modifier key mappings
   */
  private readonly modifierKeyMap: Record<string, string> = {
    ctrl: 'Control',
    control: 'Control',
    shift: 'Shift',
    alt: 'Alt',
    option: 'Alt',
    cmd: 'Meta',
    command: 'Meta',
    meta: 'Meta',
    win: 'Meta',
    windows: 'Meta',
  };

  /**
   * Creates a new TypeValueHandler instance
   *
   * @param browserContext The browser context for accessing page interaction methods
   */
  constructor(private readonly browserContext: BrowserContext) {}

  /**
   * Handle a type_value RPC request
   *
   * @param request RPC request with typing parameters
   * @returns Promise resolving to an RPC response confirming the typing action
   */
  public handleTypeValue: RpcHandler = async (request: RpcRequest): Promise<RpcResponse> => {
    this.logger.debug('Received type_value request:', request);

    try {
      const { element_index, value, options = {} } = request.params || {};

      // Validate required parameters
      if (element_index === undefined || element_index === null) {
        return {
          error: {
            code: -32602,
            message: 'Missing required parameter: element_index',
          },
        };
      }

      if (typeof element_index !== 'number' || element_index < 0) {
        return {
          error: {
            code: -32602,
            message: 'element_index must be a non-negative number',
          },
        };
      }

      if (value === undefined || value === null) {
        return {
          error: {
            code: -32602,
            message: 'Missing required parameter: value',
          },
        };
      }

      // Set default options
      const finalOptions = {
        clear_first: true,
        submit: false,
        wait_after: 1,
        ...options,
      };

      // Validate options
      if (typeof finalOptions.wait_after !== 'number' || finalOptions.wait_after < 0 || finalOptions.wait_after > 30) {
        return {
          error: {
            code: -32602,
            message: 'options.wait_after must be a number between 0 and 30 seconds',
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

      // Locate the target element by index
      const elementNode = await findElementByHighlightIndex(currentPage, element_index);
      if (!elementNode) {
        // Get total element count for better error context
        const selectorMap = currentPage.getSelectorMap();
        const totalElements = selectorMap.size;

        return {
          error: {
            code: -32000,
            message: `Element with index ${element_index} not found in DOM state. Page has ${totalElements} interactive elements. Use get_dom_extra_elements tool to see available elements.`,
            data: {
              error_code: 'ELEMENT_NOT_FOUND',
              element_index,
              available_element_count: totalElements,
              suggested_action: 'Use get_dom_extra_elements tool to list available elements',
            },
          },
        };
      }

      // DOM change detection: Get snapshot before operation
      const beforeSnapshot = await this.generateDOMSnapshot();
      this.logger.debug('DOM snapshot before type_value:', { beforeSnapshot });

      // Auto-detect or use explicit keyboard mode
      const shouldUseKeyboard = this.shouldUseKeyboardMode(value);

      if (shouldUseKeyboard) {
        try {
          // Attempt keyboard mode
          this.logger.debug('Attempting keyboard mode input');
          const keyboardResult = await this.handleKeyboardInput(currentPage, elementNode!, value, finalOptions);

          // Keyboard mode succeeded
          this.logger.info('Keyboard mode succeeded');
          // Use optimized wait time
          const optimalWait = this.getOptimalWaitTime('keyboard', finalOptions.wait_after * 1000);
          await new Promise(resolve => setTimeout(resolve, optimalWait));

          // DOM change detection: Get snapshot after keyboard operation
          const afterSnapshot = await this.generateDOMSnapshot();
          this.logger.debug('DOM snapshot after keyboard operation:', { afterSnapshot });

          const domChanged =
            beforeSnapshot !== 'no_dom' &&
            afterSnapshot !== 'no_dom' &&
            beforeSnapshot !== 'snapshot_error' &&
            afterSnapshot !== 'snapshot_error' &&
            this.isDOMSignificantlyChanged(beforeSnapshot, afterSnapshot);

          if (domChanged) {
            this.logger.info('DOM change detected after keyboard operation', {
              element_index,
              beforeSnapshot: beforeSnapshot.substring(0, 100),
              afterSnapshot: afterSnapshot.substring(0, 100),
            });
          }

          return {
            result: {
              success: true,
              message: `Successfully executed keyboard input on element`,
              element_index,
              element_type: elementNode!.tagName?.toLowerCase() || 'unknown',
              input_method: 'keyboard',
              dom_changed: domChanged,
              operations_performed: keyboardResult.operationsPerformed,
              element_info: {
                tag_name: elementNode!.tagName,
                text: elementNode!.getAllTextTillNextClickableElement() || '',
                placeholder: elementNode!.attributes.placeholder || '',
                name: elementNode!.attributes.name || '',
                id: elementNode!.attributes.id || '',
                type: elementNode!.attributes.type || '',
              },
              options_used: finalOptions,
            },
          };
        } catch (keyboardError) {
          // Keyboard mode failed, automatically fall back to text mode
          this.logger.warning('Keyboard mode failed, falling back to text mode:', keyboardError);

          try {
            // Reset element state before attempting text mode
            await this.resetElementState(currentPage, elementNode!, finalOptions);

            // Execute text mode input
            const textResult = await this.handleTextModeInput(currentPage, elementNode!, value, finalOptions);
            this.logger.info('Auto-fallback to text mode succeeded');

            // Use optimized wait time
            const strategy = this.determineInputStrategy(elementNode!, value);
            const optimalWait = this.getOptimalWaitTime(strategy.elementType, finalOptions.wait_after * 1000);
            await new Promise(resolve => setTimeout(resolve, optimalWait));

            // DOM change detection: Get snapshot after text operation
            const afterSnapshot = await this.generateDOMSnapshot();
            this.logger.debug('DOM snapshot after text operation (fallback):', { afterSnapshot });

            const domChanged =
              beforeSnapshot !== 'no_dom' &&
              afterSnapshot !== 'no_dom' &&
              beforeSnapshot !== 'snapshot_error' &&
              afterSnapshot !== 'snapshot_error' &&
              this.isDOMSignificantlyChanged(beforeSnapshot, afterSnapshot);

            if (domChanged) {
              this.logger.info('DOM change detected after text operation (fallback)', {
                element_index,
                beforeSnapshot: beforeSnapshot.substring(0, 100),
                afterSnapshot: afterSnapshot.substring(0, 100),
              });
            }

            return {
              result: {
                success: true,
                message: `Keyboard mode failed, successfully set value using text mode (fallback) on ${strategy.elementType} to "${textResult.actualValue}"`,
                element_index,
                element_type: strategy.elementType,
                input_method: 'text-fallback',
                actual_value: textResult.actualValue,
                dom_changed: domChanged,
                element_info: {
                  tag_name: elementNode!.tagName,
                  text: elementNode!.getAllTextTillNextClickableElement() || '',
                  placeholder: elementNode!.attributes.placeholder || '',
                  name: elementNode!.attributes.name || '',
                  id: elementNode!.attributes.id || '',
                  type: elementNode!.attributes.type || '',
                },
                options_used: finalOptions,
              },
            };
          } catch (textError) {
            // Both modes failed
            this.logger.error('Both keyboard and text modes failed:', { keyboardError, textError });
            return {
              error: {
                code: -32603,
                message: `Both keyboard and text input modes failed. Keyboard: ${keyboardError instanceof Error ? keyboardError.message : String(keyboardError)}. Text: ${textError instanceof Error ? textError.message : String(textError)}`,
                data: {
                  error_code: 'TYPE_VALUE_ALL_MODES_FAILED',
                  keyboard_error: keyboardError instanceof Error ? keyboardError.stack : String(keyboardError),
                  text_error: textError instanceof Error ? textError.stack : String(textError),
                },
              },
            };
          }
        }
      } else {
        // Directly use text mode
        this.logger.debug('Using text mode input');
        const textResult = await this.handleTextModeInput(currentPage, elementNode!, value, finalOptions);

        const strategy = this.determineInputStrategy(elementNode!, value);
        // Use optimized wait time based on element type
        const optimalWait = this.getOptimalWaitTime(strategy.elementType, finalOptions.wait_after * 1000);
        await new Promise(resolve => setTimeout(resolve, optimalWait));

        // Handle submit option
        if (finalOptions.submit) {
          try {
            await currentPage.sendKeys('Enter');
            this.logger.debug('Form submitted after setting value');
          } catch (submitError) {
            this.logger.warning('Failed to submit form after setting value:', submitError);
          }
        }

        // DOM change detection: Get snapshot after standard operation
        const afterSnapshot = await this.generateDOMSnapshot();
        this.logger.debug('DOM snapshot after standard operation:', { afterSnapshot });

        const domChanged =
          beforeSnapshot !== 'no_dom' &&
          afterSnapshot !== 'no_dom' &&
          beforeSnapshot !== 'snapshot_error' &&
          afterSnapshot !== 'snapshot_error' &&
          this.isDOMSignificantlyChanged(beforeSnapshot, afterSnapshot);

        if (domChanged) {
          this.logger.info('DOM change detected after standard operation', {
            element_index,
            strategy: strategy.elementType,
            beforeSnapshot: beforeSnapshot.substring(0, 100),
            afterSnapshot: afterSnapshot.substring(0, 100),
          });
        }

        return {
          result: {
            success: true,
            message: `Successfully set ${strategy.elementType} to "${textResult.actualValue}" using text method`,
            element_index,
            element_type: strategy.elementType,
            input_method: 'text',
            actual_value: textResult.actualValue,
            dom_changed: domChanged,
            element_info: {
              tag_name: elementNode!.tagName,
              text: elementNode!.getAllTextTillNextClickableElement() || '',
              placeholder: elementNode!.attributes.placeholder || '',
              name: elementNode!.attributes.name || '',
              id: elementNode!.attributes.id || '',
              type: elementNode!.attributes.type || '',
            },
            options_used: finalOptions,
          },
        };
      }
    } catch (error) {
      this.logger.error('Error setting value:', error);

      let errorCode = 'TYPE_VALUE_FAILED';
      let errorMessage = 'Failed to type value';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Classify error types
        if (error.message.includes('not found')) {
          errorCode = 'ELEMENT_NOT_FOUND';
        } else if (error.message.includes('not visible')) {
          errorCode = 'ELEMENT_NOT_VISIBLE';
        } else if (error.message.includes('timeout')) {
          errorCode = 'OPERATION_TIMEOUT';
        } else if (error.message.includes('detached')) {
          errorCode = 'ELEMENT_DETACHED';
        } else if (error.message.includes('readonly')) {
          errorCode = 'ELEMENT_READONLY';
        } else if (error.message.includes('disabled')) {
          errorCode = 'ELEMENT_DISABLED';
        }
      }

      return {
        error: {
          code: -32603,
          message: errorMessage,
          data: {
            error_code: errorCode,
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      };
    }
  };

  /**
   * Reset element state, typically used before retrying with a different input mode.
   */
  private async resetElementState(page: any, elementNode: DOMElementNode, options: any): Promise<void> {
    try {
      const elementHandle = await page.locateElement(elementNode);
      if (!elementHandle) return;

      // Clear possible focus and selection states
      await elementHandle.evaluate((el: HTMLElement) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.blur(); // Remove focus
          el.focus(); // Re-focus to ensure it's ready
          if (options.clear_first) {
            // Only clear if originally requested
            el.value = ''; // Clear value
            el.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
          }
        } else if (el.isContentEditable && options.clear_first) {
          el.textContent = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      // Brief wait for state stabilization
      await new Promise(resolve => setTimeout(resolve, 100));
      this.logger.debug('Element state reset for fallback attempt');
    } catch (error) {
      this.logger.debug('Reset element state failed (non-critical for fallback):', error);
    }
  }

  /**
   * Unified handler for text mode input, used directly or as fallback.
   */
  private async handleTextModeInput(
    page: any,
    elementNode: DOMElementNode,
    value: any,
    options: any,
  ): Promise<{ actualValue: any }> {
    const strategy = this.determineInputStrategy(elementNode!, value);
    if (!strategy.canHandle) {
      // This should ideally not be reached if called as a fallback,
      // but good to have a guard.
      throw new Error(`Cannot handle element type for text input: ${strategy.elementType}`);
    }
    return await this.executeValueSetting(page, elementNode!, value, strategy, options);
  }

  /**
   * Determine if keyboard mode should be used based on smart detection.
   */
  private shouldUseKeyboardMode(value: any): boolean {
    if (typeof value === 'string') {
      // 1. Temporarily replace escaped braces to avoid misinterpretation
      const escaped = value.replace(/\\{/g, '§LEFTBRACE§').replace(/\\}/g, '§RIGHTBRACE§');

      // 2. Search for unescaped curly brace patterns
      const keyPattern = /{([^}]+)}/g;
      const matches = [];
      let match;
      while ((match = keyPattern.exec(escaped)) !== null) {
        matches.push(match[1].trim());
      }

      if (matches.length === 0) {
        return false; // No patterns found
      }

      // 3. Validate if any found pattern is a true special key
      const hasValidKeys = matches.some(keyContent => this.isValidSpecialKey(keyContent));

      this.logger.debug('Smart keyboard mode detection:', {
        originalValue: value.substring(0, 50), // Log snippet of original value
        processedValue: escaped.substring(0, 50), // Log snippet of processed value
        foundPatterns: matches,
        hasValidSpecialKeys: hasValidKeys,
        hasEscapes: value.includes('\\{') || value.includes('\\}'),
      });
      return hasValidKeys;
    }
    return false;
  }

  /**
   * Parse keyboard input into operations, handling escaped braces and filtering invalid keys.
   */
  private parseKeyboardInput(value: string): KeyboardOperation[] {
    const operations: KeyboardOperation[] = [];
    let currentText = '';

    // 1. Temporarily replace escaped braces
    const escaped = value.replace(/\\{/g, '§LEFTBRACE§').replace(/\\}/g, '§RIGHTBRACE§');

    const keyPattern = /{([^}]+)}/g;
    let lastIndex = 0;
    let match;

    while ((match = keyPattern.exec(escaped)) !== null) {
      // Add text before this potential special key
      if (match.index > lastIndex) {
        currentText += escaped.substring(lastIndex, match.index);
      }

      // Process accumulated text (if any)
      if (currentText.length > 0) {
        operations.push({ type: 'text', content: this.restoreEscapedBraces(currentText) });
        currentText = '';
      }

      // Process the content within braces
      const keyCommand = match[1].trim();
      if (this.isValidSpecialKey(keyCommand)) {
        // It's a valid special key or combination
        if (this.isModifierCombination(keyCommand)) {
          operations.push(this.parseModifierCombination(keyCommand));
        } else {
          operations.push({
            type: 'specialKey',
            key: this.mapSpecialKey(keyCommand),
          });
        }
      } else {
        // Not a valid special key, treat {keyCommand} as literal text
        // We need to restore §LEFTBRACE§ and §RIGHTBRACE§ if they were part of the original keyCommand
        currentText += this.restoreEscapedBraces(`{${keyCommand}}`);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last pattern
    if (lastIndex < escaped.length) {
      currentText += escaped.substring(lastIndex);
    }

    if (currentText.length > 0) {
      operations.push({ type: 'text', content: this.restoreEscapedBraces(currentText) });
    }

    this.logger.debug('Parsed keyboard operations:', { operations });
    return operations;
  }

  /**
   * Check if a key command is a modifier combination (e.g., Ctrl+A)
   */
  private isModifierCombination(keyCommand: string): boolean {
    // Check for the + character but not at the beginning or end
    return /^.+\+.+$/.test(keyCommand);
  }

  /**
   * Parse a modifier combination into modifiers and key
   */
  private parseModifierCombination(keyCommand: string): KeyboardOperation {
    const parts = keyCommand.split('+').map(part => part.trim());
    const key = parts.pop() || '';
    const modifiers = parts.map(mod => this.mapModifierKey(mod));

    return {
      type: 'modifierCombination',
      key: this.mapSpecialKey(key), // Ensure the main key is also mapped if it's a special key itself
      modifiers,
    };
  }

  /**
   * Map special key name to actual key input
   */
  private mapSpecialKey(keyName: string): string {
    const normalized = keyName.trim().toLowerCase();
    return this.specialKeyMap[normalized] || keyName; // Return original if not in map (e.g. 'A' in Ctrl+A)
  }

  /**
   * Map modifier key name to actual modifier name
   */
  private mapModifierKey(modifierName: string): string {
    const normalized = modifierName.trim().toLowerCase();
    return this.modifierKeyMap[normalized] || modifierName;
  }

  /**
   * Execute keyboard operations on an element or page
   */
  private async handleKeyboardInput(
    page: any,
    elementNode: DOMElementNode,
    value: string,
    options: any,
  ): Promise<{ operationsPerformed: any[] }> {
    // Get element handle
    const elementHandle = await page.locateElement(elementNode);
    if (!elementHandle) {
      throw new Error(`Element could not be located on the page`);
    }

    // Focus the element first
    await elementHandle.focus();

    // Clear content if requested and element supports it
    if (options.clear_first) {
      const canClear = await elementHandle.evaluate((el: HTMLElement) => {
        return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable;
      });

      if (canClear) {
        await elementHandle.evaluate((el: HTMLElement) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = '';
          } else if (el.isContentEditable) {
            el.textContent = '';
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    }

    // Parse keyboard operations
    const operations = this.parseKeyboardInput(value);
    const operationsPerformed = [];

    // Execute each operation
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'text':
            if (op.content && op.content.length > 0) {
              await page._puppeteerPage.keyboard.type(op.content);
              operationsPerformed.push({ type: 'text', content: op.content });
            }
            break;

          case 'specialKey':
            if (op.key) {
              await page._puppeteerPage.keyboard.press(op.key as KeyInput);
              operationsPerformed.push({ type: 'specialKey', key: op.key });
            }
            break;

          case 'modifierCombination':
            if (op.modifiers && op.modifiers.length > 0 && op.key) {
              // Press all modifiers
              for (const modifier of op.modifiers) {
                await page._puppeteerPage.keyboard.down(modifier as KeyInput);
              }

              // Press and release the main key
              await page._puppeteerPage.keyboard.press(op.key as KeyInput);

              // Release all modifiers in reverse order
              for (const modifier of [...op.modifiers].reverse()) {
                await page._puppeteerPage.keyboard.up(modifier as KeyInput);
              }

              operationsPerformed.push({
                type: 'modifierCombination',
                modifiers: op.modifiers,
                key: op.key,
              });
            }
            break;
        }

        // Small delay between operations for stability
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        this.logger.error(`Error executing keyboard operation: ${JSON.stringify(op)}`, error);
        throw new Error(`Keyboard operation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Wait for page stability
    await page.waitForPageAndFramesLoad();

    return { operationsPerformed };
  }

  /**
   * Calculate optimized operation timeout based on input parameters
   */
  private calculateOperationTimeout(timeout: string | number, value: any, elementType: string, page: any): number {
    // Handle explicit timeout values
    if (timeout !== 'auto') {
      const numericTimeout = typeof timeout === 'number' ? timeout : parseInt(timeout as string);
      if (!isNaN(numericTimeout)) {
        return Math.min(Math.max(numericTimeout, 5000), 590000); // 5s - 590s range (leave 10s for buffer)
      }
    }

    // Auto mode: optimized intelligent timeout calculation
    const baseTimeout = 12000; // Enhanced base timeout to 12 seconds

    // Calculate text length impact
    const textLength = String(value).length;
    let lengthFactor = 0;

    if (textLength <= 100) {
      lengthFactor = 0; // Short text doesn't add time
    } else if (textLength <= 500) {
      lengthFactor = Math.ceil((textLength - 100) / 40) * 1000; // Every 40 chars adds 1 second
    } else if (textLength <= 1000) {
      lengthFactor = 10000 + Math.ceil((textLength - 500) / 30) * 1000; // 10s + every 30 chars adds 1s
    } else {
      lengthFactor = 26000 + Math.ceil((textLength - 1000) / 25) * 1000; // 26s + every 25 chars adds 1s
    }

    // Page complexity calculation - more precise assessment
    const selectorMap = page.getSelectorMap();
    const elementCount = selectorMap.size;
    let pageComplexity = 1.0;

    if (elementCount > 30) pageComplexity = 1.2;
    if (elementCount > 60) pageComplexity = 1.4;
    if (elementCount > 100) pageComplexity = 1.6;
    if (elementCount > 150) pageComplexity = 1.8;

    // Element type impact factors - more conservative settings
    const typeFactors: Record<string, number> = {
      contenteditable: 2.2, // GitHub Issue editors and other rich text
      textarea: 1.5, // Multi-line text areas
      'text-input': 1.0, // Regular input fields
      select: 0.8, // Dropdowns
      'multi-select': 1.0,
      checkbox: 0.5,
      radio: 0.5,
      keyboard: 1.8, // Keyboard operations typically need more time
    };

    const typeFactor = typeFactors[elementType] || 1.0;

    // Final calculation
    const calculatedTimeout = (baseTimeout + lengthFactor) * typeFactor * pageComplexity;

    // Ensure reasonable bounds (12s - 590s)
    const finalTimeout = Math.min(Math.max(calculatedTimeout, 12000), 590000);

    this.logger.debug('Optimized timeout calculation:', {
      textLength,
      elementType,
      pageComplexity,
      elementCount,
      baseTimeout,
      lengthFactor,
      typeFactor,
      calculatedTimeout,
      finalTimeout,
    });

    return finalTimeout;
  }

  /**
   * Get optimal wait time based on element type
   */
  private getOptimalWaitTime(elementType: string, baseWait: number): number {
    const multipliers = {
      'text-input': 0.5, // Text input is faster
      select: 1.5, // Dropdown selection needs more time
      checkbox: 0.3, // Checkbox is very fast
      radio: 0.3, // Radio button is very fast
      textarea: 0.8, // Textarea is medium speed
      keyboard: 1.2, // Keyboard operations need more time
    } as any;

    return Math.min(baseWait * (multipliers[elementType] || 1), 3000); // Maximum 3 seconds
  }

  /**
   * Determine the appropriate input strategy for the element and value
   */
  private determineInputStrategy(element: DOMElementNode, value: any): InputStrategy {
    const tagName = element.tagName?.toLowerCase() || '';
    const inputType = element.attributes.type?.toLowerCase() || 'text';

    // Handle select elements
    if (tagName === 'select') {
      const isMultiple = element.attributes.multiple !== undefined;
      return {
        elementType: isMultiple ? 'multi-select' : 'select',
        method: isMultiple ? 'multi-select' : 'single-select',
        canHandle: true,
      };
    }

    // Handle input elements
    if (tagName === 'input') {
      switch (inputType) {
        case 'checkbox':
          return {
            elementType: 'checkbox',
            method: 'toggle',
            canHandle: true,
          };
        case 'radio':
          return {
            elementType: 'radio',
            method: 'toggle',
            canHandle: true,
          };
        case 'file':
          return {
            elementType: 'file',
            method: 'upload',
            canHandle: false, // Not implemented in this version
          };
        case 'text':
        case 'password':
        case 'email':
        case 'tel':
        case 'url':
        case 'search':
        case 'number':
        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
        default:
          return {
            elementType: 'text-input',
            method: 'type',
            canHandle: true,
          };
      }
    }

    // Handle textarea
    if (tagName === 'textarea') {
      return {
        elementType: 'textarea',
        method: 'type',
        canHandle: true,
      };
    }

    // Handle contenteditable elements
    if (element.attributes.contenteditable === 'true') {
      return {
        elementType: 'contenteditable',
        method: 'type',
        canHandle: true,
      };
    }

    // Unsupported element type
    return {
      elementType: tagName,
      method: 'unknown',
      canHandle: false,
    };
  }

  /**
   * Execute the value setting operation based on strategy
   */
  private async executeValueSetting(
    page: any,
    elementNode: DOMElementNode,
    value: any,
    strategy: InputStrategy,
    options: any,
  ): Promise<{ actualValue: any }> {
    const elementHandle = await page.locateElement(elementNode);
    if (!elementHandle) {
      throw new Error(`Element could not be located on the page`);
    }

    // Check if element is visible and interactive
    const isInteractable = await elementHandle.evaluate((el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        !el.hasAttribute('disabled') &&
        !el.hasAttribute('readonly')
      );
    });

    if (!isInteractable) {
      throw new Error(`Element is not visible or interactive`);
    }

    // Scroll element into view
    await elementHandle.evaluate((el: Element) => {
      el.scrollIntoView({
        behavior: 'instant',
        block: 'center',
        inline: 'center',
      });
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Execute strategy-specific value setting
    switch (strategy.method) {
      case 'type':
        return await this.handleTextInput(elementHandle, value, options);

      case 'single-select':
        return await this.handleSingleSelect(elementHandle, value);

      case 'multi-select':
        return await this.handleMultiSelect(elementHandle, value);

      case 'toggle':
        return await this.handleToggle(elementHandle, value, strategy.elementType);

      default:
        throw new Error(`Unsupported input method: ${strategy.method}`);
    }
  }

  /**
   * Handle text input (input, textarea, contenteditable) with progressive typing for long text
   */
  private async handleTextInput(elementHandle: any, value: any, options: any): Promise<{ actualValue: string }> {
    const stringValue = String(value);

    // Clear existing content if requested
    if (options.clear_first) {
      await elementHandle.evaluate((el: HTMLInputElement | HTMLTextAreaElement | HTMLElement) => {
        if ('value' in el) {
          el.value = '';
        } else if ((el as HTMLElement).isContentEditable) {
          (el as HTMLElement).textContent = '';
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // Use progressive typing for long text (> 100 characters)
    if (stringValue.length > 100) {
      await this.handleLongTextInput(elementHandle, stringValue);
    } else {
      // Standard typing for short text
      await elementHandle.type(stringValue, { delay: 50 });
    }

    // Trigger change event
    await elementHandle.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Simple verification: check if value was set successfully
    try {
      const actualValue = await elementHandle.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => {
        if ('value' in el) {
          return el.value;
        } else if ((el as HTMLElement).isContentEditable) {
          return (el as HTMLElement).textContent || '';
        }
        return '';
      });

      if (actualValue === stringValue) {
        // Success, no need for additional waiting
        this.logger.debug('Text input value verified successfully');
      }
    } catch (e) {
      // Verification failed, continue with normal flow
      this.logger.debug('Text input verification failed, continuing normally');
    }

    return { actualValue: stringValue };
  }

  /**
   * Handle long text input with optimized progressive typing strategy
   */
  private async handleLongTextInput(elementHandle: any, value: string): Promise<void> {
    // Optimized parameters for better reliability
    const CHUNK_SIZE = 80; // Reduced from 100 to 80 for better stability
    const CHUNK_DELAY = 250; // Increased from 200 to 250ms for better processing
    const INPUT_EVENT_INTERVAL = 3; // Trigger input event every 3 chunks

    this.logger.debug(
      `Optimized long text input (${value.length} chars) with ${Math.ceil(value.length / CHUNK_SIZE)} chunks`,
    );

    // Process text in chunks with optimized timing
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      const chunk = value.substring(i, Math.min(i + CHUNK_SIZE, value.length));
      const chunkIndex = Math.floor(i / CHUNK_SIZE);

      try {
        // Type chunk with optimized character delay
        await elementHandle.type(chunk, { delay: 35 }); // Increased from 30 to 35ms

        // Periodically trigger input event to maintain page responsiveness
        if (chunkIndex % INPUT_EVENT_INTERVAL === 0) {
          await elementHandle.evaluate((el: HTMLElement) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
          });
        }

        // Adaptive delay between chunks based on chunk size and position
        if (i + CHUNK_SIZE < value.length) {
          let adaptiveDelay = CHUNK_DELAY;

          // Later chunks need more time for page processing
          if (i > value.length * 0.5) {
            adaptiveDelay = Math.min(CHUNK_DELAY * 1.2, 400);
          }

          await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }

        this.logger.debug(`Processed chunk ${chunkIndex + 1}/${Math.ceil(value.length / CHUNK_SIZE)}`);
      } catch (chunkError) {
        this.logger.warning(`Error in chunk ${chunkIndex}, retrying once...`, chunkError);

        // Single retry for current chunk
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          await elementHandle.type(chunk, { delay: 50 }); // Slower retry
        } catch (retryError) {
          this.logger.error(`Failed to process chunk ${chunkIndex} after retry`, retryError);
          throw retryError;
        }
      }
    }

    // Final event dispatch to ensure all events are triggered
    await elementHandle.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    this.logger.debug('Optimized progressive text input completed');
  }

  /**
   * Handle single select dropdown with improved error messages
   */
  private async handleSingleSelect(elementHandle: any, value: any): Promise<{ actualValue: string }> {
    const stringValue = String(value);

    const result = await elementHandle.evaluate((select: HTMLSelectElement, optionText: string) => {
      const options = Array.from(select.options);
      const option = options.find(opt => opt.text.trim() === optionText || opt.value === optionText);

      if (!option) {
        const availableOptions = options
          .slice(0, 5)
          .map(o => o.text.trim())
          .join('", "');
        const totalCount = options.length;
        const moreText = totalCount > 5 ? ` (and ${totalCount - 5} more)` : '';

        throw new Error(`Option "${optionText}" not found. Available options: "${availableOptions}"${moreText}`);
      }

      const previousValue = select.value;
      select.value = option.value;

      // Only dispatch events if value changed
      if (previousValue !== option.value) {
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
      }

      return option.text.trim();
    }, stringValue);

    return { actualValue: result };
  }

  /**
   * Handle multi-select dropdown with improved error messages
   */
  private async handleMultiSelect(elementHandle: any, value: any): Promise<{ actualValue: string[] }> {
    const values = Array.isArray(value) ? value.map(String) : [String(value)];

    const result = await elementHandle.evaluate((select: HTMLSelectElement, optionTexts: string[]) => {
      const options = Array.from(select.options);
      const selectedValues: string[] = [];

      // Clear all selections first
      options.forEach(option => {
        option.selected = false;
      });

      // Select matching options
      for (const optionText of optionTexts) {
        const option = options.find(opt => opt.text.trim() === optionText || opt.value === optionText);
        if (option) {
          option.selected = true;
          selectedValues.push(option.text.trim());
        }
      }

      if (selectedValues.length === 0) {
        const availableOptions = options
          .slice(0, 5)
          .map(o => o.text.trim())
          .join('", "');
        const totalCount = options.length;
        const moreText = totalCount > 5 ? ` (and ${totalCount - 5} more)` : '';

        throw new Error(`No matching options found. Available options: "${availableOptions}"${moreText}`);
      }

      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));

      return selectedValues;
    }, values);

    return { actualValue: result };
  }

  /**
   * Handle checkbox and radio button toggling with success verification
   */
  private async handleToggle(elementHandle: any, value: any, elementType: string): Promise<{ actualValue: boolean }> {
    const shouldCheck = Boolean(value);

    const result = await elementHandle.evaluate(
      (input: HTMLInputElement, targetState: boolean, type: string) => {
        const currentState = input.checked;

        // For radio buttons, we can only check them (not uncheck)
        if (type === 'radio' && !targetState) {
          throw new Error('Cannot uncheck a radio button - use another radio button in the same group');
        }

        // Only change if different from current state
        if (currentState !== targetState) {
          input.checked = targetState;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return input.checked;
      },
      shouldCheck,
      elementType,
    );

    return { actualValue: result };
  }
}
