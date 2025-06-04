# Active Context

## Current Work Focus
已完成修复版本号显示问题的方案实施。成功将 `import.meta.env.PACKAGE_VERSION` 替换为直接导入 `package.json` 的方式。

## Recent Changes
### Popup 版本号修复 (已完成)
- **问题**: Popup 界面中版本号显示为 `undefined`，因为 `import.meta.env.PACKAGE_VERSION` 在当前构建环境中不可用
- **解决方案**: 直接从 package.json 导入版本号
  - 修改了 `pages/popup/src/Popup.tsx`：添加 `import packageJson from '../../../package.json'` 并使用 `packageJson.version`
  - 修改了 `pages/popup/src/utils/installation.ts`：同样的修改模式

### 技术验证
- TypeScript 配置已支持 JSON 模块导入 (`resolveJsonModule: true`)
- 构建测试通过，版本号正确嵌入到最终的 JavaScript 文件中
- 全项目构建测试成功

## Next Steps
1. 测试修复后的扩展是否在浏览器中正确显示版本号
2. 检查其他可能使用 `import.meta.env.PACKAGE_VERSION` 的地方是否需要类似修复

## Active Decisions and Considerations
- **方案选择**: 选择了方案A（直接导入package.json）而非方案B（修复Vite配置），因为：
  - 更简单直接，不涉及复杂的构建配置修改
  - 减少对现有构建流程的影响
  - 更可靠，不依赖环境变量传递

## Important Patterns and Preferences
- 项目使用 pnpm + Turbo 作为构建工具
- 支持 JSON 模块导入的 TypeScript 配置
- 使用相对路径导入 package.json (`../../../package.json`)

## Learnings and Project Insights
- 项目的构建环境可能不会自动注入 `PACKAGE_VERSION` 环境变量到 `import.meta.env`
- TypeScript 的 `resolveJsonModule` 配置已启用，支持直接导入 JSON 文件
- 构建系统会在 JavaScript 文件中正确嵌入版本信息
