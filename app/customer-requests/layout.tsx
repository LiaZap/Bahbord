import { requireAdmin } from '@/lib/page-guards';

export default async function CustomerRequestsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
