import { describe, expect, it } from "vitest";
import {
  hasOfflineSubscriptionAccess,
  shouldKeepAppLocal,
  shouldRedirectAfterLogout,
} from "../offline-pwa";

describe("PWA offline-first rules", () => {
  it("keeps the app local only when offline", () => {
    expect(shouldKeepAppLocal({ online: false, standalone: false })).toBe(true);
    expect(shouldKeepAppLocal({ online: true, standalone: true })).toBe(false);
    expect(shouldRedirectAfterLogout({ online: false, standalone: false })).toBe(false);
  });

  it("redirects to login when the app is online, including after PWA installation", () => {
    expect(shouldRedirectAfterLogout({ online: true, standalone: true })).toBe(true);
    expect(shouldRedirectAfterLogout({ online: true, standalone: false })).toBe(true);
  });

  it("allows offline access only until a valid active subscription or trial expires", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");

    expect(
      hasOfflineSubscriptionAccess({ status: "active", expiresAt: "2026-10-08T12:00:00.000Z" }, now)
    ).toBe(true);
    expect(
      hasOfflineSubscriptionAccess({ status: "active", expiresAt: "2026-10-07T12:00:00.000Z" }, now)
    ).toBe(false);
    expect(
      hasOfflineSubscriptionAccess(
        { status: "trial", trialEndsAt: "2026-10-08T12:00:00.000Z" },
        now
      )
    ).toBe(true);
    expect(
      hasOfflineSubscriptionAccess(
        { status: "suspended", expiresAt: "2026-10-08T12:00:00.000Z" },
        now
      )
    ).toBe(false);
  });
});
