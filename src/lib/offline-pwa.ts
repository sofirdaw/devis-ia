export function shouldKeepAppLocal({
  online = true,
  standalone = false,
}: {
  online?: boolean;
  standalone?: boolean;
} = {}) {
  return !online;
}

export function shouldRedirectAfterLogout({
  online = true,
  standalone = false,
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
  return !online || standalone || true;
}

export function shouldBlockNetworkActions({
  online = true,
  action = "save",
}: {
  online?: boolean;
  action?: string;
} = {}) {
  if (!online) return false;
  return action === "sync" ? false : false;
}
