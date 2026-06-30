/**
 * TodayProcessingPageClient · v1.8.5 还原原型
 *
 * 4 个 section（按 Vincent 2026-06-29 反馈的"不要漏原型板块"）：
 * 1. Hero 输入区 —— 输入框 + 4 入口卡横向并排 + 右上角 CTA 按钮
 * 2. 今日推荐加工 · 5 条（候选卡带 AI 推荐理由加粗高亮）
 * 3. 📚 你的主题已具备输出条件（核心差异化）
 * 4. ⬆️ 你的判断可以变强（核心差异化）
 *
 * 关键修正（v1.8.5）：
 * - 删掉我自己造的"4 模板气泡"（原型没有）
 * - 删掉"对话框提问"作为主标题（原型是"今日加工"，加副标题）
 * - 4 入口卡**横向并排**（不是行内胶囊）
 * - 候选卡加粗高亮 AI 推荐理由
 * - **加底部 2 个推荐板块**（之前漏掉）
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Candidate {
  id: string;
  title: string;
  statement: string;
  scoreTotal: number;
  evidenceLevel: string;
  recommendedAction: 'process' | 'candidate' | 'signal' | 'ignore';
  reasoning: string;
  breakdown: {
    clear: number; evidence: number; contrarian: number; reusable: number;
    output: number; kernel: number; novelty: number;
  };
  topics: string[];
  scenarios: string[];
  createdAt: number;
  evidenceType: string[];
}

interface ReadyTopic {
  id: string;
  name: string;
  slug: string;
  assetCount: number;
  e2PlusCount: number;
  outputCount: number;
  lastOutputAt: number | null;
}

interface KernelCandidate {
  id: string;
  title: string;
  evidenceLevel: string;
  outputCount: number;
  feedbackCount: number;
}

interface SourceRow {
  id: string;
  type: string;
  url: string;
  title: string;
  enabled: number;
  lastFetchedAt: number | null;
  lastError: string | null;
  newItemsCount: number;
  totalItemsCount: number;
}

interface Props {
  candidates: Candidate[];
  totalCount: number;
  llmEnabled: boolean;
  readyTopics: ReadyTopic[];
  kernelCandidates: KernelCandidate[];
  inboxCount: number;
  sources: SourceRow[];
}

const SCORE_LABEL: Record<number, { label: string; pill: string }> = {
  0: { label: 'AI 转型', pill: 'pill-violet' },
  1: { label: '组织效能', pill: 'pill-blue' },
};

export function TodayProcessingPageClient({
  candidates, totalCount, llmEnabled, readyTopics, kernelCandidates, inboxCount, sources: sourceRows,
}: Props) {
  const router = useRouter();
  const [material, setMaterial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // V1.10: 从 IndexedDB 优先读数据（demo 数据 / 用户本地 IndexedDB 数据）
  // 如果 IndexedDB 有数据，覆盖 server props
  const [clientCandidates, setClientCandidates] = useState<Candidate[] | null>(null);
  const [clientReadyTopics, setClientReadyTopics] = useState<ReadyTopic[] | null>(null);
  const [clientKernelCandidates, setClientKernelCandidates] = useState<KernelCandidateRow[] | null>(null);
  const [clientSources, setClientSources] = useState<SourceRow[] | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const DexieModule = await import('dexie');
        const Dexie = (DexieModule as any).default || DexieModule;
        const db = new Dexie('insight-os');
        // V1.10: 必须用完整 11 table schema（和 DemoLoader 一致）
        db.version(1).stores({
          assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
          outputs: 'id, status, writingStatus, topicId, createdAt, updatedAt',
          feedback: 'id, assetId, scene, outputId, createdAt',
          topics: 'id, slug, sortOrder, updatedAt',
          assetTopics: 'id, assetId, topicId, [assetId+topicId]',
          sources: 'id, url, enabled, lastFetchedAt, type, createdAt',
          sourceItems: 'id, sourceId, status, fetchedAt, publishedAt, [sourceId+guid]',
          topicKernels: 'id, topicId, generatedAt',
          userKernels: 'id, category, status, sortOrder, updatedAt',
          writingDrafts: 'id, writingId, updatedAt',
          writingVersions: 'id, writingId, createdAt, [writingId+createdAt]',
        });

        const [allAssets, allTopics, allAssetTopics, allSources] = await Promise.all([
          db.assets.toArray(),
          db.topics.toArray(),
          db.assetTopics.toArray(),
          db.sources.toArray(),
        ]);

        // 候选卡：status in ('candidate', 'sorting', 'inbox') + scoreTotal > 0
        const candidateRows = allAssets
          .filter(a => ['candidate', 'sorting', 'inbox'].includes(a.status) && a.scoreTotal > 0)
          .sort((a, b) => b.scoreTotal - a.scoreTotal)
          .slice(0, 5);
        setClientCandidates(candidateRows.map(row => {
          let breakdown = { clear: 0.5, evidence: 0.5, contrarian: 0.5, reusable: 0.5, output: 0.5, kernel: 0.5, novelty: 0.5 };
          try {
            const parsed = JSON.parse(row.scoreBreakdownJson || '{}');
            if (parsed && typeof parsed === 'object') breakdown = { ...breakdown, ...parsed };
          } catch {}
          let topics: string[] = [];
          try { const tags = JSON.parse(row.tagsJson || '[]'); if (Array.isArray(tags)) topics = tags.slice(0, 3); } catch {}
          return {
            id: row.id,
            title: row.title,
            statement: row.oneSentenceInsight ?? '',
            scoreTotal: row.scoreTotal,
            evidenceLevel: row.evidenceLevel,
            recommendedAction: (row.scoreTotal >= 80 ? 'process' : row.scoreTotal >= 65 ? 'candidate' : row.scoreTotal >= 50 ? 'signal' : 'ignore') as any,
            reasoning: '基于 7 维度评分推荐',
            breakdown,
            topics,
            scenarios: [],
            createdAt: row.createdAt,
            evidenceType: [],
          };
        }));

        // Ready topics：每个 topic 关联的资产 + 输出统计
        const readyTopicList = allTopics.map(topic => {
          const topicAssets = allAssetTopics.filter(at => at.topicId === topic.id).map(at => allAssets.find(a => a.id === at.assetId)).filter(Boolean);
          const e2Plus = topicAssets.filter((a: any) => ['E2', 'E3', 'E4', 'E5'].includes(a.evidenceLevel)).length;
          return {
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            assetCount: topicAssets.length,
            e2PlusCount: e2Plus,
            outputCount: 0,
            lastOutputAt: null as number | null,
          };
        });
        setClientReadyTopics(readyTopicList);

        // Kernel candidates：isKernelCandidate=1
        const kernelCands = allAssets
          .filter(a => a.isKernelCandidate === 1)
          .sort((a, b) => b.outputCount - a.outputCount)
          .slice(0, 3);
        setClientKernelCandidates(kernelCands.map(a => ({
          id: a.id, title: a.title, evidenceLevel: a.evidenceLevel, outputCount: a.outputCount, feedbackCount: a.feedbackCount,
        })));

        // Sources
        setClientSources(allSources.filter((s: any) => s.enabled === 1).map((s: any) => ({
          id: s.id, type: s.type, url: s.url, title: s.title, enabled: s.enabled,
          lastError: s.lastError, newItemsCount: s.newItemsCount, totalItemsCount: s.totalItemsCount,
        })));
      } catch (e) {
        console.error('[TodayProcessingPageClient] IDB load failed:', e);
      }
    })();
  }, []);

  // 优先用 IndexedDB 数据，回退到 server props
  const finalCandidates = clientCandidates ?? candidates;
  const finalReadyTopics = clientReadyTopics ?? readyTopics;
  const finalKernelCandidates = clientKernelCandidates ?? kernelCandidates;
  const finalSources = clientSources ?? sourceRows;
  // totalCount / inboxCount 从 IDB 候选数 + inbox 数算出
  const finalTotalCount = clientCandidates ? clientCandidates.length : totalCount;
  const finalInboxCount = clientCandidates
    ? clientCandidates.filter((c: any) => c.recommendedAction === 'ignore' || c.scoreTotal < 50).length
    : inboxCount;

  const handleSubmit = async () => {
    if (!material.trim()) { setError('素材不能为空'); return; }
    if (material.trim().length < 5) { setError('素材太短（至少 5 字符）'); return; }
    setSubmitting(true);
    setError(null);
    try {
      // V1.10: 直接写 IndexedDB（demo / Vercel 上 server API 不可用）
      const DexieModule = await import('dexie');
      const Dexie = (DexieModule as any).default || DexieModule;
      const db = new Dexie('insight-os');
      db.version(1).stores({
        assets: 'id, type, status, evidenceLevel, updatedAt, scoreTotal, isKernelCandidate, isKernelApproved, sourceMaterialId, createdAt',
      });

      const id = `lc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const content = material.trim();
      // 简化版：light 卡 + 状态 inbox
      // TODO: 完整 intake 流程（LLM 评分 + 升级 candidate）
      await db.assets.put({
        id,
        type: 'light',
        status: 'inbox',
        title: content.slice(0, 50),
        evidenceLevel: 'E0',
        tagsJson: '[]',
        source: 'manual',
        sourceType: 'original',
        filePath: `/inbox/${id}.md`,
        fileMtime: now,
        fileHash: id,
        feedbackCount: 0,
        scoreTotal: 0,
        scoreBreakdownJson: '{}',
        outputCount: 0,
        isKernelCandidate: 0,
        isKernelApproved: 0,
        relatedIdsJson: '[]',
        createdAt: now,
        updatedAt: now,
      });

      setMaterial('');
      router.push('/candidates');
    } catch (e: any) {
      setError(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setMaterial(text);
    setError(null);
  };

  // 4 入口卡（按原型横向并排）
  const sourceCards = [
    { icon: '📋', label: '粘贴素材', desc: '直接复制一段文字', bg: 'rgba(26, 54, 93, 0.08)', color: '#1a365d' },
    { icon: '📎', label: '上传文件', desc: 'PDF / Word / Markdown', bg: 'rgba(109, 91, 201, 0.10)', color: '#6d5bc9' },
    { icon: '🤖', label: 'OpenClaw 同步', desc: '1,152 张概念卡待筛', bg: '#ecfdf5', color: '#059669', href: '/inbox' },
    { icon: '📥', label: '从收集箱选', desc: `${finalInboxCount} 条未加工`, bg: '#fffbeb', color: '#d97706', href: '/inbox' },
  ];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* ============== Section 1: Hero 输入区（4 入口卡横向并排）============== */}
      <div className="card" style={{
        padding: 24, marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(26, 54, 93, 0.03), rgba(234, 88, 12, 0.03))',
      }}>
        <h1 className="page-title" style={{ marginBottom: 8 }}>今日加工</h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          把一段笔记、聊天记录、项目复盘粘贴进来，AI 会识别出值得加工的判断。
        </p>

        {/* 输入框 */}
        <textarea
          value={material}
          onChange={(e) => { setMaterial(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="粘贴素材 · 拖入文件 · 或直接开始书写..."
          style={{
            width: '100%',
            minHeight: 140,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.7,
            border: '1px solid var(--line)',
            borderRadius: 8,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            background: 'white',
            color: 'var(--ink)',
          }}
          disabled={submitting}
        />
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{error}</div>
        )}

        {/* 提示 + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            <span>或从这些来源选：</span>
            {!llmEnabled && <span style={{ marginLeft: 8, color: '#d97706' }}>⚠ LLM 未配置</span>}
          </div>
          <button
            onClick={handleSubmit}
            className="btn"
            style={{
              background: llmEnabled ? 'var(--accent)' : 'var(--text-3)',
              color: 'white', borderColor: 'transparent',
              fontSize: 13, padding: '8px 20px', fontWeight: 500,
            }}
            disabled={submitting || !llmEnabled || !material.trim()}
          >
            {submitting ? '✨ 提炼中...' : '✨ 生成值得加工的判断'}
          </button>
        </div>

        {/* 4 入口卡横向并排（按原型） */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
          {sourceCards.map(c => {
            const inner = (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                  background: c.bg, color: c.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.desc}</div>
                </div>
              </>
            );
            const style: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 12, borderRadius: 8,
              background: 'white', border: '1px solid var(--line)',
              cursor: 'pointer', textDecoration: 'none',
              transition: 'all 0.15s',
            };
            return c.href ? (
              <Link key={c.label} href={c.href} style={style}>{inner}</Link>
            ) : (
              <button
                key={c.label}
                onClick={() => { if (c.label === '上传文件') fileInputRef.current?.click(); }}
                style={{ ...style, border: '1px solid var(--line)' }}
              >
                {inner}
              </button>
            );
          })}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.pdf,.doc,.docx"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* ============== Section 1.5: 信息源订阅（v1.9.0 新增）============== */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            📡 信息源订阅
            <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {finalSources.length > 0
                ? `${finalSources.length} 个源 · ${finalSources.reduce((sum, s) => sum + s.newItemsCount, 0)} 条新内容`
                : '订阅 RSS，开 insight-os 自动拉新'}
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={async () => {
                await fetch('/api/sources/sync-all', { method: 'POST' });
                location.reload();
              }}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4,
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--line)', cursor: 'pointer',
              }}
              disabled={finalSources.length === 0}
            >
              🔄 立即同步
            </button>
            <Link
              href="/sources"
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4,
                background: 'transparent', color: 'var(--primary)',
                border: '1px solid var(--primary)', textDecoration: 'none',
              }}
            >
              + 添加源
            </Link>
          </div>
        </div>

        {finalSources.length === 0 ? (
          <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            还没有订阅。<Link href="/sources" style={{ color: 'var(--primary)', textDecoration: 'none' }}>添加第一个 RSS 源 →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finalSources.slice(0, 3).map(s => (
              <SourceRowCard key={s.id} source={s} />
            ))}
            {finalSources.length > 3 && (
              <Link href="/sources" style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', textDecoration: 'none', padding: 4 }}>
                还有 {finalSources.length - 3} 个源 · 查看全部 →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ============== Section 2: 今日推荐加工 · 5 条 ============== */}
      {finalCandidates.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              今日推荐加工 · 5 条
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {finalTotalCount > 5 ? `显示前 5 / 共 ${finalTotalCount}` : `共 ${finalTotalCount}`}
              <span style={{ marginLeft: 8 }}>· 按价值排序 · AI 已自动评估</span>
              <Link href="/candidates" style={{ marginLeft: 12, color: 'var(--primary)', textDecoration: 'none' }}>查看全部 →</Link>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {finalCandidates.map(c => (
              <CandidateCard
                key={c.id}
                candidate={c}
                expanded={expandedScoreId === c.id}
                onToggle={() => setExpandedScoreId(expandedScoreId === c.id ? null : c.id)}
                onProcess={() => router.push(`/candidates/${c.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {finalCandidates.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>粘贴素材后，AI 提炼的候选会出现在这里。</div>
        </div>
      )}

      {/* ============== Section 3 + 4: 底部 2 段（核心差异化场景）============== */}
      {(finalReadyTopics.length > 0 || finalKernelCandidates.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
          {/* 📚 你的主题已具备输出条件 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                📚 你的主题已具备输出条件
              </h2>
              <Link href="/topics" style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none' }}>查看全部 →</Link>
            </div>
            {finalReadyTopics.length === 0 ? (
              <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                主题还没达到输出条件。<br/>在「判断资产」把资产归到主题，凑齐 5 个 E2+ 后会出现。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {finalReadyTopics.map(t => {
                  // 计算"已具备"和"还缺"
                  const hasArticle = t.outputCount >= 1;
                  const hasTalk = t.outputCount >= 2;
                  const has = [];
                  if (hasArticle) has.push('公众号长文');
                  if (hasTalk) has.push('客户方案');
                  const needForCourse = Math.max(0, 3 - t.e2PlusCount);
                  const needForWorkshop = Math.max(0, 5 - t.assetCount);
                  return (
                    <div key={t.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{t.name}</h4>
                        <span className="pill" style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 3,
                          background: '#f0fdf4', color: '#16a34a', fontWeight: 500,
                        }}>可输出</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px 0' }}>
                        已具备：{has.length > 0 ? has.join(' + ') : '（还没有 output）'}
                        {needForCourse > 0 && <> · 还缺 {needForCourse} 个案例可做课程</>}
                        {needForCourse === 0 && needForWorkshop > 0 && <> · 还缺 {needForWorkshop} 个案例可做工作坊</>}
                      </p>
                      <Link
                        href={`/topics/${t.slug}`}
                        className="btn btn-sm"
                        style={{
                          background: 'var(--primary)', color: 'white', borderColor: 'transparent',
                          fontSize: 11, padding: '4px 12px', fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        开始生成 →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ⬆️ 你的判断可以变强 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                ⬆️ 你的判断可以变强
              </h2>
              <Link href="/assets" style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none' }}>查看全部 →</Link>
            </div>
            {finalKernelCandidates.length === 0 ? (
              <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                还没有被反复引用的判断。<br/>被引用 5 次 + 收到 1 条反馈后会出现在这里。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {finalKernelCandidates.map(a => (
                  <div key={a.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div className={`ev-badge ev-${a.evidenceLevel}`} style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                        background: '#dbeafe', color: '#1e40af', flexShrink: 0,
                      }}>{a.evidenceLevel}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px 0' }}>
                          {a.title}
                        </h4>
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px 0' }}>
                          已被引用 {a.outputCount} 次 · 收到 {a.feedbackCount} 条反馈
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pill" style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 3,
                            background: '#f0fdf4', color: '#16a34a', fontWeight: 500,
                          }}>建议沉淀为方法论</span>
                          <Link
                            href={`/assets/${a.id}`}
                            style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            去确认 →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== 候选卡（AI 推荐理由加粗高亮）==============
function CandidateCard({
  candidate: c, expanded, onToggle, onProcess,
}: {
  candidate: Candidate; expanded: boolean; onToggle: () => void; onProcess: () => void;
}) {
  const style = actionStyle(c.recommendedAction);
  // 评分圆圈颜色（按分档）
  const scoreCircleStyle = c.scoreTotal >= 80
    ? { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' }
    : c.scoreTotal >= 65
    ? { bg: '#fffbeb', color: '#d97706', border: '#d97706' }
    : c.scoreTotal >= 50
    ? { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' }
    : { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1' };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* 评分圆圈（按原型 56×56 大圆） */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600,
          fontFamily: 'JetBrains Mono, monospace',
          background: scoreCircleStyle.bg, color: scoreCircleStyle.color,
          border: `2px solid ${scoreCircleStyle.border}`,
          flexShrink: 0,
        }}>
          {c.scoreTotal}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 标题 + 价值 badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.title}
            </h3>
            <span className="pill" style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: style.bg, color: style.color, fontWeight: 500, flexShrink: 0,
            }}>
              {actionLabel(c.recommendedAction)}
            </span>
          </div>

          {/* AI 推荐理由（加粗高亮 · 原型核心） */}
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 10px 0' }}>
            <strong style={{ color: 'var(--primary)' }}>AI 发现这条素材有 {Math.max(1, Math.round(c.scoreTotal / 20))} 个可复用判断</strong>
            ，其中 1 个适合加工为正式资产——
            <span style={{ color: 'var(--text-3)' }}>{c.reasoning || '可以同时用于公众号长文和客户方案。'}</span>
          </p>

          {/* 标签行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {c.topics.slice(0, 3).map((t, i) => (
              <span key={t} className="pill" style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: i === 0 ? '#ede9fe' : i === 1 ? '#dbeafe' : '#f1f5f9',
                color: i === 0 ? '#6d5bc9' : i === 1 ? '#1e40af' : 'var(--text-3)',
              }}>{t}</span>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· 来自 OpenClaw</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{relativeTime(c.createdAt)}</span>
            <button
              onClick={onToggle}
              style={{
                marginLeft: 'auto', fontSize: 11, color: 'var(--primary)',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {expanded ? '▾ 收起评分' : '▸ 为什么推荐这条？'}
            </button>
          </div>

          {/* 评分明细（折叠） */}
          {expanded && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>
                AI 评分依据（7 维度 · 满分 100）
              </div>
              <ScoreBreakdown breakdown={c.breakdown} />
            </div>
          )}

          {/* 4 操作按钮（按原型） */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={onProcess}
              className="btn btn-sm"
              style={{
                background: 'var(--primary)', color: 'white', borderColor: 'transparent',
                fontSize: 12, padding: '5px 14px', fontWeight: 500,
              }}
            >
              ✓ 加工为正式判断
            </button>
            <button className="btn btn-sm" style={{
              background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
              fontSize: 12, padding: '5px 12px',
            }}>稍后</button>
            <button className="btn btn-sm" style={{
              background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
              fontSize: 12, padding: '5px 12px',
            }}>忽略</button>
            <button className="btn btn-sm" style={{
              background: 'white', color: 'var(--text-2)', border: '1px solid var(--line)',
              fontSize: 12, padding: '5px 12px',
            }}>合并</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBreakdown({ breakdown: b }: { breakdown: Candidate['breakdown'] }) {
  const items: Array<[string, number, number]> = [
    ['判断清晰度', b.clear, 20],
    ['证据强度', b.evidence, 20],
    ['反常识', b.contrarian, 15],
    ['可复用', b.reusable, 15],
    ['输出潜力', b.output, 15],
    ['方法论相关', b.kernel, 10],
    ['新颖度', b.novelty, 5],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px' }}>
      {items.map(([label, score, weight]) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
            <span>{label}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)' }}>
              {(score * weight).toFixed(1)}/{weight}
            </span>
          </div>
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${score * 100}%`, height: '100%',
              background: 'linear-gradient(90deg, #1a365d, #ea580c)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function actionStyle(action: Candidate['recommendedAction']) {
  switch (action) {
    case 'process': return { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' };
    case 'candidate': return { bg: '#fffbeb', color: '#d97706', border: '#d97706' };
    case 'signal': return { bg: '#fef2f2', color: '#dc2626', border: '#dc2626' };
    default: return { bg: '#f1f5f9', color: '#94a3b8', border: '#cbd5e1' };
  }
}

function actionLabel(action: Candidate['recommendedAction']): string {
  switch (action) {
    case 'process': return '高价值';
    case 'candidate': return '中等价值';
    case 'signal': return '待补证据';
    default: return '建议忽略';
  }
}

function relativeTime(ts: number): string {
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

// ============== 信息源卡（主页用，简化版）==============
function SourceRowCard({ source: s }: { source: SourceRow }) {
  return (
    <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: 'rgba(234, 88, 12, 0.10)', color: '#ea580c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>📰</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{s.title}</span>
          {s.newItemsCount > 0 && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3,
              background: '#fef2f2', color: '#dc2626', fontWeight: 500,
            }}>{s.newItemsCount} 条新</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {s.lastFetchedAt
            ? `上次同步：${relativeTime(s.lastFetchedAt)}`
            : '尚未同步'}
          {s.lastError && (
            <span style={{ color: '#dc2626', marginLeft: 8 }}>⚠ 同步失败</span>
          )}
        </div>
      </div>
      <Link
        href={`/sources/${s.id}`}
        style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', flexShrink: 0 }}
      >
        查看 →
      </Link>
    </div>
  );
}