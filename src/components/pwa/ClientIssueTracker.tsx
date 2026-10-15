"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  discardOtherUsersEvents,
  flushClientEvents,
  reportClientEvent,
} from "@/lib/client-issue-tracker";
import { useAuthStore } from "@/store/auth.store";

export function ClientIssueTracker() {
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.user?.id);
  const companyId = useAuthStore((state) => state.company?.id);

  useEffect(() => {
    if (!userId || !companyId) return;
    discardOtherUsersEvents(userId);
    reportClientEvent(userId, "session_started");

    const handleError = (event: ErrorEvent) =>
      reportClientEvent(
        userId,
        "runtime_error",
        event.error instanceof Error ? event.error.name : "RuntimeError"
      );
    const handleRejection = (event: PromiseRejectionEvent) =>
      reportClientEvent(
        userId,
        "unhandled_rejection",
        event.reason instanceof Error ? event.reason.name : "UnhandledRejection"
      );
    const handleOffline = () => reportClientEvent(userId, "connection_lost");
    const handleOnline = () => {
      reportClientEvent(userId, "connection_restored");
      void flushClientEvents(userId);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    void flushClientEvents(userId);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [companyId, userId]);

  useEffect(() => {
    if (userId && companyId) reportClientEvent(userId, "page_view");
  }, [companyId, pathname, userId]);

  return null;
}
