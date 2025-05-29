<h1 align="center">
    <img src="https://github.com/user-attachments/assets/1b2b1bc0-c7b4-4a45-83f5-4a6161831535" height="100" width="375" alt="Algonius Browser Banner" /><br>
    MCP Browser Automation
</h1>

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/algonius/algonius-browser)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/NN3ABHggMK)

</div>

## 🌐 Overview

Algonius Browser is an open-source MCP (Model Context Protocol) server that provides browser automation capabilities to external AI systems. It exposes a comprehensive set of browser control tools through the MCP protocol, enabling AI assistants and other tools to navigate websites, interact with DOM elements, and extract web content programmatically.

## 🎯 Key Features

- **MCP Protocol Integration**: Standard interface for AI systems to control browser automation
- **Chrome Extension**: Background service worker that handles browser interactions
- **Native Messaging**: Go-based MCP host that bridges Chrome extension with external tools
- **Comprehensive Tool Set**: 7 essential browser automation tools
- **Type Safety**: Full TypeScript implementation with structured error handling
- **Testing Suite**: Comprehensive integration tests for all functionality

## 🛠️ Available MCP Tools

### Navigation & State
- **`navigate_to`**: Navigate to URLs with configurable timeout handling
- **`get_browser_state`**: Get current browser state including active tabs and page information
- **`manage_tabs`**: Create, close, and switch between browser tabs

### DOM Interaction  
- **`get_dom_state`**: Extract DOM structure and elements with pagination support
- **`click_element`**: Click DOM elements using CSS selectors or text matching
- **`set_value`**: Set values in input fields, textareas, and form elements
- **`scroll_page`**: Scroll pages up or down with customizable distances

## 🚀 Quick Start

### 1. Install MCP Host

**One-Click Installation (Recommended)**:
```bash
curl -fsSL https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.sh | bash
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

### 2. Install Chrome Extension

**From Source**:
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

### 3. Start MCP Host

```bash
# Test the installation
mcp-host-go --version

# The MCP host will be automatically started when needed by the Chrome extension
```

## 🔧 Integration Examples

### Using with AI Assistants

Once installed, AI systems can use the browser automation tools through the MCP protocol:

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

### Common Workflows

**Web Scraping**:
1. `navigate_to` → Navigate to target site
2. `get_dom_state` → Extract page content
3. `click_element` → Interact with elements
4. `get_dom_state` → Extract updated content

**Form Automation**:
1. `navigate_to` → Go to form page
2. `set_value` → Fill form fields
3. `click_element` → Submit form
4. `get_browser_state` → Verify completion

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
