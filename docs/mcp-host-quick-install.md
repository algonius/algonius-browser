# MCP Host 快速安装指南

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.sh | bash
```

## 其他选项

```bash
# 安装指定版本
./install-mcp-host.sh --version 1.2.3

# 卸载
./install-mcp-host.sh --uninstall
```

## 支持平台

- ✅ Linux x86_64
- ✅ macOS Intel & Apple Silicon  
- ✅ Windows x86_64

## 安装位置

- **二进制**: `~/.nanobrowser/bin/mcp-host`
- **配置**: 自动为 Chrome/Chromium/Edge 安装清单文件

## 验证安装

```bash
~/.nanobrowser/bin/mcp-host --version
```

详细说明请参考 [INSTALL-MCP-HOST.md](./INSTALL-MCP-HOST.md)
