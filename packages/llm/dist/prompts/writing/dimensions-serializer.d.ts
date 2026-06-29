/**
 * 5 维度配置 → 自然语言段
 *
 * 把用户的 5 维度配置（A 风格 / B 句式 / C 结构 / D 长度 / E 质检）
 * 序列化成 LLM 可读的自然语言，注入到 prompt 中。
 *
 * 设计：不用 JSON 表格，用自然语言段落，让 LLM 更容易理解每个维度的"含义"
 * 而不是"参数值"。
 */
import type { WritingConfig } from '@insight-os/core';
/**
 * 把 5 维度配置序列化为自然语言段
 * 输出会作为 L3 配置层注入到 L2 模板的 {{dimensions}} 占位符
 */
export declare function serializeDimensions(dims: WritingConfig['dimensions']): string;
