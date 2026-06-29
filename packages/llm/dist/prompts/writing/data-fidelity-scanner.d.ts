/**
 * 数据真实性深度校验（V1.2）
 *
 * 用途：生成文章后扫描数字 + 标"来源：待核实"占位
 *
 * 设计：
 *   - 正则扫所有数字（百分比、绝对值、年份、$等）
 *   - 对每个数字检查上下文是否有"按 XX 推算"/"研究表明"等模糊引用
 *   - 输出每个数字的来源状态：已标注 / 未标注 / 推算 / 待核实
 *   - 不强制修改文章，但返回 list 让 UI 高亮显示
 *
 * 比 L3 数据真实性规则更细：自动扫描而不是靠 LLM 自觉
 */
export interface NumberCheck {
    text: string;
    position: number;
    number: string;
    context: string;
    source: 'cited' | 'inferred' | 'uncited' | 'industry-common';
    suggestions: string[];
}
/**
 * 扫描文章中的所有数字 + 标注状态
 */
export declare function scanNumbers(content: string): NumberCheck[];
/**
 * 把扫描结果格式化为人类可读的摘要
 */
export declare function summarizeNumberChecks(checks: NumberCheck[]): {
    total: number;
    cited: number;
    inferred: number;
    uncited: number;
    industryCommon: number;
    issues: string[];
};
