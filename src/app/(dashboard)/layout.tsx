/**
 * Layout du groupe (dashboard) — Pages protégées avec sidebar
 * Utilise DashboardLayout qui gère la sidebar + le chargement du user
 */

import { DashboardLayout } from "@/components/layout";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
