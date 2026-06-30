/**
 * V1.11.13 解析 .md 卡片
 *
 * 解析本地 .md 卡片（V1.10 之前 Insight OS 用的格式）：
 * - YAML frontmatter: title / type / date / source / tags / related / summary / evidence_level / maturity
 * - Body: 完整 markdown 内容
 *
 * 输出 AssetRow 字段（让 .md 文件能导入 IDB）
 */

export interface ParsedMdCard {
  id: string;                  // 生成的唯一 ID
  title: string;
  oneSentenceInsight: string | null;
  antiCommonSense: string | null;
  evidenceLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
  tags: string[];
  source: string | null;
  sourceType: 'book' | 'knowledge_card' | 'project' | 'article' | 'original' | 'unknown';
  body: string;                // 完整 .md body（不含 frontmatter）
  fileName: string;            // 原始文件名
  createdAt: number;
  updatedAt: number;
}

/**
 * 解析 YAML frontmatter
 * 简化版：不引入 yaml 库（避免 Vercel bundle 增大），按行处理 key: value
 */
function parseFrontmatter(text: string): { data: Record<string, any>; body: string } {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { data: {}, body: text };
  }
  const data: Record<string, any> = {};
  const lines = fmMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      const value = m[2].trim();
      // 解析 tags: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        data[key] = inner === '' ? [] : inner.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        data[key] = value;
      }
    }
  }
  return { data, body: fmMatch[2] };
}

/**
 * 从 body 抽取"反常识"和"洞察"（如果 frontmatter 没给）
 * 搜索模式：
 * - "反常识" 段
 * - "一句话洞察" 段
 * - summary 段
 */
function extractFromBody(body: string, summary?: string): { insight: string | null; anti: string | null } {
  let insight: string | null = null;
  let anti: string | null = null;

  // 优先用 summary
  if (summary) {
    insight = summary;
  }

  // 搜 "反常识判断：" 后的内容
  const antiMatch = body.match(/\*?\*?反常识判断\*?\*?[：:]\s*\n?([^\n#]+)/);
  if (antiMatch) {
    anti = antiMatch[1].trim();
  }

  // 搜 "一句话洞察：" 后的内容（覆盖 summary 如果有更具体的）
  const insightMatch = body.match(/\*?\*?一句话洞察\*?\*?[：:]\s*\n?([^\n#]+)/);
  if (insightMatch) {
    insight = insightMatch[1].trim();
  }

  return { insight, anti };
}

/**
 * evidenceLevel 字符串规范化
 */
function normalizeEvidenceLevel(s: string | undefined): 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' {
  if (!s) return 'E1';
  const m = s.match(/E([0-5])/);
  return (m ? `E${m[1]}` : 'E1') as any;
}

/**
 * 主解析函数
 */
export function parseMdCard(content: string, fileName: string): ParsedMdCard {
  const { data, body } = parseFrontmatter(content);
  const { insight, anti } = extractFromBody(body, data.summary);

  // ID 用文件名 hash（保证稳定，不重复）
  const idFromName = fileName
    .replace(/\.md$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 40);
  const id = `md_${idFromName}_${Date.now().toString(36)}`;

  // date 转 ms（如果存在）
  let createdAt = Date.now();
  if (data.date) {
    const t = new Date(data.date).getTime();
    if (!isNaN(t)) createdAt = t;
  }

  // tags 来自 frontmatter 或从 body 抽 "#标签"
  let tags: string[] = Array.isArray(data.tags) ? data.tags : [];
  if (tags.length === 0) {
    const tagMatches = body.match(/#([\u4e00-\u9fa5a-zA-Z0-9_-]+)/g);
    if (tagMatches) {
      tags = Array.from(new Set(tagMatches.map(t => t.slice(1))));
    }
  }

  return {
    id,
    title: data.title || fileName.replace(/\.md$/, ''),
    oneSentenceInsight: insight,
    antiCommonSense: anti,
    evidenceLevel: normalizeEvidenceLevel(data.evidence_level),
    tags,
    source: data.source || fileName,
    sourceType: 'original',
    body: body.trim(),
    fileName,
    createdAt,
    updatedAt: Date.now(),
  };
}

/**
 * 批量解析多张 .md
 */
export function parseMdCards(files: { name: string; content: string }[]): ParsedMdCard[] {
  return files.map(f => parseMdCard(f.content, f.name));
}