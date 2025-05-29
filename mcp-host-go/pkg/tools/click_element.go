package tools

import (
	"fmt"
	"time"

	"github.com/algonius/algonius-browser/mcp-host-go/pkg/logger"
	"github.com/algonius/algonius-browser/mcp-host-go/pkg/types"
	"go.uber.org/zap"
)

// ClickElementTool implements a tool for clicking interactive elements on web pages
type ClickElementTool struct {
	name        string
	description string
	logger      logger.Logger
	messaging   types.Messaging
	domStateRes types.Resource
}

// ClickElementConfig contains configuration for ClickElementTool
type ClickElementConfig struct {
	Logger      logger.Logger
	Messaging   types.Messaging
	DomStateRes types.Resource
}

// NewClickElementTool creates a new ClickElementTool
func NewClickElementTool(config ClickElementConfig) (*ClickElementTool, error) {
	if config.Logger == nil {
		return nil, fmt.Errorf("logger is required")
	}

	if config.Messaging == nil {
		return nil, fmt.Errorf("messaging is required")
	}

	if config.DomStateRes == nil {
		return nil, fmt.Errorf("domStateRes is required")
	}

	return &ClickElementTool{
		name:        "click_element",
		description: "Click interactive elements on web pages using element index from DOM state",
		logger:      config.Logger,
		messaging:   config.Messaging,
		domStateRes: config.DomStateRes,
	}, nil
}

// GetName returns the tool name
func (t *ClickElementTool) GetName() string {
	return t.name
}

// GetDescription returns the tool description
func (t *ClickElementTool) GetDescription() string {
	return t.description
}

// GetInputSchema returns the tool input schema
func (t *ClickElementTool) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"element_index": map[string]interface{}{
				"type":        "number",
				"description": "Index of the element to click (0-based, from DOM state interactive_elements)",
				"minimum":     0,
			},
			"wait_after": map[string]interface{}{
				"type":        "number",
				"description": "Time to wait after clicking (milliseconds)",
				"minimum":     0,
				"maximum":     30000,
				"default":     1000,
			},
			"return_dom_state": map[string]interface{}{
				"type":        "boolean",
				"description": "Whether to return DOM state content after successful click",
				"default":     false,
			},
		},
		"required":             []string{"element_index"},
		"additionalProperties": false,
	}
}

// Execute executes the click_element tool
func (t *ClickElementTool) Execute(args map[string]interface{}) (types.ToolResult, error) {
	startTime := time.Now()
	t.logger.Info("Executing click_element tool", zap.Any("args", args))

	// Extract and validate element_index
	elementIndexArg, exists := args["element_index"]
	if !exists {
		return types.ToolResult{}, fmt.Errorf("element_index is required")
	}

	var elementIndex int
	switch v := elementIndexArg.(type) {
	case float64:
		if v < 0 {
			return types.ToolResult{}, fmt.Errorf("element_index must be non-negative, got: %v", v)
		}
		elementIndex = int(v)
	case int:
		if v < 0 {
			return types.ToolResult{}, fmt.Errorf("element_index must be non-negative, got: %v", v)
		}
		elementIndex = v
	default:
		return types.ToolResult{}, fmt.Errorf("element_index must be a number, got: %T", elementIndexArg)
	}

	// Extract and validate wait_after
	waitAfter := 1000.0 // default value
	if waitAfterArg, exists := args["wait_after"]; exists {
		if waitVal, ok := waitAfterArg.(float64); ok {
			if waitVal < 0 || waitVal > 30000 {
				return types.ToolResult{}, fmt.Errorf("wait_after must be between 0 and 30000 milliseconds, got: %v", int(waitVal))
			}
			waitAfter = waitVal
		} else {
			return types.ToolResult{}, fmt.Errorf("wait_after must be a number, got: %T", waitAfterArg)
		}
	}

	// Extract and validate return_dom_state
	returnDomState := false // default value
	if returnDomStateArg, exists := args["return_dom_state"]; exists {
		if returnVal, ok := returnDomStateArg.(bool); ok {
			returnDomState = returnVal
		} else {
			return types.ToolResult{}, fmt.Errorf("return_dom_state must be a boolean, got: %T", returnDomStateArg)
		}
	}

	// Prepare RPC parameters
	rpcParams := map[string]interface{}{
		"element_index": elementIndex,
		"wait_after":    waitAfter,
	}

	t.logger.Debug("Sending click_element RPC request",
		zap.Int("element_index", elementIndex),
		zap.Float64("wait_after", waitAfter),
		zap.String("wait_after_unit", "milliseconds"))

	// Send RPC request to the extension
	resp, err := t.messaging.RpcRequest(types.RpcRequest{
		Method: "click_element",
		Params: rpcParams,
	}, types.RpcOptions{Timeout: 15000}) // 15 second timeout

	if err != nil {
		executionTime := time.Since(startTime).Seconds()
		t.logger.Error("Error calling click_element RPC", zap.Error(err), zap.Float64("execution_time", executionTime))
		return types.ToolResult{}, fmt.Errorf("click_element RPC failed: %w", err)
	}

	if resp.Error != nil {
		executionTime := time.Since(startTime).Seconds()
		t.logger.Error("RPC error in click_element",
			zap.Any("rpc_error", resp.Error),
			zap.Float64("execution_time", executionTime))
		return types.ToolResult{}, fmt.Errorf("RPC error: %s", resp.Error.Message)
	}

	executionTime := time.Since(startTime).Seconds()

	// Parse response data
	var resultData map[string]interface{}
	if resp.Result != nil {
		if data, ok := resp.Result.(map[string]interface{}); ok {
			resultData = data
		}
	}

	// Check if the operation was successful
	success := false
	if successVal, exists := resultData["success"]; exists {
		if successBool, ok := successVal.(bool); ok {
			success = successBool
		}
	}

	if !success {
		// Handle failure case
		message := fmt.Sprintf("Failed to click element at index %d", elementIndex)
		if msgVal, exists := resultData["message"]; exists {
			if msgStr, ok := msgVal.(string); ok {
				message = msgStr
			}
		}

		errorCode := "CLICK_FAILED"
		if codeVal, exists := resultData["error_code"]; exists {
			if codeStr, ok := codeVal.(string); ok {
				errorCode = codeStr
			}
		}

		t.logger.Warn("Click element failed",
			zap.Int("element_index", elementIndex),
			zap.String("error_code", errorCode),
			zap.String("message", message),
			zap.Float64("execution_time", executionTime))

		return types.ToolResult{}, fmt.Errorf("%s (%s)", message, errorCode)
	}

	// Handle success case
	message := fmt.Sprintf("Successfully clicked element at index %d", elementIndex)
	if msgVal, exists := resultData["message"]; exists {
		if msgStr, ok := msgVal.(string); ok {
			message = msgStr
		}
	}

	// Extract additional result information
	var elementInfo map[string]interface{}
	if infoVal, exists := resultData["element_info"]; exists {
		if info, ok := infoVal.(map[string]interface{}); ok {
			elementInfo = info
		}
	}

	pageChanged := false
	if changedVal, exists := resultData["page_changed"]; exists {
		if changed, ok := changedVal.(bool); ok {
			pageChanged = changed
		}
	}

	t.logger.Info("Click element successful",
		zap.Int("element_index", elementIndex),
		zap.Bool("page_changed", pageChanged),
		zap.Any("element_info", elementInfo),
		zap.Float64("execution_time", executionTime))

	// Create detailed success response
	responseText := fmt.Sprintf(`Click Element Result:
- Status: Success
- Message: %s
- Element Index: %d
- Page Changed: %t
- Execution Time: %.2f seconds`, message, elementIndex, pageChanged, executionTime)

	if elementInfo != nil {
		if text, exists := elementInfo["text"]; exists {
			responseText += fmt.Sprintf("\n- Element Text: %v", text)
		}
		if tagName, exists := elementInfo["tag_name"]; exists {
			responseText += fmt.Sprintf("\n- Element Tag: %v", tagName)
		}
	}

	// Create result content
	resultContent := []types.ToolResultItem{
		{
			Type: "text",
			Text: responseText,
		},
	}

	// If return_dom_state is true, fetch and append DOM state
	if returnDomState {
		t.logger.Debug("Fetching DOM state after successful click")
		domContent, err := t.domStateRes.Read()
		if err != nil {
			t.logger.Warn("Failed to get DOM state after click", zap.Error(err))
			// Don't fail the entire operation, just add a note
			resultContent[0].Text += "\n\nNote: Failed to retrieve DOM state after click: " + err.Error()
		} else {
			// Append DOM state content
			if len(domContent.Contents) > 0 {
				resultContent = append(resultContent, types.ToolResultItem{
					Type: "text",
					Text: "\n--- DOM State ---\n\n" + domContent.Contents[0].Text,
				})
				t.logger.Debug("Successfully appended DOM state to click result")
			} else {
				t.logger.Warn("DOM state result is empty")
				resultContent[0].Text += "\n\nNote: DOM state result is empty"
			}
		}
	}

	return types.ToolResult{
		Content: resultContent,
	}, nil
}
