# Algonius Browser MCP Host - One-Click PowerShell Installer
# This script downloads and installs the MCP host from GitHub releases

param(
    [string]$Version = "",
    [string]$ExtensionId = "",
    [string]$ExtensionIds = "",
    [switch]$Uninstall = $false,
    [switch]$Help = $false,
    [switch]$Debug = $false
)

# Configuration
$REPO = "algonius/algonius-browser"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".algonius-browser\bin"
$MANIFEST_DIR = Join-Path $env:USERPROFILE ".algonius-browser\manifests"
$MANIFEST_NAME = "ai.algonius.mcp.host.json"
$BINARY_NAME = "mcp-host.exe"
$HOST_NAME = "ai.algonius.mcp.host"

# Registry paths for different browsers
$REGISTRY_PATHS = @{
    Chrome   = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HOST_NAME"
    Edge     = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HOST_NAME"
    Chromium = "HKCU:\Software\Chromium\NativeMessagingHosts\$HOST_NAME"
}

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

function Write-Debug {
    param([string]$Message)
    if ($Debug) {
        Write-Host "[DEBUG] $Message" -ForegroundColor Magenta
    }
}

# Validate extension ID format
function Test-ExtensionId {
    param([string]$Id)
    
    # Check if ID starts with chrome-extension:// and ends with /
    # Chrome extension IDs are 32 characters containing lowercase letters (a-z) and digits (0-9)
    return $Id -match "^chrome-extension://[a-z0-9]{32}/$"
}

# Parse extension IDs from input (comma-separated) - INLINE VERSION
# This function has been redesigned to work around PowerShell parameter passing issues
function ConvertFrom-ExtensionIds {
    param([string]$Input)
    
    Write-Debug "ConvertFrom-ExtensionIds called with input: '$Input'"
    
    # Return inline processing result immediately
    $finalResult = @()
    
    # Process input directly without intermediate variables
    ($Input -split "," | ForEach-Object { $_.Trim() }) | ForEach-Object {
        $currentId = $_
        Write-Debug "Processing ID: '$currentId'"
        
        # Skip empty entries
        if ([string]::IsNullOrWhiteSpace($currentId)) {
            Write-Debug "Skipping empty ID"
            return
        }
        
        $processedId = $currentId.Trim()
        Write-Debug "After trim: '$processedId'"
        
        # Auto-format extension ID if it's just the 32-character ID
        if ($processedId -match "^[a-z0-9]{32}$") {
            $processedId = "chrome-extension://$processedId/"
            Write-Debug "Added chrome-extension prefix: '$processedId'"
        }
        elseif ($processedId -match "^chrome-extension://[a-z0-9]{32}$") {
            # Add trailing slash if missing
            $processedId = "$processedId/"
            Write-Debug "Added trailing slash: '$processedId'"
        }
        elseif ($processedId -notmatch "^chrome-extension://") {
            # If it doesn't start with chrome-extension:// but isn't just 32 chars, try to add prefix
            if ($processedId -match "^[a-z0-9]{32}/?$") {
                # Remove trailing slash and add proper format
                $baseId = $processedId -replace "/$", ""
                $processedId = "chrome-extension://$baseId/"
                Write-Debug "Fixed format: '$processedId'"
            }
        }
        
        # Ensure trailing slash
        if ($processedId -match "^chrome-extension://" -and $processedId -notmatch "/$") {
            $processedId = "$processedId/"
            Write-Debug "Ensured trailing slash: '$processedId'"
        }
        
        # Validate format
        if ($processedId -match "^chrome-extension://[a-z0-9]{32}/$") {
            $finalResult += $processedId
            Write-Debug "VALID: Added '$processedId' to result"
        }
        else {
            Write-Warning "Invalid extension ID format: $processedId (expected: 32 lowercase characters and numbers or full chrome-extension://id/ format)"
        }
    }
    
    Write-Debug "Final result count: $($finalResult.Count)"
    return $finalResult
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
    
    $maxAttempts = 3
    $attempt = 0
    
    do {
        $attempt++
        
        # Use different input methods for better compatibility
        try {
            # Try multiple input methods for better compatibility with downloaded scripts
            Write-Host "Enter extension ID(s) (or press Enter to use default): " -NoNewline -ForegroundColor Yellow
            
            # Force input reading with different approaches
            if ($Host.UI.RawUI.KeyAvailable) {
                $userInput = Read-Host
            } else {
                # Alternative input method for script execution context
                $userInput = [System.Console]::ReadLine()
            }
            
            Write-Debug "Raw input received: '$userInput'"
            
            # Trim any whitespace
            $userInput = $userInput.Trim()
            Write-Debug "After trim: '$userInput'"
            
            # Use default if empty or just whitespace
            if ([string]::IsNullOrWhiteSpace($userInput)) {
                Write-Debug "Using default extension ID"
                return @($DEFAULT_EXTENSION_ID)
            }
            
            # Parse and validate IDs using inline processing instead of function call
            Write-Debug "Processing user input: '$userInput'"
            $finalResult = @()
            
            ($userInput -split "," | ForEach-Object { $_.Trim() }) | ForEach-Object {
                $currentId = $_
                Write-Debug "Processing ID: '$currentId'"
                
                # Skip empty entries
                if ([string]::IsNullOrWhiteSpace($currentId)) {
                    Write-Debug "Skipping empty ID"
                    return
                }
                
                $processedId = $currentId.Trim()
                Write-Debug "After trim: '$processedId'"
                
                # Auto-format extension ID if it's just the 32-character ID
                if ($processedId -match "^[a-z0-9]{32}$") {
                    $processedId = "chrome-extension://$processedId/"
                    Write-Debug "Added chrome-extension prefix: '$processedId'"
                }
                elseif ($processedId -match "^chrome-extension://[a-z0-9]{32}$") {
                    # Add trailing slash if missing
                    $processedId = "$processedId/"
                    Write-Debug "Added trailing slash: '$processedId'"
                }
                elseif ($processedId -notmatch "^chrome-extension://") {
                    # If it doesn't start with chrome-extension:// but isn't just 32 chars, try to add prefix
                    if ($processedId -match "^[a-z0-9]{32}/?$") {
                        # Remove trailing slash and add proper format
                        $baseId = $processedId -replace "/$", ""
                        $processedId = "chrome-extension://$baseId/"
                        Write-Debug "Fixed format: '$processedId'"
                    }
                }
                
                # Ensure trailing slash
                if ($processedId -match "^chrome-extension://" -and $processedId -notmatch "/$") {
                    $processedId = "$processedId/"
                    Write-Debug "Ensured trailing slash: '$processedId'"
                }
                
                # Validate format
                if ($processedId -match "^chrome-extension://[a-z0-9]{32}/$") {
                    $finalResult += $processedId
                    Write-Debug "VALID: Added '$processedId' to result"
                }
                else {
                    Write-Warning "Invalid extension ID format: $processedId (expected: 32 lowercase characters and numbers or full chrome-extension://id/ format)"
                }
            }
            
            Write-Debug "Final result count: $($finalResult.Count)"
            
            if ($finalResult.Count -gt 0) {
                return $finalResult
            }
            else {
                Write-Warning "No valid extension IDs provided. Please try again. (Attempt $attempt of $maxAttempts)"
                if ($attempt -ge $maxAttempts) {
                    Write-Warning "Maximum attempts reached. Using default extension ID."
                    return @($DEFAULT_EXTENSION_ID)
                }
            }
        }
        catch {
            Write-Warning "Input error: $($_.Exception.Message). Using default extension ID."
            return @($DEFAULT_EXTENSION_ID)
        }
    } while ($attempt -lt $maxAttempts)
    
    # Fallback to default
    return @($DEFAULT_EXTENSION_ID)
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

# Create native messaging manifest file
function New-Manifest {
    param(
        [string]$ManifestPath,
        [string[]]$ExtensionIds
    )
    
    $manifest = @{
        name = $HOST_NAME
        description = "Algonius Browser MCP Native Messaging Host"
        path = (Join-Path $INSTALL_DIR $BINARY_NAME).Replace('\', '\\')
        type = "stdio"
        allowed_origins = $ExtensionIds
    }
    
    # Ensure directory exists
    $manifestDir = Split-Path $ManifestPath -Parent
    if (-not (Test-Path $manifestDir)) {
        New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
    }
    
    # Convert to JSON and save with proper Windows path formatting
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $ManifestPath -Encoding UTF8
    
    return $ManifestPath
}

# Check if browser is installed
function Test-BrowserInstalled {
    param([string]$BrowserName)
    
    switch ($BrowserName) {
        "Chrome" {
            return Test-Path (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data")
        }
        "Edge" {
            return Test-Path (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data")
        }
        "Chromium" {
            return Test-Path (Join-Path $env:LOCALAPPDATA "Chromium\User Data")
        }
        default {
            return $false
        }
    }
}

# Register native messaging host in Windows registry
function Register-NativeMessagingHost {
    param(
        [string]$BrowserName,
        [string]$RegistryPath,
        [string]$ManifestPath
    )
    
    try {
        # Create registry key path if it doesn't exist
        $parentPath = Split-Path $RegistryPath -Parent
        if (-not (Test-Path $parentPath)) {
            New-Item -Path $parentPath -Force | Out-Null
        }
        
        # Create the host-specific registry key and set the manifest path
        New-Item -Path $RegistryPath -Force | Out-Null
        New-ItemProperty -Path $RegistryPath -Name "(Default)" -Value $ManifestPath -PropertyType String -Force | Out-Null
        
        Write-Log "Registered $BrowserName native messaging host: $RegistryPath"
        return $true
    }
    catch {
        Write-Warning "Failed to register $BrowserName native messaging host: $($_.Exception.Message)"
        return $false
    }
}

# Install manifests and register with browsers
function Install-NativeMessagingHosts {
    param([string[]]$ExtensionIds)
    
    # Create single manifest file
    $manifestPath = Join-Path $MANIFEST_DIR $MANIFEST_NAME
    $manifestPath = New-Manifest -ManifestPath $manifestPath -ExtensionIds $ExtensionIds
    
    Write-Log "Created manifest file: $manifestPath"
    
    $registrationsSuccessful = 0
    
    # Register with each detected browser
    foreach ($browser in $REGISTRY_PATHS.Keys) {
        if (Test-BrowserInstalled $browser) {
            $registryPath = $REGISTRY_PATHS[$browser]
            
            if (Register-NativeMessagingHost -BrowserName $browser -RegistryPath $registryPath -ManifestPath $manifestPath) {
                $registrationsSuccessful++
            }
        }
        else {
            Write-Info "$browser not detected, skipping registration"
        }
    }
    
    if ($registrationsSuccessful -eq 0) {
        Write-Warning "No browsers successfully registered. Please check that Chrome, Edge, or Chromium are installed."
        Write-Info "Manifest file created at: $manifestPath"
        Write-Info "You may need to manually register the native messaging host."
    }
    else {
        Write-Log "Successfully registered with $registrationsSuccessful browser(s)"
    }
    
    return $registrationsSuccessful
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
    
    # Remove registry entries
    $registriesRemoved = 0
    foreach ($browser in $REGISTRY_PATHS.Keys) {
        $registryPath = $REGISTRY_PATHS[$browser]
        
        if (Test-Path $registryPath) {
            try {
                Remove-Item $registryPath -Force
                Write-Log "Removed $browser registry entry: $registryPath"
                $registriesRemoved++
            }
            catch {
                Write-Warning "Failed to remove $browser registry entry: $($_.Exception.Message)"
            }
        }
        else {
            Write-Info "$browser registry entry not found, skipping"
        }
    }
    
    Write-Log "Removed $registriesRemoved registry entries"
    
    # Remove binary
    $binaryPath = Join-Path $INSTALL_DIR $BINARY_NAME
    if (Test-Path $binaryPath) {
        Remove-Item $binaryPath -Force
        Write-Log "Removed binary: $binaryPath"
    }
    
    # Remove manifest file
    $manifestPath = Join-Path $MANIFEST_DIR $MANIFEST_NAME
    if (Test-Path $manifestPath) {
        Remove-Item $manifestPath -Force
        Write-Log "Removed manifest: $manifestPath"
    }
    
    # Remove empty directories
    if ((Test-Path $INSTALL_DIR) -and ((Get-ChildItem $INSTALL_DIR -ErrorAction SilentlyContinue).Count -eq 0)) {
        Remove-Item $INSTALL_DIR -Force
        Write-Log "Removed empty directory: $INSTALL_DIR"
    }
    
    if ((Test-Path $MANIFEST_DIR) -and ((Get-ChildItem $MANIFEST_DIR -ErrorAction SilentlyContinue).Count -eq 0)) {
        Remove-Item $MANIFEST_DIR -Force
        Write-Log "Removed empty directory: $MANIFEST_DIR"
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
    
    # Parse extension IDs from command line - INLINE VERSION to avoid function call issues
    $extensionIds = @()
    $extensionIdsProvided = $false
    
    # Process single ExtensionId parameter
    if (-not [string]::IsNullOrWhiteSpace($ExtensionId)) {
        Write-Debug "Processing single ExtensionId: '$ExtensionId'"
        
        $tempResults = @()
        ($ExtensionId -split "," | ForEach-Object { $_.Trim() }) | ForEach-Object {
            $currentId = $_
            if (-not [string]::IsNullOrWhiteSpace($currentId)) {
                $processedId = $currentId.Trim()
                
                # Auto-format extension ID if it's just the 32-character ID
                if ($processedId -match "^[a-z0-9]{32}$") {
                    $processedId = "chrome-extension://$processedId/"
                }
                elseif ($processedId -match "^chrome-extension://[a-z0-9]{32}$") {
                    $processedId = "$processedId/"
                }
                elseif ($processedId -notmatch "^chrome-extension://") {
                    if ($processedId -match "^[a-z0-9]{32}/?$") {
                        $baseId = $processedId -replace "/$", ""
                        $processedId = "chrome-extension://$baseId/"
                    }
                }
                
                # Ensure trailing slash
                if ($processedId -match "^chrome-extension://" -and $processedId -notmatch "/$") {
                    $processedId = "$processedId/"
                }
                
                # Validate format
                if ($processedId -match "^chrome-extension://[a-z0-9]{32}/$") {
                    $tempResults += $processedId
                    Write-Debug "Valid ID added: '$processedId'"
                }
                else {
                    Write-Warning "Invalid extension ID format: $processedId"
                }
            }
        }
        
        if ($tempResults.Count -gt 0) {
            $extensionIds = $tempResults
            $extensionIdsProvided = $true
        }
        else {
            Write-Error "Invalid extension ID format: $ExtensionId"
        }
    }
    # Process multiple ExtensionIds parameter
    elseif (-not [string]::IsNullOrWhiteSpace($ExtensionIds)) {
        Write-Debug "Processing multiple ExtensionIds: '$ExtensionIds'"
        
        $tempResults = @()
        ($ExtensionIds -split "," | ForEach-Object { $_.Trim() }) | ForEach-Object {
            $currentId = $_
            if (-not [string]::IsNullOrWhiteSpace($currentId)) {
                $processedId = $currentId.Trim()
                
                # Auto-format extension ID if it's just the 32-character ID
                if ($processedId -match "^[a-z0-9]{32}$") {
                    $processedId = "chrome-extension://$processedId/"
                }
                elseif ($processedId -match "^chrome-extension://[a-z0-9]{32}$") {
                    $processedId = "$processedId/"
                }
                elseif ($processedId -notmatch "^chrome-extension://") {
                    if ($processedId -match "^[a-z0-9]{32}/?$") {
                        $baseId = $processedId -replace "/$", ""
                        $processedId = "chrome-extension://$baseId/"
                    }
                }
                
                # Ensure trailing slash
                if ($processedId -match "^chrome-extension://" -and $processedId -notmatch "/$") {
                    $processedId = "$processedId/"
                }
                
                # Validate format
                if ($processedId -match "^chrome-extension://[a-z0-9]{32}/$") {
                    $tempResults += $processedId
                    Write-Debug "Valid ID added: '$processedId'"
                }
                else {
                    Write-Warning "Invalid extension ID format: $processedId"
                }
            }
        }
        
        if ($tempResults.Count -gt 0) {
            $extensionIds = $tempResults
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
    
    # Install manifests and register with browsers
    Write-Log "Installing Native Messaging manifests and registering with browsers..."
    $registrationsSuccessful = Install-NativeMessagingHosts -ExtensionIds $extensionIds
    
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
