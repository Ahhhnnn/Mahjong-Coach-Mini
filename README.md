# 麻将教练 (Mahjong Coach)

> 四川麻将拆搭训练小程序 — 通过系统化的训练提升你的麻将牌效判断能力。

## 项目简介

本项目是一款专注于**四川麻将拆搭训练**的微信小程序，帮助玩家：

- 🀄 **拆搭练习**：训练"听牌前的最佳拆搭"判断
- 🧩 **牌型题库**：海量实战牌型题，反复演练
- 🎯 **猜牌训练**：提升读牌与算牌能力
- 📊 **训练报告**：可视化呈现个人能力雷达图
- 🤖 **AI 教练**：基于大模型的对话式辅导

## 技术栈

| 类别 | 技术 |
|------|------|
| 跨端框架 | [Taro](https://taro-docs.jd.com/) 4.2.1 |
| UI 框架 | React 18 + TypeScript |
| 样式 | SCSS |
| 构建 | Webpack 5 |
| 后端 | 微信云函数 |
| 包管理 | pnpm |

支持同时构建**微信小程序**与 **H5** 双端。

## 目录结构

```
src/
├── app.ts / app.config.ts / app.scss   # 小程序入口
├── pages/                              # 页面
│   ├── index/      首页
│   ├── train/      拆搭训练
│   ├── puzzles/    题库
│   ├── guess/      猜牌训练
│   ├── report/     训练报告
│   └── profile/    个人中心
├── components/                         # 复用组件
│   ├── coach-panel.tsx     教练对话面板
│   └── radar-chart.tsx     能力雷达图
├── core/                               # 核心逻辑
│   ├── shanten.ts           向听数算法
│   ├── tiles.ts             牌定义
│   ├── scoring.ts           计分
│   ├── coach.ts / coach-prompt.ts / coach-images.ts
│   └── cloud.ts             云函数封装
├── content/                            # 静态内容
│   ├── chapters.ts          章节
│   ├── puzzles.json         题库
│   ├── tile-data.json       牌数据
│   └── coach-personas.ts    教练人设
├── hooks/                              # React Hooks
└── assets/                             # 图片资源

cloudfunctions/                         # 微信云函数
├── coachChat/        AI 教练对话
├── getRecords/       获取训练记录
└── saveRecord/       保存训练记录
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- 微信开发者工具

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
# 微信小程序开发模式（监听文件变化）
pnpm dev:weapp

# H5 开发模式
pnpm dev:h5
```

编译产物在 `dist/` 目录，用微信开发者工具导入 `dist/` 即可预览。

### 生产构建

```bash
pnpm build:weapp
pnpm build:h5
```

## 核心算法

`src/core/shanten.ts` 实现了四川麻将的**向听数计算**，用于：

- 判断当前手牌距离听牌还需几张
- 拆搭训练中评估候选拆法优劣
- 题库生成与答案校验

## 云函数部署

```bash
# 逐个部署到微信云开发环境
cd cloudfunctions/coachChat && pnpm install && tcb fn deploy coachChat
cd cloudfunctions/getRecords && pnpm install && tcb fn deploy getRecords
cd cloudfunctions/saveRecord && pnpm install && tcb fn deploy saveRecord
```

或使用微信开发者工具的云开发面板直接上传。

## AI 模型切换

`coachChat` 云函数采用 **Provider 适配器** 架构，按环境变量动态选择底层大模型，**前端无任何改动**。

### 支持的模型

| `AI_PROVIDER` | 模型 | 默认 base URL | API Key 环境变量 |
|---|---|---|---|
| `minimax`（默认） | `MiniMax-M3` | `https://api.minimaxi.com/v1` | `MINIMAX_API_KEY` |
| `deepseek` | `deepseek-v4-flash` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |

### 切换步骤

1. 打开微信开发者工具 → 云开发 → 云函数 → `coachChat` → 配置 → 环境变量
2. 新增以下变量（按需）：
   - `AI_PROVIDER`：填 `minimax` 或 `deepseek`，不填则默认 `minimax`
   - `<PROVIDER>_API_KEY`：填对应厂商的 API Key（如 `MINIMAX_API_KEY`）
   - 可选 `AI_BASE_URL`：临时覆盖默认 base URL
   - 可选 `AI_MODEL`：临时覆盖默认模型名（例如换成 `MiniMax-M2.7-highspeed`）
3. 重新上传部署 `coachChat` 云函数

### 接入新模型

1. 在 `cloudfunctions/coachChat/providers/` 新建 `<id>.js`，实现统一契约：
   ```js
   module.exports = {
     id: 'openai',
     name: 'OpenAI',
     envKeyName: 'OPENAI_API_KEY',
     defaultBaseUrl: 'https://api.openai.com/v1',
     defaultModel: 'gpt-4o-mini',
     buildRequest({ apiKey, baseUrl, model, messages, temperature, maxCompletionTokens }) {
       return { url: baseUrl, headers: { Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ ... }) }
     },
     parseResponse(json) {
       return String(json?.choices?.[0]?.message?.content ?? '').trim() || null
     },
   }
   ```
2. 在 `cloudfunctions/coachChat/providers/index.js` 的 `REGISTRY` 中注册
3. 云函数环境变量加 `AI_PROVIDER=openai` + `OPENAI_API_KEY=...`

## 小程序配置

- AppID: `wxd40e10e4f7850325`
- 基础库版本: `3.17.0`
- 在 `project.config.json` 中配置

## License

MIT