/**
 * POST /api/assets/upgrade
 *
 * 输入：{ assetId, calibration }
 * 流程：调 LLM Prompt ③ 生成 12 章节完整资产卡 → 写 assets 表（type=asset, status=in_use）
 *
 * 返回：{ ok, assetId, upgraded }
 *
 * 关键：升级后**真的写 .md 文件**到 04_管理洞察/，让资产卡持久化、可用 Obsidian 编辑
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
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    if (!isLLMConfigured()) {
      return NextResponse.json({ ok: false, error: 'LLM 未配置' }, { status: 400 });
    }

    const body = await req.json();
    const { assetId, calibration } = body;

    if (!assetId || !calibration) {
      return NextResponse.json({ ok: false, error: '缺少 assetId 或 calibration' }, { status: 400 });
    }

    const db = getDb();


    if (!db) return NextResponse.json({ ok: false, code: 'NO_SQLITE', error: 'Vercel 部署版不支持此操作，请用浏览器 IndexedDB' });
    const light = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!light) {
      return NextResponse.json({ ok: false, error: '轻量卡不存在' }, { status: 404 });
    }
    if (light.type !== 'light') {
      return NextResponse.json({ ok: false, error: '只能升级 light 类型的卡' }, { status: 400 });
    }

    // 调 LLM Prompt ③ 生成完整资产卡
    const userPrompt = buildAssetUpgradeUserPrompt({
      title: light.title,
      calibratedInsight: calibration.calibrated_insight ?? light.oneSentenceInsight ?? light.title,
      antiCommonSense: calibration.anti_common_sense_refined ?? light.antiCommonSense ?? '',
      oppositeView: calibration.opposite_view,
      boundaryConditions: calibration.boundary_conditions,
      plainStory: calibration.plain_story,
      sourceContext: light.source ?? undefined,
      evidenceLevel: (light.evidenceLevel ?? 'E0') as AssetUpgradeInput['evidenceLevel'],
      keywords: JSON.parse(light.tagsJson || '[]'),
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
      }, { status: 500 });
    }

    const upgraded: any = normalizeUpgradeResult(result.data);

    // 构造 .md 文件内容（OpenClaw 兼容格式）
    const tags: string[] = JSON.parse(light.tagsJson || '[]');
    const today = new Date().toISOString().slice(0, 10);
    const safeTitle = upgraded.one_sentence_insight.slice(0, 30).replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `资产卡_${safeTitle}_${today}.md`;
    const cfg = readConfig();
    const dir = resolve(cfg.paths.vaultPath, '04_管理洞察');
    const filePath = resolve(dir, fileName);

    // 构造 frontmatter
    const frontmatter = [
      '---',
      `title: ${upgraded.one_sentence_insight.slice(0, 50)}`,
      `type: asset`,
      `date: ${today}`,
      `source: ${light.source ?? '本应用从轻量卡升级'}（从 light 升级）`,
      `tags: [${tags.join(', ')}]`,
      `summary: ${upgraded.raw_observation.my_view.slice(0, 100)}`,
      `evidence_level: ${upgraded.evidence_level}`,
      `maturity: ${upgraded.maturity}`,
      '---',
      '',
    ].join('\n');

    // 构造正文（12 章节）
    const md = [
      frontmatter,
      `# ${upgraded.one_sentence_insight}`,
      '',
      '> 来源：light card · ' + light.id,
      '> 升级日期：' + today,
      '> 状态：' + (upgraded.maturity === 'available' ? '可用' : upgraded.maturity === 'pending' ? '待验证' : '草稿'),
      '',
      '---',
      '',
      '## 第一层：原始观察卡',
      '',
      '**核心观点**',
      '',
      upgraded.raw_observation.what_observed,
      '',
      '---',
      '',
      '## 第二层：管理洞察卡',
      '',
      '### 观察到了什么',
      upgraded.raw_observation.what_observed,
      '',
      '### 行业怎么看',
      upgraded.raw_observation.industry_view,
      '',
      '### 我怎么看',
      upgraded.raw_observation.my_view,
      '',
      '### 依据',
      upgraded.raw_observation.basis,
      '',
      '### 一句话洞察',
      upgraded.one_sentence_insight,
      '',
      '### 反常识判断',
      upgraded.anti_common_sense_refined ?? upgraded.expression_versions.strong,
      '',
      '---',
      '',
      '## 第三层：场景输出卡',
      '',
      '| 场景 | 表达 |',
      '|------|------|',
      upgraded.scene_outputs.map((s: { scene: string; expression: string }) => `| ${s.scene} | ${s.expression} |`).join('\n'),
      '',
      '---',
      '',
      '## 第四层：内核关联',
      '',
      upgraded.kernel_links.map((k: { kernel_belief: string; relationship: string }) => `- **${k.kernel_belief}** — ${k.relationship}`).join('\n') || '- 待关联',
      '',
      '---',
      '',
      '## 第五层：方法论关联',
      '',
      upgraded.methodology_links.map((m: { framework: string; connection: string }) => `- **${m.framework}** — ${m.connection}`).join('\n') || '- 待关联',
      '',
      '---',
      '',
      '## 第六层：适用边界',
      '',
      '**适用于：**',
      upgraded.boundary.applicable_to.map((b: string) => `- ${b}`).join('\n'),
      '',
      '**不适用于：**',
      upgraded.boundary.not_applicable_to.map((b: string) => `- ${b}`).join('\n'),
      '',
      '**使用提醒：**',
      upgraded.boundary.usage_caveat,
      '',
      '---',
      '',
      '## 第七层：典型症状',
      '',
      upgraded.symptoms.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n'),
      '',
      '---',
      '',
      '## 第八层：分层诊断问题',
      '',
      '### A. 目标层',
      upgraded.diagnostic_questions.goal_level.map((q: string) => `1. ${q}`).join('\n'),
      '',
      '### B. 机制层',
      upgraded.diagnostic_questions.mechanism_level.map((q: string) => `1. ${q}`).join('\n'),
      '',
      '### C. 行为层',
      upgraded.diagnostic_questions.behavior_level.map((q: string) => `1. ${q}`).join('\n'),
      '',
      '---',
      '',
      '## 第九层：案例验证记录',
      '',
      upgraded.case_records.map((c: {
        case_name: string; industry: string; symptoms_observed: string;
        mechanism: string; outcome: string; validation_status: string;
      }) => [
        `**案例名称**：${c.case_name}`,
        `**所属行业**：${c.industry}`,
        `**观察到的症状**：${c.symptoms_observed}`,
        `**核心机制**：${c.mechanism}`,
        `**造成后果**：${c.outcome}`,
        `**验证状态**：${c.validation_status}`,
        '',
      ].join('\n')).join('\n'),
      '',
      '---',
      '',
      '## 第十层：可视化建议',
      '',
      '### A. PPT 页面结构',
      upgraded.visual_suggestion.ppt_structure,
      '',
      '### B. 图像生成提示词',
      '```',
      upgraded.visual_suggestion.image_prompt,
      '```',
      '',
      '---',
      '',
      '## 第十一层：表达版本',
      '',
      '### 强表达版（同行交流）',
      upgraded.expression_versions.strong,
      '',
      '### 客户沟通版',
      upgraded.expression_versions.client_talk,
      '',
      '### 文章表达版',
      upgraded.expression_versions.article,
      '',
      '### 方案表达版',
      upgraded.expression_versions.proposal,
      '',
      '---',
      '',
      '## 第十二层：证据等级与复用状态',
      '',
      `**证据等级**：${upgraded.evidence_level} — ${upgraded.evidence_note}`,
      '',
      '**复用状态**：',
      '- 公众号：未使用',
      '- 客户方案：未使用',
      '- 客户对话：未使用',
      '- 课程/PPT：可使用',
      '- 方法论框架：已关联',
      '',
      '---',
      '',
      '## 苏格拉底三问：管理洞察校准',
      '',
      '### 第一问：你以为在解决什么问题？',
      calibration.opposite_view ? `**反面观点**：${calibration.opposite_view}` : '',
      '',
      '### 第二问：成立的边界是什么？',
      calibration.boundary_conditions,
      '',
      '### 第三问：如何讲给不懂的人听？',
      calibration.plain_story,
      '',
      '---',
      '',
      '## 管理洞察校准总结',
      '',
      `**核心洞察**：${upgraded.one_sentence_insight}`,
      '',
      `**反常识判断**：${upgraded.anti_common_sense_refined ?? upgraded.expression_versions.strong}`,
      '',
      '**校准备注**：' + (calibration.internal_critique ?? '由苏格拉底三问自动校准'),
      '',
    ].join('\n');

    // 写文件
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, md, 'utf-8');

    // 计算文件 hash
    const fileHash = createHash('sha256').update(md).digest('hex');
    const fileStat = require('node:fs').statSync(filePath);
    const fileMtime = Math.floor(fileStat.mtimeMs / 1000);
    const now = Math.floor(Date.now() / 1000);

    // 升级为正式资产卡：删旧的 light 卡，插入新 asset 卡
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
      filePath,
      upgraded,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * 把 LLM 返回的资产卡升级结果做防御性归一化
 * LLM 经常把数组字段塞成字符串或对象，导致 .map() 报 undefined
 */
function normalizeUpgradeResult(raw: any): any {
  const pick = (obj: any, names: string[]) => {
    if (!obj) return undefined;
    for (const n of names) if (obj[n] !== undefined) return obj[n];
    return undefined;
  };

  // 数组字段：从字符串/object 转数组
  const toArray = (val: any): string[] => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') return val.split(/\n+/).filter(Boolean);
    if (typeof val === 'object' && val) {
      // 可能是 {id, content} 或 {0: 'a', 1: 'b'} 等
      const keys = Object.keys(val);
      if (keys.every(k => /^\d+$/.test(k))) {
        return keys.sort((a, b) => Number(a) - Number(b)).map(k => String(val[k]));
      }
      // 取第一个有内容的字段
      const firstVal = keys.map(k => val[k]).find(v => v);
      return firstVal ? [String(firstVal)] : [];
    }
    return [];
  };

  // 对象数组字段（每项是 {xxx: yyy}）：从任意形态转成统一结构
  const toObjectArray = <T extends Record<string, any>>(val: any, itemKeys: string[][]): T[] => {
    if (!Array.isArray(val)) return [];
    return val.map((item: any) => {
      if (typeof item === 'string') {
        // 字符串直接包装成默认字段
        const obj: any = {};
        itemKeys[0]?.forEach(k => { obj[k] = item; });
        return obj;
      }
      if (typeof item === 'object' && item) {
        const obj: any = {};
        for (const keys of itemKeys) {
          for (const k of keys) {
            if (item[k] !== undefined) {
              obj[keys[0]] = item[k];
              break;
            }
          }
        }
        return obj;
      }
      return {} as T;
    });
  };

  return {
    one_sentence_insight: pick(raw, ['one_sentence_insight', 'oneSentenceInsight', 'title']) ?? '',
    anti_common_sense_refined: pick(raw, ['anti_common_sense_refined', 'antiCommonSenseRefined', 'anti_common_sense']),
    raw_observation: {
      what_observed: pick(raw.raw_observation, ['what_observed', 'whatObserved', 'observed']) ?? '',
      industry_view: pick(raw.raw_observation, ['industry_view', 'industryView']) ?? '',
      my_view: pick(raw.raw_observation, ['my_view', 'myView', 'view']) ?? '',
      basis: pick(raw.raw_observation, ['basis', 'evidence']) ?? '',
    },
    scene_outputs: toObjectArray(pick(raw, ['scene_outputs', 'sceneOutputs']), [
      ['scene', 'type', 'name'],
      ['expression', 'content', 'text'],
    ]),
    kernel_links: toObjectArray(pick(raw, ['kernel_links', 'kernelLinks']), [
      ['kernel_belief', 'belief', 'name'],
      ['relationship', 'relation', 'connection'],
    ]),
    methodology_links: toObjectArray(pick(raw, ['methodology_links', 'methodologyLinks']), [
      ['framework', 'name'],
      ['connection', 'relation'],
    ]),
    boundary: {
      applicable_to: toArray(pick(raw.boundary, ['applicable_to', 'applicableTo'])),
      not_applicable_to: toArray(pick(raw.boundary, ['not_applicable_to', 'notApplicableTo'])),
      usage_caveat: pick(raw.boundary, ['usage_caveat', 'usageCaveat', 'caveat']) ?? '',
    },
    symptoms: toArray(pick(raw, ['symptoms', 'symptom_list'])),
    diagnostic_questions: {
      goal_level: toArray(pick(raw.diagnostic_questions, ['goal_level', 'goalLevel'])),
      mechanism_level: toArray(pick(raw.diagnostic_questions, ['mechanism_level', 'mechanismLevel'])),
      behavior_level: toArray(pick(raw.diagnostic_questions, ['behavior_level', 'behaviorLevel'])),
    },
    case_records: toObjectArray(pick(raw, ['case_records', 'caseRecords']), [
      ['case_name', 'caseName', 'name'],
      ['industry', 'sector'],
      ['symptoms_observed', 'symptomsObserved', 'symptoms'],
      ['mechanism', 'core_mechanism'],
      ['outcome', 'result', 'consequence'],
      ['validation_status', 'validationStatus', 'status'],
    ]),
    visual_suggestion: {
      ppt_structure: pick(raw.visual_suggestion, ['ppt_structure', 'pptStructure', 'ppt']) ?? '',
      image_prompt: pick(raw.visual_suggestion, ['image_prompt', 'imagePrompt', 'image']) ?? '',
    },
    expression_versions: {
      strong: pick(raw.expression_versions, ['strong', 'powerful']) ?? '',
      client_talk: pick(raw.expression_versions, ['client_talk', 'clientTalk', 'client']) ?? '',
      article: pick(raw.expression_versions, ['article', 'blog']) ?? '',
      proposal: pick(raw.expression_versions, ['proposal', 'plan']) ?? '',
    },
    evidence_level: pick(raw, ['evidence_level', 'evidenceLevel']) ?? 'E0',
    evidence_note: pick(raw, ['evidence_note', 'evidenceNote']) ?? '',
    maturity: pick(raw, ['maturity']) ?? 'pending',
  };
}
