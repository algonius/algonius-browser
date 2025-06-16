package tools

import (
	"fmt"
	"strconv"
	"time"

	"github.com/algonius/algonius-browser/mcp-host-go/pkg/logger"
	"github.com/algonius/algonius-browser/mcp-host-go/pkg/types"
	"go.uber.org/zap"
)

// TypeValueTool implements a tool for typing values and simulating keyboard inputs on interactive elements
type TypeValueTool struct {
	name        string
	description string
	logger      logger.Logger
	messaging   types.Messaging
}

// TypeValueConfig contains configuration for TypeValueTool
type TypeValueConfig struct {
	Logger    logger.Logger
	Messaging types.Messaging
}

// NewTypeValueTool creates a new TypeValueTool
func NewTypeValueTool(config TypeValueConfig) (*TypeValueTool, error) {
	if config.Logger == nil {
		return nil, fmt.Errorf("logger is required")
	}

	if config.Messaging == nil {
		return nil, fmt.Errorf("messaging is required")
	}

	return &TypeValueTool{
		name:        "type_value",
		description: "Set values on form input elements and simulate keyboard input with special keys and modifier combinations. Supports all form elements (input, select, textarea) plus advanced keyboard operations.",
		logger:      config.Logger,
		messaging:   config.Messaging,
	}, nil
}

// GetName returns the tool name
func (t *TypeValueTool) GetName() string {
	return t.name
}

// GetDescription returns the tool description
func (t *TypeValueTool) GetDescription() string {
	return t.description
}

// GetInputSchema returns the tool input schema
func (t *TypeValueTool) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"element_index": map[string]interface{}{
				"type":        "number",
				"description": "Index of the element to type value (0-based, from DOM state interactive_elements).",
				"minimum":     0,
			},
			"value": map[string]interface{}{
				"description": "Value to set (string, number, boolean, array for multi-select). For keyboard operations, use special key syntax like {Enter}, {Tab}, or {Ctrl+A} for modifier combinations.",
			},
			"timeout": map[string]interface{}{
				"type":        "string",
				"description": "Set value timeout: 'auto' for intelligent detection based on input length and page complexity, or timeout in milliseconds (e.g. '10000')",
				"default":     "auto",
			},
			"options": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"clear_first": map[string]interface{}{
						"type":        "boolean",
						"description": "Whether to clear existing content first",
						"default":     true,
					},
					"submit": map[string]interface{}{
						"type":        "boolean",
						"description": "Whether to submit form after setting value",
						"default":     false,
					},
					"wait_after": map[string]interface{}{
						"type":        "number",
						"description": "Time to wait after setting value (seconds)",
						"minimum":     0,
						"maximum":     30,
						"default":     1,
					},
				},
				"additionalProperties": false,
			},
		},
		"required":             []string{"element_index", "value"},
		"additionalProperties": false,
	}
}

// Execute executes the type_value tool
func (t *TypeValueTool) Execute(args map[string]interface{}) (types.ToolResult, error) {
	startTime := time.Now()
	t.logger.Info("Executing type_value tool", zap.Any("args", args))

	// Extract and validate element_index
	elementIndexArg, exists := args["element_index"]
	if !exists {
		return types.ToolResult{}, fmt.Errorf("element_index is required")
	}

	// Extract and validate value
	valueArg, exists := args["value"]
	if !exists {
		return types.ToolResult{}, fmt.Errorf("value is required")
	}

	// Auto-detect keyboard mode based on value content
	keyboardMode := false

	// Auto-detect keyboard mode based on value content
	keyboardMode = t.containsSpecialKeyPattern(valueArg)

	// Handle timeout parameter
	timeoutStr := "auto" // default value
	if timeoutArg, ok := args["timeout"].(string); ok {
		timeoutStr = timeoutArg
	}

	// Parse timeout value with improved intelligence
	var rpcTimeout int
	if timeoutStr == "auto" {
		rpcTimeout = t.calculateIntelligentTimeout(valueArg, keyboardMode)
	} else {
		// Try to parse as number (milliseconds)
		if parsedTimeout, err := strconv.Atoi(timeoutStr); err == nil {
			if parsedTimeout < 5000 || parsedTimeout > 600000 {
				return types.ToolResult{}, fmt.Errorf("timeout must be between 5000 and 600000 milliseconds")
			}
			rpcTimeout = parsedTimeout
		} else {
			return types.ToolResult{}, fmt.Errorf("timeout must be 'auto' or a timeout in milliseconds")
		}
	}

	// Extract options with defaults
	options := map[string]interface{}{
		"clear_first": true,
		"submit":      false,
		"wait_after":  1.0,
	}

	if optionsArg, exists := args["options"]; exists {
		if optionsMap, ok := optionsArg.(map[string]interface{}); ok {
			// Merge user options with defaults
			for key, value := range optionsMap {
				switch key {
				case "clear_first":
					if boolVal, ok := value.(bool); ok {
						options[key] = boolVal
					} else {
						return types.ToolResult{}, fmt.Errorf("options.clear_first must be a boolean")
					}
				case "submit":
					if boolVal, ok := value.(bool); ok {
						options[key] = boolVal
					} else {
						return types.ToolResult{}, fmt.Errorf("options.submit must be a boolean")
					}
				case "wait_after":
					if floatVal, ok := value.(float64); ok {
						if floatVal < 0 || floatVal > 30 {
							return types.ToolResult{}, fmt.Errorf("options.wait_after must be between 0 and 30 seconds")
						}
						options[key] = floatVal
					} else {
						return types.ToolResult{}, fmt.Errorf("options.wait_after must be a number")
					}
				default:
					return types.ToolResult{}, fmt.Errorf("unknown option: %s", key)
				}
			}
		} else {
			return types.ToolResult{}, fmt.Errorf("options must be an object")
		}
	}

	// Validate element_index parameter
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

	// Prepare RPC parameters
	rpcParams := map[string]interface{}{
		"element_index": elementIndex,
		"value":         valueArg,
		"options":       options,
	}

	// Calculate enhanced buffer time
	bufferTime := int(float64(rpcTimeout) * 0.25) // 25% buffer
	if bufferTime < 15000 {
		bufferTime = 15000 // minimum 15 second buffer
	}
	if bufferTime > 60000 {
		bufferTime = 60000 // maximum 60 second buffer
	}

	t.logger.Info("Starting type_value operation",
		zap.Int("element_index", elementIndex),
		zap.Int("value_length", len(fmt.Sprintf("%v", valueArg))),
		zap.Bool("keyboard_mode", keyboardMode),
		zap.Int("calculated_timeout", rpcTimeout),
		zap.Int("buffer_time", bufferTime))

	t.logger.Debug("Sending type_value RPC request",
		zap.Int("element_index", elementIndex),
		zap.Any("value", valueArg),
		zap.Bool("keyboard_mode", keyboardMode),
		zap.Any("options", options))

	// Send RPC request to the extension with enhanced timeout
	rpcStartTime := time.Now()
	t.logger.Debug("Sending RPC request with enhanced timeout",
		zap.Int("rpc_timeout", rpcTimeout),
		zap.Int("total_timeout", rpcTimeout+bufferTime))

	resp, err := t.messaging.RpcRequest(types.RpcRequest{
		Method: "type_value",
		Params: rpcParams,
	}, types.RpcOptions{Timeout: rpcTimeout + bufferTime})

	rpcDuration := time.Since(rpcStartTime)
	t.logger.Info("RPC request completed",
		zap.Duration("rpc_duration", rpcDuration),
		zap.Bool("success", err == nil))

	if err != nil {
		executionTime := time.Since(startTime).Seconds()
		t.logger.Error("Error calling type_value RPC", zap.Error(err), zap.Float64("execution_time", executionTime))
		return types.ToolResult{}, fmt.Errorf("type_value RPC failed: %w", err)
	}

	if resp.Error != nil {
		executionTime := time.Since(startTime).Seconds()
		t.logger.Error("RPC error in type_value",
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
		message := fmt.Sprintf("Failed to type value on element at index %d", elementIndex)
		if msgVal, exists := resultData["message"]; exists {
			if msgStr, ok := msgVal.(string); ok {
				message = msgStr
			}
		}

		errorCode := "TYPE_VALUE_FAILED"
		if codeVal, exists := resultData["error_code"]; exists {
			if codeStr, ok := codeVal.(string); ok {
				errorCode = codeStr
			}
		}

		t.logger.Warn("Type value failed",
			zap.Int("element_index", elementIndex),
			zap.String("error_code", errorCode),
			zap.String("message", message),
			zap.Float64("execution_time", executionTime))

		return types.ToolResult{}, fmt.Errorf("%s (%s)", message, errorCode)
	}

	// Handle success case
	message := fmt.Sprintf("Successfully typed value on element at index %d", elementIndex)
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

	var actualValue interface{}
	if valueVal, exists := resultData["actual_value"]; exists {
		actualValue = valueVal
	}

	var elementType string
	if typeVal, exists := resultData["element_type"]; exists {
		if typeStr, ok := typeVal.(string); ok {
			elementType = typeStr
		}
	}

	var inputMethod string
	if methodVal, exists := resultData["input_method"]; exists {
		if methodStr, ok := methodVal.(string); ok {
			inputMethod = methodStr
		}
	}

	var operationsPerformed []interface{}
	if opsVal, exists := resultData["operations_performed"]; exists {
		if ops, ok := opsVal.([]interface{}); ok {
			operationsPerformed = ops
		}
	}

	// Extract DOM change detection result from Chrome extension
	var domChanged bool
	if domChangedVal, exists := resultData["dom_changed"]; exists {
		if domChangedBool, ok := domChangedVal.(bool); ok {
			domChanged = domChangedBool
		}
	}

	t.logger.Info("Type value successful",
		zap.Int("element_index", elementIndex),
		zap.String("element_type", elementType),
		zap.String("input_method", inputMethod),
		zap.Any("actual_value", actualValue),
		zap.Bool("dom_changed", domChanged),
		zap.Float64("execution_time", executionTime))

	// Create detailed success response
	inputModeText := "standard form input"
	if keyboardMode || inputMethod == "keyboard" {
		inputModeText = "keyboard input"
	}

	responseText := fmt.Sprintf(`Type Value Result:
- Status: Success
- Message: %s
- Element Index: %d
- Input Mode: %s
- Element Type: %s
- Execution Time: %.2f seconds`, message, elementIndex, inputModeText, elementType, executionTime)

	// Add DOM change detection information
	if domChanged {
		responseText += "\n- DOM Changed: Yes (interactive elements modified)"
		responseText += "\n\n⚠️  IMPORTANT: DOM has been modified by this operation."
		responseText += "\n   Please call browser://dom/state resource to get the updated DOM state"
		responseText += "\n   before performing any subsequent element interactions."
		t.logger.Info("DOM change detected by Chrome extension",
			zap.Int("element_index", elementIndex),
			zap.Bool("dom_changed", domChanged))
	} else {
		responseText += "\n- DOM Changed: No"
	}

	if elementInfo != nil {
		if text, exists := elementInfo["text"]; exists && text != nil && text != "" {
			responseText += fmt.Sprintf("\n- Element Text: %v", text)
		}
		if tagName, exists := elementInfo["tag_name"]; exists {
			responseText += fmt.Sprintf("\n- Element Tag: %v", tagName)
		}
		if placeholder, exists := elementInfo["placeholder"]; exists && placeholder != nil && placeholder != "" {
			responseText += fmt.Sprintf("\n- Placeholder: %v", placeholder)
		}
	}

	// Include additional details for keyboard operations
	if len(operationsPerformed) > 0 {
		responseText += "\n\nKeyboard Operations Performed:"
		for i, op := range operationsPerformed {
			if opMap, ok := op.(map[string]interface{}); ok {
				opType, _ := opMap["type"].(string)
				switch opType {
				case "text":
					if content, ok := opMap["content"].(string); ok {
						responseText += fmt.Sprintf("\n%d. Typed text: \"%s\"", i+1, content)
					}
				case "specialKey":
					if key, ok := opMap["key"].(string); ok {
						responseText += fmt.Sprintf("\n%d. Pressed special key: %s", i+1, key)
					}
				case "modifierCombination":
					if key, ok := opMap["key"].(string); ok {
						if modifiers, ok := opMap["modifiers"].([]interface{}); ok {
							modStr := ""
							for i, mod := range modifiers {
								if i > 0 {
									modStr += "+"
								}
								modStr += fmt.Sprintf("%v", mod)
							}
							responseText += fmt.Sprintf("\n%d. Key combination: %s+%s", i+1, modStr, key)
						}
					}
				}
			}
		}
	}

	return types.ToolResult{
		Content: []types.ToolResultItem{
			{
				Type: "text",
				Text: responseText,
			},
		},
	}, nil
}

// calculateIntelligentTimeout calculates optimal timeout based on content length, type, and keyboard mode
func (t *TypeValueTool) calculateIntelligentTimeout(value interface{}, keyboardMode bool) int {
	textLength := len(fmt.Sprintf("%v", value))

	// Enhanced base timeout time
	baseTimeout := 15000 // 15 seconds base timeout

	// For keyboard operations, increase timeout
	if keyboardMode {
		baseTimeout = 20000 // 20 seconds base for keyboard operations
	}

	// Long text timeout calculation - more conservative estimation
	if textLength <= 100 {
		return baseTimeout
	}

	// Calculate text factor
	textFactor := ((textLength - 100) / 30) * 1000 // Beyond 100 chars, add 1 second per 30 characters

	// Apply different factors based on mode
	if keyboardMode {
		// Keyboard mode needs more time per character
		textFactor = ((textLength - 100) / 20) * 1000 // Beyond 100 chars, add 1 second per 20 characters for keyboard mode
	}

	// Calculate progressive bonus for very long content
	progressiveBonus := 0
	if textLength > 500 {
		progressiveBonus = 10000 // Extra 10 seconds
	}
	if textLength > 1000 {
		progressiveBonus = 20000 // Extra 20 seconds
	}
	if textLength > 2000 {
		progressiveBonus = 30000 // Extra 30 seconds
	}

	// Special keys and modifier combinations require extra time
	specialKeyFactor := 0
	if keyboardMode || t.containsSpecialKeyPattern(value) {
		specialKeyFactor = 5000 // Extra 5 seconds for special key handling
	}

	calculatedTimeout := baseTimeout + textFactor + progressiveBonus + specialKeyFactor

	// Ensure reasonable bounds (15 seconds - 10 minutes)
	if calculatedTimeout < 15000 {
		calculatedTimeout = 15000
	}
	if calculatedTimeout > 600000 {
		calculatedTimeout = 600000
	}

	t.logger.Debug("Calculated intelligent timeout",
		zap.Int("text_length", textLength),
		zap.Bool("keyboard_mode", keyboardMode),
		zap.Int("base_timeout", baseTimeout),
		zap.Int("text_factor", textFactor),
		zap.Int("progressive_bonus", progressiveBonus),
		zap.Int("special_key_factor", specialKeyFactor),
		zap.Int("final_timeout", calculatedTimeout))

	return calculatedTimeout
}

// containsSpecialKeyPattern checks if value contains special key patterns like {Enter} or {Ctrl+A}
func (t *TypeValueTool) containsSpecialKeyPattern(value interface{}) bool {
	if strVal, ok := value.(string); ok {
		// Check for pattern {key} or {modifier+key}
		return strVal != "" && (strVal != value && containsBraces(strVal))
	}
	return false
}

// containsBraces is a helper function to check for special key patterns
func containsBraces(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == '{' {
			for j := i + 1; j < len(s); j++ {
				if s[j] == '}' {
					return true
				}
			}
		}
	}
	return false
}
