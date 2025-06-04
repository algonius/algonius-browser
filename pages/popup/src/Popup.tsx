import React from 'react';
import { StatusDisplay } from '@src/StatusDisplay';
import { ControlPanel } from '@src/ControlPanel';
import { useMcpHost } from '@extension/shared';
import packageJson from '../../../package.json';

export const Popup: React.FC = () => {
  const { status, loading, error, refreshStatus, startMcpHost, stopMcpHost } = useMcpHost();

  return (
    <div className="mx-auto max-w-md p-4">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">MCP Host Control</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Monitor and control the MCP Host process</p>
      </header>

      <StatusDisplay status={status} loading={loading} error={error} onRefresh={refreshStatus} />

      <ControlPanel
        isConnected={status.isConnected}
        onStartHost={startMcpHost}
        onStopHost={stopMcpHost}
        loading={loading}
        error={error}
      />

      <footer className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p className="mb-2">
          Version {packageJson.version} |{' '}
          <a
            href="https://github.com/algonius/algonius-browser/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400">
            Help
          </a>
        </p>
        <div className="flex justify-center items-center gap-3">
          <a
            href="https://github.com/algonius/algonius-browser"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            aria-label="Visit GitHub repository">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <a
            href="https://x.com/tica245"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            aria-label="Visit developer on X (Twitter)">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
};
