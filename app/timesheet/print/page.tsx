export const dynamic = "force-dynamic";
import PrintReport from '@/components/timesheet/PrintReport';
import { requireApproved } from '@/lib/page-guards';
import { isAdmin } from '@/lib/api-auth';
import { redirect } from 'next/navigation';

export default async function TimesheetPrintPage() {
  const auth = await requireApproved();
  const allowed = isAdmin(auth.role) || auth.can_track_time === true;
  if (!allowed) redirect('/my-tasks');
  return <PrintReport />;
}
