<div align="center">
    <img src="https://github.com/user-attachments/assets/1b2b1bc0-c7b4-4a45-83f5-4a6161831535" width="600" alt="Algonius Browser Banner" />
</div>

<h1 align="center">MCP Browser Automation</h1>

## 🌐 Overview

Algonius Browser is an open-source MCP (Model Context Protocol) server that provides browser automation capabilities to external AI systems. It exposes a comprehensive set of browser control tools through the MCP protocol, enabling AI assistants and other tools to navigate websites, interact with DOM elements, and extract web content programmatically.

## 🎯 Key Features

- **MCP Protocol Integration**: Standard interface for AI systems to control browser automation
- **Chrome Extension**: Background service worker that handles browser interactions
- **Native Messaging**: Go-based MCP host that bridges Chrome extension with external tools
- **Comprehensive Tool Set**: 5 browser automation tools + 2 MCP resources
- **Type Safety**: Full TypeScript implementation with structured error handling
- **Testing Suite**: Comprehensive integration tests for all functionality

## 🛠️ Available MCP Tools

### Navigation & Tabs
- **`navigate_to`**: Navigate to URLs with configurable timeout handling
- **`manage_tabs`**: Create, close, and switch between browser tabs

### DOM Interaction  
- **`get_dom_extra_elements`**: Advanced DOM element extraction with pagination and filtering
- **`click_element`**: Click DOM elements using CSS selectors or text matching
- **`set_value`**: Set values in input fields, textareas, and form elements
- **`scroll_page`**: Scroll pages up or down with customizable distances

## 📋 Available MCP Resources

### Browser State Resources
- **`browser://current/state`**: Complete current browser state in AI-friendly Markdown format
  - Active tab information
  - All browser tabs with URLs, titles, and status
  - Real-time state updates via resource notifications

- **`browser://dom/state`**: Current DOM state overview in Markdown format
  - Page metadata (URL, title, scroll position)
  - First 20 interactive elements
  - Total element count with "more available" indicators
  - Simplified DOM structure
  - Auto-updates when page changes

## 🚀 Quick Start

### 1. Install Chrome Extension

**From Chrome Web Store (Recommended)**:

<a href="https://chromewebstore.google.com/detail/algonius-browser-mcp/fmcmnpejjhphnfdaegmdmahkgaccghem" target="_blank">
  <img src="https://github.com/user-attachments/assets/4c2c0b5e-8f63-4a8b-9a5e-2d7e8f3c9b1a" alt="Available in the Chrome Web Store" width="248" height="75">
</a>

1. Click the "Add to Chrome" button on the [Chrome Web Store page](https://chromewebstore.google.com/detail/algonius-browser-mcp/fmcmnpejjhphnfdaegmdmahkgaccghem)
2. Confirm the installation when prompted
3. The extension will be automatically installed and ready to use

**From Source (Development)**:
```bash
# Clone and build
git clone https://github.com/algonius/algonius-browser.git
cd algonius-browser
pnpm install
pnpm build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the 'dist' folder
```

> ⚠️ **Important**: The Chrome extension requires the MCP Host backend service to function properly. Please continue with step 2 to complete the installation.

### 2. Install MCP Host

**One-Click Installation (Recommended)**:

**Linux/macOS**:
```bash
curl -fsSL https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.sh | bash
```

**Windows (PowerShell)**:
```powershell
iwr -useb https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.ps1 | iex
```

**Manual Installation**:
```bash
# Download latest release
wget https://github.com/algonius/algonius-browser/releases/latest/download/mcp-host-linux-x86_64.tar.gz

# Extract and install
tar -xzf mcp-host-linux-x86_64.tar.gz
cd mcp-host-linux-x86_64
./install.sh
```

### 3. Verify Installation

```bash
# Test the MCP host installation
mcp-host-go --version

# The MCP host will be automatically started when needed by the Chrome extension
# You should see the extension icon in your Chrome toolbar
```

> ✅ **Success**: Both components are now installed! The Chrome extension will automatically communicate with the MCP Host when browser automation is requested.

## 🔧 Integration Examples

### Using with AI Assistants

Once installed, AI systems can use the browser automation tools and resources through the MCP protocol:

**Tool Usage**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "navigate_to",
    "arguments": {
      "url": "https://example.com",
      "timeout": 30000
    }
  }
}
```

**Resource Access**:
```json
{
  "method": "resources/read",
  "params": {
    "uri": "browser://current/state"
  }
}
```

### Common Workflows

**Web Scraping**:
1. `navigate_to` → Navigate to target site
2. Read `browser://dom/state` → Get page overview
3. `get_dom_extra_elements` → Get specific elements with pagination
4. `click_element` → Interact with elements
5. Read `browser://dom/state` → Extract updated content

**Form Automation**:
1. `navigate_to` → Go to form page
2. Read `browser://dom/state` → Identify form elements
3. `set_value` → Fill form fields
4. `click_element` → Submit form
5. Read `browser://current/state` → Verify completion

**Multi-Tab Management**:
1. Read `browser://current/state` → Check current tabs
2. `manage_tabs` → Create/switch tabs
3. `navigate_to` → Load content in each tab
4. Read `browser://current/state` → Monitor all tab states

**Page Navigation with Scrolling**:
1. `navigate_to` → Go to target page
2. Read `browser://dom/state` → Get initial page state
3. `scroll_page` → Scroll to load more content
4. `get_dom_extra_elements` → Extract newly loaded elements

## 🏗️ Architecture

```
External AI System
       ↓ (MCP Protocol)
   MCP Host (Go)
       ↓ (Native Messaging)
Chrome Extension
       ↓ (Chrome APIs)
    Browser Tabs
```

### Components

- **MCP Host**: Go-based native messaging host that implements MCP protocol
- **Chrome Extension**: Background service worker with tool handlers
- **Content Scripts**: DOM interaction and data extraction utilities
- **Integration Tests**: Comprehensive test suite for all tools

## 🧪 Development

### Build from Source

**Prerequisites**:
- Node.js 22.12.0+
- pnpm 9.15.1+
- Go 1.21+ (for MCP host)

**Build Extension**:
```bash
pnpm install
pnpm build
```

**Build MCP Host**:
```bash
cd mcp-host-go
make build
```

**Run Tests**:
```bash
# Extension tests
pnpm test

# MCP host tests  
cd mcp-host-go
make test
```

### Development Mode

```bash
# Extension development
pnpm dev

# MCP host development
cd mcp-host-go
make dev
```

## 📊 Supported Platforms

**MCP Host**:
- Linux x86_64
- macOS Intel (x86_64) and Apple Silicon (arm64)  
- Windows x86_64

**Chrome Extension**:
- Chrome/Chromium 88+
- Microsoft Edge 88+

## 📚 Documentation

Detailed documentation available in the `docs/` directory:

- [MCP Host Integration](docs/chrome-mcp-host.md)
- [Click Element Tool](docs/click-element-tool.md)
- [Set Value Tool](docs/set-value-tool.md)
- [Navigate To Timeout](docs/navigate-to-timeout.md)
- [Integration Testing](docs/mcp-host-integration-testing.md)

## 🤝 Contributing

We welcome contributions! Check out our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Ways to contribute**:
- Report bugs and feature requests
- Submit pull requests for improvements
- Add integration tests
- Improve documentation
- Share usage examples

## 🔒 Security

For security vulnerabilities, please create a [GitHub Security Advisory](https://github.com/algonius/algonius-browser/security/advisories/new) rather than opening a public issue.

## 💬 Community

- [Discord](https://discord.gg/NN3ABHggMK) - Chat with developers and users
- [GitHub Discussions](https://github.com/algonius/algonius-browser/discussions) - Share ideas and ask questions

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

Built with these excellent open-source projects:
- [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Made with ❤️ by the Algonius Browser Team**

Give us a star 🌟 if this project helps you build better browser automation!
