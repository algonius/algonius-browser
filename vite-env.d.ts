/// <reference types="vite/client" />

// 为 process.env 添加类型支持
declare namespace NodeJS {
  interface ProcessEnv {
    readonly PACKAGE_VERSION: string;
    readonly NODE_ENV: string;
  }
}

// 为 Vite 定义的环境变量添加类型
interface ImportMetaEnv {
  readonly PACKAGE_VERSION: string;
  readonly VITE_EXAMPLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
