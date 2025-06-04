package tools

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/algonius/algonius-browser/mcp-host-go/pkg/logger"
	"github.com/algonius/algonius-browser/mcp-host-go/pkg/types"
	"go.uber.org/zap"
)

// GetDomExtraElementsTool implements the get_dom_extra_elements MCP tool
// This tool provides paginated access to interactive elements in the current viewport
type GetDomExtraElementsTool struct {
	logger    logger.Logger
	messaging types.Messaging
}

// GetDomExtraElementsConfig contains configuration for GetDomExtraElementsTool
type GetDomExtraElementsConfig struct {
	Logger    logger.Logger
	Messaging types.Messaging
}

// NewGetDomExtraElementsTool creates a new GetDomExtraElementsTool
func NewGetDomExtraElementsTool(config GetDomExtraElementsConfig) (*GetDomExtraElementsTool, error) {
	if config.Logger == nil {
		return nil, fmt.Errorf("logger is required")
	}

	if config.Messaging == nil {
		return nil, fmt.Errorf("messaging is required")
	}

	return &GetDomExtraElementsTool{
		logger:    config.Logger,
		messaging: config.Messaging,
	}, nil
}

// GetName returns the tool name
func (t *GetDomExtraElementsTool) GetName() string {
	return "get_dom_extra_elements"
}

// GetDescription returns the tool description
func (t *GetDomExtraElementsTool) GetDescription() string {
	return `Get interactive elements in the current viewport with pagination and filtering options.

This tool provides paginated access to interactive elements currently visible in the browser viewport:
• Pagination: Navigate through pages of elements to manage context size
• Filtering: Filter by element type (button, input, link, select, textarea, all)
• Viewport-focused: Shows only elements in the current visible area
• Context-efficient: Designed to avoid overwhelming AI context with too many elements

Use this tool when the DOM state overview shows many elements and you need detailed access to specific elements in the current viewport. To see elements in other parts of the page, scroll first, then use this tool.`
}

// GetInputSchema returns the tool input schema
func (t *GetDomExtraElementsTool) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"page": map[string]interface{}{
				"type":        "integer",
				"description": "Page number for pagination (default: 1, min: 1)",
				"minimum":     1,
				"default":     1,
			},
			"pageSize": map[string]interface{}{
				"type":        "integer",
				"description": "Number of elements per page (default: 20, max: 100)",
				"minimum":     1,
				"maximum":     100,
				"default":     20,
			},
			"elementType": map[string]interface{}{
				"type":        "string",
				"description": "Filter by element type (default: all)",
				"enum":        []string{"button", "input", "link", "select", "textarea", "all"},
				"default":     "all",
			},
			"startIndex": map[string]interface{}{
				"type":        "integer",
				"description": "Optional: Start from specific element index (1-based, overrides page parameter)",
				"minimum":     1,
			},
		},
		"additionalProperties": false,
	}
}

// Execute executes the get_dom_extra_elements tool
func (t *GetDomExtraElementsTool) Execute(arguments map[string]interface{}) (types.ToolResult, error) {
	t.logger.Debug("Executing get_dom_extra_elements tool", zap.Any("arguments", arguments))

	// Parse and validate parameters
	params, err := t.parseArguments(arguments)
	if err != nil {
		t.logger.Error("Invalid arguments for get_dom_extra_elements", zap.Error(err))
		return types.ToolResult{}, fmt.Errorf("invalid arguments: %w", err)
	}

	t.logger.Debug("Parsed parameters", zap.Any("params", params))

	// Request DOM state from the extension
	resp, err := t.messaging.RpcRequest(types.RpcRequest{
		Method: "get_dom_state",
	}, types.RpcOptions{Timeout: 5000})

	if err != nil {
		t.logger.Error("Error requesting DOM state for extra elements", zap.Error(err))
		return types.ToolResult{}, fmt.Errorf("failed to request DOM state: %w", err)
	}

	if resp.Error != nil {
		t.logger.Error("RPC error getting DOM state for extra elements", zap.Any("respError", resp.Error))
		return types.ToolResult{}, fmt.Errorf("RPC error: %s", resp.Error.Message)
	}

	// Parse the raw DOM state data
	var domStateData DomStateData
	if err := t.parseResponseToStruct(resp.Result, &domStateData); err != nil {
		t.logger.Error("Error parsing DOM state data for extra elements", zap.Error(err))
		return types.ToolResult{}, fmt.Errorf("failed to parse DOM state data: %w", err)
	}

	// Apply pagination and filtering
	result := t.applyPaginationAndFiltering(domStateData, params)

	t.logger.Debug("Successfully retrieved extra DOM elements",
		zap.Int("totalElements", result.Pagination.TotalElements),
		zap.Int("returnedElements", len(result.Elements)),
		zap.Int("currentPage", result.Pagination.CurrentPage))

	// Generate markdown format
	markdownText := t.generateMarkdown(result)

	return types.ToolResult{
		Content: []types.ToolResultItem{
			{
				Type: "text",
				Text: markdownText,
			},
		},
	}, nil
}

// ExtraElementsParams represents the parsed parameters for the tool
type ExtraElementsParams struct {
	Page        int    // Page number, starting from 1
	PageSize    int    // Number of elements per page
	ElementType string // Element type filter
	StartIndex  int    // Optional: start from specific index (1-based)
}

// DomStateData represents the raw DOM state data from Chrome extension
type DomStateData struct {
	FormattedDom        string                   `json:"formattedDom"`
	InteractiveElements []map[string]interface{} `json:"interactiveElements"`
	Meta                interface{}              `json:"meta"`
}

// ExtraElementsResult represents the result of the extra elements tool
type ExtraElementsResult struct {
	Elements   []map[string]interface{} `json:"elements"`
	Pagination PaginationInfo           `json:"pagination"`
	Filter     *FilterInfo              `json:"filter,omitempty"`
}

// PaginationInfo contains pagination metadata
type PaginationInfo struct {
	CurrentPage     int  `json:"currentPage"`
	PageSize        int  `json:"pageSize"`
	TotalElements   int  `json:"totalElements"`
	TotalPages      int  `json:"totalPages"`
	HasNextPage     bool `json:"hasNextPage"`
	HasPreviousPage bool `json:"hasPreviousPage"`
	StartIndex      int  `json:"startIndex"` // 1-based start index of current page
	EndIndex        int  `json:"endIndex"`   // 1-based end index of current page
}

// FilterInfo contains filter metadata
type FilterInfo struct {
	ElementType string `json:"elementType"`
}

// parseArguments parses and validates the tool arguments
func (t *GetDomExtraElementsTool) parseArguments(arguments map[string]interface{}) (ExtraElementsParams, error) {
	params := ExtraElementsParams{
		Page:        1,     // Default to page 1
		PageSize:    20,    // Default page size
		ElementType: "all", // Default to all elements
	}

	if arguments == nil {
		return params, nil
	}

	// Parse page parameter
	if pageVal, exists := arguments["page"]; exists && pageVal != nil {
		if pageFloat, ok := pageVal.(float64); ok {
			page := int(pageFloat)
			if page < 1 {
				return params, fmt.Errorf("page must be >= 1, got %d", page)
			}
			params.Page = page
		} else {
			return params, fmt.Errorf("page must be an integer, got %T", pageVal)
		}
	}

	// Parse pageSize parameter
	if pageSizeVal, exists := arguments["pageSize"]; exists && pageSizeVal != nil {
		if pageSizeFloat, ok := pageSizeVal.(float64); ok {
			pageSize := int(pageSizeFloat)
			if pageSize < 1 || pageSize > 100 {
				return params, fmt.Errorf("pageSize must be between 1 and 100, got %d", pageSize)
			}
			params.PageSize = pageSize
		} else {
			return params, fmt.Errorf("pageSize must be an integer, got %T", pageSizeVal)
		}
	}

	// Parse elementType parameter
	if elementTypeVal, exists := arguments["elementType"]; exists && elementTypeVal != nil {
		if elementTypeStr, ok := elementTypeVal.(string); ok {
			if !t.isValidElementType(elementTypeStr) {
				return params, fmt.Errorf("invalid elementType: %s, must be one of: button, input, link, select, textarea, all", elementTypeStr)
			}
			params.ElementType = elementTypeStr
		} else {
			return params, fmt.Errorf("elementType must be a string, got %T", elementTypeVal)
		}
	}

	// Parse startIndex parameter (optional)
	if startIndexVal, exists := arguments["startIndex"]; exists && startIndexVal != nil {
		if startIndexFloat, ok := startIndexVal.(float64); ok {
			startIndex := int(startIndexFloat)
			if startIndex < 1 {
				return params, fmt.Errorf("startIndex must be >= 1, got %d", startIndex)
			}
			params.StartIndex = startIndex
		} else {
			return params, fmt.Errorf("startIndex must be an integer, got %T", startIndexVal)
		}
	}

	return params, nil
}

// isValidElementType checks if element type is valid
func (t *GetDomExtraElementsTool) isValidElementType(elementType string) bool {
	validTypes := []string{"button", "input", "link", "select", "textarea", "all"}
	for _, validType := range validTypes {
		if validType == elementType {
			return true
		}
	}
	return false
}

// parseResponseToStruct converts response result to a struct
func (t *GetDomExtraElementsTool) parseResponseToStruct(result interface{}, target interface{}) error {
	// Convert to JSON first, then unmarshal to target struct
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	if err := json.Unmarshal(jsonBytes, target); err != nil {
		return fmt.Errorf("failed to unmarshal to target struct: %w", err)
	}

	return nil
}

// applyPaginationAndFiltering applies pagination and filtering to DOM state data
func (t *GetDomExtraElementsTool) applyPaginationAndFiltering(data DomStateData, params ExtraElementsParams) ExtraElementsResult {
	// Start with all interactive elements
	elements := data.InteractiveElements

	// Apply element type filtering if specified and not "all"
	var filterInfo *FilterInfo
	if params.ElementType != "all" {
		filteredElements := make([]map[string]interface{}, 0)
		for _, element := range elements {
			// Look for tagName field to match element type
			if tagName, exists := element["tagName"]; exists {
				if tagStr, ok := tagName.(string); ok {
					// Map tagName to element type filter
					var elementType string
					switch tagStr {
					case "a":
						elementType = "link"
					default:
						elementType = tagStr
					}
					if elementType == params.ElementType {
						filteredElements = append(filteredElements, element)
					}
				}
			}
		}
		elements = filteredElements
		filterInfo = &FilterInfo{ElementType: params.ElementType}
	}

	totalElements := len(elements)

	// Handle startIndex parameter - if provided, calculate which page it would be on
	if params.StartIndex > 0 {
		// Convert 1-based startIndex to 0-based and calculate page
		zeroBasedStart := params.StartIndex - 1
		params.Page = (zeroBasedStart / params.PageSize) + 1
	}

	totalPages := t.calculateTotalPages(totalElements, params.PageSize)

	// Ensure page is within valid range
	if params.Page > totalPages && totalPages > 0 {
		params.Page = totalPages
	}

	// Calculate pagination bounds (0-based internally)
	startIndex := (params.Page - 1) * params.PageSize
	endIndex := startIndex + params.PageSize

	// Apply bounds checking
	if startIndex >= totalElements {
		startIndex = totalElements
	}
	if endIndex > totalElements {
		endIndex = totalElements
	}

	// Get paginated elements
	var paginatedElements []map[string]interface{}
	if startIndex < endIndex {
		paginatedElements = elements[startIndex:endIndex]
	} else {
		paginatedElements = make([]map[string]interface{}, 0)
	}

	// Build pagination info (convert back to 1-based for API)
	paginationInfo := PaginationInfo{
		CurrentPage:     params.Page,
		PageSize:        params.PageSize,
		TotalElements:   totalElements,
		TotalPages:      totalPages,
		HasNextPage:     params.Page < totalPages,
		HasPreviousPage: params.Page > 1,
		StartIndex:      startIndex + 1, // Convert to 1-based
		EndIndex:        endIndex,       // Already 1-based (exclusive end)
	}

	return ExtraElementsResult{
		Elements:   paginatedElements,
		Pagination: paginationInfo,
		Filter:     filterInfo,
	}
}

// calculateTotalPages calculates total pages based on total elements and page size
func (t *GetDomExtraElementsTool) calculateTotalPages(totalElements, pageSize int) int {
	if pageSize <= 0 {
		return 0
	}
	// Manual ceiling calculation: (totalElements + pageSize - 1) / pageSize
	return (totalElements + pageSize - 1) / pageSize
}

// generateMarkdown generates AI-friendly markdown format from the result
func (t *GetDomExtraElementsTool) generateMarkdown(result ExtraElementsResult) string {
	var content strings.Builder

	// Title with pagination info
	content.WriteString(fmt.Sprintf("# DOM Elements - Page %d of %d\n\n", result.Pagination.CurrentPage, result.Pagination.TotalPages))

	// Summary info
	filterText := "all types"
	if result.Filter != nil {
		filterText = result.Filter.ElementType
	}
	content.WriteString(fmt.Sprintf("**Total Found**: %d elements | **Showing**: Elements %d-%d | **Filter**: %s\n\n",
		result.Pagination.TotalElements,
		result.Pagination.StartIndex,
		result.Pagination.EndIndex,
		filterText))

	// Separator
	content.WriteString("---\n\n")

	// Elements section
	if len(result.Elements) == 0 {
		content.WriteString("## No Elements Found\n\n")
		content.WriteString("No interactive elements match the current filter criteria.\n\n")
	} else {
		content.WriteString("## Elements\n\n")

		for i, element := range result.Elements {
			// Get element properties
			index := t.getElementIndex(element)
			tagName := t.getElementTagName(element)
			text := t.getElementText(element)
			attributes := t.getElementAttributes(element)

			// Element header with index (consistent with dom_state.go format)
			elementTitle := fmt.Sprintf("### Element [%d]", index)
			content.WriteString(elementTitle + "\n")

			// Element details on one line
			details := fmt.Sprintf("**Type**: %s", tagName)
			if text != "" {
				details += fmt.Sprintf(" | **Text**: \"%s\"", text)
			}
			content.WriteString(details + "  \n")

			// Attributes if present
			if attributes != "" {
				content.WriteString(fmt.Sprintf("**Attributes**: `%s`  \n", attributes))
			}

			// Action description
			action := t.generateActionDescription(tagName, text, attributes)
			if action != "" {
				content.WriteString(fmt.Sprintf("**Action**: %s\n", action))
			}

			// Add spacing between elements except for the last one
			if i < len(result.Elements)-1 {
				content.WriteString("\n")
			}
		}
	}

	// Navigation section
	content.WriteString("\n---\n\n")
	navigation := t.generateNavigationText(result.Pagination)
	content.WriteString(fmt.Sprintf("**Navigation**: %s\n", navigation))

	return content.String()
}

// Helper functions for markdown generation

func (t *GetDomExtraElementsTool) getElementIndex(element map[string]interface{}) int {
	if index, exists := element["index"]; exists {
		if indexFloat, ok := index.(float64); ok {
			return int(indexFloat)
		}
	}
	return 0
}

func (t *GetDomExtraElementsTool) getElementTagName(element map[string]interface{}) string {
	if tagName, exists := element["tagName"]; exists {
		if tagStr, ok := tagName.(string); ok {
			return tagStr
		}
	}
	return "unknown"
}

func (t *GetDomExtraElementsTool) getElementText(element map[string]interface{}) string {
	if text, exists := element["text"]; exists {
		if textStr, ok := text.(string); ok {
			return strings.TrimSpace(textStr)
		}
	}
	return ""
}

func (t *GetDomExtraElementsTool) getElementAttributes(element map[string]interface{}) string {
	if attrs, exists := element["attributes"]; exists {
		if attrMap, ok := attrs.(map[string]interface{}); ok {
			var attrParts []string
			for key, value := range attrMap {
				if valueStr, ok := value.(string); ok && valueStr != "" {
					attrParts = append(attrParts, fmt.Sprintf(`%s="%s"`, key, valueStr))
				}
			}
			return strings.Join(attrParts, " ")
		}
	}
	return ""
}

func (t *GetDomExtraElementsTool) formatElementTitle(tagName, text string) string {
	switch tagName {
	case "button":
		if text != "" {
			return fmt.Sprintf("%s Button", text)
		}
		return "Button"
	case "input":
		return "Input Field"
	case "a":
		if text != "" {
			return fmt.Sprintf("%s Link", text)
		}
		return "Link"
	case "select":
		if text != "" {
			return fmt.Sprintf("%s Select", text)
		}
		return "Select Dropdown"
	case "textarea":
		return "Text Area"
	default:
		if text != "" {
			return fmt.Sprintf("%s (%s)", text, tagName)
		}
		return strings.Title(tagName)
	}
}

func (t *GetDomExtraElementsTool) generateActionDescription(tagName, text, attributes string) string {
	switch tagName {
	case "button":
		if strings.Contains(attributes, `type="submit"`) {
			return "Click to submit form"
		}
		return "Click to perform action"
	case "input":
		if strings.Contains(attributes, `type="email"`) {
			return "Enter email address"
		} else if strings.Contains(attributes, `type="password"`) {
			return "Enter password"
		} else if strings.Contains(attributes, `type="text"`) {
			return "Enter text input"
		}
		return "Enter input value"
	case "a":
		if strings.Contains(attributes, `href=`) {
			return "Click to navigate to link"
		}
		return "Click to activate link"
	case "select":
		return "Click to open dropdown and select option"
	case "textarea":
		return "Click to enter multi-line text"
	default:
		return "Click to interact with element"
	}
}

func (t *GetDomExtraElementsTool) generateNavigationText(pagination PaginationInfo) string {
	var parts []string

	// Previous page
	if pagination.HasPreviousPage {
		parts = append(parts, fmt.Sprintf("Previous: page=%d", pagination.CurrentPage-1))
	} else {
		parts = append(parts, "Previous: N/A")
	}

	// Next page
	if pagination.HasNextPage {
		parts = append(parts, fmt.Sprintf("Next: page=%d", pagination.CurrentPage+1))
	} else {
		parts = append(parts, "Next: N/A")
	}

	// Page range
	if pagination.TotalPages > 1 {
		pageRange := make([]string, pagination.TotalPages)
		for i := 1; i <= pagination.TotalPages; i++ {
			pageRange[i-1] = fmt.Sprintf("%d", i)
		}
		parts = append(parts, fmt.Sprintf("Pages: %s", strings.Join(pageRange, ", ")))
	}

	return strings.Join(parts, " | ")
}
