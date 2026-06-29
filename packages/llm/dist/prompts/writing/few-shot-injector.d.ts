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
    head: string;
    mid: string;
    tail: string;
}
export interface FewShotBlock {
    samples: FewShotSample[];
    totalChars: number;
    formattedBlock: string;
}
/**
 * 从 outputs 表读 few-shot 样本
 *
 * 注：这个函数需要在 web app 的 API route 里调用（不直接 import db）
 *     通过 callback 传入 reader 函数避免循环依赖
 */
export interface FewShotReader {
    /** 读一个 output 的 title + content + outputType */
    readOutput(id: string): Promise<{
        title: string;
        content: string;
        outputType: string;
    } | null>;
}
/**
 * 拼成 few-shot 块
 */
export declare function buildFewShotBlock(fewShotRefs: string[], reader: FewShotReader): Promise<FewShotBlock>;
