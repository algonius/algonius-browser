import React from 'react';
import type { McpHostOptions, McpError } from '@src/types';
import { McpErrorCode } from '@extension/shared';
import { openInstallationPage } from './utils/installation';

interface ControlPanelProps {
  isConnected: boolean;
  onStartHost: (options: McpHostOptions) => Promise<boolean>;
  onStopHost?: () => Promise<boolean>;
  loading: boolean;
  error?: McpError | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isConnected, onStartHost, onStopHost, loading, error }) => {
  const handleStartClick = async () => {
    // Use default parameters
    const options: McpHostOptions = {
      runMode: 'stdio',
      logLevel: 'info',
    };

    await onStartHost(options);
  };

  const handleStopClick = async () => {
    if (onStopHost) {
      await onStopHost();
    }
  };

  const handleInstallClick = () => {
    openInstallationPage();
  };

  return (
    <div className="mt-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">MCP Host Control</h2>

      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage the MCP Host process to enable advanced browser functionality
        </p>

        <div className="mt-6 flex justify-center space-x-2">
          {!isConnected && error?.code === McpErrorCode.HOST_NOT_FOUND && (
            <button
              className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleInstallClick}
              disabled={loading}>
              <span className="flex items-center">
                <svg
                  className="-ml-1 mr-2 size-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Install MCP Host
              </span>
            </button>
          )}

          {!isConnected && error?.code !== McpErrorCode.HOST_NOT_FOUND && (
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleStartClick}
              disabled={loading}>
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="-ml-1 mr-2 size-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting...
                </span>
              ) : (
                'Start MCP Host'
              )}
            </button>
          )}

          {isConnected && onStopHost && (
            <button
              className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleStopClick}
              disabled={loading}>
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="-ml-1 mr-2 size-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Stopping...
                </span>
              ) : (
                'Stop MCP Host'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
