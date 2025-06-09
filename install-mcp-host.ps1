# Algonius Browser MCP Host - One-Click PowerShell Installer
# This script downloads and installs the MCP host from GitHub releases

param(
    [string]$Version = "",
    [string]$ExtensionId = "",
    [string]$ExtensionIds = "",
    [switch]$Uninstall = $false,
    [switch]$Help = $false
)

# Configuration
$REPO = "algonius/algonius-browser"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".algonius-browser\bin"
$MANIFEST_DIR = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\NativeMessagingHosts"
$CHROMIUM_MANIFEST_DIR = Join-Path $env:LOCALAPPDATA "Chromium\User Data\NativeMessagingHosts"
$EDGE_MANIFEST_DIR = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data\NativeMessagingHosts"
$MANIFEST_NAME = "ai.algonius.mcp.host.json"
$BINARY_NAME = "mcp-host.exe"

# Default extension ID
$DEFAULT_EXTENSION_ID = "chrome-extension://fmcmnpejjhphnfdaegmdmahkgaccghem/"

# Colors for output
$Colors = @{
    Green = "Green"
    Yellow = "Yellow"
    Red = "Red"
    Blue = "Blue"
    White = "White"
}

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[MCP-HOST-INSTALLER] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
    exit 1
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

# Validate extension ID format
function Test-ExtensionId {
    param([string]$Id)
    
    # Check if ID starts with chrome-extension:// and ends with /
    return $Id -match "^chrome-extension://[a-z]{32}/$"
}

# Parse extension IDs from input (comma-separated)
function ConvertFrom-ExtensionIds {
    param([string]$Input)
    
    $ids = @()
    
    # Split by comma and trim whitespace
    $rawIds = $Input -split "," | ForEach-Object { $_.Trim() }
    
    foreach ($rawId in $rawIds) {
        # Skip empty entries
        if ([string]::IsNullOrWhiteSpace($rawId)) {
            continue
        }
        
        $trimmedId = $rawId.Trim()
        
        # Auto-format extension ID if it's just the 32-character ID
        if ($trimmedId -match "^[a-z]{32}$") {
            $trimmedId = "chrome-extension://$trimmedId/"
        }
        elseif ($trimmedId -match "^chrome-extension://[a-z]{32}$") {
            # Add trailing slash if missing
            $trimmedId = "$trimmedId/"
        }
        elseif ($trimmedId -notmatch "^chrome-extension://") {
            # If it doesn't start with chrome-extension:// but isn't just 32 chars, try to add prefix
            if ($trimmedId -match "^[a-z]{32}/?$") {
                # Remove trailing slash and add proper format
                $cleanId = $trimmedId -replace "/$", ""
                $trimmedId = "chrome-extension://$cleanId/"
            }
        }
        
        # Ensure trailing slash
        if ($trimmedId -match "^chrome-extension://" -and $trimmedId -notmatch "/$") {
            $trimmedId = "$trimmedId/"
        }
        
        # Validate format
        if (Test-ExtensionId $trimmedId) {
            $ids += $trimmedId
        }
        else {
            Write-Warning "Invalid extension ID format: $trimmedId (expected: 32 lowercase characters or full chrome-extension://id/ format)"
        }
    }
    
    return $ids
}

# Prompt user for extension IDs
function Read-ExtensionIds {
    Write-Host ""
    Write-Info "Extension ID Configuration"
    Write-Info "========================="
    Write-Info "Please provide the Chrome extension ID(s) that should be allowed to communicate with the MCP host."
    Write-Info "You can provide multiple IDs separated by commas."
    Write-Host ""
    Write-Info "Input Format:"
    Write-Info "  - Just the 32-character ID: fmcmnpejjhphnfdaegmdmahkgaccghem"
    Write-Info "  - Or the full URL: chrome-extension://fmcmnpejjhphnfdaegmdmahkgaccghem/"
    Write-Host ""
    Write-Info "Default ID: $DEFAULT_EXTENSION_ID"
    Write-Host ""
    
    do {
        $userInput = Read-Host "Enter extension ID(s) (or press Enter to use default)"
        
        # Use default if empty
        if ([string]::IsNullOrWhiteSpace($userInput)) {
            return @($DEFAULT_EXTENSION_ID)
        }
        
        # Parse and validate IDs
        $parsedIds = ConvertFrom-ExtensionIds $userInput
        
        if ($parsedIds.Count -gt 0) {
            return $parsedIds
        }
        else {
            Write-Error "No valid extension IDs provided. Please try again."
        }
    } while ($true)
}

# Detect platform (Windows architecture)
function Get-Platform {
    $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
    return "windows-$arch"
}

# Get the latest release version from GitHub
function Get-LatestVersion {
    $apiUrl = "https://api.github.com/repos/$REPO/releases/latest"
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Get
        return $response.tag_name -replace "^v", ""
    }
    catch {
        Write-Error "Failed to fetch latest version information: $($_.Exception.Message)"
    }
}

# Download binary from GitHub releases
function Get-Binary {
    param(
        [string]$Version,
        [string]$Platform
    )
    
    $binaryName = "mcp-host-$Platform.exe"
    $downloadUrl = "https://github.com/$REPO/releases/download/v$Version/$binaryName"
    $tempFile = Join-Path $env:TEMP $binaryName
    
    Write-Log "Downloading from: $downloadUrl"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
        
        # Verify the file was downloaded successfully
        if (-not (Test-Path $tempFile)) {
            Write-Error "Download failed: $tempFile was not created"
        }
        
        return $tempFile
    }
    catch {
        Write-Error "Failed to download binary from $downloadUrl : $($_.Exception.Message)"
    }
}

# Create native messaging manifest
function New-Manifest {
    param(
        [string]$ManifestPath,
        [string[]]$ExtensionIds
    )
    
    $manifest = @{
        name = "ai.algonius.mcp.host"
        description = "Algonius Browser MCP Native Messaging Host"
        path = Join-Path $INSTALL_DIR $BINARY_NAME
        type = "stdio"
        allowed_origins = $ExtensionIds
    }
    
    # Ensure directory exists
    $manifestDir = Split-Path $ManifestPath -Parent
    if (-not (Test-Path $manifestDir)) {
        New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
    }
    
    # Convert to JSON and save
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $ManifestPath -Encoding UTF8
}

# Install manifest for different browsers
function Install-Manifests {
    param([string[]]$ExtensionIds)
    
    $manifestsInstalled = 0
    
    # Google Chrome
    $chromeProfileDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
    if (Test-Path $chromeProfileDir) {
        $chromeManifestPath = Join-Path $MANIFEST_DIR $MANIFEST_NAME
        New-Manifest -ManifestPath $chromeManifestPath -ExtensionIds $ExtensionIds
        Write-Log "Installed manifest for Google Chrome: $chromeManifestPath"
        $manifestsInstalled++
    }
    
    # Chromium
    $chromiumProfileDir = Join-Path $env:LOCALAPPDATA "Chromium\User Data"
    if (Test-Path $chromiumProfileDir) {
        $chromiumManifestPath = Join-Path $CHROMIUM_MANIFEST_DIR $MANIFEST_NAME
        New-Manifest -ManifestPath $chromiumManifestPath -ExtensionIds $ExtensionIds
        Write-Log "Installed manifest for Chromium: $chromiumManifestPath"
        $manifestsInstalled++
    }
    
    # Microsoft Edge
    $edgeProfileDir = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
    if (Test-Path $edgeProfileDir) {
        $edgeManifestPath = Join-Path $EDGE_MANIFEST_DIR $MANIFEST_NAME
        New-Manifest -ManifestPath $edgeManifestPath -ExtensionIds $ExtensionIds
        Write-Log "Installed manifest for Microsoft Edge: $edgeManifestPath"
        $manifestsInstalled++
    }
    
    if ($manifestsInstalled -eq 0) {
        Write-Warning "No supported browsers detected. Manifest installed to default location: $MANIFEST_DIR\$MANIFEST_NAME"
        $defaultManifestPath = Join-Path $MANIFEST_DIR $MANIFEST_NAME
        New-Manifest -ManifestPath $defaultManifestPath -ExtensionIds $ExtensionIds
    }
}

# Verify installation
function Test-Installation {
    $binaryPath = Join-Path $INSTALL_DIR $BINARY_NAME
    
    if (-not (Test-Path $binaryPath)) {
        Write-Error "Binary installation failed: $binaryPath not found"
    }
    
    # Get file info
    $fileInfo = Get-Item $binaryPath
    Write-Log "Binary file size: $($fileInfo.Length) bytes"
    
    Write-Log "Installation verification completed successfully!"
}

# Uninstall function
function Uninstall-McpHost {
    Write-Log "Uninstalling Algonius Browser MCP Host..."
    
    # Remove binary
    $binaryPath = Join-Path $INSTALL_DIR $BINARY_NAME
    if (Test-Path $binaryPath) {
        Remove-Item $binaryPath -Force
        Write-Log "Removed binary: $binaryPath"
    }
    
    # Remove manifests
    $manifestPaths = @(
        (Join-Path $MANIFEST_DIR $MANIFEST_NAME),
        (Join-Path $CHROMIUM_MANIFEST_DIR $MANIFEST_NAME),
        (Join-Path $EDGE_MANIFEST_DIR $MANIFEST_NAME)
    )
    
    foreach ($manifestPath in $manifestPaths) {
        if (Test-Path $manifestPath) {
            Remove-Item $manifestPath -Force
            Write-Log "Removed manifest: $manifestPath"
        }
    }
    
    # Remove install directory if empty
    if ((Test-Path $INSTALL_DIR) -and ((Get-ChildItem $INSTALL_DIR).Count -eq 0)) {
        Remove-Item $INSTALL_DIR -Force
        Write-Log "Removed empty directory: $INSTALL_DIR"
    }
    
    Write-Log "Uninstallation completed!"
    exit 0
}

# Print usage information
function Show-Usage {
    Write-Host @"
Algonius Browser MCP Host Installer

Usage: .\install-mcp-host.ps1 [OPTIONS]

OPTIONS:
  -Version VERSION              Install a specific version (e.g., 1.0.0)
  -ExtensionId ID               Specify a single extension ID
  -ExtensionIds ID1,ID2,ID3     Specify multiple extension IDs (comma-separated)
  -Uninstall                    Uninstall the MCP host
  -Help                         Show this help message

Extension ID Format:
  chrome-extension://32-character-lowercase-id/

Examples:
  .\install-mcp-host.ps1                                                    # Install latest version (interactive ID input)
  .\install-mcp-host.ps1 -Version 1.2.3                                    # Install specific version (interactive ID input)
  .\install-mcp-host.ps1 -ExtensionId "chrome-extension://abcd.../"        # Install with single extension ID
  .\install-mcp-host.ps1 -ExtensionIds "chrome-extension://abc.../,chrome-extension://def.../"  # Install with multiple IDs
  .\install-mcp-host.ps1 -Uninstall                                        # Uninstall
"@
    exit 0
}

# Main installation function
function Install-McpHost {
    # Handle command line arguments
    if ($Help) {
        Show-Usage
    }
    
    if ($Uninstall) {
        Uninstall-McpHost
    }
    
    # Parse extension IDs from command line
    $extensionIds = @()
    $extensionIdsProvided = $false
    
    if (-not [string]::IsNullOrWhiteSpace($ExtensionId)) {
        $parsedIds = ConvertFrom-ExtensionIds $ExtensionId
        if ($parsedIds.Count -gt 0) {
            $extensionIds = $parsedIds
            $extensionIdsProvided = $true
        }
        else {
            Write-Error "Invalid extension ID format: $ExtensionId"
        }
    }
    elseif (-not [string]::IsNullOrWhiteSpace($ExtensionIds)) {
        $parsedIds = ConvertFrom-ExtensionIds $ExtensionIds
        if ($parsedIds.Count -gt 0) {
            $extensionIds = $parsedIds
            $extensionIdsProvided = $true
        }
        else {
            Write-Error "Invalid extension IDs format: $ExtensionIds"
        }
    }
    
    # Print banner
    Write-Host ""
    Write-Log "🚀 Algonius Browser MCP Host Installer"
    Write-Log "======================================"
    Write-Host ""
    
    # Detect platform
    $platform = Get-Platform
    Write-Log "Detected platform: $platform"
    
    # Get version
    if ([string]::IsNullOrWhiteSpace($Version)) {
        Write-Log "Fetching latest release information..."
        $Version = Get-LatestVersion
        if ([string]::IsNullOrWhiteSpace($Version)) {
            Write-Error "Failed to fetch latest version information"
        }
    }
    Write-Log "Installing version: $Version"
    
    # Create installation directory
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }
    
    # Download binary
    Write-Log "Downloading MCP host binary..."
    $tempBinary = Get-Binary -Version $Version -Platform $platform
    
    # Install binary
    $binaryPath = Join-Path $INSTALL_DIR $BINARY_NAME
    Write-Log "Installing binary to: $binaryPath"
    Copy-Item $tempBinary $binaryPath -Force
    
    # Clean up temp file
    Remove-Item $tempBinary -Force
    
    # Get extension IDs (command line or interactive)
    if (-not $extensionIdsProvided) {
        Write-Log "Getting extension ID configuration..."
        $extensionIds = Read-ExtensionIds
    }
    
    # Display configured extension IDs
    Write-Log "Configured extension IDs:"
    foreach ($id in $extensionIds) {
        Write-Info "  - $id"
    }
    
    # Install manifests
    Write-Log "Installing Native Messaging manifests..."
    Install-Manifests -ExtensionIds $extensionIds
    
    # Verify installation
    Test-Installation
    
    # Success message
    Write-Host ""
    Write-Log "✅ Installation completed successfully!"
    Write-Log "======================================"
    Write-Log "Binary installed: $binaryPath"
    Write-Log "Manifests installed for detected browsers"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Info "1. Install the Algonius Browser Chrome extension"
    Write-Info "2. Configure your LLM providers in the extension options"
    Write-Info "3. Start using MCP features with external AI systems"
    Write-Host ""
    Write-Info "For troubleshooting and documentation, visit:"
    Write-Info "https://github.com/$REPO"
    Write-Host ""
}

# Run main function
Install-McpHost
