/**
 * POST /api/candidates/[id]/promote
 *
 * 把 light 卡（候选池）升级为正式资产卡
 *
 * 流程：
 * 1. 拿 light 卡的 db 字段
 * 2. 自动组装 calibration（用 db 现有字段，无三问结果时自动填充）
 * 3. 调 LLM Prompt ③ 生成 12 章节
 * 4. 写 .md 文件 + 删 light 卡 + 插入 asset/in_use 卡
 * 5. 返回新资产卡 id
 *
 * 区别于直接 type=asset 标记：这个流程**会**生成 12 章节 .md 文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, assets, getActiveKernelsForInjection } from '@insight-os/db';
import { eq } from 'drizzle-orm';
import {
  buildAssetUpgradeUserPrompt,
  ASSET_UPGRADE_SYSTEM,
  callLLM,
  type AssetUpgradeInput,
  type AssetUpgradeOutput,
} from '@insight-os/llm';
import { isLLMConfigured, readConfig } from '@insight-os/core';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeUpgradeResult } from '@/lib/normalize-upgrade';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置，请先在 /settings 配置 API Key',
        code: 'LLM_NOT_CONFIGURED',
      }, { status: 400 });
    }

    const { id } = await params;
    const db = getDb();

    const light = db.select().from(assets).where(eq(assets.id, id)).get();
    if (!light) {
      return NextResponse.json({ ok: false, error: '候选卡不存在' }, { status: 404 });
    }

    if (light.status === 'in_use') {
      return NextResponse.json({ ok: true, assetId: id, alreadyInUse: true });
    }

    if (light.status === 'archived') {
      return NextResponse.json({
        ok: false,
        error: '已归档的资产不能直接入库',
      }, { status: 400 });
    }

    // 自动组装 calibration（候选池"确认入库"无三问结果）
    const tags: string[] = JSON.parse(light.tagsJson || '[]');
    const calibration = {
      calibrated_insight: light.oneSentenceInsight || light.title,
      anti_common_sense_refined: light.antiCommonSense || undefined,
      opposite_view: `（从候选池快速入库，未做三问校准）`,
      boundary_conditions: tags.length > 0
        ? `适用于：${tags.join('、')} 相关场景`
        : '（未指定边界）',
      plain_story: '（未提供类比故事）',
      priority: light.priority,
      internal_critique: '由候选池自动入库，暂未做人工校准',
    };

    // 调 LLM 升级
    const userPrompt = buildAssetUpgradeUserPrompt({
      title: light.title,
      calibratedInsight: calibration.calibrated_insight,
      antiCommonSense: calibration.anti_common_sense_refined ?? '',
      oppositeView: calibration.opposite_view,
      boundaryConditions: calibration.boundary_conditions,
      plainStory: calibration.plain_story,
      sourceContext: light.source ?? undefined,
      evidenceLevel: (light.evidenceLevel ?? 'E0') as AssetUpgradeInput['evidenceLevel'],
      keywords: tags,
    });

    const kernel = getActiveKernelsForInjection();
    const result = await callLLM<AssetUpgradeOutput>(
      ASSET_UPGRADE_SYSTEM,
      userPrompt,
      { temperature: 0.5, maxTokens: 8000 ,
      kernel,}
    );

    if (!result.ok || !result.data) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'LLM 升级失败',
        raw: result.raw,
        code: 'LLM_CALL_FAILED',
      }, { status: 500 });
    }

    const upgraded = normalizeUpgradeResult(result.data);

    // 写 .md 文件
    const today = new Date().toISOString().slice(0, 10);
    const safeTitle = upgraded.one_sentence_insight.slice(0, 30).replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `资产卡_${safeTitle}_${today}.md`;
    const cfg = readConfig();
    const dir = resolve(cfg.paths.vaultPath, '04_管理洞察');
    const filePath = resolve(dir, fileName);

    const frontmatter = [
      '---',
      `title: ${upgraded.one_sentence_insight.slice(0, 50)}`,
      `type: asset`,
      `date: ${today}`,
      `source: ${light.source ?? '本应用从候选池升级'}（从 light 升级）`,
      `tags: [${tags.join(', ')}]`,
      `summary: ${upgraded.raw_observation.my_view.slice(0, 100)}`,
      `evidence_level: ${upgraded.evidence_level}`,
      `maturity: ${upgraded.maturity}`,
      '---',
      '',
    ].join('\n');

    const md = buildMarkdown(upgraded, calibration, light.id, today);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, md, 'utf-8');

    const fileHash = createHash('sha256').update(md).digest('hex');
    const fileMtime = Math.floor(statSync(filePath).mtimeMs / 1000);
    const now = Math.floor(Date.now() / 1000);

    // 删 light 卡，插入新 asset 卡
    db.delete(assets).where(eq(assets.id, light.id)).run();

    const newId = `asset_${randomUUID().slice(0, 8)}`;
    db.insert(assets)
      .values({
        id: newId,
        type: 'asset',
        status: 'in_use',
        title: upgraded.one_sentence_insight.slice(0, 50),
        evidenceLevel: upgraded.evidence_level,
        priority: calibration.priority ?? light.priority,
        tagsJson: JSON.stringify(tags),
        source: light.source ?? `本应用升级 · ${today}`,
        sourceType: 'original',
        oneSentenceInsight: upgraded.one_sentence_insight,
        antiCommonSense: upgraded.anti_common_sense_refined ?? null,
        filePath,
        fileMtime,
        fileHash,
        feedbackCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({
      ok: true,
      assetId: newId,
      oldId: light.id,
      filePath,
      upgraded,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function buildMarkdown(upgraded: any, calibration: any, lightId: string, today: string): string {
  const frontmatter = [
    '---',
    `title: ${upgraded.one_sentence_insight.slice(0, 50)}`,
    `type: asset`,
    `date: ${today}`,
    `source: 本应用从候选池升级（light ${lightId}）`,
    `tags: []`,
    `summary: ${upgraded.raw_observation.my_view.slice(0, 100)}`,
    `evidence_level: ${upgraded.evidence_level}`,
    `maturity: ${upgraded.maturity}`,
    '---',
    '',
  ].join('\n');

  return [
    frontmatter,
    `# ${upgraded.one_sentence_insight}`,
    '',
    '> 来源：light card · ' + lightId,
    '> 升级日期：' + today,
    '> 状态：' + (upgraded.maturity === 'available' ? '可用' : upgraded.maturity === 'pending' ? '待验证' : '草稿'),
    '',
    '---', '',
    '## 第一层：原始观察卡', '',
    '**核心观点**', '',
    upgraded.raw_observation.what_observed, '',
    '---', '',
    '## 第二层：管理洞察卡', '',
    '### 观察到了什么', '',
    upgraded.raw_observation.what_observed, '',
    '### 行业怎么看', '',
    upgraded.raw_observation.industry_view, '',
    '### 我怎么看', '',
    upgraded.raw_observation.my_view, '',
    '### 依据', '',
    upgraded.raw_observation.basis, '',
    '### 一句话洞察', '',
    upgraded.one_sentence_insight, '',
    '### 反常识判断', '',
    upgraded.anti_common_sense_refined ?? upgraded.expression_versions.strong, '',
    '---', '',
    '## 第三层：场景输出卡', '',
    '| 场景 | 表达 |',
    '|------|------|',
    upgraded.scene_outputs.map((s: any) => `| ${s.scene} | ${s.expression} |`).join('\n'),
    '', '---', '',
    '## 第四层：内核关联', '',
    upgraded.kernel_links.map((k: any) => `- **${k.kernel_belief}** — ${k.relationship}`).join('\n') || '- 待关联',
    '', '---', '',
    '## 第五层：方法论关联', '',
    upgraded.methodology_links.map((m: any) => `- **${m.framework}** — ${m.connection}`).join('\n') || '- 待关联',
    '', '---', '',
    '## 第六层：适用边界', '',
    '**适用于：**', upgraded.boundary.applicable_to.map((b: string) => `- ${b}`).join('\n'),
    '', '**不适用于：**', upgraded.boundary.not_applicable_to.map((b: string) => `- ${b}`).join('\n'),
    '', '**使用提醒：**', upgraded.boundary.usage_caveat, '',
    '---', '',
    '## 第七层：典型症状', '',
    upgraded.symptoms.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n'), '',
    '---', '',
    '## 第八层：分层诊断问题', '',
    '### A. 目标层', upgraded.diagnostic_questions.goal_level.map((q: string) => `1. ${q}`).join('\n'),
    '', '### B. 机制层', upgraded.diagnostic_questions.mechanism_level.map((q: string) => `1. ${q}`).join('\n'),
    '', '### C. 行为层', upgraded.diagnostic_questions.behavior_level.map((q: string) => `1. ${q}`).join('\n'),
    '', '---', '',
    '## 第九层：案例验证记录', '',
    upgraded.case_records.map((c: any) => [
      `**案例名称**：${c.case_name}`,
      `**所属行业**：${c.industry}`,
      `**观察到的症状**：${c.symptoms_observed}`,
      `**核心机制**：${c.mechanism}`,
      `**造成后果**：${c.outcome}`,
      `**验证状态**：${c.validation_status}`,
      '',
    ].join('\n')).join('\n'),
    '', '---', '',
    '## 第十层：可视化建议', '',
    '### A. PPT 页面结构', upgraded.visual_suggestion.ppt_structure, '',
    '### B. 图像生成提示词', '```', upgraded.visual_suggestion.image_prompt, '```',
    '', '---', '',
    '## 第十一层：表达版本', '',
    '### 强表达版（同行交流）', upgraded.expression_versions.strong, '',
    '### 客户沟通版', upgraded.expression_versions.client_talk, '',
    '### 文章表达版', upgraded.expression_versions.article, '',
    '### 方案表达版', upgraded.expression_versions.proposal, '',
    '---', '',
    '## 第十二层：证据等级与复用状态', '',
    `**证据等级**：${upgraded.evidence_level} — ${upgraded.evidence_note}`, '',
    '**复用状态**：',
    '- 公众号：未使用',
    '- 客户方案：未使用',
    '- 客户对话：未使用',
    '- 课程/PPT：可使用',
    '- 方法论框架：已关联',
    '', '---', '',
    '## 苏格拉底三问：管理洞察校准', '',
    '### 第一问：你以为在解决什么问题？', `**反面观点**：${calibration.opposite_view}`,
    '', '### 第二问：成立的边界是什么？', calibration.boundary_conditions, '',
    '### 第三问：如何讲给不懂的人听？', calibration.plain_story, '',
    '---', '',
    '## 管理洞察校准总结', '',
    `**核心洞察**：${upgraded.one_sentence_insight}`, '',
    `**反常识判断**：${upgraded.anti_common_sense_refined ?? upgraded.expression_versions.strong}`,
    '', '**校准备注**：' + (calibration.internal_critique ?? '由苏格拉底三问自动校准'), '',
  ].join('\n');
}
