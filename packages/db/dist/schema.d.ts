/**
 * Insight OS · 数据库 Schema
 *
 * 核心设计：.md 文件是权威源，本表只是索引。
 * 不在数据库里存长文本（raw_content、boundary、symptoms 等），
 * 这些都存在 .md 文件里。
 */
/**
 * assets 表 —— 轻量卡 + 资产卡 + 内核卡（用 type 区分）
 *
 * type: 卡片类型
 *   - light: 轻量卡（LLM 整理后，未校准）
 *   - asset: 资产卡（已校准 + 人工确认）
 *   - kernel: 内核卡（v0.2 再做，v0.1 占位）
 *
 * status: 工作流状态
 *   - inbox: 在收集箱（原始输入，未整理）
 *   - sorting: 整理中
 *   - calibrating: 校准中
 *   - candidate: 候选池（待人工确认升级）
 *   - in_use: 已入库资产库
 *   - archived: 已归档
 *
 * evidence_level: E0-E5（PRD 第 7.7 节）
 *   - E0: 纯观点，暂无案例
 *   - E1: 有类比案例
 *   - E2: 有真实方案或项目观察
 *   - E3: 在客户沟通中获得共鸣
 *   - E4: 进入方案并被客户认可
 *   - E5: 形成可复用工具、课程或服务模块
 */
export declare const assets: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "assets";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        type: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "type";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: "light" | "asset" | "kernel";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["light", "asset", "kernel"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        status: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "status";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: "inbox" | "sorting" | "calibrating" | "candidate" | "in_use" | "archived";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["inbox", "sorting", "calibrating", "candidate", "in_use", "archived"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        evidenceLevel: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "evidence_level";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["E0", "E1", "E2", "E3", "E4", "E5"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        priority: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "priority";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: "A" | "B" | "C";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["A", "B", "C"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        tagsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "tags_json";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        source: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sourceType: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source_type";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: "book" | "knowledge_card" | "project" | "article" | "original" | "unknown";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["book", "knowledge_card", "project", "article", "original", "unknown"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        oneSentenceInsight: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "one_sentence_insight";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        antiCommonSense: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "anti_common_sense";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        filePath: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "file_path";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        fileMtime: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "file_mtime";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        fileHash: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "file_hash";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        feedbackCount: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "feedback_count";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        lastUsedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "last_used_at";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sourceMaterialId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source_material_id";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        scoreTotal: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "score_total";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        scoreBreakdownJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "score_breakdown_json";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        outputCount: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "output_count";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        processedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "processed_at";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        isKernelCandidate: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "is_kernel_candidate";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        isKernelApproved: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "is_kernel_approved";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        relatedIdsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "related_ids_json";
            tableName: "assets";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "assets";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
/**
 * outputs 表 —— 场景输出记录
 *
 * 一个输出可以引用多张资产卡（assetIdsJson 是数组）
 * outputType: 输出场景
 *   - talk_script: 客户沟通话术
 *   - article_outline: 公众号文章大纲
 *
 * status:
 *   - draft: 草稿（用户编辑中）
 *   - used: 已使用（销售/客户用了）
 *   - feedback_done: 已记录反馈
 */
export declare const outputs: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "outputs";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        assetIdsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "asset_ids_json";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        outputType: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "output_type";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: "talk_script" | "article_outline" | "article_full" | "writing" | "speech" | "book_note" | "email";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["talk_script", "article_outline", "article_full", "writing", "speech", "book_note", "email"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        content: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "content";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        audience: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "audience";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        status: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "status";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: "draft" | "used" | "feedback_done";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["draft", "used", "feedback_done"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        scaffoldJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "scaffold_json";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        templateType: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "template_type";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sourceUrl: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source_url";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        topicId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "topic_id";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        writingStatus: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "writing_status";
            tableName: "outputs";
            dataType: "string";
            columnType: "SQLiteText";
            data: "draft" | "scaffold" | "published";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["scaffold", "draft", "published"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "outputs";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "outputs";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
/**
 * feedback 表 —— 反馈记录（v0.1 最小集）
 *
 * 一条反馈关联一个 output，反过来 output 关联多张 asset
 * 这里同时存 assetId 便于直接查询
 */
export declare const feedback: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "feedback";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        outputId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "output_id";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        assetId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "asset_id";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        scene: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "scene";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: "article" | "client_talk" | "course" | "colleague" | "archive" | "other";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["client_talk", "article", "course", "colleague", "archive", "other"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        reaction: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "reaction";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        mostTouchedPoint: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "most_touched_point";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        followUpQuestions: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "follow_up_questions";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        evidenceLevelBefore: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "evidence_level_before";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["E0", "E1", "E2", "E3", "E4", "E5"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        evidenceLevelAfter: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "evidence_level_after";
            tableName: "feedback";
            dataType: "string";
            columnType: "SQLiteText";
            data: "E0" | "E1" | "E2" | "E3" | "E4" | "E5";
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["E0", "E1", "E2", "E3", "E4", "E5"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "feedback";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const assetsStatusIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const assetsTypeIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const assetsEvidenceIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const assetsUpdatedIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const outputsAssetIdsIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const outputsCreatedIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const feedbackAssetIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const feedbackCreatedIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * topics 表 —— 资产主题（v0.2 资产地图用）
 *
 * 一张资产卡可以属于多个主题
 * 一个主题下可以有多张资产卡
 * 通过 asset_topics 关联表维护
 */
export declare const topics: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "topics";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        name: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "name";
            tableName: "topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        slug: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "slug";
            tableName: "topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        description: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "description";
            tableName: "topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        coreBeliefsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "core_beliefs_json";
            tableName: "topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sortOrder: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "sort_order";
            tableName: "topics";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "topics";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "topics";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
/**
 * asset_topics 表 —— 资产和主题的多对多关联
 *
 * confidence: LLM 自动归类时的置信度（0-1）
 *   - 1.0: 人工指定
 *   - 0.5-0.9: LLM 推断
 * assignedBy: 'human' | 'llm' | 'rule'
 */
export declare const assetTopics: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "asset_topics";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "asset_topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        assetId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "asset_id";
            tableName: "asset_topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        topicId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "topic_id";
            tableName: "asset_topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        confidence: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "confidence";
            tableName: "asset_topics";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        assignedBy: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "assigned_by";
            tableName: "asset_topics";
            dataType: "string";
            columnType: "SQLiteText";
            data: "human" | "llm" | "rule";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["human", "llm", "rule"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "asset_topics";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const topicsSlugIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const assetTopicsAssetIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const assetTopicsTopicIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * sources 表 —— 信息源订阅（v1.9.0）
 *
 * V1.9.0 只支持 type='rss'，V1.9.1+ 扩展 twitter / wechat-account
 * url: RSS feed URL
 * fetchIntervalMin: 默认 60 分钟抓一次
 * lastFetchedAt / lastError: 调试用，记录最近一次同步状态
 */
export declare const sources: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "sources";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "sources";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        type: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "type";
            tableName: "sources";
            dataType: "string";
            columnType: "SQLiteText";
            data: "rss" | "twitter" | "wechat-account" | "reddit";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["rss", "twitter", "wechat-account", "reddit"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        url: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "url";
            tableName: "sources";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "sources";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        enabled: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "enabled";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        lastFetchedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "last_fetched_at";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        lastError: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "last_error";
            tableName: "sources";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        fetchIntervalMin: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "fetch_interval_min";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        newItemsCount: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "new_items_count";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        totalItemsCount: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "total_items_count";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "sources";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const sourcesUrlIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const sourcesEnabledIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * source_items 表 —— 抓来的内容（v1.9.0）
 *
 * (source_id, guid) UNIQUE 去重（同一篇文章多次抓不会被重复入库）
 * status:
 *   - new:        新抓到的，UI 显示在主页"📡 信息源"section
 *   - imported:   已调 intake 进 assets，assetId 关联
 *   - skipped:    用户主动跳过（点击"忽略"按钮）
 */
export declare const sourceItems: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "source_items";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sourceId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source_id";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        guid: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "guid";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        url: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "url";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        excerpt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "excerpt";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        content: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "content";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        publishedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "published_at";
            tableName: "source_items";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        fetchedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "fetched_at";
            tableName: "source_items";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        status: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "status";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: "new" | "imported" | "skipped";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["new", "imported", "skipped"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        assetId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "asset_id";
            tableName: "source_items";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const sourceItemsSourceIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const sourceItemsStatusIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const sourceItemsGuidIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * topic_kernels 表 —— 主题思想内核（v0.8）
 *
 * 一个主题对应 0 或 1 个 kernel（LLM 从主题下所有资产卡总结出来）
 * 包含：headline（一句话）+ summary（200-500 字综合）+ coreBeliefs（3-5 个核心判断）
 * sourceAssetIds 用于追溯 kernel 引用了哪些卡
 */
export declare const topicKernels: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "topic_kernels";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        topicId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "topic_id";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        headline: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "headline";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        summary: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "summary";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        coreBeliefsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "core_beliefs_json";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sourceAssetIdsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "source_asset_ids_json";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        generatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "generated_at";
            tableName: "topic_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        generationModel: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "generation_model";
            tableName: "topic_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const topicKernelsTopicIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * user_kernels 表 —— Insight Kernel 用户判断协议（v1.4）
 *
 * 跟 topic_kernels（主题级 LLM 总结）不同，这是**用户级**的"判断宪法"：
 * - 每次 LLM 调用自动注入 system prompt
 * - 用户自己写 / 改 / 删 / 归档
 * - 6 条 ship-ready 默认 + onboarding 种子
 *
 * 4 类别（与 prototype insight-kernel-v2 一致）：
 *   - belief:       底层信念（长期价值主张 / 哲学立场）
 *   - contrarian:   反常识判断（反对主流叙事的判断）
 *   - expertise:    擅长问题域（被验证过能力的领域）
 *   - challenge:    想挑战的常识（想消灭 / 重塑的行业套话）
 *
 * 4 关键字段：
 *   - content:         一句话判断（最核心）
 *   - confidence:      置信度 0-100（避免教条）
 *   - counterExample:  强制反例（什么时候不成立）
 *   - scope:           适用场景（如"客户咨询 · 公众号"）
 *
 * 额外字段：
 *   - kind: 信念类型（belief/hypothesis/experience/contrarian）—— 区分确定性
 *   - evidenceAssetIdsJson: 关联证据资产（不建独立 evidence 表，复用现有 assets）
 *   - referencedCount: 被 LLM 引用次数（统计用）
 *   - lastVerifiedAt: 最后验证时间（防过期判断）
 *   - status: active / archived
 */
export declare const userKernels: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "user_kernels";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        category: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "category";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        kind: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "kind";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        content: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "content";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        confidence: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "confidence";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        counterExample: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "counter_example";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        scope: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "scope";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        evidenceAssetIdsJson: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "evidence_asset_ids_json";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        referencedCount: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "referenced_count";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        lastVerifiedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "last_verified_at";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        status: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "status";
            tableName: "user_kernels";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        sortOrder: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "sort_order";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "user_kernels";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const userKernelsCategoryIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
export declare const userKernelsStatusIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * writing_drafts 表 —— 写作草稿自动保存（v1.5）
 *
 * 每个 writing 最多 1 行 draft（覆盖式保存），区别于 writing_versions（历史版本，多行）
 * - debounce 3 秒自动保存
 * - 页面打开时优先加载 draft（比 outputs.content 新）
 * - published 状态时停止保存
 */
export declare const writingDrafts: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "writing_drafts";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "writing_drafts";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        writingId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "writing_id";
            tableName: "writing_drafts";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        content: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "content";
            tableName: "writing_drafts";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "writing_drafts";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "writing_drafts";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const writingDraftsWritingIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
/**
 * writing_versions 表 —— 写作历史版本（v1.5）
 *
 * 每次"手动保存版本"或"重大改动前自动快照"创建一行
 * - 保留最近 20 个版本（超出自动清旧）
 * - 恢复版本 = 写入 outputs.content + writing_drafts.content
 */
export declare const writingVersions: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "writing_versions";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        writingId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "writing_id";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        content: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "content";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        title: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "title";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        note: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "note";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdBy: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_by";
            tableName: "writing_versions";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "writing_versions";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export declare const writingVersionsWritingIdx: import("drizzle-orm/sqlite-core").IndexBuilder;
