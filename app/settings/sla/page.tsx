export const dynamic = 'force-dynamic';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { requireAdmin } from '@/lib/page-guards';
import { query } from '@/lib/db';
import SlaPoliciesSettings, {
  type SlaPolicy,
} from '@/components/settings/SlaPoliciesSettings';

export default async function SlaSettingsPage() {
  const auth = await requireAdmin();

  const result = await query<SlaPolicy>(
    `SELECT id, workspace_id, priority, hours_to_resolve, alert_hours_before,
            enabled, updated_at
     FROM sla_policies
     WHERE workspace_id = $1
     ORDER BY
       CASE priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END`,
    [auth.workspace_id]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-8 space-y-2">
              <p className="page-eyebrow">Workspace · Configurações</p>
              <h1 className="page-title">
                Políticas de <span className="em">SLA.</span>
              </h1>
            </div>
            <SlaPoliciesSettings initialPolicies={result.rows} />
          </div>
        </main>
      </div>
    </div>
  );
}
