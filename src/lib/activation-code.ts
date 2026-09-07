import "server-only";
import { createHmac, randomInt } from "node:crypto";

const activationSecret =
  process.env.ACTIVATION_CODE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "development-activation-secret";

export function generateActivationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashActivationCode(code: string) {
  return createHmac("sha256", activationSecret).update(code).digest("hex");
}
