import GraphClient from './GraphClient';

export const dynamic = 'force-dynamic';

export default function GraphPage() {
  return (
    <div className="page-container">
      <GraphClient />
    </div>
  );
}