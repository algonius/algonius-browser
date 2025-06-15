# Algonius Browser E2E Test Server

[English](#english) | [中文](#中文)

---

## English

### Overview

This directory contains a lightweight HTTP server for serving test pages to support end-to-end testing of Algonius Browser MCP (Model Context Protocol) tools. The server provides static HTML test pages that can be used to validate browser automation functionality.

### Quick Start

```bash
# Start the test server
node start-test-server.cjs

# Access test pages in browser
# http://localhost:8080

# Stop the server
node stop-test-server.cjs
```

### Available Test Pages

| Test Page | URL | Purpose |
|-----------|-----|---------|
| **Static Page Test** | `/test_static_page.html` | DOM index consistency testing with various interactive elements (buttons, inputs, links, forms) |
| **Type Value Test** | `/test-type-value.html` | Input value typing tool testing with special keys, modifiers, and form elements |
| **Scrollable Container** | `/test-scrollable-container.html` | Scrollable container detection and navigation testing |
| **Canvas Ball Game** | `/canvas-ball-game.html` | Canvas-based interactive game for complex interaction testing |

### Server Features

- **Static File Serving**: Serves HTML, CSS, JS, and media files
- **CORS Support**: Enabled for cross-origin testing
- **Auto Index**: Lists all available test pages at root URL
- **Process Management**: PID-based start/stop with cleanup
- **Port Configuration**: Configurable via environment variables
- **Error Handling**: Graceful 404/500 error pages
- **Security**: Path traversal protection
- **Logging**: Request logging for debugging

### Configuration

#### Environment Variables

```bash
# Server port (default: 8080)
export TEST_SERVER_PORT=8080

# Server host (default: localhost)
export TEST_SERVER_HOST=localhost

# Start with custom configuration
TEST_SERVER_PORT=3000 node start-test-server.cjs
```

#### File Structure

```
e2e-tests/
├── start-test-server.cjs    # Server start script
├── stop-test-server.cjs     # Server stop script
├── README.md                # This documentation
├── .test-server-pid         # PID file (generated at runtime)
├── test_static_page.html    # DOM testing page
├── test-type-value.html     # Input testing page
├── test-scrollable-container.html  # Scroll testing page
└── canvas-ball-game.html    # Canvas interaction testing
```

### Usage Examples

#### Basic Server Operations

```bash
# Start server on default port 8080
node start-test-server.cjs

# Start server on custom port
TEST_SERVER_PORT=3000 node start-test-server.cjs

# Stop server normally
node stop-test-server.cjs

# Force stop (if normal stop fails)
node stop-test-server.cjs --force

# Get help
node stop-test-server.cjs --help
```

#### Integration with Algonius Browser MCP

```javascript
// Example: Navigate to test page
await navigate_to({
  url: "http://localhost:8080/test_static_page.html"
});

// Example: Get DOM state for testing
const domState = await get_dom_state();

// Example: Click element by index
await click_element({
  element_index: 0
});
```

### Test Page Details

#### 1. Static Page Test (`test_static_page.html`)
- **Purpose**: Validate DOM index consistency between `get_dom_extra_elements` and `click_element` tools
- **Elements**: 15+ buttons, multiple input types, links, select dropdown, textarea
- **Features**: Click result display, element counting, section navigation

#### 2. Type Value Test (`test-type-value.html`)
- **Purpose**: Test the `type_value` tool with various input scenarios
- **Features**: 
  - Basic text input
  - Special key combinations (`{Enter}`, `{Tab}`, `{Ctrl+A}`)
  - Modifier keys (`{Shift+ArrowRight}`)
  - Long text handling
  - Form elements (select, checkbox, textarea)
  - Content editable elements
- **Logging**: Real-time event logging for debugging

#### 3. Scrollable Container (`test-scrollable-container.html`)
- **Purpose**: Test scrollable container detection and `scroll_page` tool
- **Features**: Multiple scrollable areas, nested containers, position tracking

#### 4. Canvas Ball Game (`canvas-ball-game.html`)
- **Purpose**: Test complex interactive elements and canvas-based interactions
- **Features**: Canvas drawing, animation, mouse/touch events

### Troubleshooting

#### Common Issues

**Port Already in Use**
```bash
# Error: Port 8080 is already in use
# Solution: Use different port
TEST_SERVER_PORT=8081 node start-test-server.cjs
```

**Server Won't Stop**
```bash
# Try force stop
node stop-test-server.cjs --force

# Manual cleanup
rm .test-server-pid
```

**Permission Denied**
```bash
# Make scripts executable (Linux/macOS)
chmod +x start-test-server.cjs stop-test-server.cjs
```

#### Debug Mode

```bash
# Check if server is running
curl http://localhost:8080

# View server logs
node start-test-server.cjs
# Server will output request logs in real-time
```

### Development

#### Adding New Test Pages

1. Create HTML file in `e2e-tests/` directory
2. Restart server to see new page in index
3. Test page will be automatically available

#### Server Customization

The server scripts are modular and can be extended:

```javascript
// Import server functions
const { startServer, createServer } = require('./start-test-server.cjs');

// Create custom server instance
const server = createServer();
// Add custom middleware or configuration
```

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Start Test Server
  run: |
    cd e2e-tests
    node start-test-server.cjs &
    sleep 2  # Wait for server to start

- name: Run E2E Tests
  run: |
    # Your test commands here
    # Tests can access http://localhost:8080/

- name: Stop Test Server
  run: |
    cd e2e-tests
    node stop-test-server.cjs
```

---

## 中文

### 概述

此目录包含一个轻量级 HTTP 服务器，用于提供测试页面以支持 Algonius Browser MCP（模型上下文协议）工具的端到端测试。服务器提供静态 HTML 测试页面，可用于验证浏览器自动化功能。

### 快速开始

```bash
# 启动测试服务器
node start-test-server.cjs

# 在浏览器中访问测试页面
# http://localhost:8080

# 停止服务器
node stop-test-server.cjs
```

### 可用测试页面

| 测试页面 | URL | 用途 |
|---------|-----|-----|
| **静态页面测试** | `/test_static_page.html` | 使用各种交互元素（按钮、输入框、链接、表单）进行 DOM 索引一致性测试 |
| **输入值测试** | `/test-type-value.html` | 使用特殊键、修饰符和表单元素进行输入值类型工具测试 |
| **可滚动容器** | `/test-scrollable-container.html` | 可滚动容器检测和导航测试 |
| **Canvas 球类游戏** | `/canvas-ball-game.html` | 基于 Canvas 的交互式游戏，用于复杂交互测试 |

### 服务器功能

- **静态文件服务**：提供 HTML、CSS、JS 和媒体文件
- **CORS 支持**：启用跨域测试
- **自动索引**：在根 URL 列出所有可用测试页面
- **进程管理**：基于 PID 的启动/停止和清理
- **端口配置**：通过环境变量可配置
- **错误处理**：优雅的 404/500 错误页面
- **安全性**：路径遍历保护
- **日志记录**：请求日志用于调试

### 配置

#### 环境变量

```bash
# 服务器端口（默认：8080）
export TEST_SERVER_PORT=8080

# 服务器主机（默认：localhost）
export TEST_SERVER_HOST=localhost

# 使用自定义配置启动
TEST_SERVER_PORT=3000 node start-test-server.cjs
```

#### 文件结构

```
e2e-tests/
├── start-test-server.cjs    # 服务器启动脚本
├── stop-test-server.cjs     # 服务器停止脚本
├── README.md                # 本文档
├── .test-server-pid         # PID 文件（运行时生成）
├── test_static_page.html    # DOM 测试页面
├── test-type-value.html     # 输入测试页面
├── test-scrollable-container.html  # 滚动测试页面
└── canvas-ball-game.html    # Canvas 交互测试
```

### 使用示例

#### 基本服务器操作

```bash
# 在默认端口 8080 启动服务器
node start-test-server.cjs

# 在自定义端口启动服务器
TEST_SERVER_PORT=3000 node start-test-server.cjs

# 正常停止服务器
node stop-test-server.cjs

# 强制停止（如果正常停止失败）
node stop-test-server.cjs --force

# 获取帮助
node stop-test-server.cjs --help
```

#### 与 Algonius Browser MCP 集成

```javascript
// 示例：导航到测试页面
await navigate_to({
  url: "http://localhost:8080/test_static_page.html"
});

// 示例：获取 DOM 状态进行测试
const domState = await get_dom_state();

// 示例：通过索引点击元素
await click_element({
  element_index: 0
});
```

### 测试页面详情

#### 1. 静态页面测试 (`test_static_page.html`)
- **目的**：验证 `get_dom_extra_elements` 和 `click_element` 工具之间的 DOM 索引一致性
- **元素**：15+ 个按钮、多种输入类型、链接、选择下拉菜单、文本区域
- **功能**：点击结果显示、元素计数、章节导航

#### 2. 输入值测试 (`test-type-value.html`)
- **目的**：在各种输入场景下测试 `type_value` 工具
- **功能**：
  - 基本文本输入
  - 特殊键组合（`{Enter}`、`{Tab}`、`{Ctrl+A}`）
  - 修饰键（`{Shift+ArrowRight}`）
  - 长文本处理
  - 表单元素（选择、复选框、文本区域）
  - 内容可编辑元素
- **日志记录**：实时事件日志用于调试

#### 3. 可滚动容器 (`test-scrollable-container.html`)
- **目的**：测试可滚动容器检测和 `scroll_page` 工具
- **功能**：多个可滚动区域、嵌套容器、位置跟踪

#### 4. Canvas 球类游戏 (`canvas-ball-game.html`)
- **目的**：测试复杂交互元素和基于 canvas 的交互
- **功能**：Canvas 绘图、动画、鼠标/触摸事件

### 故障排除

#### 常见问题

**端口已被使用**
```bash
# 错误：端口 8080 已被使用
# 解决方案：使用不同端口
TEST_SERVER_PORT=8081 node start-test-server.cjs
```

**服务器无法停止**
```bash
# 尝试强制停止
node stop-test-server.cjs --force

# 手动清理
rm .test-server-pid
```

**权限被拒绝**
```bash
# 使脚本可执行（Linux/macOS）
chmod +x start-test-server.cjs stop-test-server.cjs
```

#### 调试模式

```bash
# 检查服务器是否运行
curl http://localhost:8080

# 查看服务器日志
node start-test-server.cjs
# 服务器将实时输出请求日志
```

### 开发

#### 添加新测试页面

1. 在 `e2e-tests/` 目录中创建 HTML 文件
2. 重启服务器以在索引中看到新页面
3. 测试页面将自动可用

#### 服务器自定义

服务器脚本是模块化的，可以扩展：

```javascript
// 导入服务器函数
const { startServer, createServer } = require('./start-test-server.cjs');

// 创建自定义服务器实例
const server = createServer();
// 添加自定义中间件或配置
```

### CI/CD 集成

```yaml
# 示例 GitHub Actions 工作流
- name: 启动测试服务器
  run: |
    cd e2e-tests
    node start-test-server.cjs &
    sleep 2  # 等待服务器启动

- name: 运行 E2E 测试
  run: |
    # 您的测试命令在这里
    # 测试可以访问 http://localhost:8080/

- name: 停止测试服务器
  run: |
    cd e2e-tests
    node stop-test-server.cjs
```

### 技术规格

- **Node.js**: >= 22.12.0
- **依赖**: 仅使用 Node.js 内置模块
- **平台**: 跨平台（Linux、macOS、Windows）
- **协议**: HTTP/1.1
- **安全**: 路径验证、CORS 头部

### 许可证

本项目采用 Apache-2.0 许可证。
