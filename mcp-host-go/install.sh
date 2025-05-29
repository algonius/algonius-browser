#!/bin/bash

set -e

# Set variables
PACKAGE_NAME="github.com/algonius/algonius-browser/mcp-host-go"
BINARY_NAME="mcp-host"
INSTALL_DIR="${HOME}/.algonius-browser/bin"
MANIFEST_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
MANIFEST_NAME="ai.algonius.mcp.host.json"
MANIFEST_SOURCE="$(pwd)/manifest/${MANIFEST_NAME}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[MCP-HOST-GO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[MCP-HOST-GO]${NC} $1"
}

error() {
  echo -e "${RED}[MCP-HOST-GO]${NC} $1"
  exit 1
}

# Check if Go is installed
if ! command -v go &> /dev/null; then
  error "Go is not installed. Please install Go and try again."
fi

# Create directories if they don't exist
log "Creating installation directories..."
mkdir -p "${INSTALL_DIR}"
mkdir -p "${MANIFEST_DIR}"
mkdir -p "$(pwd)/manifest"

# Create manifest file if it doesn't exist
if [ ! -f "${MANIFEST_SOURCE}" ]; then
  log "Creating manifest file..."
  cat > "${MANIFEST_SOURCE}" << EOF
{
  "name": "dev.nanobrowser.mcp.host",
  "description": "Nanobrowser MCP Native Messaging Host",
  "path": "${INSTALL_DIR}/${BINARY_NAME}",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://neiiiibdmgkoabmaodedfkgomofhcbal/"]
}
EOF
fi

# Check if binary exists in bin directory, if not build it
BIN_PATH="$(pwd)/bin/${BINARY_NAME}"
if [ ! -f "${BIN_PATH}" ]; then
  log "Binary not found in bin/, building MCP host..."
  cd "$(dirname "$0")"
  go build -o "${BIN_PATH}" ./cmd/mcp-host
fi

# Copy binary to install directory
log "Installing MCP host binary..."
cp "${BIN_PATH}" "${INSTALL_DIR}/${BINARY_NAME}"

# Make the binary executable
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# Install the manifest file
log "Installing manifest file..."
cp "${MANIFEST_SOURCE}" "${MANIFEST_DIR}/${MANIFEST_NAME}"

log "Installation completed successfully!"
log "Installed binary: ${INSTALL_DIR}/${BINARY_NAME}"
log "Installed manifest: ${MANIFEST_DIR}/${MANIFEST_NAME}"
