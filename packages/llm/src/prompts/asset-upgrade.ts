/**
 * Prompt ③：资产卡升级
 *
 * 输入：轻量卡 + 校准结果
 * 输出：完整管理洞察资产卡（12 章节结构，与 OpenClaw 已有的资产卡格式一致）
 *
 * 参考你 OpenClaw 生成的资产卡结构（已验证的 12 章节）：
 * 1. 一句话洞察
 * 2. 原始观察卡
 * 3. 管理洞察卡
 * 4. 场景输出卡
 * 5. 内核关联卡
 * 6. 方法论关联
 * 7. 适用边界
 * 8. 典型症状
 * 9. 分层诊断问题
 * 10. 案例验证记录
 * 11. 可视化建议
 * 12. 表达版本 + 证据等级
 */

export const ASSET_UPGRADE_SYSTEM = `你是 Vincent 的资深研究助理。Vincent 是一名独立管理咨询顾问。

**你的任务**：把通过苏格拉底三问校准的轻量卡，升级为完整的「管理洞察资产卡」。

**资产卡的目标读者**：
- 第一读者是 Vincent 本人（他要拿来给客户沟通、写文章、做方案）
- 第二读者是 LLM（要被 AI 在客户场景里调用）

**所以内容必须**：
1. **可调用** —— 客户问到"我们公司 AI 该怎么落地"时，AI 能直接调出这张卡的关键判断
2. **可输出** —— Vincent 可以从这张卡直接生成客户话术、公众号文章、方案页
3. **可验证** —— 证据等级、案例、边界要明确，方便 Vincent 后续补充升级

**核心原则**：
1. **每个章节都要有内容**，不要"待补"敷衍。证据等级、案例可以标"待补"，但分析本身必须有内容。
2. **保持 OpenClaw 既有风格**：使用「观察到了什么 / 行业怎么看 / 我怎么看 / 依据」的分析结构。
3. **典型症状要具体到可识别的行为模式**（不是"组织效率低下"这种空话，而是"全公司都在用 AI，但说不清带来了什么业务价值"）。
4. **分层诊断问题要分目标层/机制层/行为层**，让 Vincent 可以直接拿去问客户。
5. **场景输出要给 3-5 种**（公众号/客户方案/客户沟通/课程/同行交流），每种都给出可直接用的表达。

**输出格式必须是严格 JSON**。`;

export interface AssetUpgradeInput {
  title: string;
  calibratedInsight: string;
  antiCommonSense: string;
  oppositeView: string;
  boundaryConditions: string;
  plainStory: string;
  sourceContext?: string;
  evidenceLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
  keywords: string[];
}

export interface AssetUpgradeOutput {
  one_sentence_insight: string;
  raw_observation: {
    what_observed: string;
    industry_view: string;
    my_view: string;
    basis: string;
  };
  scene_outputs: Array<{
    scene: 'public_account' | 'client_proposal' | 'client_talk' | 'course_ppt' | 'colleague';
    expression: string;
  }>;
  kernel_links: Array<{
    kernel_belief: string;
    relationship: string;
  }>;
  methodology_links: Array<{
    framework: string;
    connection: string;
  }>;
  boundary: {
    applicable_to: string[];
    not_applicable_to: string[];
    usage_caveat: string;
  };
  symptoms: string[];
  diagnostic_questions: {
    goal_level: string[];
    mechanism_level: string[];
    behavior_level: string[];
  };
  case_records: Array<{
    case_name: string;
    industry: string;
    symptoms_observed: string;
    mechanism: string;
    outcome: string;
    validation_status: string;
  }>;
  visual_suggestion: {
    ppt_structure: string;
    image_prompt: string;
  };
  expression_versions: {
    strong: string;
    client_talk: string;
    article: string;
    proposal: string;
  };
  evidence_level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
  evidence_note: string;
  maturity: 'available' | 'pending' | 'draft';
  maturity_note: string;
}

export function buildAssetUpgradeUserPrompt(input: AssetUpgradeInput): string {
  return `请将以下洞察升级为完整的管理洞察资产卡。

## 基础信息
- 标题: ${input.title}
- 校准后洞察: ${input.calibratedInsight}
- 反常识判断: ${input.antiCommonSense}
- 反面观点: ${input.oppositeView}
- 适用边界: ${input.boundaryConditions}
- 类比故事: ${input.plainStory}
- 关键词: ${input.keywords.join('、')}
- 初始证据等级: ${input.evidenceLevel}
${input.sourceContext ? `- 来源上下文: ${input.sourceContext}` : ''}

## 章节结构（必须全部填写，不能省略）

### 1. one_sentence_insight
一句话洞察（20-40 字），要能当标题用。

### 2. raw_observation
**what_observed**: 观察到了什么（具体事实/数据/案例，不要空话）
**industry_view**: 行业普遍怎么看
**my_view**: Vincent 的独立判断（与行业观点的差异）
**basis**: 依据（凭什么这么判断）

### 3. scene_outputs
至少 3 种场景的表达：
- public_account: 公众号文章标题或开头
- client_proposal: 客户方案中的核心表达
- client_talk: 客户沟通中的开场白
- course_ppt: 课程/PPT 的核心命题
- colleague: 同行交流的观点

### 4. kernel_links
关联的管理思想内核（1-3 个）
**kernel_belief**: 内核观点
**relationship**: 与本卡的关系（"是 X 的具体体现" / "是 X 的反面" / "补充 X" 等）

### 5. methodology_links
关联的方法论框架（1-3 个）
**framework**: 框架名
**connection**: 关联点

### 6. boundary
**applicable_to**: 适用场景（数组，3-5 个具体场景）
**not_applicable_to**: 不适用场景（数组）
**usage_caveat**: 使用提醒（不要让客户误解的注意事项）

### 7. symptoms
典型症状（3-5 条，每条要可识别，不要"组织效率低"这种空话）

### 8. diagnostic_questions
**goal_level**: 目标层问题（2-3 个，关于"客户想要什么"）
**mechanism_level**: 机制层问题（2-3 个，关于"机制如何运转"）
**behavior_level**: 行为层问题（2-3 个，关于"具体行为表现"）

### 9. case_records
**case_name**: 案例名（如果还没有真实案例，写"待补"）
**industry**: 所属行业
**symptoms_observed**: 观察到的症状
**mechanism**: 核心机制
**outcome**: 造成后果
**validation_status**: 验证状态

（第一条必须是真实或基于已有素材的案例。如果没有真实案例，给一条"类比案例"标注 evidence_note="类比"）

### 10. visual_suggestion
**ppt_structure**: PPT 页面结构描述（用于指导图表设计）
**image_prompt**: 图像生成提示词（中文咨询风信息图描述）

### 11. expression_versions
**strong**: 强表达版（适合文章/同行交流）
**client_talk**: 客户沟通版（柔和、不咄咄逼人）
**article**: 文章表达版
**proposal**: 方案表达版

### 12. evidence_level + evidence_note
**evidence_level**: E0-E5
**evidence_note**: 证据等级说明

### 13. maturity + maturity_note
**maturity**: available / pending / draft
**maturity_note**: 成熟度说明

请输出严格 JSON。`;
}
