const cloud = require('wx-server-sdk')
const https = require('https')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ============================================================
// 教练人设（与前端 coach-personas.ts 保持同步）
// ============================================================
const COACH_PERSONAS = {
  zhouxx: {
    name: '周猩猩',
    temperature: 0.85,
    systemPrompt: `你是「周猩猩」，四川麻将技术主播，搞笑风格，像直播时跟兄弟伙摆龙门阵。

说话风格：
- 语气夸张、有感染力，节奏快，像直播解说。
- 口头禅：「兄弟们」「看到没得」「这波啊」「起飞」「你搁这搁这呢」「巴适得板」。
- 夹杂四川方言：巴适、安逸、瓜娃子、莫得、要得、雄起。
- 好牌时夸张庆祝（「起飞！直接起飞！」），打错时吐槽但不伤人（「兄弟你这手牌打得我血压都上来了」）。
- 善用生活化比喻讲牌理，比如「这个搭子就像火锅里的毛肚，七上八下刚刚好」「你留这张孤张跟留个冷馒头有啥区别」。
- 回复 3～6 句，短句为主，带感叹号，有直播的即时感。

教学偏好：
- 先给结论再解释，不啰嗦。
- 用进张数、向听数说话，但要用大白话包装，不掉书袋。
- 未交卷时不剧透标准弃牌，但用暗示性吐槽引导（「你确定要留这张？我怕你待会儿哭都哭不出来」）。
- 已交卷后放飞复盘，夸张对比正确和错误打法的差距。
- 学员打得好时大力夸（「这波操作，巴适！给你鼓个掌」），打得差时毒舌但带幽默。`,
  },
  hehe: {
    name: '何何',
    temperature: 0.65,
    systemPrompt: `你是「何何」，麻将教练里温和、耐心的那一位。

说话风格：
- 像一位会鼓励学生的陪练老师，语气轻松但不敷衍。
- 多用「我们一起看」「你可以先试着…」这类协作口吻。
- 遇到术语（向听、进张、搭子、孤张、边张、两面等）时，先用一句话解释再往下讲。
- 一次 ideally 只推进一个思考点；先提问引导，再给提示，避免长篇大论一次倒完。
- 学员答错或卡住时先肯定观察里做对的部分，再指出可以改进的地方。
- 回复宜短：默认 3～6 句或等价小段落，需要时再用条目。

教学偏好：
- 基础拆搭优先讲「结构」：面子/搭子/对子/孤张怎么归类。
- 鼓励学员自己比较「打 A 和打 B 后进张差在哪」。
- 未交卷时绝不点名标准弃牌；已交卷后可以温柔对照解析讲解。`,
  },
  duhan: {
    name: '杜涵',
    temperature: 0.45,
    systemPrompt: `你是「杜涵」，麻将教练里犀利、直接的那一位。

说话风格：
- 像一位高水平牌友复盘：结论先行，短句，少客套。
- 用牌效数字说话（向听、进张张数、搭子形状），少讲鸡汤。
- 发现坏习惯（拆好搭子保废牌、无视进张差等）时直接指出，但不人身攻击。
- 不哄人；学员问「可不可以打 X」时，给明确判断 + 一句理由即可。
- 回复宜短狠：默认 2～5 句；能一条说清就不要三条。

教学偏好：
- 效率优先：先比向听，再比进张，再比形状质量与后续发展。
- 讨厌含糊：「感觉这张不好」必须落到具体结构原因。
- 未交卷时绝不剧透标准弃牌，但可以泼冷水指出某条思路为什么站不住。
- 已交卷后可以对照参考切牌做毒舌复盘，仍基于给定数据，不编造场况。`,
  },
}

const DEFAULT_COACH_ID = 'hehe'

// ============================================================
// 共享规则（与前端 coach-prompt.ts 保持同步）
// ============================================================
const SHARED_RULES = `你是「麻将教练」应用中的 AI 陪练，专攻四川麻将血战到底。

## 规则边界（必须遵守）
- 108 张：万/条/筒，无字牌、无风箭。
- 血战玩法：无吃；本题训练不涉及换三张、查花猪、查大叫。
- 可以碰、杠；基础拆搭题通常只看自己手牌与副露，不要求考虑对手。
- 牌名输出用中文：如「三万」「七筒」「一条」；代码形态为 3m/7p/1s。

## 防剧透（硬性）
- 若上下文标明「学员尚未交卷」：
  - 禁止说出推荐弃牌、标准答案、官方解析原文。
  - 禁止用「标准答案是 X」「应该打 X」等方式点名具体切牌。
  - 可以讲概念、结构归类、向听/进张怎么比、引导学员自己比较选项。
- 若上下文标明「学员已交卷」：
  - 可以对照参考切牌与官方解析讲解，仍须基于给定数据。

## 事实约束
- 向听、进张、手牌内容以系统给定的「局面上下文」为准，不要编造河牌、对手定缺或墙牌。
- 不知道的信息要明说「题目没给」，不要脑补。
- 始终使用简体中文。`

// ============================================================
// 牌名格式化
// ============================================================
const SUIT_LABEL = { m: '万', p: '筒', s: '条' }
const RANK_CN = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
  6: '六', 7: '七', 8: '八', 9: '九',
}

function tileLabel(t) {
  const rank = t[0]
  const suit = t[1]
  return `${RANK_CN[rank]}${SUIT_LABEL[suit]}`
}

function formatTiles(tiles) {
  if (!tiles || !tiles.length) return '（无）'
  return tiles.map((t) => `${tileLabel(t)}(${t})`).join('、')
}

function formatMelds(melds) {
  if (!melds || !melds.length) return '（无副露）'
  return melds.map((m) => `${m.type}: ${formatTiles(m.tiles)}`).join('；')
}

// ============================================================
// 构建上下文消息
// ============================================================
function buildSystemPrompt(coachId) {
  const persona = COACH_PERSONAS[coachId] || COACH_PERSONAS[DEFAULT_COACH_ID]
  return `${SHARED_RULES}

---
## 当前教练人设：${persona.name}
${persona.systemPrompt}`
}

function buildContextMessage(puzzle, ctx) {
  const variant = puzzle.variant || 'basic'
  const lines = [
    `题型: 弃牌训练 / ${variant === 'basic' ? '基础拆搭' : '进阶场况'}`,
    `题目 ID: ${puzzle.id}`,
    `标题: ${puzzle.title || '（无）'}`,
    `难度: ${puzzle.difficulty}/5`,
    `门牌(${puzzle.hand.length}): ${formatTiles(puzzle.hand)}`,
    `副露: ${formatMelds(puzzle.melds)}`,
    `系统计算: ${ctx.shanten === -1 ? '胡牌' : ctx.shanten === 0 ? '听牌' : `${ctx.shanten} 向听`}，进张合计 ${ctx.ukeireTotal} 张`,
  ]

  if (ctx.selectedTile) {
    lines.push(`学员当前点选: ${tileLabel(ctx.selectedTile)}(${ctx.selectedTile})`)
  }

  lines.push(
    ctx.submitted
      ? '交卷状态: 已交卷（可以讲解参考答案与解析）'
      : '交卷状态: 尚未交卷（严格禁止剧透推荐弃牌与官方解析）'
  )

  if (ctx.attempt) {
    if (ctx.attempt.skipped) {
      lines.push('学员操作: 跳过本题')
    } else if (ctx.attempt.discard) {
      lines.push(
        `学员作答弃牌: ${tileLabel(ctx.attempt.discard)}(${ctx.attempt.discard}) · 合理=${ctx.attempt.reasonable ? '是' : '否'} · 命中参考=${ctx.attempt.hitRecommended ? '是' : '否'}`
      )
    }
  }

  if (ctx.submitted) {
    lines.push(`参考切牌: ${formatTiles(puzzle.recommendedDiscards)}`)
    if (puzzle.discussableDiscards && puzzle.discussableDiscards.length) {
      lines.push(`可讨论切牌: ${formatTiles(puzzle.discussableDiscards)}`)
    }
    lines.push(`官方解析摘要: ${puzzle.analysis.summary}`)
    if (puzzle.analysis.lines && puzzle.analysis.lines.length) {
      lines.push(
        `解析要点:\n${puzzle.analysis.lines.map((l, i) => `  ${i + 1}. ${l}`).join('\n')}`
      )
    }
  }

  return `以下是当前训练题的局面上下文（由系统注入，每轮可能刷新；不是学员原话）：\n\n${lines.join('\n')}`
}

// ============================================================
// 调用 DeepSeek API（非流式）
// ============================================================
function callDeepSeek(apiKey, baseUrl, model, messages, temperature) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(baseUrl)
    const postData = JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.6,
      stream: false,
      thinking: { type: 'disabled' },
    })

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: (parsed.pathname || '') + '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode !== 200) {
            reject(
              new Error(
                json?.error?.message ||
                  json?.message ||
                  `Chat API failed (${res.statusCode})`
              )
            )
            return
          }
          const content =
            String(json?.choices?.[0]?.message?.content ?? '').trim()
          if (!content) {
            reject(new Error('模型未返回内容'))
            return
          }
          resolve(content)
        } catch (e) {
          reject(new Error('解析 AI 响应失败'))
        }
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('AI 响应超时（30秒），请稍后重试'))
    })

    req.on('error', (e) => {
      reject(new Error(e.message || 'AI 调用失败'))
    })

    req.write(postData)
    req.end()
  })
}

// ============================================================
// 云函数入口
// ============================================================
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const {
    puzzleId,
    coachId,
    content,
    selectedTile,
    submitted,
    attempt,
    shanten: shantenVal,
    ukeireTotal,
    puzzle,
    history,
  } = event

  if (!content || !content.trim()) {
    return { ok: false, error: '消息不能为空' }
  }
  if (content.length > 2000) {
    return { ok: false, error: '消息过长（最多 2000 字）' }
  }
  if (!puzzle) {
    return { ok: false, error: '缺少题目数据' }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

  if (!apiKey) {
    return {
      ok: false,
      error: '未配置 AI 密钥：请在云函数环境变量中设置 DEEPSEEK_API_KEY',
    }
  }

  const cid = coachId || DEFAULT_COACH_ID
  const persona = COACH_PERSONAS[cid] || COACH_PERSONAS[DEFAULT_COACH_ID]

  // 构建消息列表
  const messages = [
    { role: 'system', content: buildSystemPrompt(cid) },
    {
      role: 'system',
      content: buildContextMessage(puzzle, {
        submitted: !!submitted,
        attempt: attempt || null,
        selectedTile: selectedTile || null,
        shanten: shantenVal,
        ukeireTotal: ukeireTotal,
      }),
    },
  ]

  // 加入历史消息（最多 40 条）
  if (history && Array.isArray(history)) {
    const trimmed = history.slice(-40)
    for (const m of trimmed) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content })
      }
    }
  }

  // 加入当前用户消息
  messages.push({ role: 'user', content: content.trim() })

  try {
    const reply = await callDeepSeek(
      apiKey,
      baseUrl,
      model,
      messages,
      persona.temperature
    )
    return { ok: true, content: reply }
  } catch (e) {
    return { ok: false, error: e.message || 'AI 对话失败' }
  }
}
