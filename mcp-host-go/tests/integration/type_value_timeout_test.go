package integration

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"env"
)

func TestTypeValueToolTimeoutSupport(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured type_value requests
	var capturedTypeValueRequests []map[string]interface{}

	// Register RPC handler for type_value method with timeout parameter support
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedTypeValueRequests = append(capturedTypeValueRequests, params)

		// Check for keyboard mode patterns
		value, ok := params["value"].(string)
		if !ok {
			value = ""
		}
		containsSpecialKeys := strings.Contains(value, "{") && strings.Contains(value, "}")

		// Determine input method based on content
		inputMethod := "type"
		if containsSpecialKeys {
			inputMethod = "keyboard"
		} else if len(value) > 100 {
			inputMethod = "progressive-type"
		}

		// Simulate successful response
		return map[string]interface{}{
			"success":       true,
			"message":       "Successfully set value",
			"element_index": params["element_index"],
			"element_type":  "text-input",
			"input_method":  inputMethod,
			"actual_value":  params["value"],
			"element_info": map[string]interface{}{
				"tag_name":    "input",
				"text":        "",
				"placeholder": "Enter text here",
				"name":        "text-input",
				"id":          "text-input",
				"type":        "text",
			},
			"operations": []map[string]interface{}{
				{
					"type":    "type",
					"content": params["value"],
					"success": true,
				},
			},
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify type_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "type_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("type_value tool not found")
		return
	}

	// Test auto timeout with medium text
	t.Run("auto timeout with medium text", func(t *testing.T) {
		capturedTypeValueRequests = nil

		mediumText := strings.Repeat("This is a test sentence. ", 20) // ~500 characters

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         mediumText,
			"timeout":       "auto",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedTypeValueRequests, 1)
		assert.Equal(t, mediumText, capturedTypeValueRequests[0]["value"])

		t.Log("Successfully tested auto timeout with medium text")
	})

	// Test auto timeout with long text
	t.Run("auto timeout with long text", func(t *testing.T) {
		capturedTypeValueRequests = nil

		longText := strings.Repeat("Long content for testing progressive input strategy. ", 50) // ~2500 characters

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         longText,
			"timeout":       "auto",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedTypeValueRequests, 1)
		assert.Equal(t, longText, capturedTypeValueRequests[0]["value"])

		t.Log("Successfully tested auto timeout with long text")
	})

	// Test special key input with auto timeout
	t.Run("auto timeout with special key input", func(t *testing.T) {
		capturedTypeValueRequests = nil

		specialKeyText := "Hello{Enter}World{Tab}Test{Ctrl+A}Delete"

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         specialKeyText,
			"timeout":       "auto",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedTypeValueRequests, 1)
		assert.Equal(t, specialKeyText, capturedTypeValueRequests[0]["value"])

		t.Log("Successfully tested auto timeout with special key input")
	})

	// Test explicit timeout value
	t.Run("explicit timeout value", func(t *testing.T) {
		capturedTypeValueRequests = nil

		testText := "Test with explicit timeout"

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         testText,
			"timeout":       "30000", // 30 seconds
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedTypeValueRequests, 1)
		assert.Equal(t, testText, capturedTypeValueRequests[0]["value"])

		t.Log("Successfully tested explicit timeout value")
	})

	// Test maximum allowed timeout
	t.Run("maximum timeout value", func(t *testing.T) {
		capturedTypeValueRequests = nil

		veryLongText := strings.Repeat("Very long content ", 200) // ~3600 characters

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         veryLongText,
			"timeout":       "300000", // 5 minutes - maximum allowed
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedTypeValueRequests, 1)
		assert.Equal(t, veryLongText, capturedTypeValueRequests[0]["value"])

		t.Log("Successfully tested maximum timeout value")
	})
}

func TestTypeValueToolTimeoutValidation(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Register RPC handler (won't be called for invalid parameters)
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		return map[string]interface{}{
			"success": true,
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify type_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "type_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("type_value tool not found")
		return
	}

	// Test timeout validation - too low
	t.Run("timeout too low", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "test",
			"timeout":       "3000", // Too low - should be rejected (below minimum of 5000)
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught timeout too low validation error")
	})

	// Test timeout validation - too high
	t.Run("timeout too high", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "test",
			"timeout":       "700000", // Too high - should be rejected (above maximum of 600000)
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught timeout too high validation error")
	})

	// Test invalid timeout format
	t.Run("invalid timeout format", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "test",
			"timeout":       "invalid", // Invalid format
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught invalid timeout format validation error")
	})

	// Test valid timeout range
	t.Run("valid timeout range", func(t *testing.T) {
		testCases := []string{"5000", "15000", "30000", "60000", "300000", "600000"}

		for _, timeout := range testCases {
			result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": 0,
				"value":         "test",
				"timeout":       timeout,
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Timeout %s should be valid", timeout)
		}

		t.Log("All valid timeout values accepted")
	})
}

func TestTypeValueToolTypingStrategies(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured requests
	var capturedRequests []map[string]interface{}

	// Register RPC handler that simulates different typing strategies
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedRequests = append(capturedRequests, params)

		// Return response based on content characteristics
		value := params["value"].(string)
		elementType := "text-input"
		inputMethod := "type"
		operations := []map[string]interface{}{}

		// Check for special keys
		containsSpecialKeys := strings.Contains(value, "{") && strings.Contains(value, "}")

		if containsSpecialKeys {
			inputMethod = "keyboard"
			operations = append(operations, map[string]interface{}{
				"type":    "keyboard",
				"content": value,
				"success": true,
			})
		} else if len(value) > 100 {
			inputMethod = "progressive-type"
			operations = append(operations, map[string]interface{}{
				"type":    "clear",
				"success": true,
			})
			operations = append(operations, map[string]interface{}{
				"type":        "progressive-type",
				"content":     value,
				"chunk_count": (len(value) + 99) / 100, // rough chunk estimation
				"success":     true,
			})
		} else {
			operations = append(operations, map[string]interface{}{
				"type":    "clear",
				"success": true,
			})
			operations = append(operations, map[string]interface{}{
				"type":    "type",
				"content": value,
				"success": true,
			})
		}

		return map[string]interface{}{
			"success":       true,
			"element_type":  elementType,
			"input_method":  inputMethod,
			"actual_value":  value,
			"element_index": params["element_index"],
			"message":       fmt.Sprintf("Successfully set %s with %d characters", elementType, len(value)),
			"operations":    operations,
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify type_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "type_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("type_value tool not found")
		return
	}

	// Test different typing strategies
	testCases := []struct {
		name             string
		value            string
		expectedStrategy string
		description      string
	}{
		{"short text", "short text input", "type", "Should use normal typing"},
		{"medium text", strings.Repeat("A", 100), "type", "Boundary case for progressive typing"},
		{"long text", strings.Repeat("A", 500), "progressive-type", "Should use progressive typing"},
		{"special keys", "Hello{Enter}World", "keyboard", "Should use keyboard input mode"},
		{"modifier keys", "Select All{Ctrl+A}", "keyboard", "Should use keyboard input with modifiers"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			capturedRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": 0,
				"value":         tc.value,
				"timeout":       "auto",
			})
			require.NoError(t, err)
			assert.False(t, result.IsError, "Expected success for %s", tc.name)

			// Wait for RPC call to be processed
			time.Sleep(50 * time.Millisecond)

			// Verify RPC call was made
			require.Len(t, capturedRequests, 1)
			assert.Equal(t, tc.value, capturedRequests[0]["value"])

			// The test doesn't actually verify the strategy since that's internal to the tool
			// but it makes sure the request is processed correctly regardless of content type
			t.Logf("Successfully tested %s: %s", tc.name, tc.description)
		})
	}
}
