const DEFAULT_SITE_URL = "http://localhost:3000";

function asHttpsUrl(hostOrUrl: string): string {
  return new URL(hostOrUrl.includes("://") ? hostOrUrl : `https://${hostOrUrl}`).origin;
}

export function getSiteUrl(requestOrigin?: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  const deploymentHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (deploymentHost) {
    return asHttpsUrl(deploymentHost);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (requestOrigin) {
    const origin = new URL(requestOrigin).origin;
    const hostname = new URL(origin).hostname;
    if (
      process.env.NODE_ENV === "production" &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname)
    ) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL doit être configurée pour empêcher une redirection OAuth vers localhost."
      );
    }
    return origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL doit être configurée en production.");
  }

  return DEFAULT_SITE_URL;
}
