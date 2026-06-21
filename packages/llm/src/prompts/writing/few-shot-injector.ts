/**
 * Few-shot 注入器（V1.2）
 *
 * 用途：把 preset.fewShotRefs 关联的 outputs 内容注入到生成 prompt
 *
 * 设计：
 *   - 读 outputs 表里 fewShotRefs 引用的文章
 *   - 抽每篇的"风格特征片段"（开头 200 字 + 中段金句 1 句 + 结尾 100 字）
 *   - 拼成 few-shot 块注入到 user prompt
 *   - 截断总长度（5000 字内）避免超 context
 *
 * 让 LLM 看到"作者原话"，比纯参数化 5 维度更准
 */

export interface FewShotSample {
  outputId: string;
  title: string;
  outputType: string;
  head: string;        // 开头 200 字
  mid: string;         // 中段金句 1 句
  tail: string;        // 结尾 100 字
}

export interface FewShotBlock {
  samples: FewShotSample[];
  totalChars: number;
  formattedBlock: string;
}

const HEAD_CHARS = 200;
const MID_CHARS = 100;
const TAIL_CHARS = 100;
const MAX_TOTAL_CHARS = 5000;

/**
 * 抽一篇文章的"风格特征片段"
 */
function extractSample(content: string, outputType: string): { head: string; mid: string; tail: string } {
  // 去掉 JSON 包装（multi 输出的 content 是 JSON 字符串）
  let plainText = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed.primary_version) {
      plainText = parsed.primary_version;
    }
  } catch { /* 不是 JSON 包装 */ }

  plainText = plainText.trim();
  if (plainText.length <= HEAD_CHARS + TAIL_CHARS + 50) {
    // 太短：整篇
    return { head: plainText, mid: '', tail: '' };
  }

  const head = plainText.slice(0, HEAD_CHARS);
  const tail = plainText.slice(-TAIL_CHARS);

  // 中段金句：取中间 1 句
  const midStart = Math.floor(plainText.length / 2);
  const midArea = plainText.slice(midStart, midStart + 500);
  // 找第一个句号/问号/感叹号
  const sentenceEnd = midArea.search(/[。！？.!?]/);
  const mid = sentenceEnd > 0
    ? midArea.slice(0, sentenceEnd + 1).slice(0, MID_CHARS)
    : midArea.slice(0, MID_CHARS);

  return { head, mid, tail };
}

/**
 * 从 outputs 表读 few-shot 样本
 *
 * 注：这个函数需要在 web app 的 API route 里调用（不直接 import db）
 *     通过 callback 传入 reader 函数避免循环依赖
 */
export interface FewShotReader {
  /** 读一个 output 的 title + content + outputType */
  readOutput(id: string): Promise<{ title: string; content: string; outputType: string } | null>;
}

/**
 * 拼成 few-shot 块
 */
export async function buildFewShotBlock(
  fewShotRefs: string[],
  reader: FewShotReader
): Promise<FewShotBlock> {
  if (!fewShotRefs || fewShotRefs.length === 0) {
    return { samples: [], totalChars: 0, formattedBlock: '' };
  }

  const samples: FewShotSample[] = [];
  let totalChars = 0;

  for (const id of fewShotRefs) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    const output = await reader.readOutput(id);
    if (!output) continue;

    const { head, mid, tail } = extractSample(output.content, output.outputType);
    const sampleChars = head.length + mid.length + tail.length + 100;  // 100 字标签开销
    if (totalChars + sampleChars > MAX_TOTAL_CHARS) break;

    samples.push({
      outputId: id,
      title: output.title,
      outputType: output.outputType,
      head,
      mid,
      tail,
    });
    totalChars += sampleChars;
  }

  if (samples.length === 0) {
    return { samples: [], totalChars: 0, formattedBlock: '' };
  }

  const formattedBlock = `## 作者风格参考（few-shot 样本 · 摘自 ${samples.length} 篇历史文章）

> 这是 Vincent 自己的历史文章片段，**严格按这个风格写**，包括：句式、节奏、修辞、判断方式。

${samples.map((s, i) => `### 参考 ${i + 1}：《${s.title}》

**开头风格**：
${s.head}${s.head.length >= HEAD_CHARS ? '…' : ''}

${s.mid ? `**中段金句风格**：
> ${s.mid}` : ''}

${s.tail ? `**结尾风格**：
${s.tail}` : ''}
`).join('\n')}
`;

  return { samples, totalChars, formattedBlock };
}