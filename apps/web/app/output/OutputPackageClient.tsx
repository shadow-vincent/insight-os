/**
 * OutputPackageClient · v1.8.3 输出包
 *
 * 按 Vincent v3 评价第 5 + 9 条：
 * - 4 类型快速切换（公众号 / 客户方案 / 课程大纲 / 邮件 / 演讲）
 * - 4 格式导出（Markdown / HTML / 公众号格式 / PDF）
 * - Pro 能力区：克制表达，不放大橙色购买框
 * - ¥199 锚点保留（轻量卡底部）
 *
 * 设计原则：
 * - 输出包是 V1.8.3 收尾，**不再扩功能**（V1.8.4 = 我的方法论）
 * - 不在每个工作页都出现大橙色购买框
 * - Pro 能力区 = 表达"未来可解锁"，不是当下卡死
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface Output {
  id: string;
  title: string;
  content: string;
  outputType: string;
  audience: string | null;
  status: string;
  createdAt: number;
  assetIds: string[];
  assetCount: number;
  primaryAssetTitle: string;
  primaryAssetId: string | null;
  isMulti: boolean;
}

// v1.8.3 6 种输出类型
const TYPE_TABS = [
  { key: 'all', label: '全部', icon: '📚' },
  { key: 'article_outline', label: '文章大纲', icon: '📝' },
  { key: 'talk_script', label: '客户沟通话术', icon: '💬' },
  { key: 'writing', label: '公众号长文', icon: '✍️' },
  { key: 'speech', label: '演讲稿', icon: '🎤' },
  { key: 'book_note', label: '读书笔记', icon: '📖' },
  { key: 'email', label: '邮件', icon: '✉️' },
];

const TYPE_LABEL: Record<string, string> = {
  talk_script: '客户沟通话术',
  article_outline: '文章大纲',
  article_full: '公众号长文',
  writing: '公众号长文',
  speech: '演讲稿',
  book_note: '读书笔记',
  email: '邮件',
};

// 4 种导出格式
const EXPORT_FORMATS = [
  { key: 'md', label: 'Markdown', icon: '📝', desc: '适合继续编辑' },
  { key: 'html', label: 'HTML', icon: '🌐', desc: '适合贴博客' },
  { key: 'wechat', label: '公众号', icon: '📱', desc: 'Pro 能力（V1.8.4 解锁）' },
  { key: 'pdf', label: 'PDF', icon: '📄', desc: 'Pro 能力（V1.8.4 解锁）' },
];

export function OutputPackageClient() {
  const [list, setList] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();

  // V1.11.16: IDB-first
  useEffect(() => {
    (async () => {
      try {
        const { getOutputs } = await import('@/lib/idb/operations');
        const outputs = await getOutputs();
        setList(outputs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filterType === 'all' ? list : list.filter(o => o.outputType === filterType);
  // 计算每个 type 的数量（用于 tab 显示）
  const typeCounts: Record<string, number> = { all: list.length };
  list.forEach(o => { typeCounts[o.outputType] = (typeCounts[o.outputType] ?? 0) + 1; });

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>加载中…</div>;
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">输出包</h1>
          <p className="page-subtitle">
            把判断资产变成可用的内容：公众号长文、客户方案、课程大纲、邮件、演讲稿。
          </p>
        </div>
        <Link href="/assets" className="btn btn-primary">+ 从判断资产生成</Link>
      </div>

      {/* Pro 能力区 · 克制版（v3 评价第 5 条） */}
      <ProCapabilityHint />

      {/* 4 类型快速切换 */}
      {list.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          borderBottom: '1px solid var(--line)',
          overflowX: 'auto',
        }}>
          {TYPE_TABS.map(t => {
            const count = typeCounts[t.key] ?? 0;
            // 隐藏 count=0 的非"全部" tab
            if (t.key !== 'all' && count === 0) return null;
            return (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key)}
                style={{
                  padding: '10px 18px', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${filterType === t.key ? 'var(--primary)' : 'transparent'}`,
                  color: filterType === t.key ? 'var(--primary)' : 'var(--text-2)',
                  fontSize: 14, fontWeight: filterType === t.key ? 600 : 500,
                  cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 输出列表 */}
      {list.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📤</div>
          <p style={{ fontSize: 14, color: 'var(--ink)' }}>还没有输出</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            去「判断资产」选一张，AI 会帮你生成客户沟通话术 / 公众号大纲 / 课程大纲
          </p>
          <Link href="/assets" className="btn btn-primary" style={{ marginTop: 16 }}>
            去判断资产 →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(o => (
            <OutputRow
              key={o.id}
              o={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 输出卡 · 含 4 格式导出 + 4 动作（复制 / 公众号 / 写文章 / 看源资产）
 */
function OutputRow({ o, expanded, onToggle, toast }: {
  o: Output;
  expanded: boolean;
  onToggle: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}) {
  const date = new Date(o.createdAt * 1000).toLocaleString('zh-CN');
  let parsed: any = {};
  try { parsed = JSON.parse(o.content || '{}'); } catch { /* noop */ }
  const text = parsed.primary_version ?? parsed.content ?? o.content;

  // 复制为 Markdown
  const copyAsMarkdown = async () => {
    await navigator.clipboard.writeText(`# ${o.title}\n\n${text}`);
    toast.success('已复制为 Markdown');
  };

  // 复制为 HTML（极简转 Markdown → HTML 不会做，粗略包 p 标签）
  const copyAsHtml = async () => {
    const html = `<h1>${o.title}</h1>\n${text.split('\n\n').map((p: string) => `<p>${p}</p>`).join('\n')}`;
    await navigator.clipboard.writeText(html);
    toast.success('已复制为 HTML（基础版）');
  };

  // 公众号格式（V1.8.4 解锁）
  const copyAsWechat = () => {
    toast.info('公众号格式是 Pro 能力，V1.8.4 上线');
  };

  // PDF 导出（V1.8.4 解锁）
  const exportPdf = () => {
    toast.info('PDF 导出是 Pro 能力，V1.8.4 上线');
  };

  // v1.8.4 输出后强化：沉淀为方法论
  const [showStrengthen, setShowStrengthen] = useState(false);
  const [strengthenBusy, setStrengthenBusy] = useState(false);
  const [strengthenResult, setStrengthenResult] = useState<{
    ok: boolean;
    message: string;
    suggestedCategory?: string;
  } | null>(null);

  const handlePromoteToKernel = async () => {
    setStrengthenBusy(true);
    try {
      const res = await fetch(`/api/outputs/${o.id}/promote-to-kernel`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setStrengthenResult({
          ok: true,
          message: data.message ?? '已沉淀为方法论候选',
          suggestedCategory: data.suggestedCategory,
        });
        toast.success('已沉淀为方法论候选');
      } else {
        setStrengthenResult({ ok: false, message: data.error ?? '失败' });
        toast.error(`沉淀失败: ${data.error}`);
      }
    } catch (e: any) {
      setStrengthenResult({ ok: false, message: e.message });
    } finally {
      setStrengthenBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600 }}>
          {TYPE_LABEL[o.outputType] ?? o.outputType}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{o.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            来自「{o.primaryAssetTitle}」 · {date}
            {o.assetCount > 1 && ` · 联合 ${o.assetCount} 张资产`}
          </div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line-soft)' }}>
          <div style={{ padding: '18px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 12, letterSpacing: '0.05em' }}>输出内容</div>
            <pre style={{
              margin: 0, padding: 18, background: 'var(--bg-subtle)', borderRadius: 6,
              fontSize: 14, lineHeight: 1.8, color: 'var(--text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
            }}>
              {text}
            </pre>
          </div>

          {/* 4 格式导出 + 复制 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 8, alignSelf: 'center' }}>导出为：</span>
            <button onClick={copyAsMarkdown} className="btn btn-sm" style={{ fontSize: 12 }}>
              📝 Markdown
            </button>
            <button onClick={copyAsHtml} className="btn btn-sm" style={{ fontSize: 12 }}>
              🌐 HTML
            </button>
            <button onClick={copyAsWechat} className="btn btn-sm" style={{ fontSize: 12, opacity: 0.65 }} title="Pro 能力">
              📱 公众号 <span style={{ fontSize: 10, color: '#ea580c' }}>Pro</span>
            </button>
            <button onClick={exportPdf} className="btn btn-sm" style={{ fontSize: 12, opacity: 0.65 }} title="Pro 能力">
              📄 PDF <span style={{ fontSize: 10, color: '#ea580c' }}>Pro</span>
            </button>
            <div style={{ flex: 1 }} />
            {o.primaryAssetId && (
              <Link href={`/assets/${o.primaryAssetId}`} className="btn btn-sm" style={{ fontSize: 12 }}>
                查看源资产 →
              </Link>
            )}
          </div>

          {/* v1.8.4 输出后强化 · 沉淀为方法论 */}
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                  🧠 输出后强化
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {strengthenResult?.ok
                    ? `已沉淀为「${strengthenResult.suggestedCategory ?? '方法论'}」候选 — 在「我的方法论」页确认`
                    : '这条输出用了一种判断方式？沉淀为方法论，下次 LLM 自动用同样的方式。'}
                </div>
              </div>
              {!strengthenResult?.ok && (
                <button
                  onClick={handlePromoteToKernel}
                  disabled={strengthenBusy}
                  className="btn btn-sm"
                  style={{ fontSize: 12, background: 'var(--primary)', color: 'white', borderColor: 'transparent' }}
                >
                  {strengthenBusy ? '沉淀中…' : '✨ 沉淀为方法论'}
                </button>
              )}
              {strengthenResult?.ok && (
                <Link href="/kernel" className="btn btn-sm" style={{ fontSize: 12, background: '#16a34a', color: 'white', borderColor: 'transparent', textDecoration: 'none' }}>
                  去确认 →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pro 能力区 · 克制版
 *
 * 按 v3 评价第 5 条：
 * - 不放大橙色购买框
 * - 表达"Pro 解锁：公众号 / PDF / HTML / 自定义模板"
 * - ¥199 锚点保留在底部
 */
function ProCapabilityHint() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="card"
      style={{
        padding: 16,
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(26, 54, 93, 0.03), rgba(234, 88, 12, 0.03))',
        borderColor: '#1a365d',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a365d' }}>⭐ Pro 能力</span>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                style={{
                  fontSize: 11, color: 'var(--text-3)', background: 'transparent',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                收起
              </button>
            )}
          </div>
          {!collapsed ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.5 }}>
                Pro 解锁：公众号排版格式 · PDF 导出 · 自定义模板 · 批量导出 · 品牌样式
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { icon: '📱', label: '公众号排版' },
                  { icon: '📄', label: 'PDF 导出' },
                  { icon: '🎨', label: '自定义模板' },
                  { icon: '📦', label: '批量导出' },
                  { icon: '🏷', label: '品牌样式' },
                ].map(c => (
                  <span
                    key={c.label}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 4,
                      background: 'rgba(26, 54, 93, 0.06)', color: '#1a365d',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              Pro 能力已收起 ·{' '}
              <button
                onClick={() => setCollapsed(false)}
                style={{ background: 'transparent', border: 'none', color: '#1a365d', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 12 }}
              >
                展开
              </button>
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>买断制</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a365d' }}>¥199<small style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>/年起</small></div>
          <Link
            href="/settings"
            className="btn btn-sm"
            style={{ marginTop: 6, fontSize: 11, padding: '4px 10px', background: 'transparent', color: '#1a365d', border: '1px solid #1a365d' }}
          >
            查看定价 →
          </Link>
        </div>
      </div>
    </div>
  );
}