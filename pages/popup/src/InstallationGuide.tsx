import React from 'react';
import { openInstallationPage, detectPlatform, getPlatformHints } from './utils/installation';

interface InstallationGuideProps {
  onRetry: () => void;
}

export const InstallationGuide: React.FC<InstallationGuideProps> = ({ onRetry }) => {
  const platform = detectPlatform();
  const platformHints = getPlatformHints(platform);

  const handleInstallClick = () => {
    openInstallationPage();
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      {/* Header with Icon */}
      <div className="mb-4 flex items-center justify-center">
        <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
          <svg
            className="size-8 text-blue-600 dark:text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2 className="mb-3 text-center text-xl font-bold text-gray-900 dark:text-white">MCP Host Required</h2>

      {/* Description */}
      <div className="mb-6 text-center">
        <p className="mb-3 text-gray-600 dark:text-gray-400">
          MCP Host is the core component that enables Algonius Browser's advanced automation features.
        </p>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">{platformHints}</p>
      </div>

      {/* Status Indicator */}
      <div className="mb-6 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
        <div className="flex items-center">
          <svg
            className="mr-3 size-5 text-yellow-600 dark:text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Installation Required</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">MCP Host not detected on this system</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary Install Button */}
        <button
          onClick={handleInstallClick}
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200">
          <div className="flex items-center justify-center">
            <svg
              className="mr-2 size-5"
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
          </div>
        </button>

        {/* Secondary Retry Button */}
        <button
          onClick={onRetry}
          className="w-full rounded-md bg-gray-100 px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          <div className="flex items-center justify-center">
            <svg
              className="mr-2 size-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Check Again
          </div>
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          After installation, click "Check Again" to verify the setup
        </p>
      </div>
    </div>
  );
};
