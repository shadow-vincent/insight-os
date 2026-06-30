'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { getSharedDexie } from '@/lib/idb/shared-dexie';
import { useRouter } from 'next/navigation';
import { useToast } from '../ToastProvider';

interface CardSnippet {
  id: string;
  title: string;
  evidenceLevel: string;
  priority: string;
  oneSentenceInsight: string | null;
  topicNames: string[];
}

interface FollowUp {
  label: string;
  payload: { kind: string; [k: string]: any };
}

interface StepRecord {
  tool: string;
  query: string;
  reasoning: string;
  status: 'running' | 'done';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cards?: CardSnippet[];
  followUp?: FollowUp[];
  intent?: string;
  pending?: boolean;
  stage?: 'route' | 'search' | 'summarize' | 'done';
  steps?: StepRecord[];
}

const SUGGESTIONS = [
  '找组织设计的洞察',
  '找 AI 时代组织失效',
  '看看激励错位相关',
  '多卡 [asset_xxx] 讲给客户 CEO',
];

export default function AssistantDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: '👋 我是 Insight OS 的洞察助手。可以搜资产卡、做多卡联合输出。\n\n试试：**找组织设计** · **AI 时代组织失效** · **多卡 [asset_xxx, asset_yyy] 讲给 CEO**',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setInput('');

    // 1) 拼 history 给后端（最近 6 条 + 上轮引用的卡）
    const historyForApi = messages
      .filter(m => !m.pending)
      .slice(-6)
      .map(m => ({
        role: m.role,
        content: m.content,
        intent: m.intent,
        cards: m.cards?.map(c => ({ id: c.id, title: c.title })),
      }));

    // 2) 加 user 消息 + 空 assistant（pending）
    const userMsg: ChatMessage = { role: 'user', content };
    const asstMsg: ChatMessage = { role: 'assistant', content: '', pending: true, stage: 'route' };
    setMessages(m => [...m, userMsg, asstMsg]);
    setLoading(true);

    const realAsstIdx = messages.length + 1;

    const updateAsst = (patch: Partial<ChatMessage>) => {
      setMessages(m => {
        const next = [...m];
        const i = realAsstIdx;
        if (i >= 0 && i < next.length) next[i] = { ...next[i], ...patch };
        return next;
      });
    };

    try {
      // V1.10: 从 IDB 读 LLM config 传给 server（Vercel demo 用户从 IndexedDB 读）
      let clientLLMConfig: any = undefined;
      try {
        const DexieModule = await import('dexie');

        const db = await getSharedDexie();
const cfg = await db.preferences.get('llm-config');
        if (cfg?.baseUrl && cfg?.apiKey) {
          clientLLMConfig = { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model };
        }
      } catch { /* 静默失败 */ }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: content, history: historyForApi, clientLLMConfig }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstDeltaAt: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          const m = part.match(/^event: (\w+)\ndata: (.+)$/s);
          if (!m) continue;
          const eventType = m[1];
          let payload: any;
          try { payload = JSON.parse(m[2]); } catch { continue; }
          switch (eventType) {
            case 'meta':
              updateAsst({ intent: payload.intent, stage: payload.intent === 'help' ? 'done' : 'search' });
              break;
            case 'cards':
              updateAsst({ cards: payload.cards, stage: 'search' });
              break;
            case 'data':
              // multi_output 原始数据 或 multi_step 单步结果
              if (payload.multiStep) {
                // 多步：第一步完成时进入 summarize，并记录所有步骤进度
                const stepRec: StepRecord = {
                  tool: payload.step?.tool ?? '',
                  query: payload.step?.query ?? '',
                  reasoning: payload.step?.reasoning ?? '',
                  status: 'done',
                };
                setMessages(m => {
                  const next = [...m];
                  const i = realAsstIdx;
                  if (i >= 0 && i < next.length) {
                    const prevSteps = next[i].steps ?? [];
                    next[i] = {
                      ...next[i],
                      steps: [...prevSteps, stepRec],
                      stage: payload.stepIndex === 0 ? 'summarize' : next[i].stage,
                    };
                  }
                  return next;
                });
              }
              break;
            case 'delta':
              if (firstDeltaAt === null) {
                firstDeltaAt = Date.now();
                updateAsst({ stage: 'summarize' });
              }
              // 流式追加文本（functional update 累加）
              setMessages(m => {
                const next = [...m];
                const i = realAsstIdx;
                if (i >= 0 && i < next.length) {
                  next[i] = { ...next[i], content: (next[i].content ?? '') + payload.text };
                }
                return next;
              });
              break;
            case 'followUp':
              updateAsst({ followUp: payload.followUp });
              break;
            case 'done':
              updateAsst({ pending: false, stage: 'done' });
              break;
            case 'error':
              updateAsst({ content: `出错了：${payload.error}`, pending: false, stage: 'done' });
              toast.error('助手请求失败');
              break;
          }
        }
      }
      updateAsst({ pending: false, stage: 'done' });
    } catch (e: any) {
      setMessages(m => {
        const next = [...m];
        const i = realAsstIdx;
        if (i >= 0 && i < next.length) {
          next[i] = { ...next[i], content: `出错了：${e.message ?? '未知错误'}`, pending: false, stage: 'done' };
        }
        return next;
      });
      toast.error('助手请求失败');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleFollowUp = (f: FollowUp) => {
    if (f.payload.kind === 'open_output' && f.payload.outputId) {
      router.push(`/output#${f.payload.outputId}`);
      onClose();
    } else if (f.payload.kind === 'multi_start' && f.payload.seedAssetId) {
      setInput(`多卡 [${f.payload.seedAssetId}] `);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 400, maxWidth: '90vw',
        background: 'var(--surface, white)',
        borderLeft: '1px solid var(--line)',
        boxShadow: '-8px 0 24px rgba(15,23,42,0.08)',
        zIndex: 9998,
        display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes cursor-blink {
          0%, 50% { opacity: 0.85; }
          51%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)',
        color: 'white',
      }}>
        <div style={{ fontSize: 18 }}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>洞察助手</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>搜资产卡 · 多卡联合输出</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 16,
          }}
        >×</button>
      </div>

      {/* 消息流 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} onFollowUp={handleFollowUp} onJump={onClose} />
        ))}

        {/* 建议气泡（只在初始时显示） */}
        {messages.length === 1 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                style={{
                  textAlign: 'left', padding: '8px 12px', fontSize: 12,
                  background: 'white', border: '1px solid var(--line)', borderRadius: 8,
                  cursor: 'pointer', color: 'var(--text-2)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div style={{
        padding: '12px 14px 14px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg-subtle, #f8fafc)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'white', border: '1px solid var(--line)', borderRadius: 10,
          padding: '8px 10px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="问我点什么…  (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={loading}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)',
              maxHeight: 100, minHeight: 22,
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="btn btn-primary btn-sm"
            style={{ padding: '4px 12px', fontSize: 12, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
          >
            发送
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
          用 [asset_xxx] 引用具体资产卡 · v0.7.1
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg, onFollowUp, onJump,
}: {
  msg: ChatMessage;
  onFollowUp: (f: FollowUp) => void;
  onJump: () => void;
}) {
  const isUser = msg.role === 'user';
  const isStreaming = msg.role === 'assistant' && msg.stage === 'summarize' && !msg.followUp;
  const showCursor = isStreaming && msg.content && msg.content.length > 0;
  const stageLabel = msg.role === 'assistant' && !isUser
    ? (msg.stage === 'route' ? '理解意图…'
      : msg.stage === 'search' ? '查资产库…'
      : msg.stage === 'summarize' ? '组织语言…'
      : null)
    : null;

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        padding: '10px 14px',
        background: isUser ? 'var(--primary)' : 'var(--bg-subtle, #f1f5f9)',
        color: isUser ? 'white' : 'var(--ink)',
        borderRadius: 12,
        fontSize: 13, lineHeight: 1.65,
        wordBreak: 'break-word',
        minHeight: 24,
      }}>
        {msg.content ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{renderInline(msg.content)}</span>
        ) : stageLabel ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)' }}>
            <PulseDots />
            <span style={{ fontSize: 12 }}>{stageLabel}</span>
          </span>
        ) : null}
        {showCursor && (
          <span style={{
            display: 'inline-block', width: 6, height: 14, marginLeft: 2,
            background: 'var(--primary)', opacity: 0.7,
            verticalAlign: 'text-bottom',
            animation: 'cursor-blink 0.9s steps(2) infinite',
          }} />
        )}
      </div>

      {msg.intent && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', alignSelf: isUser ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
          intent: <code style={{ fontSize: 10, background: 'var(--bg-subtle)', padding: '1px 4px', borderRadius: 3 }}>{msg.intent}</code>
        </div>
      )}

      {msg.steps && msg.steps.length > 0 && (
        <div style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          padding: '8px 10px',
          background: 'var(--bg-subtle, #f8fafc)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--text-2)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2, fontWeight: 600 }}>
            🔄 推理 {msg.steps.length} 步
          </div>
          {msg.steps.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
              <span style={{ flexShrink: 0, color: 'var(--accent)', fontWeight: 600, fontSize: 10, marginTop: 1 }}>
                {idx + 1}.
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {s.tool === 'search' ? '🔍 搜' : s.tool === 'meta_query' ? '📊 统计' : s.tool}
                </span>
                <span style={{ color: 'var(--text-2)', marginLeft: 4 }}>
                  "{s.query.slice(0, 30)}{s.query.length > 30 ? '…' : ''}"
                </span>
                {s.reasoning && (
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                    ↳ {s.reasoning}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {msg.cards && msg.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          {msg.cards.slice(0, 5).map(c => (
            <CardSnippetCard key={c.id} card={c} onJump={onJump} />
          ))}
          {msg.cards.length > 5 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              +{msg.cards.length - 5} 张相关卡
            </div>
          )}
        </div>
      )}

      {msg.followUp && msg.followUp.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {msg.followUp.map((f, i) => (
            <button
              key={i}
              onClick={() => onFollowUp(f)}
              className="btn btn-sm"
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PulseDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 1.2s infinite' }} />
      <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 1.2s infinite 0.2s' }} />
      <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 1.2s infinite 0.4s' }} />
    </span>
  );
}

/**
 * 轻量内联 markdown 渲染：仅支持 **bold**，避免引入 marked/rehype 依赖
 * 每次流式 delta 重新解析，安全且轻量（< 1KB）
 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = text.split('\n');
  let k = 0;
  lines.forEach((line, lineIdx) => {
    const segs: ReactNode[] = [];
    const re = /\*\*([^*\n]+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) segs.push(line.slice(last, m.index));
      segs.push(
        <strong key={`b${k++}`} style={{ fontWeight: 600, color: 'var(--ink-1, #0f172a)' }}>
          {m[1]}
        </strong>
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) segs.push(line.slice(last));
    if (segs.length === 0) segs.push(line);
    nodes.push(<span key={`l${lineIdx}`}>{segs}</span>);
    if (lineIdx < lines.length - 1) {
      nodes.push(<br key={`br${lineIdx}`} />);
    }
  });
  return nodes;
}

function CardSnippetCard({ card, onJump }: { card: CardSnippet; onJump: () => void }) {
  return (
    <a
      href={`/assets/${card.id}`}
      onClick={onJump}
      style={{
        display: 'block', padding: '10px 12px',
        background: 'white', border: '1px solid var(--line)', borderRadius: 8,
        textDecoration: 'none', color: 'inherit',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span className={`pill pill-${card.evidenceLevel.toLowerCase()}`} style={{ fontSize: 10, padding: '1px 6px' }}>
          {card.evidenceLevel}
        </span>
        {card.priority && <span className={`pill pill-priority-${card.priority.toLowerCase()}`} style={{ fontSize: 10, padding: '1px 6px' }}>{card.priority}</span>}
        {card.topicNames.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {card.topicNames.slice(0, 2).join(' · ')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 2 }}>
        {card.title}
      </div>
      {card.oneSentenceInsight && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {card.oneSentenceInsight.length > 80 ? card.oneSentenceInsight.slice(0, 80) + '…' : card.oneSentenceInsight}
        </div>
      )}
    </a>
  );
}
