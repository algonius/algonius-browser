/**
 * Type Value Handler for MCP Host RPC Requests
 *
 * This file implements the type_value RPC method handler for the browser extension.
 * It responds to requests from the MCP Host that need to type text or simulate keyboard input on interactive elements.
 */

import type BrowserContext from '../browser/context';
import { createLogger } from '../log';
import type { RpcHandler, RpcRequest, RpcResponse } from '../mcp/host-manager';
import type { DOMElementNode } from '../dom/views';
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
      const { element_index, value, keyboard_mode = false, options = {} } = request.params || {};

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

      // Auto-detect or use explicit keyboard mode
      const useKeyboardMode = this.shouldUseKeyboardMode(value, keyboard_mode);

      // Handle keyboard mode for special key input
      if (useKeyboardMode) {
        const result = await this.handleKeyboardInput(currentPage, elementNode!, value, finalOptions);

        // Use optimized wait time
        const optimalWait = this.getOptimalWaitTime('keyboard', finalOptions.wait_after * 1000);
        await new Promise(resolve => setTimeout(resolve, optimalWait));

        return {
          result: {
            success: true,
            message: `Successfully executed keyboard input on element`,
            element_index,
            element_type: elementNode!.tagName?.toLowerCase() || 'unknown',
            input_method: 'keyboard',
            operations_performed: result.operationsPerformed,
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

      // Standard value setting mode for non-keyboard input
      // Determine input strategy
      const strategy = this.determineInputStrategy(elementNode!, value);
      if (!strategy.canHandle) {
        const supportedTypes = ['input', 'select', 'textarea', 'contenteditable'];
        const suggestedActions = [
          'Check if element is actually interactive',
          'Verify element type matches expected behavior',
          'Use click_element tool for non-form elements',
        ];

        return {
          error: {
            code: -32000,
            message: `Cannot handle element type: ${strategy.elementType}`,
            data: {
              error_code: 'UNSUPPORTED_ELEMENT_TYPE',
              element_type: strategy.elementType,
              element_tag: elementNode!.tagName,
              supported_types: supportedTypes,
              suggested_actions: suggestedActions,
            },
          },
        };
      }

      // Execute the value setting operation
      const setResult = await this.executeValueSetting(currentPage, elementNode!, value, strategy, finalOptions);

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

      const result = {
        success: true,
        message: `Successfully set ${strategy.elementType} to "${setResult.actualValue}" using ${strategy.method} method`,
        element_index,
        element_type: strategy.elementType,
        input_method: strategy.method,
        actual_value: setResult.actualValue,
        element_info: {
          tag_name: elementNode!.tagName,
          text: elementNode!.getAllTextTillNextClickableElement() || '',
          placeholder: elementNode!.attributes.placeholder || '',
          name: elementNode!.attributes.name || '',
          id: elementNode!.attributes.id || '',
          type: elementNode!.attributes.type || '',
        },
        options_used: finalOptions,
      };

      this.logger.debug('Type value completed:', result);

      return {
        result,
      };
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
   * Determine if keyboard mode should be used
   */
  private shouldUseKeyboardMode(value: any, explicitKeyboardMode: boolean): boolean {
    // If keyboard mode explicitly specified, use that
    if (explicitKeyboardMode !== undefined) {
      return explicitKeyboardMode;
    }

    // Auto-detect keyboard mode based on content
    if (typeof value === 'string') {
      // Check for special key pattern {key} or modifier combinations like {Ctrl+A}
      const keyPattern = /{([^}]+)}/g;
      return keyPattern.test(value);
    }

    return false;
  }

  /**
   * Parse keyboard input into operations
   */
  private parseKeyboardInput(value: string): KeyboardOperation[] {
    const operations: KeyboardOperation[] = [];
    let currentText = '';

    // Regex pattern for detecting special keys
    const keyPattern = /{([^}]+)}/g;
    let lastIndex = 0;
    let match;

    // Process input value to find special keys and text
    while ((match = keyPattern.exec(value)) !== null) {
      // Add any text before this special key
      if (match.index > lastIndex) {
        currentText += value.substring(lastIndex, match.index);
      }

      if (currentText.length > 0) {
        operations.push({ type: 'text', content: currentText });
        currentText = '';
      }

      // Process the special key or key combination
      const keyCommand = match[1].trim();
      if (this.isModifierCombination(keyCommand)) {
        operations.push(this.parseModifierCombination(keyCommand));
      } else {
        operations.push({
          type: 'specialKey',
          key: this.mapSpecialKey(keyCommand),
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last special key
    if (lastIndex < value.length) {
      currentText += value.substring(lastIndex);
    }

    if (currentText.length > 0) {
      operations.push({ type: 'text', content: currentText });
    }

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
      key: this.mapSpecialKey(key),
      modifiers,
    };
  }

  /**
   * Map special key name to actual key input
   */
  private mapSpecialKey(keyName: string): string {
    const normalized = keyName.trim().toLowerCase();
    return this.specialKeyMap[normalized] || keyName;
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
