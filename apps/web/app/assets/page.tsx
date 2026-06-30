import { getDb, assets } from '@insight-os/db';
import { desc, ne } from 'drizzle-orm';
import AssetsPageClient from './AssetsPageClient';

export const dynamic = 'force-dynamic';

export default function AssetsPage() {
  const db = getDb();
  // V1.10: server 没 SQLite → 让 client 从 IndexedDB 读
  if (!db) return <AssetsPageClient all={[]} />;
  type AssetRow = typeof assets.$inferSelect;
  // 资产库只显示正式资产卡（type=asset），light 卡在候选池
  const all = db.select().from(assets)
    .where(ne(assets.type, 'light'))
    .orderBy(desc(assets.updatedAt))
    .all() as AssetRow[];
  return <AssetsPageClient all={all} />;
}
