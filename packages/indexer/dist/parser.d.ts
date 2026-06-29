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
export declare function parseFrontmatter(content: string): Frontmatter;
/**
 * 从 Markdown 内容提取一句话洞察
 * 优先匹配特定章节：# 一句话洞察 / ## 一句话洞察 / | **一句话洞察** |
 * 找不到则取正文第一段
 */
export declare function extractOneSentenceInsight(content: string): string | undefined;
/**
 * 从 Markdown 内容提取反常识判断
 */
export declare function extractAntiCommonSense(content: string): string | undefined;
/**
 * 从 Markdown 内容提取摘要
 * 优先 frontmatter.summary，否则取第一个段落
 */
export declare function extractSummary(fm: Frontmatter, content: string): string | undefined;
