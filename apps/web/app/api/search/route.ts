/**
 * GET /api/search
 *
 * 全文搜索资产卡
 *
 * Query 参数：
 *   q         - 搜索关键词（FTS5 语法）
 *   topic     - 主题 slug（可选）
 *   evidence  - E0/E1/E2/E3/E4/E5（可选）
 *   type      - light/asset/kernel（可选）
 *   limit     - 最多返回（默认 20）
 *
 * 返回：
 *   { ok, q, total, results: [{ id, title, snippet, score, ... }] }
 *
 * Highlight 策略：FTS5 的 highlight() 函数返回带 <mark> 标记的片段
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRawSqlite } from '@insight-os/db';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    const topic = searchParams.get('topic') ?? '';
    const evidence = searchParams.get('evidence') ?? '';
    const type = searchParams.get('type') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, MAX_LIMIT);

    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, q, total: 0, results: [] });
    }

    const sqlite = getRawSqlite();

    // 用 FTS5 搜索，highlight 取 title 和 insight
    // FTS5 的 MATCH 语法：直接传用户输入（unicode61 tokenizer 会切词）
    // 用引号包起来避免特殊字符
    const ftsQuery = q.replace(/"/g, '""');
    const baseSql = `
      SELECT
        f.asset_id AS id,
        a.title,
        a.evidence_level AS evidenceLevel,
        a.priority,
        a.one_sentence_insight AS oneSentenceInsight,
        a.type,
        highlight(assets_fts, 1, '<mark>', '</mark>') AS titleHighlight,
        snippet(assets_fts, 2, '<mark>', '</mark>', '…', 12) AS insightSnippet,
        bm25(assets_fts) AS score
      FROM assets_fts f
      INNER JOIN assets a ON a.id = f.asset_id
      WHERE assets_fts MATCH ?
    `;

    const conditions: string[] = [];
    const params: any[] = [`"${ftsQuery}"`];

    if (evidence && /^E[0-5]$/.test(evidence)) {
      conditions.push('a.evidence_level = ?');
      params.push(evidence);
    }
    if (type && ['light', 'asset', 'kernel'].includes(type)) {
      conditions.push('a.type = ?');
      params.push(type);
    }

    let sql = baseSql;
    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY score LIMIT ?';
    params.push(limit);

    const rows = sqlite.prepare(sql).all(...params) as any[];

    // 主题过滤（用单独的 query：拿每个 asset 的主题 slug）
    let filtered = rows;
    if (topic) {
      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const topicRows = sqlite.prepare(`
          SELECT at.asset_id, t.slug
          FROM asset_topics at
          INNER JOIN topics t ON t.id = at.topic_id
          WHERE at.asset_id IN (${placeholders})
        `).all(...ids) as { asset_id: string; slug: string }[];
        const topicSet = new Set(topicRows.filter(r => r.slug === topic).map(r => r.asset_id));
        filtered = rows.filter(r => topicSet.has(r.id));
      }
    }

    return NextResponse.json({
      ok: true,
      q,
      total: filtered.length,
      filters: { topic, evidence, type },
      results: filtered.map(r => ({
        id: r.id,
        title: r.title,
        titleHighlight: r.titleHighlight,
        insightSnippet: r.insightSnippet,
        oneSentenceInsight: r.oneSentenceInsight,
        evidenceLevel: r.evidenceLevel,
        priority: r.priority,
        type: r.type,
        score: r.score,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
