/**
 * LLM 升级结果归一化函数
 *
 * 从 upgrade 路由和 promote 路由共用
 * 防御 LLM 返回值的字段名/类型混乱（数组/字符串/对象混用）
 */

/**
 * 数组字段归一化
 */
function toArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(/\n+/).filter(Boolean);
  if (typeof val === 'object' && val) {
    const keys = Object.keys(val);
    if (keys.every(k => /^\d+$/.test(k))) {
      return keys.sort((a, b) => Number(a) - Number(b)).map(k => String(val[k]));
    }
    const firstVal = keys.map(k => val[k]).find(v => v);
    return firstVal ? [String(firstVal)] : [];
  }
  return [];
}

/**
 * 对象数组归一化（每项 {xxx: yyy}）
 */
function toObjectArray<T extends Record<string, any>>(val: any, itemKeys: string[][]): T[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: any) => {
    if (typeof item === 'string') {
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
}

function pick(obj: any, names: string[]) {
  if (!obj) return undefined;
  for (const n of names) if (obj[n] !== undefined) return obj[n];
  return undefined;
}

export function normalizeUpgradeResult(raw: any): any {
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
