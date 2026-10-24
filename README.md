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

### 四人认领与共享牌局

微信登录后直接认领 HENING、WUYU、TANGXIANG、DUHAN 中未被占用的身份，无需审核。账号与身份一对一绑定；HENING 作为原始账号管理员，可在「我的 → 成员管理」解除其他人的误绑定。四人均可新增、编辑、删除公共牌局，未认领账号不能读取或维护牌局数据。昵称和头像不参与身份判断。

`matchTable` 是统一接口，所有请求必须携带 `schemaVersion: 2`；提供 `status`、`claim`、`release`、`list`、`save`、`remove` 操作。读取和写入必须携带登录返回的 `bindingId`；保存和删除还需加载时的 `revision` 与本次操作的 `mutationId`。云端通过微信真实 OPENID 校验绑定，事务处理认领、权限和版本检查；重复请求幂等，旧版本返回 `CONFLICT`，已删除记录不允许旧保存恢复。旧 `getMatches`、`saveMatch`、`removeMatch` 仅返回更新提示。

`match_tables/fixed-four` 保存四个身份及管理员；`table_matches` 保存唯一的共享牌局，`match_reviews` 按牌局与玩家保存个人发挥和复盘标签。三个集合均禁止客户端直接读写，仅通过云函数访问。公共备注四人可见，个人复盘仅返回本人内容。原 `matches` 和 `table_migration_backups` 保留运维备份，同样禁止客户端直接访问。

牌局缓存和待同步队列按账号与绑定版本隔离；徽章已读状态另按绑定隔离。离线保存保留明确操作，恢复网络后重试；冲突保留本机草稿并拉取云端内容，用户核对后重新编辑。已删除或未曾上传的草稿可在明确确认后另存为新牌局。旧版待同步数据只保留为待核对草稿，不自动覆盖共享历史。明确解绑会关闭访问并清除相关缓存；网络失败保留已绑定成员的离线阅读。

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-1gjvozwi57c18c42 --names matchTable loginUser saveMatch getMatches removeMatch \
  --remote-npm-install --project /Users/hening/WeChatProjects/Mahjong-Coach

node --test tests/match-cloud-sync.test.cjs tests/table-identity.test.cjs \
  tests/table-migration.test.cjs tests/match-seasons.test.cjs \
  tests/match-badges.test.cjs tests/match-mystic.test.cjs
```

历史迁移模块位于 `scripts/migrate-shared-table.cjs`，不是运行时初始化入口。先备份并冻结旧写入，再由限定原账号的临时运维函数运行预检和迁移；逐项核对日期、地点、备注、四人积分及删除状态，成功后开放共享牌桌并删除临时函数。重复执行只核验，不重写已迁移的线上数据。默认 21 场原始 JSON 仅用于核对，不参与运行时自动补齐；迁移也包含后来手动录入的有效牌局。首次认领必须联网。

所有牌局按 `playedAt` 从早到晚展示，同一时刻按稳定 ID 排序；`createdAt` 与云端写入时间只用于追踪，不代替对局时间。

### 棋牌室抽签与提前选店

「我的 → 更多服务 → 棋牌室抽签」进入独立抽取页，选择今天至未来 30 天的牌局日期后抽取地点。四人共享结果，按云端北京时间计算：全桌每天最多发起一次新抽取，且同一个牌局日期永久只能抽一次。例如今天为周六抽签后，今天不能再为其他日期抽签，明天也不能重抽周六。过去日期只能查看已有结果，不能补抽。任意成员抽取后，其他成员重新进入页面或点击刷新即可查看；不提供重抽、删除、作废入口。实际牌局地点仍由录分时填写，不自动关联选店结果。

HENING 在抽取页管理名单，支持新增、改名、启停和调整展示顺序，最多 50 家，名称去除首尾空格后须唯一且为 1～100 字。已有棋牌室使用稳定 ID，只能停用，不能删除。启用项等概率抽取；没有启用项时不能抽，只有一家时仍消耗当日机会。

确认抽取后，候选名称与列表高亮先快速轮换再减速，约 2.6～3 秒后用落章效果揭晓。最终地点只采用云端结果，展示随机不参与选店；云端响应较慢时继续等待确认，失败时停止动效并允许重试。播放中锁定日期、名单与重复抽取操作，提前到达的结果不会从主卡片、候选高亮或签簿提前露出。切后台、离开页面或切换身份时清理动画定时器；已经写入云端的签仍保留，返回后直接查看。动效仅涉及前端，无须单独部署云函数。

`matchTable` 新增 `venueStatus`、`saveVenues`、`drawVenue`、`venueHistory`，沿用 `schemaVersion: 2` 和 `bindingId`。`venueStatus`、`drawVenue` 可携带 `targetDate: 'YYYY-MM-DD'`，省略时使用云端今天，兼容旧客户端。状态返回牌局日期 `date`、服务器当天 `today`、最晚可抽日期 `maxDate`、当天已用机会 `dailyDraw`、`canDraw` 和不可抽原因 `unavailableReason`。云端校验真实日历日期，过去或超出范围的未抽日期不可抽；已抽日期优先返回原签，不消耗每日机会。`saveVenues` 携带 `{ version, venues: [{ id?, name, enabled }] }`，新项不填 ID，云端分配 ID；版本过期返回 `CONFLICT`，保留本机编辑内容，重新加载后再编辑。`venueHistory` 接受上一页返回的 `nextCursor` 作为 `before`，每页 20 条，按牌局日期倒序，包含提前抽好的未来牌局。点击签簿条目可查看该日期结果，页面分别显示牌局日期和实际抽取日期时间。

`table_venue_configs/fixed-four` 保存名单、版本及修改人时间；`table_venue_draws/fixed-four_YYYY-MM-DD` 的日期代表牌局日期，保存该日唯一结果、候选 ID/名称快照、名单版本、抽取人及实际抽取时间。抽取在数据库事务中重新校验绑定，使用 `crypto.randomInt` 选择，同时写入结果和 `match_tables/fixed-four.venueLastDraw`（实际抽取日期、目标牌局日期、抽取人时间），保证四人同时选择不同日期时也只能用一次每日机会。并发点击与响应丢失后的同日期重试均返回原签；名单后续变化、清缓存或重绑身份不重置机会。旧版已抽记录原样保留，以原日期作为牌局日期；旧版当天已抽且没有每日标记时，从当天记录恢复次数限制，无须迁移。提前抽好的当天牌局不占用当天的新机会。云函数失败时不在本地抽取。拥有云数据库管理权限的人仍能直接修改数据，此机制防止小程序客户端作弊。

上线顺序（现有牌局无须迁移）：

已部署过选店功能的环境不需要新增集合或索引，只需更新 `matchTable` 云函数（尤其是 `venue-actions.js`）并重新构建客户端。下面是首次部署步骤：

1. 在云开发数据库创建 `table_venue_configs`、`table_venue_draws`，两个集合的客户端安全规则均设置为 `{"read": false, "write": false}`；云函数使用服务端权限访问。
2. 为 `table_venue_draws` 创建联合索引：`tableId` 升序、`date` 降序，用于历史分页。每日唯一性由固定文档 ID 与事务保证，不依赖此查询索引。
3. 上传部署整个 `cloudfunctions/matchTable/`（包括 `venue-actions.js`），继续兼容旧版共享牌局接口。
4. 构建并发布小程序；HENING 首次在页面录入候选名单。名单初始为空，不使用测试数据自动初始化。

```bash
node --test tests/venue-draw.test.cjs tests/venue-status.test.cjs tests/venue-animation.test.cjs
pnpm build:weapp
```

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

牌局页默认展示北京时间当前自然季度，支持「全年 / Q1 / Q2 / Q3 / Q4」赛季切换，顶部可选择当前年份及有记录的其他年份。Q1 为 1–3 月、Q2 为 4–6 月、Q3 为 7–9 月、Q4 为 10–12 月；全年仅包含所选年份。累计战绩、多人趋势、牌友榜与历史列表仅展示积分，统一使用所选赛季，切换后从零累计，不带入其他赛季积分；无记录的赛季展示空状态。生涯荣誉仍按全部历史计算。图表使用按需引入的 ECharts 5.6，微信端使用 `echarts-for-weixin` 原生适配组件，H5 使用独立 Canvas 适配。第三方组件来源和 BSD 许可证位于 `src/components/ec-canvas/`。 ECharts 引擎、Canvas 适配器和图标随小程序代码包携带，趋势图不请求 CDN、外部脚本或在线字体。原生图表等待 ready 与 Canvas 2D 节点渲染完成，临时空节点或零尺寸会重试；失败显示重试入口。曲线渐变使用 rgba，避免部分手机 Canvas 对八位十六进制颜色的兼容问题。修改后需重新构建并上传最新体验版，手机端才会使用修复后的前端。

2026-10-16 导出的 21 场历史已写入云数据库，升级后四个已认领账号共用同一份历史，按各自绑定身份计算个人统计。保留原始日期、备注和四人积分，后续通过页面手动录入。清除本地缓存后从共享云端恢复；未认领账号不能读取，不自动生成默认历史。

牌局固定为 HENING、WUYU、TANGXIANG、DUHAN 四人，录入页直接展示姓名，仅录入积分，不提供金额录入和切换。列表、趋势图、牌友榜与荣誉进度仅使用这四人齐全且不重复的记录；旧的匿名或其他人员牌局保留在存储中，不参与展示和统计，也不按座位猜测真实身份。历史本人名称「我 / 我的」会统一展示为 HENING。

荣誉墙按本人全部历史积分牌局计算 14 枚生涯徽章，包含铜、银、金与传奇四档。连续一位按单场排名计算（同分并列），常胜将军按正分率计算。徽章每次按当前有效积分历史重新核验，仅使用当前绑定玩家本人的积分；不满足条件的历史误授缓存会自动撤回，编辑或删除牌局后资格同步更新。解锁时间按牌局发生时间依次回放，取首次满足条件的那场牌局时间；补录、编辑或删除后重新推算，并自动修正旧缓存中的录入或首次打开时间。无效分数、匿名牌局及旧金额存档不参与授予，全员零分平局不计首胜、连胜或垫底。初始历史荣誉静默展示，新解锁荣誉以弹层集中庆祝。

## 牌桌玄学

牌友榜下方的「牌桌玄学」摘要始终基于全部历史，点击进入独立的「玄学档案」分包页。详情默认全部历史，可独立切换年份的全年或 Q1–Q4，不影响牌局页当前赛季。分析只使用时间有效、四人身份完整、积分有限且合计为零的积分牌局，计算结果不另存缓存，也不修改历史数据。

- **牌友相克**：压制率 = 对方最终积分高于本人的场次 / 同场场次，同分计入分母并单列；场均积分差为「对方 − 我」。至少 5 场、压制率超过 50% 才参与「头号冤家」评选，最高者获选，并列共同展示。仅比较同场最终积分，不代表两人之间的实际输赢流水。
- **福地雷区**：地点至少 5 场才参与称号评选；正场均最高为福地，负场均最低为雷区，并列共同展示，称号允许为空。其余地点标记「待观察」并保留实际数据。地点仅去除首尾空白，不自动合并名称；未填写地点不参与地点分析。
- 人物和地点条目可展开按时间排序的牌局手记，再进入原有编辑页。补录、编辑、删除及云同步后重新计算；离线仍可查看本地记录。

微信 / H5 的真机性能仍需在设备上验收。
