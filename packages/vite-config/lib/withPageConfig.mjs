import { defineConfig } from 'vite';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { isDev, isProduction } from './env.mjs';
import fs from 'fs';
import path from 'path';

export const watchOption = isDev ? {
  buildDelay: 100,
  chokidar: {
    ignored:[
      /\/packages\/.*\.(ts|tsx|map)$/,
    ]
  }
}: undefined;

/**
 * Get package version by reading package.json directly
 * This ensures consistent version across all components
 */
function getPackageVersion() {
  try {
    // Try multiple paths to find the root package.json
    const possiblePaths = [
      path.resolve(process.cwd(), '../../package.json'),
      path.resolve(process.cwd(), '../package.json'),
      path.resolve(process.cwd(), 'package.json')
    ];
    
    for (const packageJsonPath of possiblePaths) {
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.version) {
          console.log(`[Vite Config] Found version ${packageJson.version} in ${packageJsonPath}`);
          return packageJson.version;
        }
      }
    }
    
    console.warn('[Vite Config] Could not find package.json with version');
    return '0.1.0';
  } catch (error) {
    console.warn('[Vite Config] Failed to read package.json version:', error.message);
    return '0.1.0';
  }
}

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
          'process.env.PACKAGE_VERSION': JSON.stringify(getPackageVersion()),
        },
        envDir: '../..'
      },
      config,
    ),
  );
}
