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

### 牌局一次性初始化与日常录入

默认 21 场历史已完成一次性云端导入。原初始化云函数已从云端删除，本地入口和生成脚本也已移除，后续只保留 `saveMatch`、`getMatches`、`removeMatch` 三个日常读写接口。原始 `src/content/default-matches.json` 保留作数据核对，不参与运行时补齐。

后续通过页面手动新增或编辑牌局，调用 `saveMatch` 保存一场；`getMatches` 分页读取当前账号已有记录；`removeMatch` 保留删除标记。打开页面和登录只拉取已有历史、重试页面操作产生的待保存队列，不调用初始化入口，不批量回写 21 场默认历史。清除缓存或换设备后从云端恢复；空账号不会自动生成默认对局，删除或缺少的历史不会被补回。

```bash
# 官方 CLI 部署：仅部署日常读写函数
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-1gjvozwi57c18c42 --names saveMatch getMatches removeMatch \
  --remote-npm-install --project /Users/hening/WeChatProjects/Mahjong-Coach

# 本地回归验证（数据库与网络使用内存模拟，不会写入真实云环境）
node --test tests/match-cloud-sync.test.cjs tests/match-seasons.test.cjs tests/match-badges.test.cjs
```

部署完成后重新编译小程序。数据库 `matches` 已存在；建议建立 `_openid`、`playedAt`、`id` 均为升序的组合索引。手动录入、修改对局日期或离线补录后，本地立即按 `playedAt` 从早到晚排序，同一时间按稳定 ID 排序；联网后仅上传页面明确保存的对局。录入时间 `createdAt` 和云端写入时间 `createdAtServer` 仅用于追踪，不能替代 `playedAt` 排序。在数据库控制台查看时也应按 `playedAt` 升序排序。旧的匿名记录仍保留，但不参与四人牌局的展示。

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

## 牌局趋势与个人荣誉

牌局页默认展示北京时间当前自然季度，支持「全年 / Q1 / Q2 / Q3 / Q4」赛季切换，顶部可选择当前年份及有记录的其他年份。Q1 为 1–3 月、Q2 为 4–6 月、Q3 为 7–9 月、Q4 为 10–12 月；全年仅包含所选年份。累计战绩、多人趋势、牌友榜与历史列表仅展示积分，统一使用所选赛季，切换后从零累计，不带入其他赛季积分；无记录的赛季展示空状态。生涯荣誉仍按全部历史计算。图表使用按需引入的 ECharts 5.6，微信端使用 `echarts-for-weixin` 原生适配组件，H5 使用独立 Canvas 适配。第三方组件来源和 BSD 许可证位于 `src/components/ec-canvas/`。

2026-10-16 导出的 21 场历史已一次性写入当前账号云数据库，HENING 为本人，保留原始日期、备注和四人积分。后续通过页面手动录入，不再自动导入默认历史。清除本地缓存后仅从账号云端恢复已有数据；其他空账号不会自动获得这份历史。

牌局固定为 HENING、WUYU、TANGXIANG、DUHAN 四人，录入页直接展示姓名，仅录入积分，不提供金额录入和切换。列表、趋势图、牌友榜与荣誉进度仅使用这四人齐全且不重复的记录；旧的匿名或其他人员牌局保留在存储中，不参与展示和统计，也不按座位猜测真实身份。历史本人名称「我 / 我的」会统一展示为 HENING。

荣誉墙按本人全部历史积分牌局计算 14 枚生涯徽章，包含铜、银、金与传奇四档。连续一位按单场排名计算（同分并列），常胜将军按正分率计算。徽章每次按当前有效积分历史重新核验，仅使用 HENING 本人积分；不满足条件的历史误授缓存会自动撤回，编辑或删除牌局后资格同步更新。解锁时间按牌局发生时间依次回放，取首次满足条件的那场牌局时间；补录、编辑或删除后重新推算，并自动修正旧缓存中的录入或首次打开时间。无效分数、匿名牌局及旧金额存档不参与授予，全员零分平局不计首胜、连胜或垫底。初始历史荣誉静默展示，新解锁荣誉以弹层集中庆祝。

## 牌桌玄学

牌友榜下方的「牌桌玄学」摘要始终基于全部历史，点击进入独立的「玄学档案」分包页。详情默认全部历史，可独立切换年份的全年或 Q1–Q4，不影响牌局页当前赛季。分析只使用时间有效、四人身份完整、积分有限且合计为零的积分牌局，计算结果不另存缓存，也不修改历史数据。

- **牌友相克**：压制率 = 对方最终积分高于本人的场次 / 同场场次，同分计入分母并单列；场均积分差为「对方 − 我」。至少 5 场、压制率超过 50% 才参与「头号冤家」评选，最高者获选，并列共同展示。仅比较同场最终积分，不代表两人之间的实际输赢流水。
- **福地雷区**：地点至少 5 场才参与称号评选；正场均最高为福地，负场均最低为雷区，并列共同展示，称号允许为空。其余地点标记「待观察」并保留实际数据。地点仅去除首尾空白，不自动合并名称；未填写地点不参与地点分析。
- 人物和地点条目可展开按时间排序的牌局手记，再进入原有编辑页。补录、编辑、删除及云同步后重新计算；离线仍可查看本地记录。

微信 / H5 的真机性能仍需在设备上验收。
