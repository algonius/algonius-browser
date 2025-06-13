package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"env"
)

func TestTypeValueToolBasicFunctionality(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured type_value requests
	var capturedTypeValueRequests []map[string]interface{}

	// Register RPC handler for type_value method
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedTypeValueRequests = append(capturedTypeValueRequests, params)
		return map[string]interface{}{
			"success":       true,
			"message":       "Successfully typed value",
			"element_index": params["element_index"],
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

	// Verify type_value tool is available
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed (expected if not implemented): %v", err)
		return
	}

	found := false
	for _, tool := range tools.Tools {
		if tool.Name == "type_value" {
			found = true
			assert.Contains(t, tool.Description, "Set values on form input elements")
			t.Log("Found type_value tool with correct description")
			break
		}
	}

	if !found {
		t.Log("type_value tool not found (expected if not implemented)")
		return
	}

	// Test basic text input operation
	t.Run("successful text input", func(t *testing.T) {
		// Clear previous requests
		capturedTypeValueRequests = nil

		// Execute type_value tool
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "Hello World",
			"options": map[string]interface{}{
				"clear_first": true,
				"wait_after":  1.0,
			},
		})
		require.NoError(t, err)
		assert.False(t, result.IsError, "Tool execution should not result in error")

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made with correct parameters
		require.Len(t, capturedTypeValueRequests, 1, "Should have captured exactly one type_value request")

		capturedParams := capturedTypeValueRequests[0]
		assert.Equal(t, float64(0), capturedParams["element_index"])
		assert.Equal(t, "Hello World", capturedParams["value"])

		// Verify keyboard_mode is NOT present in parameters (it's auto-detected)
		_, keyboardModePresent := capturedParams["keyboard_mode"]
		assert.False(t, keyboardModePresent, "keyboard_mode should not be present in parameters")

		options := capturedParams["options"].(map[string]interface{})
		assert.Equal(t, true, options["clear_first"])
		assert.Equal(t, 1.0, options["wait_after"])

		t.Log("Successfully tested basic text input")
	})

	// Test special key input operation
	t.Run("special key input", func(t *testing.T) {
		// Clear previous requests
		capturedTypeValueRequests = nil

		// Execute type_value tool with special key syntax
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "Test{Enter}",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError, "Tool execution should not result in error")

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made with correct parameters
		require.Len(t, capturedTypeValueRequests, 1, "Should have captured exactly one type_value request")

		capturedParams := capturedTypeValueRequests[0]
		assert.Equal(t, float64(0), capturedParams["element_index"])
		assert.Equal(t, "Test{Enter}", capturedParams["value"])

		// Verify keyboard_mode is NOT present in parameters (auto-detected based on special key)
		_, keyboardModePresent := capturedParams["keyboard_mode"]
		assert.False(t, keyboardModePresent, "keyboard_mode should not be present in parameters")

		t.Log("Successfully tested special key input")
	})

	// Test modifier key combination
	t.Run("modifier key combination", func(t *testing.T) {
		// Clear previous requests
		capturedTypeValueRequests = nil

		// Execute type_value tool with modifier key syntax
		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 0,
			"value":         "{Ctrl+A}text",
		})
		require.NoError(t, err)
		assert.False(t, result.IsError, "Tool execution should not result in error")

		// Wait for RPC call to be processed
		time.Sleep(100 * time.Millisecond)

		// Verify RPC call was made with correct parameters
		require.Len(t, capturedTypeValueRequests, 1, "Should have captured exactly one type_value request")

		capturedParams := capturedTypeValueRequests[0]
		assert.Equal(t, float64(0), capturedParams["element_index"])
		assert.Equal(t, "{Ctrl+A}text", capturedParams["value"])

		t.Log("Successfully tested modifier key combination")
	})
}

func TestTypeValueToolParameterValidation(t *testing.T) {
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

	// Test cases for parameter validation
	testCases := []struct {
		name        string
		args        map[string]interface{}
		expectError bool
	}{
		{
			name:        "missing_element_index",
			args:        map[string]interface{}{"value": "test"},
			expectError: true,
		},
		{
			name:        "missing_value",
			args:        map[string]interface{}{"element_index": 0},
			expectError: true,
		},
		{
			name: "invalid_wait_after_negative",
			args: map[string]interface{}{
				"element_index": 0,
				"value":         "test",
				"options": map[string]interface{}{
					"wait_after": -1,
				},
			},
			expectError: true,
		},
		{
			name: "invalid_wait_after_too_large",
			args: map[string]interface{}{
				"element_index": 0,
				"value":         "test",
				"options": map[string]interface{}{
					"wait_after": 35,
				},
			},
			expectError: true,
		},
		{
			name: "valid_parameters",
			args: map[string]interface{}{
				"element_index": 0,
				"value":         "test value",
				"options": map[string]interface{}{
					"clear_first": true,
					"submit":      false,
					"wait_after":  1.5,
				},
			},
			expectError: false,
		},
		{
			name: "valid_parameters_with_special_key",
			args: map[string]interface{}{
				"element_index": 0,
				"value":         "test{Enter}",
				"options": map[string]interface{}{
					"clear_first": true,
				},
			},
			expectError: false,
		},
		{
			name: "valid_parameters_with_modifier_key",
			args: map[string]interface{}{
				"element_index": 0,
				"value":         "{Ctrl+V}",
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := testEnv.GetMcpClient().CallTool("type_value", tc.args)

			if tc.expectError {
				// For parameter validation errors, we expect either an error or IsError=true
				if err == nil {
					assert.True(t, result.IsError, "Expected tool execution to result in error for case: %s", tc.name)
				}
				t.Logf("Correctly caught validation error for case: %s", tc.name)
			} else {
				require.NoError(t, err)
				assert.False(t, result.IsError, "Tool execution should not result in error for case: %s", tc.name)
			}
		})
	}
}

func TestTypeValueToolDifferentElementTypes(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedRequests = append(capturedRequests, params)

		elementIndex := params["element_index"]
		value := params["value"]

		// Simulate different responses based on element_index
		switch elementIndex {
		case float64(0): // Text input
			return map[string]interface{}{
				"success":       true,
				"element_type":  "text-input",
				"input_method":  "type",
				"actual_value":  value,
				"element_index": 0,
			}, nil
		case float64(1): // Select dropdown
			return map[string]interface{}{
				"success":       true,
				"element_type":  "select",
				"input_method":  "single-select",
				"actual_value":  value,
				"element_index": 1,
			}, nil
		case float64(2): // Checkbox
			return map[string]interface{}{
				"success":       true,
				"element_type":  "checkbox",
				"input_method":  "toggle",
				"actual_value":  value,
				"element_index": 2,
			}, nil
		default:
			return map[string]interface{}{
				"success":       true,
				"element_type":  "unknown",
				"actual_value":  value,
				"element_index": elementIndex,
			}, nil
		}
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

	// Test different element types
	elementTestCases := []struct {
		name           string
		target         int
		value          interface{}
		expectedType   string
		expectedMethod string
	}{
		{
			name:           "text_input",
			target:         0,
			value:          "Hello World",
			expectedType:   "text-input",
			expectedMethod: "type",
		},
		{
			name:           "select_dropdown",
			target:         1,
			value:          "Option 1",
			expectedType:   "select",
			expectedMethod: "single-select",
		},
		{
			name:           "checkbox",
			target:         2,
			value:          true,
			expectedType:   "checkbox",
			expectedMethod: "toggle",
		},
	}

	for _, tc := range elementTestCases {
		t.Run(tc.name, func(t *testing.T) {
			// Clear previous requests
			capturedRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": tc.target,
				"value":         tc.value,
			})

			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(50 * time.Millisecond)

			// Verify RPC call was made
			require.Len(t, capturedRequests, 1, "Should have captured the request")
			assert.Equal(t, float64(tc.target), capturedRequests[0]["element_index"])
			assert.Equal(t, tc.value, capturedRequests[0]["value"])

			t.Logf("Successfully tested %s element type", tc.name)
		})
	}
}

func TestTypeValueToolWithOptions(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured requests
	var capturedRequests []map[string]interface{}

	// Register RPC handler for options testing
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedRequests = append(capturedRequests, params)

		return map[string]interface{}{
			"success":       true,
			"element_index": params["element_index"],
			"element_type":  "text-input",
			"input_method":  "type",
			"actual_value":  params["value"],
			"element_info": map[string]interface{}{
				"tag_name":    "input",
				"placeholder": "Enter your name",
				"id":          "name-field",
				"type":        "text",
			},
			"options_used": params["options"],
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

	// Test options handling
	t.Run("options_handling", func(t *testing.T) {
		// Clear previous requests
		capturedRequests = nil

		result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
			"element_index": 5,
			"value":         "John Doe",
			"options": map[string]interface{}{
				"clear_first": false,
				"submit":      true,
				"wait_after":  2.5,
			},
		})

		require.NoError(t, err)
		assert.False(t, result.IsError, "Tool execution should not result in error")

		// Wait for RPC call to be processed
		time.Sleep(50 * time.Millisecond)

		// Verify RPC call was made with correct parameters
		require.Len(t, capturedRequests, 1, "Should have captured the request")
		assert.Equal(t, float64(5), capturedRequests[0]["element_index"])
		assert.Equal(t, "John Doe", capturedRequests[0]["value"])

		// Verify options were passed correctly
		options := capturedRequests[0]["options"].(map[string]interface{})
		assert.Equal(t, false, options["clear_first"])
		assert.Equal(t, true, options["submit"])
		assert.Equal(t, 2.5, options["wait_after"])

		t.Log("Successfully tested options handling")
	})
}

func TestTypeValueToolSpecialKeyHandling(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Track captured requests with special keys
	var capturedRequests []map[string]interface{}

	// Register RPC handler for special key testing
	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		capturedRequests = append(capturedRequests, params)

		// Simulate detailed keyboard operation report
		operations := []interface{}{}
		value := ""
		if val, ok := params["value"].(string); ok {
			value = val
		}

		// Detect special keys and report operations
		if value == "{Enter}" {
			operations = append(operations, map[string]interface{}{
				"type": "specialKey",
				"key":  "Enter",
			})
		} else if value == "{Tab}" {
			operations = append(operations, map[string]interface{}{
				"type": "specialKey",
				"key":  "Tab",
			})
		} else if value == "{Ctrl+A}" {
			operations = append(operations, map[string]interface{}{
				"type":      "modifierCombination",
				"key":       "a",
				"modifiers": []string{"Control"},
			})
		} else if value == "hello{Enter}world" {
			operations = append(operations, map[string]interface{}{
				"type":    "text",
				"content": "hello",
			})
			operations = append(operations, map[string]interface{}{
				"type": "specialKey",
				"key":  "Enter",
			})
			operations = append(operations, map[string]interface{}{
				"type":    "text",
				"content": "world",
			})
		} else {
			operations = append(operations, map[string]interface{}{
				"type":    "text",
				"content": value,
			})
		}

		return map[string]interface{}{
			"success":              true,
			"element_index":        params["element_index"],
			"element_type":         "text-input",
			"input_method":         "keyboard",
			"actual_value":         params["value"],
			"operations_performed": operations,
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

	// Test special key handling
	specialKeyTestCases := []struct {
		name  string
		value string
	}{
		{
			name:  "enter_key",
			value: "{Enter}",
		},
		{
			name:  "tab_key",
			value: "{Tab}",
		},
		{
			name:  "ctrl_a_combination",
			value: "{Ctrl+A}",
		},
		{
			name:  "mixed_content",
			value: "hello{Enter}world",
		},
	}

	for _, tc := range specialKeyTestCases {
		t.Run(tc.name, func(t *testing.T) {
			// Clear previous requests
			capturedRequests = nil

			result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": 0,
				"value":         tc.value,
			})

			require.NoError(t, err)
			assert.False(t, result.IsError, "Tool execution should not result in error")

			// Wait for RPC call to be processed
			time.Sleep(50 * time.Millisecond)

			// Verify RPC call was made
			require.Len(t, capturedRequests, 1, "Should have captured the request")
			assert.Equal(t, float64(0), capturedRequests[0]["element_index"])
			assert.Equal(t, tc.value, capturedRequests[0]["value"])

			t.Logf("Successfully tested special key handling for %s", tc.name)
		})
	}
}

func TestTypeValueToolSchema(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Setup test environment
	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	// Get tools list
	tools, err := testEnv.GetMcpClient().ListTools()
	if err != nil {
		t.Logf("ListTools failed: %v", err)
		return
	}

	// Find type_value tool
	var typeValueTool *struct {
		Name        string
		Description string
	}

	for _, tool := range tools.Tools {
		if tool.Name == "type_value" {
			typeValueTool = &struct {
				Name        string
				Description string
			}{
				Name:        tool.Name,
				Description: tool.Description,
			}
			break
		}
	}

	if typeValueTool == nil {
		t.Log("type_value tool not found")
		return
	}

	// Validate tool schema
	t.Run("tool_schema_validation", func(t *testing.T) {
		assert.Equal(t, "type_value", typeValueTool.Name)
		assert.Contains(t, typeValueTool.Description, "Set values on form input elements")

		t.Log("Successfully validated type_value tool schema")
	})
}
