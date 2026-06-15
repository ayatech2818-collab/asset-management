import { requireProfile } from "@/lib/dal";
import { AppShell } from "@/components/layout/AppShell";
import { RealtimeAlertToaster } from "@/components/alerts/RealtimeAlertToaster";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <>
      <AppShell profile={profile}>{children}</AppShell>
      <RealtimeAlertToaster />
    </>
  );
}
