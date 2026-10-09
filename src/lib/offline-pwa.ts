export function shouldKeepAppLocal({
  online = true,
}: {
  online?: boolean;
  standalone?: boolean;
} = {}) {
  return !online;
}

export function shouldRedirectAfterLogout({
  online = true,
}: {
  online?: boolean;
  standalone?: boolean;
} = {}) {
  return online;
}

export function shouldAllowOfflineNavigation({
  online = true,
  standalone = false,
}: {
  online?: boolean;
  standalone?: boolean;
} = {}) {
  return !online || standalone;
}

export function shouldBlockNetworkActions({
  online = true,
  action = "save",
}: {
  online?: boolean;
  action?: string;
} = {}) {
  if (online) return false;
  return ["ai", "payment", "subscription", "sync"].includes(action);
}

export function hasOfflineSubscriptionAccess(
  subscription: {
    status?: string | null;
    expiresAt?: string | null;
    trialEndsAt?: string | null;
  },
  now = new Date()
): boolean {
  if (subscription.status === "suspended") return false;

  const expiry =
    subscription.status === "active"
      ? subscription.expiresAt
      : subscription.status === "trial"
        ? subscription.trialEndsAt
        : null;

  if (!expiry) return false;
  const expiryTime = new Date(expiry).getTime();
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}
