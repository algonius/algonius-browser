# Windows Installation Guide

This document provides detailed installation instructions for the Algonius Browser MCP Host on Windows systems.

## Overview

The Windows installation process involves:
1. Downloading the Windows binary from GitHub releases
2. Installing the binary to a user directory
3. Creating native messaging manifests for Chrome/Edge/Chromium
4. **Registering the native messaging host in Windows Registry** (Critical for Windows)
5. Configuring extension permissions

## Important: Windows Registry Requirement

⚠️ **Critical**: Unlike Linux/macOS, Windows Chrome Native Messaging requires **registry registration**. Simply placing manifest files in directories is not sufficient on Windows.

The installer automatically:
- Creates registry entries in `HKEY_CURRENT_USER\Software\[Browser]\NativeMessagingHosts\`
- Points registry entries to the manifest file location
- Supports Chrome, Edge, and Chromium browsers

## Quick Installation

### PowerShell One-Click Installer (Recommended)

The easiest way to install on Windows is using our PowerShell installer:

```powershell
# Download and run the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/algonius/algonius-browser/main/install-mcp-host.ps1" -OutFile "install-mcp-host.ps1"
.\install-mcp-host.ps1
```

### Installation Options

```powershell
# Install latest version (interactive)
.\install-mcp-host.ps1

# Install specific version
.\install-mcp-host.ps1 -Version "1.2.3"

# Install with specific extension ID
.\install-mcp-host.ps1 -ExtensionId "chrome-extension://your-extension-id/"

# Install with multiple extension IDs
.\install-mcp-host.ps1 -ExtensionIds "chrome-extension://id1/,chrome-extension://id2/"

# Uninstall
.\install-mcp-host.ps1 -Uninstall

# Show help
.\install-mcp-host.ps1 -Help
```

## What the Installer Does

The PowerShell installer performs these steps automatically:

1. **Downloads the Binary**: Fetches the latest Windows binary from GitHub releases
2. **Installs to User Directory**: Places the binary in `%USERPROFILE%\.algonius-browser\bin\`
3. **Creates Manifest File**: Generates the native messaging manifest with your extension IDs
4. **Registry Registration**: Creates registry entries for detected browsers:
   - `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\ai.algonius.mcp.host`
   - `HKEY_CURRENT_USER\Software\Microsoft\Edge\NativeMessagingHosts\ai.algonius.mcp.host`
   - `HKEY_CURRENT_USER\Software\Chromium\NativeMessagingHosts\ai.algonius.mcp.host`

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
# Remove registry entries (CRITICAL for Windows)
Remove-Item "HKCU:\Software\Google\Chrome\NativeMessagingHosts\ai.algonius.mcp.host" -Force -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\ai.algonius.mcp.host" -Force -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Chromium\NativeMessagingHosts\ai.algonius.mcp.host" -Force -ErrorAction SilentlyContinue

# Remove binary
Remove-Item "$env:USERPROFILE\.algonius-browser\bin\mcp-host.exe" -Force

# Remove manifest file
Remove-Item "$env:USERPROFILE\.algonius-browser\manifests\ai.algonius.mcp.host.json" -Force -ErrorAction SilentlyContinue

# Remove empty directories
Remove-Item "$env:USERPROFILE\.algonius-browser\bin" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\.algonius-browser\manifests" -Force -ErrorAction SilentlyContinue
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
