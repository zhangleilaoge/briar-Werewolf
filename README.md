# Briar Werewolf

一个基于 **Astro + React + TypeScript** 的狼人杀 AI 对战演示项目。所有玩家（AI Agent）在复杂推理系统中自主行动，包含六维属性、九宫格阵营、压力系统、社交关系网络、四层信念系统（L0-L3）和基于 BDI 架构的意图决策系统。

---

## 快速启动

需要 [Bun](https://bun.sh) 作为包管理器。

```bash
# 1. 进入项目目录
cd web-demo/ai-werewolf-demo

# 2. 安装依赖
bun install

# 3. 启动开发服务器
bun run dev

# 4. 打开浏览器访问 http://localhost:4321
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器 |
| `bun run build` | 构建（含 lint + 类型检查） |
| `bun run preview` | 预览构建产物 |
| `bun run test` | 运行测试（Vitest） |
| `bun run lint` | 代码检查（Biome） |
| `bun run lint:fix` | 自动修复代码问题 |

---

## 技术栈

- **前端框架**: [Astro](https://astro.build) + [React](https://react.dev)
- **样式**: Tailwind CSS
- **构建工具**: Vite
- **测试**: Vitest
- **类型检查**: TypeScript
- **代码规范**: Biome（`noMagicNumbers` + `noUnusedImports`）
