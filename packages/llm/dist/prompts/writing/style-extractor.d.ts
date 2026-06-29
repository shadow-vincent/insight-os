/**
 * 写作风格反推 (V1.2)
 *
 * 接受 1-5 篇文章样本，调 LLM 反推 5 维度配置。
 *
 * 设计:
 *   - 用 callLLM jsonMode = true，强制 LLM 输出纯 JSON
 *   - 失败容错：解析失败返回 { ok: false, error }
 *   - 截断：每篇样本最多 3000 字（避免超 token）
 *   - 风格总结：200 字（人话描述作者风格）
 *   - 建议预设名：2-4 个汉字 / 2-3 个英文词（如 "深夜评论风格"）
 *   - 置信度：low / medium / high（让用户判断是否需要手动调整）
 *
 * 反推结果不是最终值，用户可以手动调整后再保存。
 */
export declare const STYLE_EXTRACTION_SYSTEM: string;
export interface StyleSample {
    text: string;
    title?: string;
}
export interface StyleExtractionLLMResult {
    summary: string;
    suggestedName: string;
    config: {
        style: {
            tone: number;
            stance: 'neutral' | 'advisory' | 'critical' | 'coach';
            persona: string;
            viewpoint: 'first' | 'second' | 'third' | 'mixed';
            termDensity: 'low' | 'medium' | 'high';
            temperature: number;
        };
        sentence: {
            rhythm: 'short' | 'mixed' | 'long';
            shortRatio: number;
            paragraphLength: number;
            rhetoric: Array<'metaphor' | 'analogy' | 'rhetorical' | 'story' | 'data'>;
        };
        structure: {
            headingStyle: 'numbered-question' | 'question' | 'statement' | 'parallel';
            corePosition: 'title' | 'opening' | 'middle' | 'ending';
            argumentPattern: 'total-detail-total' | 'progressive' | 'parallel' | 'contrast';
            sectionCount: number;
            ending: 'call-to-action' | 'quote' | 'open' | 'summary';
        };
        length: {
            targetWords: number;
            sectionCount: number;
            perSectionWords: number;
            keyQuotes: number;
        };
        quality: {
            citationLimit: number;
            bannedWords: string[];
            dataFidelity: 'strict' | 'loose' | 'none';
        };
    };
    confidence: 'low' | 'medium' | 'high';
}
export interface ExtractStyleOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** 每篇样本最大字符数（默认 3000） */
    maxCharsPerSample?: number;
}
export declare function extractStyle(samples: StyleSample[], options?: ExtractStyleOptions): Promise<{
    ok: boolean;
    data?: StyleExtractionLLMResult;
    error?: string;
}>;
