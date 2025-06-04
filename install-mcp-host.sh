#!/bin/bash

set -e

# Algonius Browser MCP Host - One-Click Installer
# This script downloads and installs the MCP host from GitHub releases

# Configuration
REPO="algonius/algonius-browser"
INSTALL_DIR="${HOME}/.algonius-browser/bin"
MANIFEST_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_MANIFEST_DIR="${HOME}/.config/chromium/NativeMessagingHosts"
MANIFEST_NAME="ai.algonius.mcp.host.json"
BINARY_NAME="mcp-host"

# Default extension ID
DEFAULT_EXTENSION_ID="chrome-extension://fmcmnpejjhphnfdaegmdmahkgaccghem/"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
  echo -e "${GREEN}[MCP-HOST-INSTALLER]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Validate extension ID format
validate_extension_id() {
  local id="$1"
  
  # Check if ID starts with chrome-extension:// and ends with /
  if [[ "$id" =~ ^chrome-extension://[a-z]{32}/$ ]]; then
    return 0
  else
    return 1
  fi
}

# Parse extension IDs from input (comma-separated)
parse_extension_ids() {
  local input="$1"
  local -a ids
  
  # Split by comma and trim whitespace
  IFS=',' read -ra ADDR <<< "$input"
  for i in "${ADDR[@]}"; do
    # Trim whitespace
    local trimmed_id="$(echo "$i" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    
    # Skip empty entries
    if [ -z "$trimmed_id" ]; then
      continue
    fi
    
    # Auto-format extension ID if it's just the 32-character ID
    if [[ "$trimmed_id" =~ ^[a-z]{32}$ ]]; then
      trimmed_id="chrome-extension://${trimmed_id}/"
    elif [[ "$trimmed_id" =~ ^chrome-extension://[a-z]{32}$ ]]; then
      # Add trailing slash if missing
      trimmed_id="${trimmed_id}/"
    elif [[ "$trimmed_id" != chrome-extension://* ]]; then
      # If it doesn't start with chrome-extension:// but isn't just 32 chars, try to add prefix
      if [[ "$trimmed_id" =~ ^[a-z]{32}/?$ ]]; then
        # Remove trailing slash and add proper format
        local clean_id="$(echo "$trimmed_id" | sed 's|/$||')"
        trimmed_id="chrome-extension://${clean_id}/"
      fi
    fi
    
    # Ensure trailing slash
    if [[ "$trimmed_id" != */ ]] && [[ "$trimmed_id" == chrome-extension://* ]]; then
      trimmed_id="${trimmed_id}/"
    fi
    
    # Validate format
    if validate_extension_id "$trimmed_id"; then
      ids+=("$trimmed_id")
    else
      warn "Invalid extension ID format: $trimmed_id (expected: 32 lowercase characters or full chrome-extension://id/ format)"
    fi
  done
  
  # Return array as space-separated string
  printf '%s\n' "${ids[@]}"
}

# Prompt user for extension IDs
prompt_for_extension_ids() {
  echo >&2
  echo -e "${BLUE}[INFO]${NC} Extension ID Configuration" >&2
  echo -e "${BLUE}[INFO]${NC} =========================" >&2
  echo -e "${BLUE}[INFO]${NC} Please provide the Chrome extension ID(s) that should be allowed to communicate with the MCP host." >&2
  echo -e "${BLUE}[INFO]${NC} You can provide multiple IDs separated by commas." >&2
  echo >&2
  echo -e "${BLUE}[INFO]${NC} Input Format:" >&2
  echo -e "${BLUE}[INFO]${NC}   - Just the 32-character ID: fmcmnpejjhphnfdaegmdmahkgaccghem" >&2
  echo -e "${BLUE}[INFO]${NC}   - Or the full URL: chrome-extension://fmcmnpejjhphnfdaegmdmahkgaccghem/" >&2
  echo >&2
  echo -e "${BLUE}[INFO]${NC} Default ID: ${DEFAULT_EXTENSION_ID}" >&2
  echo >&2
  
  while true; do
    echo -n "Enter extension ID(s) (or press Enter to use default): " >&2
    read -r user_input
    
    # Use default if empty
    if [ -z "$user_input" ]; then
      echo "$DEFAULT_EXTENSION_ID"
      return 0
    fi
    
    # Parse and validate IDs
    local parsed_ids
    parsed_ids=$(parse_extension_ids "$user_input")
    
    if [ -n "$parsed_ids" ]; then
      echo "$parsed_ids"
      return 0
    else
      echo -e "${RED}[ERROR]${NC} No valid extension IDs provided. Please try again." >&2
    fi
  done
}

# Detect operating system and architecture
detect_platform() {
  local os=""
  local arch=""
  
  # Detect OS
  case "$(uname -s)" in
    Linux*)   os="linux" ;;
    Darwin*)  os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows" ;;
    *)        error "Unsupported operating system: $(uname -s)" ;;
  esac
  
  # Detect architecture
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)            error "Unsupported architecture: $(uname -m)" ;;
  esac
  
  # Special handling for Windows
  if [ "$os" = "windows" ]; then
    BINARY_NAME="${BINARY_NAME}.exe"
  fi
  
  echo "${os}-${arch}"
}

# Get the latest release version from GitHub
get_latest_version() {
  local api_url="https://api.github.com/repos/${REPO}/releases/latest"
  
  if command -v curl &> /dev/null; then
    curl -s "${api_url}" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//'
  elif command -v wget &> /dev/null; then
    wget -qO- "${api_url}" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//'
  else
    error "Neither curl nor wget is available. Please install one of them."
  fi
}

# Download binary from GitHub releases
download_binary() {
  local version="$1"
  local platform="$2"
  local binary_name="mcp-host-${platform}"
  
  # Add .exe extension for Windows
  if [[ "$platform" == *"windows"* ]]; then
    binary_name="${binary_name}.exe"
  fi
  
  local download_url="https://github.com/${REPO}/releases/download/v${version}/${binary_name}"
  local temp_file="/tmp/${binary_name}"
  
  # Log to stderr to avoid polluting the return value
  log "Downloading from: ${download_url}" >&2
  
  if command -v curl &> /dev/null; then
    if ! curl -L -o "${temp_file}" "${download_url}" 2>/dev/null; then
      error "Failed to download binary from ${download_url}"
    fi
  elif command -v wget &> /dev/null; then
    if ! wget -O "${temp_file}" "${download_url}" 2>/dev/null; then
      error "Failed to download binary from ${download_url}"
    fi
  else
    error "Neither curl nor wget is available. Please install one of them."
  fi
  
  # Verify the file was downloaded successfully
  if [ ! -f "${temp_file}" ]; then
    error "Download failed: ${temp_file} was not created"
  fi
  
  echo "${temp_file}"
}

# Create native messaging manifest
create_manifest() {
  local manifest_path="$1"
  shift
  local extension_ids=("$@")
  
  # Start building the manifest
  cat > "${manifest_path}" << EOF
{
  "name": "ai.algonius.mcp.host",
  "description": "Algonius Browser MCP Native Messaging Host",
  "path": "${INSTALL_DIR}/${BINARY_NAME}",
  "type": "stdio",
  "allowed_origins": [
EOF

  # Add extension IDs
  local first=true
  for id in "${extension_ids[@]}"; do
    if [ "$first" = true ]; then
      echo "    \"${id}\"" >> "${manifest_path}"
      first=false
    else
      echo ",    \"${id}\"" >> "${manifest_path}"
    fi
  done
  
  # Close the manifest
  cat >> "${manifest_path}" << EOF
  ]
}
EOF
}

# Install manifest for different browsers
install_manifests() {
  local extension_ids=("$@")
  local manifests_installed=0
  
  # Google Chrome
  if [ -d "${HOME}/.config/google-chrome" ] || [ -d "${HOME}/Library/Application Support/Google/Chrome" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      CHROME_MANIFEST_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    else
      CHROME_MANIFEST_DIR="${MANIFEST_DIR}"
    fi
    
    mkdir -p "${CHROME_MANIFEST_DIR}"
    create_manifest "${CHROME_MANIFEST_DIR}/${MANIFEST_NAME}" "${extension_ids[@]}"
    log "Installed manifest for Google Chrome: ${CHROME_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  # Chromium
  if [ -d "${HOME}/.config/chromium" ] || [ -d "${HOME}/Library/Application Support/Chromium" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      CHROMIUM_MANIFEST_DIR="${HOME}/Library/Application Support/Chromium/NativeMessagingHosts"
    fi
    
    mkdir -p "${CHROMIUM_MANIFEST_DIR}"
    create_manifest "${CHROMIUM_MANIFEST_DIR}/${MANIFEST_NAME}" "${extension_ids[@]}"
    log "Installed manifest for Chromium: ${CHROMIUM_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  # Microsoft Edge (if detected)
  if [[ "$OSTYPE" == "darwin"* ]] && [ -d "${HOME}/Library/Application Support/Microsoft Edge" ]; then
    EDGE_MANIFEST_DIR="${HOME}/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    mkdir -p "${EDGE_MANIFEST_DIR}"
    create_manifest "${EDGE_MANIFEST_DIR}/${MANIFEST_NAME}" "${extension_ids[@]}"
    log "Installed manifest for Microsoft Edge: ${EDGE_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  if [ $manifests_installed -eq 0 ]; then
    warn "No supported browsers detected. Manifest installed to default location: ${MANIFEST_DIR}/${MANIFEST_NAME}"
    mkdir -p "${MANIFEST_DIR}"
    create_manifest "${MANIFEST_DIR}/${MANIFEST_NAME}" "${extension_ids[@]}"
  fi
}

# Verify installation
verify_installation() {
  if [ ! -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
    error "Binary installation failed: ${INSTALL_DIR}/${BINARY_NAME} not found"
  fi
  
  if [ ! -x "${INSTALL_DIR}/${BINARY_NAME}" ]; then
    error "Binary is not executable: ${INSTALL_DIR}/${BINARY_NAME}"
  fi
  
  # Get basic file info
  local file_size=$(stat -c%s "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || echo "unknown")
  log "Binary file size: ${file_size} bytes"
  
  log "Installation verification completed successfully!"
}

# Uninstall function
uninstall() {
  log "Uninstalling Algonius Browser MCP Host..."
  
  # Remove binary
  if [ -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
    rm -f "${INSTALL_DIR}/${BINARY_NAME}"
    log "Removed binary: ${INSTALL_DIR}/${BINARY_NAME}"
  fi
  
  # Remove manifests
  for manifest_dir in "${MANIFEST_DIR}" "${CHROMIUM_MANIFEST_DIR}" \
                      "${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
                      "${HOME}/Library/Application Support/Chromium/NativeMessagingHosts" \
                      "${HOME}/Library/Application Support/Microsoft Edge/NativeMessagingHosts"; do
    if [ -f "${manifest_dir}/${MANIFEST_NAME}" ]; then
      rm -f "${manifest_dir}/${MANIFEST_NAME}"
      log "Removed manifest: ${manifest_dir}/${MANIFEST_NAME}"
    fi
  done
  
  # Remove install directory if empty
  if [ -d "${INSTALL_DIR}" ] && [ -z "$(ls -A "${INSTALL_DIR}")" ]; then
    rmdir "${INSTALL_DIR}"
    log "Removed empty directory: ${INSTALL_DIR}"
  fi
  
  log "Uninstallation completed!"
  exit 0
}

# Print usage information
usage() {
  cat << EOF
Algonius Browser MCP Host Installer

Usage: $0 [OPTIONS]

OPTIONS:
  --version VERSION              Install a specific version (e.g., 1.0.0)
  --extension-id ID              Specify a single extension ID
  --extension-ids ID1,ID2,ID3    Specify multiple extension IDs (comma-separated)
  --uninstall                    Uninstall the MCP host
  --help                         Show this help message

Extension ID Format:
  chrome-extension://32-character-lowercase-id/

Examples:
  $0                                                    # Install latest version (interactive ID input)
  $0 --version 1.2.3                                   # Install specific version (interactive ID input)
  $0 --extension-id chrome-extension://abcd.../        # Install with single extension ID
  $0 --extension-ids chrome-extension://abc.../,chrome-extension://def.../  # Install with multiple IDs
  $0 --uninstall                                       # Uninstall
EOF
  exit 0
}

# Main installation function
main() {
  local version=""
  local force_version=false
  local extension_ids_provided=false
  local extension_ids=()
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --version)
        version="$2"
        force_version=true
        shift 2
        ;;
      --extension-id)
        local parsed_ids
        parsed_ids=$(parse_extension_ids "$2")
        if [ -n "$parsed_ids" ]; then
          while IFS= read -r line; do
            extension_ids+=("$line")
          done <<< "$parsed_ids"
          extension_ids_provided=true
        else
          error "Invalid extension ID format: $2"
        fi
        shift 2
        ;;
      --extension-ids)
        local parsed_ids
        parsed_ids=$(parse_extension_ids "$2")
        if [ -n "$parsed_ids" ]; then
          while IFS= read -r line; do
            extension_ids+=("$line")
          done <<< "$parsed_ids"
          extension_ids_provided=true
        else
          error "Invalid extension IDs format: $2"
        fi
        shift 2
        ;;
      --uninstall)
        uninstall
        ;;
      --help)
        usage
        ;;
      *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
    esac
  done
  
  # Print banner
  echo
  log "🚀 Algonius Browser MCP Host Installer"
  log "======================================"
  echo
  
  # Detect platform
  local platform=$(detect_platform)
  log "Detected platform: ${platform}"
  
  # Get version
  if [ "$force_version" = false ]; then
    log "Fetching latest release information..."
    version=$(get_latest_version)
    if [ -z "$version" ]; then
      error "Failed to fetch latest version information"
    fi
  fi
  log "Installing version: ${version}"
  
  # Create installation directory
  mkdir -p "${INSTALL_DIR}"
  
  # Download binary
  log "Downloading MCP host binary..."
  local temp_binary
  temp_binary=$(download_binary "$version" "$platform")
  
  # Debug: Check if file exists
  if [ ! -f "$temp_binary" ]; then
    error "Downloaded file not found: $temp_binary"
  fi
  
  # Install binary
  log "Installing binary to: ${INSTALL_DIR}/${BINARY_NAME}"
  cp "${temp_binary}" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
  
  # Clean up temp file
  rm -f "${temp_binary}"
  
  # Get extension IDs (command line or interactive)
  if [ "$extension_ids_provided" = false ]; then
    log "Getting extension ID configuration..."
    local prompted_ids
    prompted_ids=$(prompt_for_extension_ids)
    
    # Parse prompted IDs into array
    while IFS= read -r line; do
      extension_ids+=("$line")
    done <<< "$prompted_ids"
  fi
  
  # Display configured extension IDs
  log "Configured extension IDs:"
  for id in "${extension_ids[@]}"; do
    info "  - $id"
  done
  
  # Install manifests
  log "Installing Native Messaging manifests..."
  install_manifests "${extension_ids[@]}"
  
  # Verify installation
  verify_installation
  
  # Success message
  echo
  log "✅ Installation completed successfully!"
  log "======================================"
  log "Binary installed: ${INSTALL_DIR}/${BINARY_NAME}"
  log "Manifests installed for detected browsers"
  echo
  info "Next steps:"
  info "1. Install the Algonius Browser Chrome extension"
  info "2. Configure your LLM providers in the extension options"
  info "3. Start using MCP features with external AI systems"
  echo
  info "For troubleshooting and documentation, visit:"
  info "https://github.com/${REPO}"
  echo
}

# Run main function with all arguments
main "$@"
