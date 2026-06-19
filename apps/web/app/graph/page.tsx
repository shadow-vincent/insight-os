import GraphClient from './GraphClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function GraphPage() {
  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">资产图谱</h1>
          <p className="page-subtitle">
            节点 = 资产 · 边 = 共享主题 · 颜色 = 证据等级 · 大小 = 反馈数 + 主题数
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/map" className="btn">列表视图</Link>
          <Link href="/assets" className="btn">资产库</Link>
        </div>
      </div>

      <GraphClient />
    </div>
  );
}
