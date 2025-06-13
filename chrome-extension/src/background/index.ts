import 'webextension-polyfill';
import BrowserContext from './browser/context';
import { createLogger } from './log';
import { McpHostManager } from './mcp/host-manager';
import {
  GetBrowserStateHandler,
  GetDomStateHandler,
  NavigateToHandler,
  ManageTabsHandler,
  TypeValueHandler,
} from './task';
import { ScrollPageHandler } from './task/scroll-page-handler';
import { ClickElementHandler } from './task/click-element-handler';

const logger = createLogger('background');

const browserContext = new BrowserContext({});

// Initialize MCP Host Manager
const mcpHostManager = new McpHostManager();

// Create handler instances with required dependencies
const navigateToHandler = new NavigateToHandler(browserContext);
const getBrowserStateHandler = new GetBrowserStateHandler(browserContext);
const getDomStateHandler = new GetDomStateHandler(browserContext);
const scrollPageHandler = new ScrollPageHandler(browserContext);
const clickElementHandler = new ClickElementHandler(browserContext);
const manageTabsHandler = new ManageTabsHandler(browserContext);
const typeValueHandler = new TypeValueHandler(browserContext);

// Register RPC method handlers
mcpHostManager.registerRpcMethod('navigate_to', navigateToHandler.handleNavigateTo.bind(navigateToHandler));
mcpHostManager.registerRpcMethod(
  'get_browser_state',
  getBrowserStateHandler.handleGetBrowserState.bind(getBrowserStateHandler),
);
mcpHostManager.registerRpcMethod('get_dom_state', getDomStateHandler.handleGetDomState.bind(getDomStateHandler));
mcpHostManager.registerRpcMethod('scroll_page', scrollPageHandler.handleScrollPage.bind(scrollPageHandler));
mcpHostManager.registerRpcMethod('click_element', clickElementHandler.handleClickElement.bind(clickElementHandler));
mcpHostManager.registerRpcMethod('manage_tabs', manageTabsHandler.handleManageTabs.bind(manageTabsHandler));
mcpHostManager.registerRpcMethod('type_value', typeValueHandler.handleTypeValue.bind(typeValueHandler));

// Function to check if script is already injected
async function isScriptInjected(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Object.prototype.hasOwnProperty.call(window, 'buildDomTree'),
    });
    return results[0]?.result || false;
  } catch (err) {
    console.error('Failed to check script injection status:', err);
    return false;
  }
}

// Function to inject the buildDomTree script
async function injectBuildDomTree(tabId: number) {
  try {
    // Check if already injected
    const alreadyInjected = await isScriptInjected(tabId);
    if (alreadyInjected) {
      console.log('Scripts already injected, skipping...');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['buildDomTree.js'],
    });
    console.log('Scripts successfully injected');
  } catch (err) {
    console.error('Failed to inject scripts:', err);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId && changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    await injectBuildDomTree(tabId);
  }
});

// Listen for debugger detached event
chrome.debugger.onDetach.addListener(async (source, reason) => {
  console.log('Debugger detached:', source, reason);
  if (reason === 'canceled_by_user') {
    if (source.tabId) {
      await browserContext.cleanup();
    }
  }
});

// Cleanup when tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
  browserContext.removeAttachedPage(tabId);
});

logger.info('background loaded');

// Listen for simple messages (e.g., from popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle MCP Host related messages
  if (message.type === 'startMcpHost') {
    // Start MCP Host process
    logger.info('Received request to start MCP Host:', message.options);

    // Use Promise-based connect method
    mcpHostManager
      .connect()
      .then(success => {
        logger.info('MCP Host connection successful:', success);
        sendResponse({ success });
      })
      .catch(error => {
        // Check if this is our structured error or a regular error
        if (error && typeof error === 'object' && 'code' in error) {
          // This is our structured McpError
          logger.error(`Failed to connect to MCP Host: [${error.code}] ${error.message}`);

          // Log additional context based on error code
          if (error.code === 'MCP_HOST_NOT_FOUND') {
            logger.error('This error indicates the MCP Host is not installed or registered correctly.');
            logger.error('Make sure the native messaging host manifest is properly installed.');
          }

          // Send the structured error back to the UI
          sendResponse({
            success: false,
            error: error, // Pass the entire error object
          });
        } else {
          // Handle legacy or unexpected errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to connect to MCP Host:', errorMessage);

          // Send the error back to the UI
          sendResponse({
            success: false,
            error: {
              code: 'MCP_UNKNOWN_ERROR',
              message: errorMessage,
            },
          });
        }

        // Log last error from Chrome runtime for debugging
        if (chrome.runtime.lastError) {
          logger.error('Chrome runtime last error:', chrome.runtime.lastError);
        }
      });

    return true; // Indicate async response
  }

  if (message.type === 'stopMcpHost') {
    // Stop MCP Host process
    logger.info('Received request to stop MCP Host');

    try {
      // Call stopMcpHost which handles graceful shutdown and disconnection internally
      mcpHostManager
        .stopMcpHost()
        .then(success => {
          logger.info('MCP Host stopped successfully:', success);
          // Status already updated by stopMcpHost internal disconnect() call
          sendResponse({ success: true });
        })
        .catch(error => {
          logger.error('Failed to stop MCP Host gracefully:', error);
          // Force disconnect only if stopMcpHost failed completely
          if (mcpHostManager.getStatus().isConnected) {
            mcpHostManager.disconnect();
            logger.info('Native connection forcefully disconnected');
          }
          sendResponse({ success: true });
        });
    } catch (error) {
      logger.error('Error initiating MCP Host stop:', error);
      // Try to disconnect only if still connected
      try {
        if (mcpHostManager.getStatus().isConnected) {
          mcpHostManager.disconnect();
          logger.info('Native connection forcefully disconnected after error');
        }
        sendResponse({ success: true });
      } catch (disconnectError) {
        logger.error('Failed to disconnect:', disconnectError);
        sendResponse({ success: false, error: String(error) });
      }
    }

    return true; // Indicate async response
  }

  if (message.type === 'getMcpHostStatus') {
    // Return current MCP Host status
    const status = mcpHostManager.getStatus();
    logger.info('Returning MCP Host status:', status);
    sendResponse({ status });
    return false; // Synchronous response
  }

  // Handle other message types if needed in the future
  return false; // Synchronous response for unhandled messages
});
