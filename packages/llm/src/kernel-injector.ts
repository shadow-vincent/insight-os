/**
 * Insight Kernel · LLM 注入序列化器（v1.4）
 *
 * 用户的"判断宪法"在每次 LLM 调用前自动拼到 system prompt 前面，
 * 让所有输出（写作 / 改稿 / chat / vision / 反推 / 数据校验）都带立场。
 *
 * 设计：
 * - 不引用 packages/db（避免循环依赖）
 * - KernelEntry 是稳定 DTO，db 侧负责转换
 * - 输出格式优化 LLM 阅读：分组 + 类别标题 + 置信度 + 反例
 * - 自动剔除空内容 + 排序
 */

export interface KernelEntry {
  category: 'belief' | 'contrarian' | 'expertise' | 'challenge';
  content: string;
  confidence: number;             // 0-100
  counterExample?: string | null; // 什么时候不成立
  scope?: string | null;          // 适用场景
}

/**
 * 4 类别的中文标签 + 英文 key
 */
const CATEGORY_LABEL: Record<KernelEntry['category'], { zh: string; en: string; emoji: string }> = {
  belief:      { zh: '底层信念',     en: 'Belief',      emoji: '◆' },
  contrarian:  { zh: '反常识判断',   en: 'Contrarian',  emoji: '◇' },
  expertise:   { zh: '擅长问题域',   en: 'Expertise',   emoji: '◈' },
  challenge:   { zh: '想挑战的常识', en: 'Challenge',   emoji: '◉' },
};

/**
 * 渲染一条内核（紧凑 LLM 友好格式）
 */
function renderEntry(entry: KernelEntry): string {
  const conf = Math.max(0, Math.min(100, entry.confidence));
  let line = `- ${entry.content}（置信度 ${conf}/100）`;
  if (entry.scope?.trim()) {
    line += `  · 适用: ${entry.scope}`;
  }
  if (entry.counterExample?.trim()) {
    line += `\n  - 不适用场景: ${entry.counterExample}`;
  }
  return line;
}

/**
 * 把内核列表渲染成 system prompt 片段
 *
 * 输出格式：
 * ```
 * # Insight Kernel（用户判断协议）
 * 你在所有写作、对话、改稿、推演时应遵循以下立场。
 * 这些是经过用户确认的判断，不是通用 LLM 调调。
 *
 * ## 底层信念 (Belief)
 * - 内容 (置信度 90/100)
 *   - 不适用: ...
 *
 * ## 反常识判断 (Contrarian)
 * - ...
 *
 * ---
 * ```
 *
 * @param kernels 激活的内核列表（已按 sortOrder + confidence 排序）
 * @returns system prompt 片段；空数组返回空字符串
 */
export function kernelToSystemPrompt(kernels: KernelEntry[]): string {
  if (!kernels || kernels.length === 0) return '';

  // 按类别分组
  const groups: Record<KernelEntry['category'], KernelEntry[]> = {
    belief: [],
    contrarian: [],
    expertise: [],
    challenge: [],
  };
  for (const k of kernels) {
    if (!k.content?.trim()) continue;
    if (!groups[k.category]) continue;
    groups[k.category].push(k);
  }

  const sections: string[] = [];
  // 类别顺序按重要性：belief → contrarian → expertise → challenge
  const order: KernelEntry['category'][] = ['belief', 'contrarian', 'expertise', 'challenge'];
  for (const cat of order) {
    const list = groups[cat];
    if (list.length === 0) continue;
    const label = CATEGORY_LABEL[cat];
    sections.push(`## ${label.zh} (${label.en})\n${list.map(renderEntry).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return [
    '# Insight Kernel（用户判断协议）',
    '你在所有写作、对话、改稿、推演时应遵循以下立场。',
    '这些是经过用户确认的判断，不是通用 LLM 调调——请严格遵守。',
    '',
    ...sections,
    '',
    '---',
    '',
  ].join('\n');
}

/**
 * 把 kernel system prompt 拼接到原 system prompt 前
 *
 * 自动处理：空 kernel 不拼接、保留原 prompt 完整性
 */
export function prependKernel(sysPrompt: string, kernel: KernelEntry[] | undefined | null): string {
  if (!kernel || kernel.length === 0) return sysPrompt;
  const prefix = kernelToSystemPrompt(kernel);
  if (!prefix) return sysPrompt;
  return `${prefix}\n${sysPrompt}`;
}
