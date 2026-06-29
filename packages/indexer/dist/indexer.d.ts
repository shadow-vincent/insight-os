/**
 * .md 文件索引器
 *
 * 核心规则：
 * 1. .md 文件是权威源，索引器只读不写
 * 2. 数据库里只存元数据（id/type/status/...），不存长文本
 * 3. 文件 hash 用于检测外部修改
 * 4. 增量索引：跳过 hash 一致的文件
 */
import { type CardType, type EvidenceLevel } from '@insight-os/core';
export interface IndexResult {
    scanned: number;
    indexed: number;
    updated: number;
    unchanged: number;
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export interface IndexOptions {
    vaultPath?: string;
    watch?: boolean;
}
/**
 * 索引单个 .md 文件，返回是否需要更新数据库
 */
export declare function indexFile(filePath: string): {
    action: "unchanged";
    record: {
        id: string;
        type: "light" | "asset" | "kernel";
        status: "inbox" | "sorting" | "calibrating" | "candidate" | "in_use" | "archived";
        title: string;
        evidenceLevel: "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
        priority: "A" | "B" | "C";
        tagsJson: string;
        source: string;
        sourceType: "book" | "knowledge_card" | "project" | "article" | "original" | "unknown";
        oneSentenceInsight: string;
        antiCommonSense: string;
        filePath: string;
        fileMtime: number;
        fileHash: string;
        feedbackCount: number;
        lastUsedAt: number;
        sourceMaterialId: string;
        scoreTotal: number;
        scoreBreakdownJson: string;
        outputCount: number;
        processedAt: number;
        isKernelCandidate: number;
        isKernelApproved: number;
        relatedIdsJson: string;
        createdAt: number;
        updatedAt: number;
    };
} | {
    action: "updated";
    record: {
        type: CardType;
        title: string;
        evidenceLevel: EvidenceLevel;
        tagsJson: string;
        id: string;
        status: "inbox" | "sorting" | "calibrating" | "candidate" | "in_use" | "archived";
        priority: "A" | "B" | "C";
        source: string;
        sourceType: "book" | "knowledge_card" | "project" | "article" | "original" | "unknown";
        oneSentenceInsight: string;
        antiCommonSense: string;
        filePath: string;
        fileMtime: number;
        fileHash: string;
        feedbackCount: number;
        lastUsedAt: number;
        sourceMaterialId: string;
        scoreTotal: number;
        scoreBreakdownJson: string;
        outputCount: number;
        processedAt: number;
        isKernelCandidate: number;
        isKernelApproved: number;
        relatedIdsJson: string;
        createdAt: number;
        updatedAt: number;
    };
} | {
    action: "indexed";
    record: {
        id: string;
        type: CardType;
        title: string;
    };
};
/**
 * 扫描 vault 目录下所有 资产卡_*.md 并索引
 */
export declare function indexVault(options?: IndexOptions): IndexResult;
