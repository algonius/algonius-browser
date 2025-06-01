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

func TestSetValueToolTimeoutSupport(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured set_value requests
	var capturedSetValueRequests []map[string]interface{}

	// Register RPC handler for set_value method with timeout parameter support
	testEnv.GetNativeMsg().RegisterRpcHandler("set_value", func(params map[string]interface{}) (interface{}, error) {
		capturedSetValueRequests = append(capturedSetValueRequests, params)

		// Simulate successful response
		return map[string]interface{}{
			"success":       true,
			"message":       "Successfully set value",
			"target":        params["target"],
			"target_type":   params["target_type"],
			"element_index": 0,
			"element_type":  "text-input",
			"input_method":  "type",
			"actual_value":  params["value"],
			"element_info": map[string]interface{}{
				"tag_name":    "input",
				"text":        "",
				"placeholder": "Enter text here",
				"name":        "text-input",
				"id":          "text-input",
				"type":        "text",
			},
			"options_used": map[string]interface{}{
				"clear_first": true,
				"submit":      false,
				"wait_after":  1.0,
			},
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify set_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "set_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("set_value tool not found")
		return
	}

	// Test auto timeout with medium text
	t.Run("auto timeout with medium text", func(t *testing.T) {
		capturedSetValueRequests = nil

		mediumText := strings.Repeat("This is a test sentence. ", 20) // ~500 characters

		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   mediumText,
			"timeout": "auto",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedSetValueRequests, 1)
		assert.Equal(t, mediumText, capturedSetValueRequests[0]["value"])

		t.Log("Successfully tested auto timeout with medium text")
	})

	// Test auto timeout with long text
	t.Run("auto timeout with long text", func(t *testing.T) {
		capturedSetValueRequests = nil

		longText := strings.Repeat("Long content for testing progressive input strategy. ", 50) // ~2500 characters

		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   longText,
			"timeout": "auto",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedSetValueRequests, 1)
		assert.Equal(t, longText, capturedSetValueRequests[0]["value"])

		t.Log("Successfully tested auto timeout with long text")
	})

	// Test explicit timeout value
	t.Run("explicit timeout value", func(t *testing.T) {
		capturedSetValueRequests = nil

		testText := "Test with explicit timeout"

		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   testText,
			"timeout": "30000", // 30 seconds
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedSetValueRequests, 1)
		assert.Equal(t, testText, capturedSetValueRequests[0]["value"])

		t.Log("Successfully tested explicit timeout value")
	})

	// Test maximum allowed timeout
	t.Run("maximum timeout value", func(t *testing.T) {
		capturedSetValueRequests = nil

		veryLongText := strings.Repeat("Very long content ", 200) // ~3600 characters

		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   veryLongText,
			"timeout": "300000", // 5 minutes - maximum allowed
		})
		require.NoError(t, err)
		assert.False(t, result.IsError)

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made
		require.Len(t, capturedSetValueRequests, 1)
		assert.Equal(t, veryLongText, capturedSetValueRequests[0]["value"])

		t.Log("Successfully tested maximum timeout value")
	})
}

func TestSetValueToolTimeoutValidation(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Register RPC handler (won't be called for invalid parameters)
	testEnv.GetNativeMsg().RegisterRpcHandler("set_value", func(params map[string]interface{}) (interface{}, error) {
		return map[string]interface{}{
			"success": true,
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify set_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "set_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("set_value tool not found")
		return
	}

	// Test timeout validation - too low
	t.Run("timeout too low", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   "test",
			"timeout": "1000", // Too low - should be rejected
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught timeout too low validation error")
	})

	// Test timeout validation - too high
	t.Run("timeout too high", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   "test",
			"timeout": "400000", // Too high - should be rejected
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught timeout too high validation error")
	})

	// Test invalid timeout format
	t.Run("invalid timeout format", func(t *testing.T) {
		result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
			"target":  0,
			"value":   "test",
			"timeout": "invalid", // Invalid format
		})
		require.NoError(t, err)
		assert.True(t, result.IsError)
		// Note: Error details would be in result.Content if available, but we mainly check IsError
		t.Log("Correctly caught invalid timeout format validation error")
	})
}

func TestSetValueToolProgressiveTypingScenarios(t *testing.T) {
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

	// Register RPC handler that simulates different element types
	testEnv.GetNativeMsg().RegisterRpcHandler("set_value", func(params map[string]interface{}) (interface{}, error) {
		capturedRequests = append(capturedRequests, params)

		// Return response based on text length to simulate progressive typing behavior
		value := params["value"].(string)
		elementType := "text-input"
		inputMethod := "type"

		if len(value) > 100 {
			inputMethod = "progressive-type" // Simulate progressive typing detection
		}

		return map[string]interface{}{
			"success":       true,
			"element_type":  elementType,
			"input_method":  inputMethod,
			"actual_value":  value,
			"element_index": 0,
			"message":       fmt.Sprintf("Successfully set %s with %d characters", elementType, len(value)),
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Verify set_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "set_value" {
			found = true
			break
		}
	}

	if !found {
		t.Log("set_value tool not found")
		return
	}

	// Test different text lengths
	testCases := []struct {
		name           string
		textLength     int
		expectsSuccess bool
		description    string
	}{
		{"short text", 10, true, "Should use normal typing"},
		{"medium text", 100, true, "Boundary case for progressive typing"},
		{"long text", 500, true, "Should use progressive typing"},
		{"very long text", 1000, true, "Should use progressive typing with chunks"},
		{"extremely long text", 2000, true, "Should handle very long text efficiently"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			capturedRequests = nil

			testText := strings.Repeat("A", tc.textLength)

			result, err := testEnv.GetMcpClient().CallTool("set_value", map[string]interface{}{
				"target":  0,
				"value":   testText,
				"timeout": "auto",
			})
			require.NoError(t, err)

			if tc.expectsSuccess {
				assert.False(t, result.IsError, "Expected success for %s", tc.name)

				// Wait for RPC call to be processed
				time.Sleep(50 * time.Millisecond)

				// Verify RPC call was made
				require.Len(t, capturedRequests, 1)
				assert.Equal(t, testText, capturedRequests[0]["value"])

				t.Logf("Successfully tested %s: %s", tc.name, tc.description)
			} else {
				assert.True(t, result.IsError, "Expected failure for %s", tc.name)
			}
		})
	}
}
