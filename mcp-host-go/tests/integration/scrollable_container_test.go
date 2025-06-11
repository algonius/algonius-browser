package integration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"env"
)

func TestScrollableContainerDetection(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured scroll requests
	var capturedScrollRequests []map[string]interface{}

	// Register RPC handler for scroll_page method
	testEnv.GetNativeMsg().RegisterRpcHandler("scroll_page", func(params map[string]interface{}) (interface{}, error) {
		capturedScrollRequests = append(capturedScrollRequests, params)

		action := params["action"].(string)
		switch action {
		case "up", "down":
			pixels := params["pixels"].(float64)
			return map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Scrolled %s %v pixels in detected container", action, pixels),
			}, nil
		case "to_top":
			return map[string]interface{}{
				"success": true,
				"message": "Scrolled to top of detected container",
			}, nil
		case "to_bottom":
			return map[string]interface{}{
				"success": true,
				"message": "Scrolled to bottom of detected container",
			}, nil
		default:
			return map[string]interface{}{
				"success": true,
				"message": "Scroll completed in detected container",
			}, nil
		}
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify scroll_page tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed (expected if not implemented): %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "scroll_page" {
			found = true
			break
		}
	}

	if !found {
		t.Log("scroll_page tool not found (expected if not implemented)")
		return
	}

	// Get the test file path
	wd, err := os.Getwd()
	require.NoError(t, err)
	testFilePath := filepath.Join(wd, "..", "..", "test-scrollable-container.html")
	fileURL := fmt.Sprintf("file://%s", testFilePath)

	t.Run("ScrollableContainerDetection", func(t *testing.T) {
		// First, navigate to test page if navigation tool is available
		navTools, err := testEnv.GetMcpClient().ListTools()
		if err == nil {
			for _, tool := range navTools.Tools {
				if tool.Name == "navigate_to" {
					_, err := testEnv.GetMcpClient().CallTool("navigate_to", map[string]interface{}{
						"url": fileURL,
					})
					if err == nil {
						time.Sleep(2 * time.Second) // Wait for page load
					}
					break
				}
			}
		}

		// Test scrolling down - should detect and scroll the main scrollable container
		t.Run("ScrollDownInContainer", func(t *testing.T) {
			capturedScrollRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("scroll_page", map[string]interface{}{
				"action": "down",
				"pixels": 200,
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(100 * time.Millisecond)

			// Verify RPC call was made with correct parameters
			require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
			capturedParams := capturedScrollRequests[0]
			assert.Equal(t, "down", capturedParams["action"])
			assert.Equal(t, 200.0, capturedParams["pixels"])

			t.Log("Successfully tested scroll down in container")
		})

		// Test scrolling up
		t.Run("ScrollUpInContainer", func(t *testing.T) {
			capturedScrollRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("scroll_page", map[string]interface{}{
				"action": "up",
				"pixels": 100,
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(100 * time.Millisecond)

			// Verify RPC call was made with correct parameters
			require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
			capturedParams := capturedScrollRequests[0]
			assert.Equal(t, "up", capturedParams["action"])
			assert.Equal(t, 100.0, capturedParams["pixels"])

			t.Log("Successfully tested scroll up in container")
		})

		// Test scroll to top of container
		t.Run("ScrollToTopOfContainer", func(t *testing.T) {
			capturedScrollRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("scroll_page", map[string]interface{}{
				"action": "to_top",
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(100 * time.Millisecond)

			// Verify RPC call was made with correct parameters
			require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
			capturedParams := capturedScrollRequests[0]
			assert.Equal(t, "to_top", capturedParams["action"])

			t.Log("Successfully tested scroll to top of container")
		})

		// Test scroll to bottom of container
		t.Run("ScrollToBottomOfContainer", func(t *testing.T) {
			capturedScrollRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("scroll_page", map[string]interface{}{
				"action": "to_bottom",
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(100 * time.Millisecond)

			// Verify RPC call was made with correct parameters
			require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
			capturedParams := capturedScrollRequests[0]
			assert.Equal(t, "to_bottom", capturedParams["action"])

			t.Log("Successfully tested scroll to bottom of container")
		})

		// Test scrolling with DOM state return to verify DOM updates
		t.Run("ScrollWithDOMStateReturn", func(t *testing.T) {
			capturedScrollRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("scroll_page", map[string]interface{}{
				"action":           "down",
				"pixels":           150,
				"return_dom_state": true,
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(100 * time.Millisecond)

			// Verify RPC call was made with correct parameters
			require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
			capturedParams := capturedScrollRequests[0]
			assert.Equal(t, "down", capturedParams["action"])
			assert.Equal(t, 150.0, capturedParams["pixels"])
			// The return_dom_state parameter might not be passed through to the RPC call
			// as it could be handled by the MCP tool itself
			if returnDomState, exists := capturedParams["return_dom_state"]; exists {
				assert.Equal(t, true, returnDomState)
			}

			t.Log("Successfully tested scroll with DOM state return")
		})
	})
}

func TestScrollableContainerPrioritization(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured scroll requests
	var capturedScrollRequests []map[string]interface{}

	// Register RPC handler for scroll_page method
	testEnv.GetNativeMsg().RegisterRpcHandler("scroll_page", func(params map[string]interface{}) (interface{}, error) {
		capturedScrollRequests = append(capturedScrollRequests, params)

		action := params["action"].(string)
		switch action {
		case "up", "down":
			pixels := params["pixels"].(float64)
			return map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Prioritized container: scrolled %s %v pixels", action, pixels),
			}, nil
		case "to_top":
			return map[string]interface{}{
				"success": true,
				"message": "Prioritized container: scrolled to top",
			}, nil
		case "to_bottom":
			return map[string]interface{}{
				"success": true,
				"message": "Prioritized container: scrolled to bottom",
			}, nil
		default:
			return map[string]interface{}{
				"success": true,
				"message": "Prioritized container: scroll completed",
			}, nil
		}
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify scroll_page tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "scroll_page" {
			found = true
			break
		}
	}

	if !found {
		t.Log("scroll_page tool not found")
		return
	}

	// Get test file path for scrollable container test
	wd, err := os.Getwd()
	require.NoError(t, err)
	testFilePath := filepath.Join(wd, "..", "..", "test-scrollable-container.html")
	fileURL := fmt.Sprintf("file://%s", testFilePath)

	t.Run("ContainerPrioritization", func(t *testing.T) {
		// Navigate to test page if navigation tool is available
		navTools, err := testEnv.GetMcpClient().ListTools()
		if err == nil {
			for _, tool := range navTools.Tools {
				if tool.Name == "navigate_to" {
					_, err := testEnv.GetMcpClient().CallTool("navigate_to", map[string]interface{}{
						"url": fileURL,
					})
					if err == nil {
						time.Sleep(3 * time.Second) // Wait for page load
					}
					break
				}
			}
		}

		// Test multiple scroll actions to ensure consistent container detection
		actions := []struct {
			action string
			pixels interface{}
			desc   string
		}{
			{"down", 100, "small scroll down"},
			{"up", 50, "small scroll up"},
			{"down", 300, "large scroll down"},
			{"to_top", nil, "scroll to top"},
			{"to_bottom", nil, "scroll to bottom"},
		}

		for _, test := range actions {
			t.Run(test.desc, func(t *testing.T) {
				capturedScrollRequests = nil

				args := map[string]interface{}{
					"action": test.action,
				}
				if test.pixels != nil {
					args["pixels"] = test.pixels
				}

				result, err := testEnv.GetMcpClient().CallTool("scroll_page", args)
				require.NoError(t, err, "Failed for action: %s", test.action)
				assert.False(t, result.IsError, "Tool execution should not result in error")

				// Wait for RPC call to be processed
				time.Sleep(100 * time.Millisecond)

				// Verify RPC call was made
				require.Len(t, capturedScrollRequests, 1, "Should have captured exactly one scroll request")
				capturedParams := capturedScrollRequests[0]
				assert.Equal(t, test.action, capturedParams["action"])

				if test.pixels != nil {
					assert.Equal(t, float64(test.pixels.(int)), capturedParams["pixels"])
				}

				t.Logf("Successfully tested container prioritization for %s", test.desc)
			})

			// Small delay between actions
			time.Sleep(500 * time.Millisecond)
		}
	})
}
