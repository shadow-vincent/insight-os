/**
 * .md 文件 frontmatter 解析器
 *
 * 解析 YAML 风格 frontmatter，支持：
 * - 简单 key: value
 * - 数组 key: [a, b, c]
 * - 字符串 tags（"AI, 判断力"）
 *
 * 不引入 js-yaml 依赖，自己实现足够用（你 OpenClaw 写的格式很规整）
 */

export interface Frontmatter {
  [key: string]: string | string[] | undefined;
}

/**
 * 从文件内容中提取 frontmatter
 * 不支持复杂的 YAML 语法（嵌套、引用等），但够 99% 的场景
 */
export function parseFrontmatter(content: string): Frontmatter {
  if (!content.startsWith('---\n')) return {};

  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return {};

  const fmText = content.slice(4, end);
  const result: Frontmatter = {};

  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const rawLine of fmText.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    // 数组项: "  - xxx" 或 "  - "xxx""
    const listMatch = line.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentList) {
      const item = listMatch[1].trim().replace(/^["']|["']$/g, '');
      currentList.push(item);
      continue;
    }

    // 键值对: key: value 或 key: [a, b]
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      // 保存上一个 list
      if (currentKey && currentList) {
        result[currentKey] = currentList;
      }

      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();

      if (val.startsWith('[') && val.endsWith(']')) {
        // 内联数组: [a, b, c]
        const inner = val.slice(1, -1);
        result[currentKey] = parseInlineArray(inner);
        currentList = null;
      } else if (val === '' || val === '|' || val === '>') {
        // 可能是多行数组开始
        currentList = [];
      } else {
        // 普通字符串值（去掉引号）
        result[currentKey] = val.replace(/^["']|["']$/g, '');
        currentList = null;
      }
    }
  }

  // 保存最后一个 list
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }

  return result;
}

function parseInlineArray(s: string): string[] {
  return s
    .split(',')
    .map(x => x.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * 从 Markdown 内容提取一句话洞察
 * 优先匹配特定章节：# 一句话洞察 / ## 一句话洞察 / | **一句话洞察** |
 * 找不到则取正文第一段
 */
export function extractOneSentenceInsight(content: string): string | undefined {
  // 模式 1: 表格里 | **一句话洞察** | xxx |
  const tableMatch = content.match(/\|\s*\*\*一句话洞察\*\*\s*\|\s*([^|]+?)\s*\|/);
  if (tableMatch) return cleanText(tableMatch[1]);

  // 模式 2: 标题后跟文本
  const headingMatch = content.match(/(?:#{1,4}\s*)?\*\*?一句话洞察\*\*?[：:]\s*(.+?)(?:\n|$)/);
  if (headingMatch) return cleanText(headingMatch[1]);

  return undefined;
}

/**
 * 从 Markdown 内容提取反常识判断
 */
export function extractAntiCommonSense(content: string): string | undefined {
  const tableMatch = content.match(/\|\s*\*\*反常识判断\*\*\s*\|\s*([^|]+?)\s*\|/);
  if (tableMatch) return cleanText(tableMatch[1]);

  const headingMatch = content.match(/(?:#{1,4}\s*)?\*\*?反常识判断\*\*?[：:]\s*(.+?)(?:\n|$)/);
  if (headingMatch) return cleanText(headingMatch[1]);

  return undefined;
}

function cleanText(s: string): string {
  return s.trim().replace(/\*\*/g, '').replace(/\s+/g, ' ');
}

/**
 * 从 Markdown 内容提取摘要
 * 优先 frontmatter.summary，否则取第一个段落
 */
export function extractSummary(fm: Frontmatter, content: string): string | undefined {
  if (typeof fm.summary === 'string' && fm.summary.trim()) {
    return fm.summary.trim();
  }

  // 跳过 frontmatter 和第一个标题
  const bodyStart = content.indexOf('\n---\n');
  if (bodyStart === -1) return undefined;

  const body = content.slice(bodyStart + 5);
  // 找第一个非空、非标题段落
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('>')) continue;
    if (t.startsWith('|')) continue;
    if (t.startsWith('```')) continue;
    if (t.startsWith('---')) continue;
    return cleanText(t);
  }

  return undefined;
}
