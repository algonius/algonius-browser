import { defineConfig } from 'vite';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { isDev, isProduction } from './env.mjs';

export const watchOption = isDev ? {
  buildDelay: 100,
  chokidar: {
    ignored:[
      /\/packages\/.*\.(ts|tsx|map)$/,
    ]
  }
}: undefined;

/**
 * @typedef {import('vite').UserConfig} UserConfig
 * @param {UserConfig} config
 * @returns {UserConfig}
 */
export function withPageConfig(config) {
  return defineConfig(
    deepmerge(
      {
        base: '',
        plugins: [react(), isDev && watchRebuildPlugin({ refresh: true })],
        build: {
          sourcemap: isDev,
          minify: isProduction,
          reportCompressedSize: isProduction,
          emptyOutDir: isProduction,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
        define: {
          'process.env.NODE_ENV': isDev ? `"development"` : `"production"`,
          'process.env.PACKAGE_VERSION': JSON.stringify(
            (() => {
              // Priority order for version detection
              const version = process.env.PACKAGE_VERSION || 
                            process.env.npm_package_version;
              
              // Log for debugging in CI
              if (process.env.CI) {
                console.log('[Vite Config] Environment variables:');
                console.log('  PACKAGE_VERSION:', process.env.PACKAGE_VERSION);
                console.log('  npm_package_version:', process.env.npm_package_version);
                console.log('  Selected version:', version || '0.1.0');
              }
              
              return version || '0.1.0';
            })()
          ),
        },
        envDir: '../..'
      },
      config,
    ),
  );
}
