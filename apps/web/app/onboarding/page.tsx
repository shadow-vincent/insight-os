'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

interface SystemStatus {
  llmConfigured: boolean;
  vaultPath: string;
  vaultPathValid: boolean;
  hasAssets: boolean;
  hasSeed: boolean;
  needsOnboarding: boolean;
  reasons: string[];
}

const LLM_PRESETS = [
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  { label: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { label: '自定义', baseUrl: '', model: '' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  // Step 1: LLM
  const [llmProvider, setLlmProvider] = useState(0);
  const [baseUrl, setBaseUrl] = useState(LLM_PRESETS[0].baseUrl);
  const [model, setModel] = useState(LLM_PRESETS[0].model);
  const [apiKey, setApiKey] = useState('');
  const [savingLlm, setSavingLlm] = useState(false);

  // Step 2: Vault
  const [vaultPath, setVaultPath] = useState('~/Documents/knowledge_base');
  const [savingVault, setSavingVault] = useState(false);

  // Step 3: Seed sample
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ sampleAssetsCount: number; sampleTopicsCount: number } | null>(null);

  // Step 4: Insight Kernel
  const [kernelSeeding, setKernelSeeding] = useState(false);
  const [kernelResult, setKernelResult] = useState<{ seeded: number } | null>(null);
  const [kernelsPreview, setKernelsPreview] = useState<Array<{ id: string; category: string; content: string; confidence: number }>>([]);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/system/status');
    const data = await res.json();
    if (data.ok) setStatus(data);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // 智能跳到下一步
  useEffect(() => {
    if (!status) return;
    if (status.hasSeed) {
      router.push('/');
      return;
    }
    // 跳到第一个未完成的步骤
    if (!status.llmConfigured && step === 0) setStep(1);
    else if (status.llmConfigured && !status.vaultPathValid && step === 0) setStep(2);
    else if (status.llmConfigured && status.vaultPathValid && !status.hasAssets && step === 0) setStep(3);
  }, [status, router, step]);

  const handleLlmProvider = (idx: number) => {
    setLlmProvider(idx);
    setBaseUrl(LLM_PRESETS[idx].baseUrl);
    setModel(LLM_PRESETS[idx].model);
  };

  const saveLlm = async () => {
    if (!apiKey && !baseUrl) {
      toast.error('请填 API Key 或选一个预设');
      return;
    }
    setSavingLlm(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          llm: { baseUrl, apiKey, model, enabled: true },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('LLM 配置已保存');
        await loadStatus();
        setStep(2);
      } else {
        toast.error(data.error ?? '保存失败');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingLlm(false);
    }
  };

  const skipLlm = async () => {
    setStep(2);
  };

  const saveVault = async () => {
    if (!vaultPath.trim()) {
      toast.error('请填 Vault 路径');
      return;
    }
    setSavingVault(true);
    try {
      // 展开 ~ → $HOME
      const expanded = vaultPath.startsWith('~') ? vaultPath.replace('~', '/Users/' + (window.navigator.userAgent.includes('Mac') ? '' : '')) : vaultPath;
      // 实际展开靠后端
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paths: { vaultPath: vaultPath.trim() } }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Vault 路径已保存');
        await loadStatus();
        setStep(3);
      } else {
        toast.error(data.error ?? '保存失败');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingVault(false);
    }
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/system/seed', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSeedResult({ sampleAssetsCount: data.sampleAssetsCount, sampleTopicsCount: data.sampleTopicsCount });
        toast.success(`已装入 ${data.sampleAssetsCount} 张示例卡 + ${data.sampleTopicsCount} 个主题`);
        setStep(4);
      } else {
        toast.error(data.error ?? '装入失败');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const seedKernels = async () => {
    setKernelSeeding(true);
    try {
      const res = await fetch('/api/kernel/seed-default', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setKernelResult({ seeded: data.seeded });
        toast.success(`已装入 ${data.seeded} 条 Insight Kernel 默认内核`);
        // 拉取预览
        const kRes = await fetch('/api/kernel');
        const kData = await kRes.json();
        if (kData.ok) setKernelsPreview(kData.kernels.map((k: any) => ({
          id: k.id, category: k.category, content: k.content, confidence: k.confidence,
        })));
      } else {
        // 409 已有内核 → 直接拉取
        if (data.existingCount) {
          toast.info(`已有 ${data.existingCount} 条内核，直接预览`);
          const kRes = await fetch('/api/kernel');
          const kData = await kRes.json();
          if (kData.ok) {
            setKernelsPreview(kData.kernels.map((k: any) => ({
              id: k.id, category: k.category, content: k.content, confidence: k.confidence,
            })));
            setKernelResult({ seeded: data.existingCount });
          }
        } else {
          toast.error(data.error ?? '种子失败');
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setKernelSeeding(false);
    }
  };

  const skipKernels = () => {
    setStep(5);
  };

  const finish = () => {
    router.push('/');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 640,
        background: 'white', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        padding: 40,
      }}>
        {/* 顶部 logo + step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--primary)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
          }}>I</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Insight Asset OS</div>
          <span style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {step === 0 ? '' : `步骤 ${step} / 4`}
          </div>
        </div>

        {/* Step 0: 欢迎 */}
        {step === 0 && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>
              欢迎使用 Insight Asset OS
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 12, lineHeight: 1.7 }}>
              把零散经验转化为可调用、可输出、可验证、可进化的管理思想资产。
            </p>
            <ul style={{ marginTop: 20, paddingLeft: 20, fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
              <li>🧠 <strong>思想内核</strong>：每个主题 1 句核心判断 + 3-5 条反常识</li>
              <li>✍️ <strong>写作工作流</strong>：1 句核心 + 3 张卡 = 写作骨架 + 陪练</li>
              <li>📊 <strong>资产地图 + 图谱</strong>：判断结构 + 血脉关系可视化</li>
              <li>💬 <strong>洞察助手</strong>：用自然语言问"我有几张高等级卡"</li>
            </ul>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 20 }}>
              需要 3 步配置（约 1 分钟）就能开始用。
            </p>
            <button
              onClick={() => setStep(1)}
              className="btn"
              style={{
                marginTop: 24, width: '100%', padding: '12px 20px',
                background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                fontSize: 15, fontWeight: 600,
              }}
            >
              开始配置 →
            </button>
          </>
        )}

        {/* Step 1: LLM */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              配置 LLM（可选）
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              LLM 用于：思想内核提炼 / 写作骨架 / 资产升级 / 洞察助手。<strong>没配也能用</strong>，只是高级功能不可用。
            </p>

            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>选服务</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {LLM_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    onClick={() => handleLlmProvider(i)}
                    style={{
                      padding: '10px 14px', fontSize: 13, fontWeight: 500,
                      background: llmProvider === i ? 'var(--bg-subtle)' : 'white',
                      border: llmProvider === i ? '2px solid var(--primary)' : '1px solid var(--line)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                    }}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>Base URL</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="form-input"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>Model</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="deepseek-chat"
                className="form-input"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button
                onClick={saveLlm}
                disabled={savingLlm || !apiKey}
                className="btn"
                style={{
                  flex: 1, padding: '11px 18px',
                  background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                  fontWeight: 600,
                  opacity: !apiKey ? 0.4 : 1,
                }}
              >
                {savingLlm ? '保存中…' : '保存并继续 →'}
              </button>
              <button onClick={skipLlm} className="btn btn-ghost">
                跳过
              </button>
            </div>
          </>
        )}

        {/* Step 2: Vault */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              选 Vault 路径
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              指向你的知识库根目录，应用会扫描 <code>04_管理洞察/</code> 下的所有 .md 资产卡。
            </p>

            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, display: 'block' }}>Vault 根路径</label>
              <input
                value={vaultPath}
                onChange={e => setVaultPath(e.target.value)}
                placeholder="~/Documents/knowledge_base"
                className="form-input"
              />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
                不存在也没关系，应用会帮你创建。<code>~</code> 会展开为你的 home 目录。
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => setStep(1)} className="btn btn-ghost">
                ← 上一步
              </button>
              <button
                onClick={saveVault}
                disabled={savingVault}
                className="btn"
                style={{
                  flex: 1, padding: '11px 18px',
                  background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {savingVault ? '保存中…' : '保存并继续 →'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Seed */}
        {step === 3 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              装入示例数据
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              装入 8 张示例资产 + 2 个主题 + 1 个内核 + 1 个示例写作。这样你打开就能看到完整的产品形态。
            </p>

            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
              <div>📚 <strong>8 张示例资产</strong>（跨 E0/E1/E2 三个等级）</div>
              <div>📂 <strong>2 个示例主题</strong>（AI 时代的判断力 / 组织治理）</div>
              <div>💡 <strong>1 个内核</strong>（手写预生成，不调 LLM）</div>
              <div>✍️ <strong>1 个示例写作</strong>（完整骨架 + 草稿）</div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.5 }}>
              所有示例数据用 <code>sample-</code> 前缀，不会跟你后续真实数据冲突。随时可以在「设置 → 清理示例数据」删除。
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => setStep(2)} className="btn btn-ghost">
                ← 上一步
              </button>
              <button
                onClick={runSeed}
                disabled={seeding}
                className="btn"
                style={{
                  flex: 1, padding: '11px 18px',
                  background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {seeding ? '装入中…' : '✨ 装入示例数据'}
              </button>
            </div>
          </>
        )}

        {/* Step 4: Insight Kernel */}
        {step === 4 && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              🧠 装入 Insight Kernel
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              你的"判断宪法"——<strong>每次 LLM 调用都会自动注入</strong>，让所有输出带你的立场。<br />
              先装入 6 条 ship-ready 默认，之后随时改。
            </p>

            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--ink)' }}>6 条默认内核</div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
                ◆ 底层信念 2 条 · ◇ 反常识 2 条 · ◈ 擅长 1 条 · ◉ 挑战 1 条
              </div>
            </div>

            {!kernelResult ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                  <button onClick={() => setStep(3)} className="btn btn-ghost">
                    ← 上一步
                  </button>
                  <button
                    onClick={seedKernels}
                    disabled={kernelSeeding}
                    className="btn"
                    style={{
                      flex: 1, padding: '11px 18px',
                      background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {kernelSeeding ? '装入中…' : '✨ 装入 6 条默认内核'}
                  </button>
                </div>
                <button
                  onClick={skipKernels}
                  style={{
                    marginTop: 8, width: '100%',
                    background: 'transparent', border: 'none',
                    color: 'var(--text-3)', cursor: 'pointer',
                    fontSize: 12, padding: 8,
                  }}
                >
                  跳过 · 之后在 ⚙ 设置里手动装入
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--success, #16a34a)', marginTop: 16, lineHeight: 1.5 }}>
                  ✓ 已装入 {kernelResult.seeded} 条内核
                </p>
                <div style={{
                  marginTop: 12, maxHeight: 220, overflowY: 'auto',
                  border: '1px solid var(--line-soft)', borderRadius: 8,
                  padding: 8,
                }}>
                  {kernelsPreview.map((k, i) => (
                    <div key={k.id} style={{
                      padding: '8px 10px',
                      borderBottom: i < kernelsPreview.length - 1 ? '1px solid var(--line-soft)' : 'none',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      <span style={{
                        fontSize: 10,
                        color: k.category === 'belief' ? '#6366f1' :
                               k.category === 'contrarian' ? '#f43f5e' :
                               k.category === 'expertise' ? '#10b981' : '#f59e0b',
                        marginRight: 6, fontWeight: 600,
                      }}>
                        {k.category === 'belief' ? '◆' :
                         k.category === 'contrarian' ? '◇' :
                         k.category === 'expertise' ? '◈' : '◉'}
                      </span>
                      {k.content}
                      <span style={{
                        marginLeft: 6, fontSize: 11, color: 'var(--text-3)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        ({k.confidence}/100)
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  想改？去 <code>⚙ 设置 › 判断协议</code>，每条都能改、加、归档。
                </p>
                <button
                  onClick={() => setStep(5)}
                  className="btn btn-primary"
                  style={{
                    marginTop: 16, width: '100%', padding: '11px 18px',
                    fontSize: 15, fontWeight: 600,
                  }}
                >
                  下一步 →
                </button>
              </>
            )}
          </>
        )}

        {/* Step 5: 完成 */}
        {step === 5 && (
          <>
            <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', margin: 0, textAlign: 'center' }}>
              配置完成！
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 12, textAlign: 'center', lineHeight: 1.7 }}>
              {seedResult && `已装入 ${seedResult.sampleAssetsCount} 张示例卡 + ${seedResult.sampleTopicsCount} 个主题。`}
              {kernelResult && <><br />已装入 {kernelResult.seeded} 条 Insight Kernel。</>}
              <br />去仪表盘看看你的判断力库存。
            </p>
            <button
              onClick={finish}
              className="btn"
              style={{
                marginTop: 24, width: '100%', padding: '12px 20px',
                background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
                fontSize: 15, fontWeight: 600,
              }}
            >
              打开 Insight Asset OS →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
