/**
 * POST /api/assistant/chat
 *
 * v0.7.5 — 多步 ReAct（multi_step）
 *   - LLM 路由可返回 multi_step 计划（1-3 步串行）
 *   - server 串行执行：search / meta_query
 *   - 每次 step 完成推 data 事件（含 stepIndex + reasoning + result）
 *   - 第一步的 cards 也会被推到前端（用户能看到相关卡）
 *   - 最后 LLM 拿到所有 step 结果做综合总结
 *
 * v0.7.4 — SSE 流式输出（打字机效果）
 *
 * 事件流（text/event-stream）：
 *   meta    → { intent, routerSource, confidence }
 *   cards   → { cards: CardSnippet[] }
 *   data    → { toolData: any }   (multi_output 原始数据 / multi_step 单步结果)
 *   delta   → { text: string }    (LLM 总结的流式片段，可能多次)
 *   followUp→ { followUp: FollowUp[] }
 *   done    → { ok: true }
 *   error   → { error: string }
 *
 * 兼容 fallback：未配 LLM 时直接走一次性 JSON 风格（一条 delta = 全部文本）
 */

import { NextRequest } from 'next/server';
import { getDb, getRawSqlite, assets } from '@insight-os/db';
import { inArray } from 'drizzle-orm';
import { isLLMConfigured } from '@insight-os/core';
import { callLLM, streamLLM } from '@insight-os/llm';
import {
  ASSISTANT_ROUTER_SYSTEM,
  buildAssistantRouterUserPrompt,
  ASSISTANT_SUMMARIZER_SYSTEM,
  buildAssistantSummarizerUserPrompt,
  type RouterOutput,
  type SummarizerInput,
} from '@insight-os/llm';

export const dynamic = 'force-dynamic';

// ==================== Types ====================
interface CardSnippet {
  id: string;
  title: string;
  evidenceLevel: string;
  priority: string;
  oneSentenceInsight: string | null;
  topicNames: string[];
  score?: number;
  followUp?: FollowUp[];
}

interface FollowUp {
  label: string;
  payload: { kind: string; [k: string]: any };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cards?: CardSnippet[];
  followUp?: FollowUp[];
  intent?: string;
}

// ==================== Regex fallback ====================
function extractAssetIds(text: string): string[] {
  return [...new Set([...text.matchAll(/\[(asset_[a-z0-9_]+)\]/g)].map(m => m[1]))];
}

function stripPrefix(text: string): string {
  return text
    .replace(/^(我想|我需要|帮我|麻烦|请|想|要|要个|给我|可以)/, '')
    .replace(/^(找|搜索|搜下|查下|看看|有哪些|有什么|有没有)/, '')
    .replace(/(的卡|的资产|的洞察|的笔记|的素材)$/, '')
    .trim();
}

function regexRoute(message: string): RouterOutput {
  const t = message.trim();
  const ids = extractAssetIds(t);
  if (/^(你能做什么|你能干嘛|什么|是什么|怎么用|help|\?|帮助|介绍)/i.test(t)) {
    return { intent: 'help', query: t, assetIds: ids, confidence: 0.95, fallbackIntent: 'help' };
  }
  // v0.7.5：复杂查询（对比/分析/综合/整理）→ multi_step
  if (/对比|比较|差异|vs|\bvs\.?\b|分析.*和|综合|整理|评估|盘点/.test(t)) {
    return {
      intent: 'multi_step', query: t, assetIds: ids, confidence: 0.75,
      multiStep: [
        { tool: 'search', query: stripPrefix(t) || t, reasoning: '先搜一下相关卡' },
      ],
      fallbackIntent: 'search',
    };
  }
  if (/多卡|几张|联合|一起生成|一起讲|组合|汇总|整合|一稿|一篇文|一篇稿/.test(t)) {
    return { intent: 'multi_output', query: t, assetIds: ids, outputType: 'talk_script', audience: '客户 CEO', confidence: 0.9, fallbackIntent: 'search' };
  }
  if (ids.length >= 1 && /生成|写|讲|拆|说|总结|讲给/.test(t)) {
    return { intent: 'multi_output', query: t, assetIds: ids, outputType: 'talk_script', audience: '客户 CEO', confidence: 0.85, fallbackIntent: 'search' };
  }
  if (/几张|多少|最常|分布|有几个|数量|排行/.test(t)) {
    return { intent: 'meta_query', query: t, assetIds: ids, confidence: 0.85, fallbackIntent: 'search' };
  }
  // v0.8：主题思想内核
  if (/核心思想|思想内核|主题总结|主题概述|一句话讲|主题说什么/.test(t)) {
    return { intent: 'meta_query', query: t, assetIds: ids, confidence: 0.85, fallbackIntent: 'search' };
  }
  return { intent: 'search', query: stripPrefix(t) || t, assetIds: ids, confidence: 0.5, fallbackIntent: 'search' };
}

async function llmRoute(message: string, history: ChatMessage[]): Promise<RouterOutput> {
  const userPrompt = buildAssistantRouterUserPrompt({
    message,
    history: history.map(h => ({
      role: h.role, content: h.content, intent: h.intent, cards: h.cards,
    })),
  });
  const res = await callLLM<RouterOutput>(ASSISTANT_ROUTER_SYSTEM, userPrompt, {
    jsonMode: true, temperature: 0.1,
  });
  if (!res.ok || !res.data) throw new Error(`路由 LLM 失败: ${res.error}`);
  if (!['search', 'multi_output', 'meta_query', 'multi_step', 'help'].includes(res.data.intent)) {
    res.data.intent = 'search';
  }
  res.data.confidence = res.data.confidence ?? 0.7;
  res.data.fallbackIntent = res.data.fallbackIntent ?? 'search';
  res.data.assetIds = res.data.assetIds ?? [];
  return res.data;
}

// ==================== SSE Writer ====================
function sseEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ==================== Main ====================
export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = (body.message ?? '').trim();
  const history: ChatMessage[] = body.history ?? [];
  if (!message) {
    return new Response(sseEvent('error', { error: '消息为空' }), {
      status: 400, headers: { 'content-type': 'text/event-stream' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try { controller.enqueue(encoder.encode(sseEvent(event, data))); }
        catch { /* 客户端可能断开 */ }
      };

      try {
        // ===== 1) regex 路由（0ms，立即）+ search API（~50ms）=====
        // 让 cards 立即可见，不等 LLM router
        const regex = regexRoute(message);
        let route: RouterOutput = regex;
        let routerSource: 'llm' | 'regex' = 'regex';

        let toolData: any = null;
        let cards: CardSnippet[] = [];
        let followUp: FollowUp[] = [];
        let hardReply: string | null = null;

        if (regex.intent === 'help') {
          hardReply = `我是 Insight OS 的洞察助手。可以：

• **找关于"组织设计"的卡** — 全文搜索资产库
• **多卡 [asset_xxx, asset_yyy] 讲给 CEO** — 几张卡一起生成话术
• **看看组织设计主题下有什么** — 主题/标签搜索
• **AI 时代组织失效的洞察** — 自由搜索（不一定要"找"开头）
• **几张 E5 的卡** — 元信息查询

点搜索结果上的"用这个生成"可以一键开生成。`;
        } else if (regex.intent === 'search') {
          // 立即发 cards（不等 LLM router）
          const results = await callSearchAPI(regex.query, 8);
          cards = results.map(c => ({
            ...c,
            followUp: [{ label: '用这 + 其它卡生成话术', payload: { kind: 'multi_start', seedAssetId: c.id } }],
          } as any));
          if (cards.length === 0) {
            hardReply = `没找到关于「${regex.query}」的资产卡。试试换个关键词，或者去收集箱 / 候选池 提一张新卡。`;
          } else {
            send('cards', { cards });
          }
        } else if (regex.intent === 'meta_query') {
          toolData = await callMetaQuery(regex.query || message);
          send('data', { toolData });
        } else if (regex.intent === 'multi_output') {
          // regex 不太擅长 multi_output，等 LLM router
        } else if (regex.intent === 'multi_step') {
          // regex multi_step 也会等 LLM 重新规划
        }

        // ===== 2) LLM 路由（后台，可提升意图）=====
        if (isLLMConfigured()) {
          try {
            const lr = await llmRoute(message, history);
            routerSource = 'llm';
            if (lr.confidence >= 0.6) {
              // LLM 比 regex 更准：覆盖 route
              route = lr;
              // 如果 LLM 改主意到 multi_output 且 regex 没做，触发 multi
              if (lr.intent === 'multi_output' && regex.intent !== 'multi_output') {
                // 重新调 multi API
                let ids = lr.assetIds;
                if (ids.length < 2) {
                  const sr = await callSearchAPI(lr.query || stripPrefix(message), 5);
                  ids = sr.map(r => r.id).slice(0, Math.max(2, Math.min(7, ids.length || 5)));
                }
                if (ids.length >= 2) {
                  const origin = req.nextUrl.origin;
                  const res = await fetch(`${origin}/api/output/multi`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      assetIds: ids,
                      outputType: lr.outputType ?? 'talk_script',
                      audience: lr.audience ?? '客户 CEO',
                      context: lr.context || message,
                    }),
                  });
                  const out = await res.json();
                  if (out.ok) {
                    toolData = out;
                    cards = await getCardSnippets(ids);
                    followUp = [{ label: '查看完整输出 →', payload: { kind: 'open_output', outputId: out.outputId } }];
                    send('data', { toolData });
                    send('cards', { cards });
                  } else {
                    hardReply = `生成失败：${out.error ?? '未知错误'}`;
                  }
                } else {
                  hardReply = `联合输出需要至少 2 张资产卡。你可以：

• 直接粘贴 [asset_xxx, asset_yyy]
• 或说"多卡 [主题词]" — 我会先搜相关卡再拼`;
                }
              } else if (lr.intent === 'meta_query' && regex.intent !== 'meta_query') {
                toolData = await callMetaQuery(lr.query || message);
                send('data', { toolData });
              } else if (lr.intent === 'help' && regex.intent !== 'help') {
                hardReply = `我是 Insight OS 的洞察助手。可以：

• **找关于"组织设计"的卡** — 全文搜索资产库
• **多卡 [asset_xxx, asset_yyy] 讲给 CEO** — 几张卡一起生成话术
• **AI 时代组织失效的洞察** — 自由搜索（不一定要"找"开头）
• **几张 E5 的卡** — 元信息查询`;
              } else if (lr.intent === 'multi_step') {
                // v0.7.5：执行多步计划
                // 清掉之前可能设的 hardReply（regex search 没卡时设过）
                hardReply = null;
                const steps = lr.multiStep ?? [];
                if (steps.length === 0) {
                  hardReply = `你想综合分析，但需要更具体的内容。试试：

• "对比组织设计和激励错位"
• "分析我这周没用的卡"`;
                } else {
                  const stepResults: Array<{ tool: string; query: string; reasoning: string; result: any }> = [];
                  for (let i = 0; i < Math.min(steps.length, 3); i++) {
                    const step = steps[i];
                    let result: any;
                    let stepCards: CardSnippet[] = [];
                    try {
                      if (step.tool === 'search') {
                        const sr = await callSearchAPI(step.query, 6);
                        result = { type: 'search', count: sr.length, cards: sr.map(c => ({ id: c.id, title: c.title, evidenceLevel: c.evidenceLevel, oneSentenceInsight: c.oneSentenceInsight })) };
                        stepCards = sr;
                        if (i === 0 && sr.length > 0) {
                          // 第一步 search 的 cards 推到前端
                          const cardsForUi = sr.map(c => ({
                            ...c,
                            followUp: [{ label: '用这 + 其它卡生成话术', payload: { kind: 'multi_start', seedAssetId: c.id } }],
                          } as any));
                          cards = cardsForUi;
                          send('cards', { cards });
                        }
                      } else if (step.tool === 'meta_query') {
                        result = await callMetaQuery(step.query);
                      }
                    } catch (e: any) {
                      result = { error: e.message ?? 'step failed' };
                    }
                    stepResults.push({ tool: step.tool, query: step.query, reasoning: step.reasoning, result });
                    send('data', { multiStep: true, stepIndex: i, totalSteps: steps.length, step, result });
                  }
                  toolData = { steps: stepResults };
                }
              }
              // 如果 LLM 改 search 但 query 变了，可以重新搜
              else if (lr.intent === 'search' && regex.intent === 'search' && lr.query && lr.query !== regex.query) {
                const results2 = await callSearchAPI(lr.query, 8);
                const newCards = results2.map(c => ({
                  ...c,
                  followUp: [{ label: '用这 + 其它卡生成话术', payload: { kind: 'multi_start', seedAssetId: c.id } }],
                } as any));
                if (newCards.length > 0) {
                  cards = newCards;
                  send('cards', { cards });
                }
              }
            } else {
              route = regex;
            }
          } catch (e) {
            console.warn('[assistant] llm route fallback:', e);
            route = regex;
          }
        }

        send('meta', { intent: route.intent, routerSource, confidence: route.confidence });

        // ===== 3) 流式总结 =====
        if (hardReply) {
          // 非 LLM 路径：一次性推全部文本（模拟一次性 delta）
          send('delta', { text: hardReply });
        } else if (isLLMConfigured() && (toolData || cards.length > 0)) {
          // LLM 路径：流式
          const summarizeInput: SummarizerInput = {
            message,
            intent: route.intent,
            data: route.intent === 'search' ? { cards: cards.slice(0, 8) } : toolData,
            history: history.map(h => ({ role: h.role, content: h.content })),
          };
          const userPrompt = buildAssistantSummarizerUserPrompt(summarizeInput);
          try {
            for await (const chunk of streamLLM(ASSISTANT_SUMMARIZER_SYSTEM, userPrompt, {
              temperature: 0.5, maxTokens: 600,
            })) {
              if (chunk.startsWith('[ERROR]')) {
                send('delta', { text: fallbackTemplate(route.intent, toolData, cards.length) });
                break;
              }
              send('delta', { text: chunk });
            }
          } catch (e: any) {
            console.warn('[assistant] streamLLM failed:', e);
            send('delta', { text: fallbackTemplate(route.intent, toolData, cards.length) });
          }
        } else {
          send('delta', { text: fallbackTemplate(route.intent, toolData, cards.length) });
        }

        if (followUp.length > 0) send('followUp', { followUp });
        send('done', { ok: true });
      } catch (e: any) {
        send('error', { error: e.message ?? String(e) });
      } finally {
        try { controller.close(); } catch { /* */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

// ==================== Helpers ====================
function fallbackTemplate(intent: string, data: any, cardCount: number): string {
  if (intent === 'multi_output' && data?.data) {
    const d = data.data;
    const points = (d.corePoints ?? []).slice(0, 3).map((p: any) =>
      `• ${typeof p === 'string' ? p : p.point ?? p.title ?? JSON.stringify(p).slice(0, 60)}`
    ).join('\n');
    return `已基于多张卡生成联合话术。\n\n${d.headline ?? ''}\n\n${points}`;
  }
  if (intent === 'meta_query' && data) {
    return `元信息：${JSON.stringify(data).slice(0, 200)}`;
  }
  return `找到 ${cardCount} 张相关卡。`;
}

// ==================== Search ====================
async function callSearchAPI(query: string, limit: number): Promise<CardSnippet[]> {
  const sqlite = getRawSqlite();
  const likeQuery = `%${query.replace(/[%_]/g, '\\$&')}%`;
  const ftsQuery = query
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .map(w => `${w}*`)
    .join(' OR ');

  let rows: any[] = [];
  try {
    if (ftsQuery) {
      rows = sqlite.prepare(`
        SELECT a.id, a.title, a.evidence_level as evidenceLevel, a.priority,
               a.one_sentence_insight as oneSentenceInsight,
               bm25(assets_fts) as score
        FROM assets_fts f
        JOIN assets a ON a.id = f.asset_id
        WHERE assets_fts MATCH ?
        AND a.type = 'asset'
        ORDER BY score
        LIMIT ?
      `).all(ftsQuery, limit);
    }
  } catch { /* FTS 失败降级 */ }
  if (rows.length === 0) {
    rows = sqlite.prepare(`
      SELECT a.id, a.title, a.evidence_level as evidenceLevel, a.priority,
             a.one_sentence_insight as oneSentenceInsight, 0 as score
      FROM assets a
      WHERE a.type = 'asset'
        AND (a.title LIKE ? OR a.one_sentence_insight LIKE ?)
      ORDER BY a.feedback_count DESC, a.last_used_at DESC
      LIMIT ?
    `).all(likeQuery, likeQuery, limit);
  }
  if (rows.length === 0) return [];

  const ids = rows.map((r: any) => r.id);
  const topicMap = new Map<string, string[]>();
  for (const id of ids) {
    const trs = sqlite.prepare(`
      SELECT t.name FROM topics t
      JOIN asset_topics at ON at.topic_id = t.id
      WHERE at.asset_id = ?
      ORDER BY at.confidence DESC LIMIT 3
    `).all(id) as any[];
    topicMap.set(id, trs.map(t => t.name));
  }

  return rows.map((r: any) => ({
    id: r.id, title: r.title, evidenceLevel: r.evidenceLevel,
    priority: r.priority ?? 'C', oneSentenceInsight: r.oneSentenceInsight,
    score: r.score, topicNames: topicMap.get(r.id) ?? [],
  }));
}

async function getCardSnippets(ids: string[]): Promise<CardSnippet[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = db.select().from(assets).where(inArray(assets.id, ids)).all();
  const sqlite = getRawSqlite();
  return rows.map(r => {
    const trs = sqlite.prepare(`
      SELECT t.name FROM topics t
      JOIN asset_topics at ON at.topic_id = t.id
      WHERE at.asset_id = ?
      ORDER BY at.confidence DESC LIMIT 3
    `).all(r.id) as any[];
    return {
      id: r.id, title: r.title, evidenceLevel: r.evidenceLevel,
      priority: r.priority ?? 'C', oneSentenceInsight: r.oneSentenceInsight,
      topicNames: trs.map(t => t.name),
    };
  });
}

async function callMetaQuery(question: string): Promise<any> {
  const sqlite = getRawSqlite();
  // v0.8：主题思想内核查询
  if (/核心思想|思想内核|主题总结|主题概述|一句话讲/.test(question)) {
    // 尝试匹配主题名（不要求严格，因为 topic_name 是中文）
    const topicsRows = sqlite.prepare(`SELECT id, name, slug FROM topics`).all() as any[];
    let matchedTopic: any = null;
    for (const t of topicsRows) {
      if (question.includes(t.name)) { matchedTopic = t; break; }
    }
    if (matchedTopic) {
      const kernel = sqlite.prepare(`
        SELECT id, headline, summary, core_beliefs_json, source_asset_ids_json,
               generated_at, generation_model
        FROM topic_kernels WHERE topic_id = ?
      `).get(matchedTopic.id) as any;
      if (kernel) {
        return {
          metric: `${matchedTopic.name} 思想内核`,
          value: {
            topicName: matchedTopic.name,
            headline: kernel.headline,
            summary: kernel.summary,
            coreBeliefs: JSON.parse(kernel.core_beliefs_json),
            sourceAssetIds: JSON.parse(kernel.source_asset_ids_json),
            generatedAt: kernel.generated_at,
            generationModel: kernel.generation_model,
          },
          distribution: null,
        };
      } else {
        return { metric: `${matchedTopic.name} 思想内核`, value: null, distribution: null, hint: '该主题尚未生成内核，需要在资产地图页点击「生成内核」' };
      }
    }
    return { metric: '主题内核', value: null, distribution: null, hint: '问题里没识别到主题名' };
  }
  const eMatch = question.match(/E([0-5])/);
  if (eMatch) {
    const level = `E${eMatch[1]}`;
    const count = (sqlite.prepare(`SELECT COUNT(*) as c FROM assets WHERE type='asset' AND evidence_level = ?`).get(level) as any).c;
    return { metric: `${level} 卡数量`, value: count, distribution: null };
  }
  if (/最常/.test(question) || /排行/.test(question)) {
    const rows = sqlite.prepare(`
      SELECT id, title, evidence_level, feedback_count, last_used_at
      FROM assets WHERE type='asset' ORDER BY feedback_count DESC LIMIT 5
    `).all() as any[];
    return { metric: '最常引用', value: rows, distribution: null };
  }
  const dist = sqlite.prepare(`
    SELECT evidence_level, COUNT(*) as count FROM assets
    WHERE type='asset' GROUP BY evidence_level
  `).all() as any[];
  return { metric: '证据分布', value: dist, distribution: dist };
}
