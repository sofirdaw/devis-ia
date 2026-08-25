import { describe, expect, it } from "vitest";
import { shouldKeepAppLocal, shouldRedirectAfterLogout } from "../offline-pwa";

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
});
