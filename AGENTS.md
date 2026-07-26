---
description:
alwaysApply: true
---

# AGENTS.md

四川麻将拆搭训练小程序（Taro 4 + React + TS + SCSS，weapp/H5）。详细说明见 `README.md`。

## 优先复用

- **UI/图标**：默认 **Taroify**（`@taroify/core`、`@taroify/icons`）；新组件样式在 `src/app.ts` 按需 import。
- **仓库内**：先搜 `src/components`、`src/core`、`src/hooks`、已有页面，能扩展就不新建平行实现。
- **自研仅限**：品牌强定制、库无能力、现有抽象无法扩展。
- **TabBar 图标**：本地 PNG（`src/assets/icons/`），不用 Taroify。

## 技术栈

- Taro 4.2 · React 18 · TypeScript · SCSS · pnpm · 微信云函数
- 主色 `#1a5c2e`，页面背景 `#f5f5f0`（`src/app.scss`）
- 开发：`pnpm dev:weapp`（产物 `dist/`）/ `pnpm dev:h5`

## 目录要点

| 路径 | 用途 |
|------|------|
| `src/pages/` | 页面，`index.tsx` + `index.scss` + `index.config.ts` |
| `src/core/` | 算法（`shanten`、`scoring`、`tiles`）、`*-service.ts`、云封装 |
| `src/components/` | 跨页组件（`coach-panel`、`radar-chart` 等） |
| `src/content/` | 章节、教练人设、题型 types |
| `cloudfunctions/` | 云函数（CommonJS） |

## 关键约定

**路由**：TabBar 用 `switchTab`（index / puzzles / report / profile）；子页用 `navigateTo`（train / guess / mistakes / favorites）。

**数据**：本地优先、离线可用；云失败静默降级。持久化走 `src/core/*-service.ts`，页面不散落 `getStorageSync`。登录与同步见 `auth.ts`、`cloud.ts`。

**算法**：向听/进张/拆搭评分只在 `src/core/` 实现，页面勿重写。

**牌面**：用 `getTileImage` + `Image`，勿用 Unicode 或 emoji 冒充图标。

**AI 教练**：前端 `CoachPanel` + `useCoach` → 云函数 `coachChat`；换模型只改云函数环境变量。
