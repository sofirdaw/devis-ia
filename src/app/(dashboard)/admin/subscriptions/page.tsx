import { redirect } from "next/navigation";
import { AdminSubscriptionRequests } from "@/components/subscription/AdminSubscriptionRequests";
import { AdminSubscriptionControl } from "@/components/subscription/AdminSubscriptionControl";
import { isCurrentUserAdmin } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  if (!(await isCurrentUserAdmin())) redirect("/dashboard");

  return (
    <main className="page-container space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Administration
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-950">Suivi des clients et abonnements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Consultez les dossiers clients, l’activité, les incidents et les paiements.
        </p>
      </div>
      <AdminSubscriptionRequests />
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Contrôle des accès</h2>
          <p className="text-sm text-gray-500">Suspendez ou réactivez immédiatement un compte.</p>
        </div>
        <AdminSubscriptionControl />
      </section>
    </main>
  );
}
