import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getDb } from "@/db";
import { StoreProvider } from "@/lib/store";
import { loadSnapshotWithTime } from "@/server/data";
import { getCurrentUser, getMe } from "@/server/session";
import { NoCompany } from "@/components/auth/no-company";

/** Everything inside requires a login. Data is loaded here once, on the server. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const me = await getMe();
  if (!me) return <NoCompany email={user.email} />;

  const { data, loadedAt } = await loadSnapshotWithTime(getDb(), me.companyId);
  return (
    <StoreProvider
      initialData={data}
      loadedAt={loadedAt}
      me={{ id: me.id, name: me.name, email: me.email, role: me.role, companyName: me.companyName }}
    >
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
