import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "../site-url";

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("uses the explicitly configured canonical site URL first", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dev-fac-ia.vercel.app/");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "another-site.vercel.app");

    expect(getSiteUrl("http://localhost:3001")).toBe("https://dev-fac-ia.vercel.app");
  });

  it("uses Vercel's production domain if the canonical URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "dev-fac-ia.vercel.app");

    expect(getSiteUrl("http://localhost:3001")).toBe("https://dev-fac-ia.vercel.app");
  });

  it("uses the Vercel deployment URL for previews", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "devis-ia-git-feature.vercel.app");

    expect(getSiteUrl("http://localhost:3001")).toBe("https://devis-ia-git-feature.vercel.app");
  });

  it("uses the request origin locally and rejects localhost as a production fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(getSiteUrl("http://localhost:3001")).toBe("http://localhost:3001");

    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSiteUrl("http://localhost:3001")).toThrow(/localhost/);
  });
});
