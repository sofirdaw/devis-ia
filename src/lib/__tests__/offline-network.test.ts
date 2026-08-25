import { describe, expect, it } from "vitest";
import { shouldAllowOfflineNavigation, shouldBlockNetworkActions } from "../offline-pwa";

describe("offline network rules", () => {
  it("keeps app navigation usable offline", () => {
    expect(shouldAllowOfflineNavigation({ online: false, standalone: true })).toBe(true);
    expect(shouldAllowOfflineNavigation({ online: false, standalone: false })).toBe(true);
  });

  it("blocks only the actions that definitely require connectivity", () => {
    expect(shouldBlockNetworkActions({ online: false, action: "save" })).toBe(false);
    expect(shouldBlockNetworkActions({ online: false, action: "sync" })).toBe(false);
    expect(shouldBlockNetworkActions({ online: true, action: "sync" })).toBe(false);
  });
});
