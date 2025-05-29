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
  
  cat > "${manifest_path}" << EOF
{
  "name": "ai.algonius.mcp.host",
  "description": "Algonius Browser MCP Native Messaging Host",
  "path": "${INSTALL_DIR}/${BINARY_NAME}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://neiiiibdmgkoabmaodedfkgomofhcbal/"
  ]
}
EOF
}

# Install manifest for different browsers
install_manifests() {
  local manifests_installed=0
  
  # Google Chrome
  if [ -d "${HOME}/.config/google-chrome" ] || [ -d "${HOME}/Library/Application Support/Google/Chrome" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      CHROME_MANIFEST_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    else
      CHROME_MANIFEST_DIR="${MANIFEST_DIR}"
    fi
    
    mkdir -p "${CHROME_MANIFEST_DIR}"
    create_manifest "${CHROME_MANIFEST_DIR}/${MANIFEST_NAME}"
    log "Installed manifest for Google Chrome: ${CHROME_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  # Chromium
  if [ -d "${HOME}/.config/chromium" ] || [ -d "${HOME}/Library/Application Support/Chromium" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      CHROMIUM_MANIFEST_DIR="${HOME}/Library/Application Support/Chromium/NativeMessagingHosts"
    fi
    
    mkdir -p "${CHROMIUM_MANIFEST_DIR}"
    create_manifest "${CHROMIUM_MANIFEST_DIR}/${MANIFEST_NAME}"
    log "Installed manifest for Chromium: ${CHROMIUM_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  # Microsoft Edge (if detected)
  if [[ "$OSTYPE" == "darwin"* ]] && [ -d "${HOME}/Library/Application Support/Microsoft Edge" ]; then
    EDGE_MANIFEST_DIR="${HOME}/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    mkdir -p "${EDGE_MANIFEST_DIR}"
    create_manifest "${EDGE_MANIFEST_DIR}/${MANIFEST_NAME}"
    log "Installed manifest for Microsoft Edge: ${EDGE_MANIFEST_DIR}/${MANIFEST_NAME}"
    manifests_installed=$((manifests_installed + 1))
  fi
  
  if [ $manifests_installed -eq 0 ]; then
    warn "No supported browsers detected. Manifest installed to default location: ${MANIFEST_DIR}/${MANIFEST_NAME}"
    mkdir -p "${MANIFEST_DIR}"
    create_manifest "${MANIFEST_DIR}/${MANIFEST_NAME}"
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
  
  # Test if binary runs
  if ! "${INSTALL_DIR}/${BINARY_NAME}" --version &> /dev/null; then
    warn "Binary may not be working correctly. Please check your system compatibility."
  fi
  
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
  --version VERSION    Install a specific version (e.g., 1.0.0)
  --uninstall         Uninstall the MCP host
  --help              Show this help message

Examples:
  $0                   # Install latest version
  $0 --version 1.2.3   # Install specific version
  $0 --uninstall       # Uninstall
EOF
  exit 0
}

# Main installation function
main() {
  local version=""
  local force_version=false
  
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --version)
        version="$2"
        force_version=true
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
  
  # Install manifests
  log "Installing Native Messaging manifests..."
  install_manifests
  
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
