'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<{ llmConfigured: boolean; hasAssets: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStatus({ llmConfigured: d.llmConfigured, hasAssets: d.hasAssets });
          // 已经全配好 → 直接跳首页
          if (d.llmConfigured && d.hasAssets) {
            router.replace('/');
          }
        }
      })
      .catch(() => null);
  }, [router]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          padding: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            I
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Insight Asset OS
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>
          👋 开始使用
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.7 }}>
          Insight OS 是个人判断力工作台 —— AI 帮你从素材里发现值得加工的判断。
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--line)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
            首次使用建议
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>
            <li>去 <strong>设置</strong> 配 LLM（base URL + API key）</li>
            <li>去 <strong>设置</strong> 配资产库路径（Vault）</li>
            <li>开始 <strong>写文章</strong> 或 <strong>浏览资产库</strong></li>
          </ol>
        </div>

        {status && !status.llmConfigured && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#fff8e6',
              border: '1px solid #f0d890',
              borderRadius: 6,
              fontSize: 12,
              color: '#7a6320',
            }}
          >
            ⚠️ 检测到 LLM 还没配置 —— 先去 <a href="/settings" style={{ color: 'var(--primary)' }}>设置</a> 配 API key
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/settings')}
            style={{ flex: 1, padding: '12px 20px', fontSize: 14, fontWeight: 600 }}
          >
            ⚙ 去设置
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => router.push('/')}
            style={{ padding: '12px 20px', fontSize: 14 }}
          >
            跳过，先逛逛
          </button>
        </div>
      </div>
    </div>
  );
}