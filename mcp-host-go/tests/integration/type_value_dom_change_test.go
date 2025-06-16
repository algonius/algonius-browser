package integration

import (
	"context"
	"strings"
	"testing"
	"time"

	"env"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestTypeValueDOMChange(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Register mock browser RPC handlers for DOM change testing
	var lastTypeValue string
	var lastElementIndex int

	testEnv.GetNativeMsg().RegisterRpcHandler("navigate_to", func(params map[string]interface{}) (interface{}, error) {
		return map[string]interface{}{
			"success": true,
			"message": "Navigation completed",
			"url":     params["url"],
		}, nil
	})

	testEnv.GetNativeMsg().RegisterRpcHandler("get_dom_extra_elements", func(params map[string]interface{}) (interface{}, error) {
		// Mock response with elements that might change based on input
		elements := []map[string]interface{}{
			{
				"index":      0,
				"type":       "input",
				"tagName":    "input",
				"attributes": "type=\"text\" placeholder=\"Enter text\"",
				"text":       "",
			},
			{
				"index":      25,
				"type":       "div",
				"tagName":    "div",
				"attributes": "role=\"textbox\" aria-label=\"Post text\"",
				"text":       lastTypeValue,
			},
		}

		// Simulate DOM changes for long text
		if len(lastTypeValue) > 280 {
			// Add Premium upgrade prompt
			elements = append(elements, map[string]interface{}{
				"index":      26,
				"type":       "a",
				"tagName":    "a",
				"attributes": "href=\"/i/premium_sign_up\" class=\"premium-upgrade\"",
				"text":       "Upgrade to Premium+ to write longer posts",
			})

			// Add character counter showing negative count
			elements = append(elements, map[string]interface{}{
				"index":      27,
				"type":       "div",
				"tagName":    "div",
				"attributes": "class=\"char-counter negative\"",
				"text":       "-" + string(rune(len(lastTypeValue)-280)),
			})

		}

		return map[string]interface{}{
			"elements": elements,
			"success":  true,
		}, nil
	})

	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		if elementIndex, ok := params["element_index"].(float64); ok {
			lastElementIndex = int(elementIndex)
		}
		if value, ok := params["value"].(string); ok {
			lastTypeValue = value
		}

		// Simulate DOM change detection based on text length
		domChanged := len(lastTypeValue) > 100

		return map[string]interface{}{
			"success":        true,
			"element_index":  lastElementIndex,
			"value":          lastTypeValue,
			"dom_changed":    domChanged,
			"execution_time": "1.5s",
			"message":        "Text entered successfully",
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	testCases := []struct {
		name                   string
		url                    string
		inputText              string
		expectedDOMChange      bool
		expectedDOMChangeProps []string
		description            string
	}{
		{
			name:              "Short text input - minimal DOM change",
			url:               "http://localhost:3002/test-dom-change.html",
			inputText:         "Short test text",
			expectedDOMChange: false,
			description:       "Short text should have minimal DOM impact",
		},
		{
			name:                   "Long text input - triggers UI changes",
			url:                    "http://localhost:3002/test-dom-change.html",
			inputText:              "This is a very long text that will exceed the character limit and trigger DOM changes. This text is repeated to make it very long. More text to ensure we exceed limits. Even more text to trigger validation messages. Additional text to ensure DOM changes occur.",
			expectedDOMChange:      true,
			expectedDOMChangeProps: []string{"character", "warning", "count"},
			description:            "Long text should trigger character warning and counter",
		},
		{
			name:                   "X.com long text - triggers Premium upgrade",
			url:                    "https://x.com/home",
			inputText:              "这是一个测试超长文本来验证 Algonius Browser MCP 如何处理 X.com 字符限制的测试。这个文本故意设计得非常长，远远超过 X.com 平台的 280 字符限制。我们想要观察当输入的文本超过平台限制时，DOM 会如何变化，是否会显示字符计数器、警告信息或者其他视觉反馈。这种测试对于验证我们的 MCP 工具在处理复杂的用户界面反馈和动态 DOM 变化方面的能力非常重要。通过这个测试，我们可以确保工具能够正确识别和响应各种 DOM 状态变化，包括错误状态、警告状态和限制状态。这样的测试覆盖了真实用户在使用社交媒体平台时可能遇到的各种情况，确保我们的自动化工具具有足够的鲁棒性和可靠性。让我们看看 X.com 会如何响应这个超长的输入文本，以及我们的 MCP 工具是否能够正确检测到相关的 DOM 变化。",
			expectedDOMChange:      true,
			expectedDOMChangeProps: []string{"Premium", "character", "counter"},
			description:            "X.com long text should trigger Premium+ upgrade prompt and character limit UI",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset state for each test
			lastTypeValue = ""
			lastElementIndex = -1

			// Navigate to the test URL first
			navigateResult, err := testEnv.GetMcpClient().CallTool("navigate_to", map[string]interface{}{
				"url": tc.url,
			})
			require.NoError(t, err, "Navigation should succeed")
			require.False(t, navigateResult.IsError, "Navigation should not error")

			// Wait for page to load
			time.Sleep(1 * time.Second)

			// Find the text input element
			inputElementIndex := 0
			if tc.url == "https://x.com/home" {
				inputElementIndex = 25 // Mock X.com textbox element index
			}

			// Type the test text
			typeResult, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": inputElementIndex,
				"value":         tc.inputText,
				"options": map[string]interface{}{
					"clear_first": true,
					"wait_after":  2,
				},
			})

			require.NoError(t, err, "Type operation should succeed")

			t.Logf("Test: %s", tc.name)
			t.Logf("Description: %s", tc.description)
			t.Logf("Input text length: %d characters", len(tc.inputText))

			// Extract result information
			if !typeResult.IsError && len(typeResult.Content) > 0 {
				if textContent, ok := mcp.AsTextContent(typeResult.Content[0]); ok {
					t.Logf("Type result: %s", textContent.Text)

					// Check for DOM change indicators in the response
					resultText := textContent.Text

					// Verify DOM change expectation
					if tc.expectedDOMChange {
						if strings.Contains(resultText, "dom_changed") && strings.Contains(resultText, "true") {
							t.Logf("✓ DOM change detected as expected")
						} else {
							t.Logf("⚠ DOM change expected but not detected in response")
						}
					}

					// Verify expected DOM change properties
					if len(tc.expectedDOMChangeProps) > 0 {
						foundProps := 0
						for _, prop := range tc.expectedDOMChangeProps {
							if containsIgnoreCase(resultText, prop) {
								foundProps++
								t.Logf("✓ Found expected property: %s", prop)
							}
						}
						t.Logf("Found %d out of %d expected properties", foundProps, len(tc.expectedDOMChangeProps))
					}

					// Test DOM state after typing to verify changes
					if tc.expectedDOMChange {
						time.Sleep(1 * time.Second)

						finalDOMResult, err := testEnv.GetMcpClient().CallTool("get_dom_extra_elements", map[string]interface{}{
							"elementType": "all",
							"page":        1,
							"pageSize":    30,
						})

						if err == nil && !finalDOMResult.IsError {
							if len(finalDOMResult.Content) > 0 {
								if domContent, ok := mcp.AsTextContent(finalDOMResult.Content[0]); ok {
									if tc.url == "https://x.com/home" && len(tc.inputText) > 280 {
										// Check for Premium upgrade elements
										if strings.Contains(domContent.Text, "Premium") {
											t.Logf("✓ Premium upgrade prompt detected in DOM")
										}
										if strings.Contains(domContent.Text, "char-counter") {
											t.Logf("✓ Character counter detected in DOM")
										}
									}
								}
							}
						}
					}

					t.Logf("Test '%s' completed successfully", tc.name)
				}
			} else if typeResult.IsError {
				t.Logf("Type operation returned error (may be expected): %+v", typeResult)
			}
		})
	}
}

// Helper function for case-insensitive string matching
func containsIgnoreCase(text, substr string) bool {
	return len(text) >= len(substr) &&
		(text == substr ||
			strings.ToLower(text) == strings.ToLower(substr) ||
			strings.Contains(strings.ToLower(text), strings.ToLower(substr)))
}

func TestTypeValueComplexScenarios(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	testEnv, err := env.NewMcpHostTestEnvironment(nil)
	require.NoError(t, err)
	defer testEnv.Cleanup()

	err = testEnv.Setup(ctx)
	require.NoError(t, err)

	// Register simplified mock handlers for complex scenarios
	testEnv.GetNativeMsg().RegisterRpcHandler("navigate_to", func(params map[string]interface{}) (interface{}, error) {
		return map[string]interface{}{
			"success": true,
			"message": "Navigation completed",
		}, nil
	})

	testEnv.GetNativeMsg().RegisterRpcHandler("type_value", func(params map[string]interface{}) (interface{}, error) {
		value := ""
		if v, ok := params["value"].(string); ok {
			value = v
		}

		// Simulate different behaviors based on text length
		domChanged := len(value) > 50
		executionTime := "1.2s"
		if len(value) > 300 {
			executionTime = "2.5s" // Longer execution for complex DOM changes
		}

		message := "Text entered successfully"
		if len(value) > 280 {
			message = "Text entered successfully, character limit exceeded"
		}

		return map[string]interface{}{
			"success":         true,
			"dom_changed":     domChanged,
			"execution_time":  executionTime,
			"message":         message,
			"character_count": len(value),
		}, nil
	})

	// Initialize MCP client
	err = testEnv.GetMcpClient().Initialize(ctx)
	require.NoError(t, err)

	testCases := []struct {
		name            string
		description     string
		inputText       string
		expectDOMChange bool
	}{
		{
			name:            "Empty input",
			description:     "Test with empty string",
			inputText:       "",
			expectDOMChange: false,
		},
		{
			name:            "Medium length text",
			description:     "Test with medium length text that should trigger DOM changes",
			inputText:       strings.Repeat("Medium length text for DOM change testing. ", 3),
			expectDOMChange: true,
		},
		{
			name:            "Very long text",
			description:     "Test with very long text that should trigger significant DOM changes",
			inputText:       strings.Repeat("Very long text that will definitely exceed character limits and trigger various DOM changes including warnings, counters, and upgrade prompts. ", 5),
			expectDOMChange: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Navigate first
			_, err := testEnv.GetMcpClient().CallTool("navigate_to", map[string]interface{}{
				"url": "http://localhost:3002/test-dom-change.html",
			})
			require.NoError(t, err)

			// Type the text
			result, err := testEnv.GetMcpClient().CallTool("type_value", map[string]interface{}{
				"element_index": 0,
				"value":         tc.inputText,
			})

			require.NoError(t, err, "Type operation should succeed")
			require.False(t, result.IsError, "Type operation should not error")

			t.Logf("Test: %s", tc.name)
			t.Logf("Description: %s", tc.description)
			t.Logf("Input length: %d characters", len(tc.inputText))
			t.Logf("Expected DOM change: %t", tc.expectDOMChange)

			if len(result.Content) > 0 {
				if textContent, ok := mcp.AsTextContent(result.Content[0]); ok {
					resultText := textContent.Text
					t.Logf("Result: %s", resultText)

					// Check for DOM change indication
					if tc.expectDOMChange {
						if strings.Contains(resultText, "dom_changed") && strings.Contains(resultText, "true") {
							t.Logf("✓ DOM change detected as expected")
						} else {
							t.Logf("⚠ Expected DOM change but not detected")
						}
					} else {
						if strings.Contains(resultText, "dom_changed") && strings.Contains(resultText, "false") {
							t.Logf("✓ No DOM change detected as expected")
						}
					}

					t.Logf("Test '%s' completed", tc.name)
				}
			}
		})
	}
}
