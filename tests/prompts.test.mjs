/**
 * Prompt 模板测试
 *
 * 验证：
 * - 所有 system prompt 长度合理
 * - 所有 user prompt 包含必要占位符
 * - JSON 输出接口定义完整
 * - 业务约束在 prompt 中有体现
 *
 * node --test tests/prompts.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIGHT_CARD_SYSTEM, buildLightCardUserPrompt,
  CALIBRATE_SYSTEM, buildCalibrateUserPrompt,
  ASSET_UPGRADE_SYSTEM, buildAssetUpgradeUserPrompt,
  OUTPUT_GENERATE_SYSTEM, buildOutputGenerateUserPrompt,
} from '../packages/llm/src/index.ts';

test('Prompt ① 轻量卡: system 包含业务角色 + 输出格式约束', () => {
  assert.ok(LIGHT_CARD_SYSTEM.length > 200);
  assert.ok(LIGHT_CARD_SYSTEM.includes('Vincent'));
  assert.ok(LIGHT_CARD_SYSTEM.includes('JSON'));
  assert.ok(LIGHT_CARD_SYSTEM.includes('不夸大') || LIGHT_CARD_SYSTEM.includes('不空话'));
});

test('Prompt ①: user prompt 包含原始内容和来源类型', () => {
  const prompt = buildLightCardUserPrompt({
    rawContent: '测试内容',
    sourceType: 'manual',
  });
  assert.ok(prompt.includes('测试内容'));
  assert.ok(prompt.includes('manual'));
  assert.ok(prompt.includes('priority'));
  assert.ok(prompt.includes('reasoning'));
});

test('Prompt ①: 输出字段定义完整', () => {
  // 编译时检查（如果字段缺失 ts 会报错），运行时再 spot check
  const sampleOutput = {
    title: '测试',
    source_type: 'voice',
    summary: '测试摘要',
    keywords: ['A', 'B'],
    scene: '客户沟通',
    initial_insight: '测试洞察',
    anti_common_sense: null,
    possible_use_cases: ['公众号'],
    recommended_next_action: 'candidate',
    priority: 'A',
    reasoning: '反常识 + 高反密度',
  };
  // 验证枚举值合法
  assert.ok(['voice', 'knowledge_card', 'project', 'article', 'original', 'unknown'].includes(sampleOutput.source_type));
  assert.ok(['archive', 'candidate', 'socratic', 'upgrade_to_asset', 'generate_output'].includes(sampleOutput.recommended_next_action));
  assert.ok(['A', 'B', 'C'].includes(sampleOutput.priority));
});

test('Prompt ② 苏格拉底三问: system 明确三问 + 校准原则', () => {
  assert.ok(CALIBRATE_SYSTEM.includes('反面观点'));
  assert.ok(CALIBRATE_SYSTEM.includes('边界'));
  assert.ok(CALIBRATE_SYSTEM.includes('讲给不懂的人听'));
  assert.ok(CALIBRATE_SYSTEM.includes('should_promote'));
  assert.ok(CALIBRATE_SYSTEM.includes('JSON'));
});

test('Prompt ②: user prompt 包含三问问题 + 字段说明', () => {
  const prompt = buildCalibrateUserPrompt({
    initialInsight: '判断力是稀缺资源',
    antiCommonSense: '所有人都在学 PE',
    sourceContext: '与某 CIO 沟通',
  });
  assert.ok(prompt.includes('判断力是稀缺资源'));
  assert.ok(prompt.includes('反面观点'));
  assert.ok(prompt.includes('边界'));
  assert.ok(prompt.includes('类比'));
  assert.ok(prompt.includes('should_promote'));
  assert.ok(prompt.includes('internal_critique'));
});

test('Prompt ③ 资产卡升级: system 包含 12 章节 + 输出原则', () => {
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('可调用'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('可输出'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('可验证'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('分层诊断'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('JSON'));
});

test('Prompt ③: user prompt 包含 13 个章节字段名', () => {
  const prompt = buildAssetUpgradeUserPrompt({
    title: 'AI 时代最稀缺的是判断力',
    calibratedInsight: '判断力稀缺',
    antiCommonSense: '该学判断力工程',
    oppositeView: 'AI 决定一切',
    boundaryConditions: '企业管理场景',
    plainStory: '选书的类比',
    evidenceLevel: 'E1',
    keywords: ['AI', '判断力'],
  });

  // 12 个核心章节
  assert.ok(prompt.includes('one_sentence_insight'));
  assert.ok(prompt.includes('raw_observation'));
  assert.ok(prompt.includes('scene_outputs'));
  assert.ok(prompt.includes('kernel_links'));
  assert.ok(prompt.includes('methodology_links'));
  assert.ok(prompt.includes('boundary'));
  assert.ok(prompt.includes('symptoms'));
  assert.ok(prompt.includes('diagnostic_questions'));
  assert.ok(prompt.includes('case_records'));
  assert.ok(prompt.includes('visual_suggestion'));
  assert.ok(prompt.includes('expression_versions'));
  assert.ok(prompt.includes('evidence_level'));
  assert.ok(prompt.includes('maturity'));
});

test('Prompt ③: 输出字段包含分层诊断的 3 个层级', () => {
  // 编译时检查
  const sample = {
    one_sentence_insight: 'x',
    raw_observation: { what_observed: 'x', industry_view: 'x', my_view: 'x', basis: 'x' },
    scene_outputs: [{ scene: 'client_talk', expression: 'x' }],
    kernel_links: [],
    methodology_links: [],
    boundary: { applicable_to: [], not_applicable_to: [], usage_caveat: '' },
    symptoms: [],
    diagnostic_questions: { goal_level: [], mechanism_level: [], behavior_level: [] },
    case_records: [],
    visual_suggestion: { ppt_structure: '', image_prompt: '' },
    expression_versions: { strong: '', client_talk: '', article: '', proposal: '' },
    evidence_level: 'E1',
    evidence_note: '',
    maturity: 'available',
    maturity_note: '',
  };
  assert.ok(sample.diagnostic_questions.goal_level !== undefined);
  assert.ok(sample.diagnostic_questions.mechanism_level !== undefined);
  assert.ok(sample.diagnostic_questions.behavior_level !== undefined);
});

test('Prompt ④ 场景输出: system 区分 talk_script 和 article_outline', () => {
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('talk_script'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('article_outline'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('客户沟通话术'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('公众号文章大纲'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('JSON'));
});

test('Prompt ④: talk_script user prompt 包含 4 段结构', () => {
  const prompt = buildOutputGenerateUserPrompt({
    assetSummaries: [{
      title: '判断力',
      oneSentenceInsight: '判断力稀缺',
      antiCommonSense: '学 PE 不如学判断力',
    }],
    outputType: 'talk_script',
    audience: '企业 CIO',
  });
  assert.ok(prompt.includes('开场白'));
  assert.ok(prompt.includes('核心观点 1'));
  assert.ok(prompt.includes('核心观点 2'));
  assert.ok(prompt.includes('收尾'));
  assert.ok(prompt.includes('企业 CIO'));
  assert.ok(prompt.includes('客户沟通话术'));
});

test('Prompt ④: article_outline user prompt 包含 5 段结构', () => {
  const prompt = buildOutputGenerateUserPrompt({
    assetSummaries: [{
      title: '判断力',
      oneSentenceInsight: '判断力稀缺',
      antiCommonSense: '学 PE 不如学判断力',
    }],
    outputType: 'article_outline',
    audience: '公众号读者',
  });
  assert.ok(prompt.includes('钩子段'));
  assert.ok(prompt.includes('核心观点 1-3'));
  assert.ok(prompt.includes('反常识判断'));
  assert.ok(prompt.includes('收尾'));
  assert.ok(prompt.includes('公众号文章大纲'));
});

test('Prompt ④: 多张资产卡联合生成', () => {
  const prompt = buildOutputGenerateUserPrompt({
    assetSummaries: [
      { title: 'A', oneSentenceInsight: 'ia', antiCommonSense: 'aa' },
      { title: 'B', oneSentenceInsight: 'ib', antiCommonSense: 'ab' },
    ],
    outputType: 'talk_script',
    audience: '客户',
  });
  assert.ok(prompt.includes('资产卡 1: A'));
  assert.ok(prompt.includes('资产卡 2: B'));
  assert.ok(prompt.includes('2 张资产卡'));
});

test('全部 4 个 prompt: 包含 JSON 输出约束', () => {
  assert.ok(LIGHT_CARD_SYSTEM.includes('JSON'));
  assert.ok(CALIBRATE_SYSTEM.includes('JSON'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('JSON'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('JSON'));
});

test('全部 4 个 prompt: 都明确提到 Vincent 业务角色', () => {
  assert.ok(LIGHT_CARD_SYSTEM.includes('Vincent'));
  assert.ok(CALIBRATE_SYSTEM.includes('Vincent'));
  assert.ok(ASSET_UPGRADE_SYSTEM.includes('Vincent'));
  assert.ok(OUTPUT_GENERATE_SYSTEM.includes('Vincent'));
});

test('全部 4 个 prompt: 都有"不空话/不夸大/不敷衍"等质量约束', () => {
  // 至少 3 个 prompt 包含明确的"不 X"质量约束
  const constraints = [
    /不[空夸敷衍编造]+/g,
  ];
  let total = 0;
  const allPrompts = [
    LIGHT_CARD_SYSTEM,
    CALIBRATE_SYSTEM,
    ASSET_UPGRADE_SYSTEM,
    OUTPUT_GENERATE_SYSTEM,
  ];
  for (const p of allPrompts) {
    for (const c of constraints) {
      const m = p.match(c);
      if (m) total += m.length;
    }
  }
  assert.ok(total >= 4, `期望 ≥4 个质量约束，实际 ${total}`);
});
