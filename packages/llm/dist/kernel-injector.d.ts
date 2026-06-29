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
    confidence: number;
    counterExample?: string | null;
    scope?: string | null;
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
export declare function kernelToSystemPrompt(kernels: KernelEntry[]): string;
/**
 * 把 kernel system prompt 拼接到原 system prompt 前
 *
 * 自动处理：空 kernel 不拼接、保留原 prompt 完整性
 */
export declare function prependKernel(sysPrompt: string, kernel: KernelEntry[] | undefined | null): string;
