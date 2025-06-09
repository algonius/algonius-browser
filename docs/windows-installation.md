# Windows Installation Guide

This guide provides detailed instructions for installing Algonius Browser MCP Host on Windows systems.

## Prerequisites

- Windows 10 or later
- PowerShell 5.1 or later (included with Windows 10+)
- Google Chrome, Microsoft Edge, or Chromium browser
- Internet connection for downloading the MCP host binary

## Installation Methods

### Method 1: One-Click PowerShell Installation (Recommended)

**Quick Install**:
```powershell
iwr -useb https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.ps1 | iex
```

**Download and Run Locally**:
```powershell
# Download the script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/algonius/algonius-browser/master/install-mcp-host.ps1" -OutFile "install-mcp-host.ps1"

# Run the script
.\install-mcp-host.ps1
```

### Method 2: Manual Installation

1. **Download Binary**:
   - Visit [GitHub Releases](https://github.com/algonius/algonius-browser/releases/latest)
   - Download `mcp-host-windows-amd64.exe`

2. **Create Installation Directory**:
   ```powershell
   $installDir = "$env:USERPROFILE\.algonius-browser\bin"
   New-Item -ItemType Directory -Path $installDir -Force
   ```

3. **Install Binary**:
   ```powershell
   Copy-Item "mcp-host-windows-amd64.exe" "$installDir\mcp-host.exe"
   ```

4. **Create Native Messaging Manifest**:
   ```powershell
   # Create manifest directory
   $manifestDir = "$env:LOCALAPPDATA\Google\Chrome\User Data\NativeMessagingHosts"
   New-Item -ItemType Directory -Path $manifestDir -Force
   
   # Create manifest content
   $manifest = @{
       name = "ai.algonius.mcp.host"
       description = "Algonius Browser MCP Native Messaging Host"
       path = "$installDir\mcp-host.exe"
       type = "stdio"
       allowed_origins = @("chrome-extension://fmcmnpejjhphnfdaegmdmahkgaccghem/")
   }
   
   # Save manifest
   $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path "$manifestDir\ai.algonius.mcp.host.json" -Encoding UTF8
   ```

## PowerShell Script Options

The `install-mcp-host.ps1` script supports various command-line options:

### Basic Usage
```powershell
# Install latest version with interactive extension ID input
.\install-mcp-host.ps1

# Install specific version
.\install-mcp-host.ps1 -Version "1.2.3"

# Show help
.\install-mcp-host.ps1 -Help
```

### Extension ID Configuration
```powershell
# Single extension ID
.\install-mcp-host.ps1 -ExtensionId "chrome-extension://abc123.../"

# Multiple extension IDs
.\install-mcp-host.ps1 -ExtensionIds "chrome-extension://abc123.../,chrome-extension://def456.../"

# Use 32-character ID (auto-formatted)
.\install-mcp-host.ps1 -ExtensionId "fmcmnpejjhphnfdaegmdmahkgaccghem"
```

### Uninstallation
```powershell
.\install-mcp-host.ps1 -Uninstall
```

## Supported Browsers

The installer automatically detects and configures native messaging for:

- **Google Chrome**: `%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts`
- **Microsoft Edge**: `%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts`
- **Chromium**: `%LOCALAPPDATA%\Chromium\User Data\NativeMessagingHosts`

## Installation Locations

### Binary Installation
- **MCP Host Binary**: `%USERPROFILE%\.algonius-browser\bin\mcp-host.exe`

### Native Messaging Manifests
- **Chrome**: `%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json`
- **Edge**: `%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json`
- **Chromium**: `%LOCALAPPDATA%\Chromium\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json`

## Troubleshooting

### PowerShell Execution Policy

If you encounter execution policy errors:

```powershell
# Check current policy
Get-ExecutionPolicy

# Temporarily allow script execution (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or bypass for a single script
PowerShell -ExecutionPolicy Bypass -File .\install-mcp-host.ps1
```

### Windows Defender / Antivirus

If Windows Defender blocks the download:
1. Temporarily disable real-time protection
2. Add an exclusion for the installation directory
3. Download and scan the binary manually

### Verify Installation

```powershell
# Check if binary exists
Test-Path "$env:USERPROFILE\.algonius-browser\bin\mcp-host.exe"

# Check binary version
& "$env:USERPROFILE\.algonius-browser\bin\mcp-host.exe" --version

# Check manifest files
Get-ChildItem "$env:LOCALAPPDATA\*\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json" -Recurse
```

### Common Issues

**Issue**: "Cannot download binary"
- **Solution**: Check internet connection and firewall settings

**Issue**: "Access denied when creating directories"
- **Solution**: Run PowerShell as Administrator

**Issue**: "Extension cannot connect to native host"
- **Solution**: Verify manifest file exists and extension ID is correct

**Issue**: "Binary not found"
- **Solution**: Check installation path and file permissions

## Manual Uninstallation

If the automatic uninstall fails:

```powershell
# Remove binary
Remove-Item "$env:USERPROFILE\.algonius-browser\bin\mcp-host.exe" -Force

# Remove manifests
Remove-Item "$env:LOCALAPPDATA\Google\Chrome\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\Edge\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Chromium\User Data\NativeMessagingHosts\ai.algonius.mcp.host.json" -Force -ErrorAction SilentlyContinue

# Remove empty directories
Remove-Item "$env:USERPROFILE\.algonius-browser\bin" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\.algonius-browser" -Force -ErrorAction SilentlyContinue
```

## Next Steps

After successful installation:

1. **Install Chrome Extension**: Load the extension in developer mode or install from the Chrome Web Store
2. **Test Connection**: Open the extension popup and verify MCP host connection
3. **Configure AI Integration**: Set up your preferred AI system to use the MCP browser tools

## Security Considerations

- The installer downloads binaries from GitHub releases only
- Native messaging manifests restrict communication to specified extension IDs
- Binary installation is user-scoped (no administrator privileges required)
- All network communication is over HTTPS

## Support

For Windows-specific issues:
- Check the main [GitHub Issues](https://github.com/algonius/algonius-browser/issues)
- Join our [Discord community](https://discord.gg/NN3ABHggMK)
- Review the [troubleshooting documentation](../README.md#troubleshooting)
