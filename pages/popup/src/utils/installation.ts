/**
 * Installation utilities for MCP Host
 */

import packageJson from '../../../../package.json';

/**
 * Gets the version-specific installation URL
 * @returns The GitHub installation URL for the current extension version
 */
export const getVersionSpecificInstallationUrl = (): string => {
  const version = packageJson.version;

  if (version && version !== 'undefined') {
    return `https://github.com/algonius/algonius-browser/tree/v${version}?tab=readme-ov-file#-quick-start`;
  } else {
    return 'https://github.com/algonius/algonius-browser?tab=readme-ov-file#-quick-start';
  }
};

/**
 * Opens the GitHub installation page in a new tab
 * Uses version-specific URL to ensure installation instructions match the extension version
 */
export const openInstallationPage = (): void => {
  const installationUrl = getVersionSpecificInstallationUrl();

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: installationUrl });
  } else {
    // Fallback for development or non-extension environments
    window.open(installationUrl, '_blank');
  }
};

/**
 * Detects the user's operating system for platform-specific guidance
 */
export const detectPlatform = (): 'windows' | 'macos' | 'linux' | 'unknown' => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('win')) {
    return 'windows';
  } else if (userAgent.includes('mac')) {
    return 'macos';
  } else if (userAgent.includes('linux')) {
    return 'linux';
  }

  return 'unknown';
};

/**
 * Gets platform-specific installation hints
 */
export const getPlatformHints = (platform: ReturnType<typeof detectPlatform>): string => {
  switch (platform) {
    case 'windows':
      return 'Download the Windows installer (.exe) from the installation page';
    case 'macos':
      return 'Download the macOS installer for your chip (Intel or Apple Silicon)';
    case 'linux':
      return 'Download the Linux binary or use the installation script';
    default:
      return 'Choose the appropriate installer for your operating system';
  }
};
