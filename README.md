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

## 小程序配置

- AppID: `wxd40e10e4f7850325`
- 基础库版本: `3.17.0`
- 在 `project.config.json` 中配置

## License

MIT