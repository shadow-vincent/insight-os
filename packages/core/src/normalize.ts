/**
 * 应用层适配器
 *
 * 核心规则：原始 .md 文件永远不动，应用层读进来自己做映射。
 * 你 OpenClaw 怎么写就怎么写，你 Obsidian 怎么改就怎么改，
 * 应用层做适配。
 */

// ===== Type 映射 =====
// OpenClaw 历史上用过 5 种 type 写法，统一成 3 种
export const TYPE_MAP: Record<string, 'light' | 'asset' | 'kernel'> = {
  // 当前主用（也兼容历史）
  management_insight: 'asset',
  管理洞察资产卡: 'asset',
  'insight-card': 'asset',
  management_insight_asset: 'asset',
  insight: 'asset',
  // 未来扩展
  light_card: 'light',
  light: 'light',
  kernel: 'kernel',
  'core_belief': 'kernel',
};

export type CardType = 'light' | 'asset' | 'kernel';

export function normalizeType(raw: string | undefined | null): CardType {
  if (!raw) return 'asset'; // 默认
  const key = raw.trim().toLowerCase();
  if (TYPE_MAP[key]) return TYPE_MAP[key];
  // 未知 type：保守起见归为 asset
  return 'asset';
}

// ===== Tags 适配 =====
// 历史数据中 19 张是数组、20 张是字符串，统一处理
export function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map(s => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    // 支持 ", " "，" "、" " " 四种分隔符
    return raw
      .split(/[,，、\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ===== Evidence Level 适配 =====
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export const EVIDENCE_LEVELS: EvidenceLevel[] = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'];

export function normalizeEvidenceLevel(raw: string | undefined | null): EvidenceLevel {
  if (!raw) return 'E0';
  const upper = raw.trim().toUpperCase();
  if (EVIDENCE_LEVELS.includes(upper as EvidenceLevel)) {
    return upper as EvidenceLevel;
  }
  return 'E0';
}

// ===== Maturity 适配 =====
export type Maturity = 'available' | 'pending' | 'draft' | 'unknown';

export const MATURITY_MAP: Record<string, Maturity> = {
  可用: 'available',
  待验证: 'pending',
  草稿: 'draft',
  available: 'available',
  pending: 'pending',
  draft: 'draft',
};

export function normalizeMaturity(raw: string | undefined | null): Maturity {
  if (!raw) return 'unknown';
  return MATURITY_MAP[raw.trim()] ?? 'unknown';
}

// ===== Source Type 推断 =====
// 不做精确分类，只给一个粗的 sourceType 标签
export type SourceType = 'book' | 'knowledge_card' | 'project' | 'article' | 'original' | 'unknown';

export function inferSourceType(raw: string | undefined | null): SourceType {
  if (!raw) return 'unknown';
  const s = raw.trim();
  if (s.includes('insight-pipeline') || s.includes('→') || s.startsWith('知识卡片')) {
    return 'knowledge_card';
  }
  if (s.startsWith('原创')) return 'original';
  if (s.endsWith('.pdf') || s.includes('方案') || s.includes('报告')) {
    return 'project';
  }
  if (s.startsWith('http') || s.includes('公众号') || s.includes('blog')) {
    return 'article';
  }
  // 默认认为是书（因为你的 39 张卡里 60% 是德鲁克/明茨伯格/精要）
  return 'book';
}
