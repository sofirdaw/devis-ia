import { PLANS, type PlanId } from "@/lib/subscription";

const ORANGE_TOKEN_URL = process.env.ORANGE_MONEY_TOKEN_URL;
const ORANGE_PAYMENT_URL = process.env.ORANGE_MONEY_PAYMENT_URL;

export function isOrangeMoneyConfigured() {
  return Boolean(
    ORANGE_TOKEN_URL &&
    ORANGE_PAYMENT_URL &&
    process.env.ORANGE_MONEY_CLIENT_ID &&
    process.env.ORANGE_MONEY_CLIENT_SECRET &&
    process.env.ORANGE_MONEY_MERCHANT_KEY
  );
}

export async function createOrangeMoneyPayment(input: {
  plan: PlanId;
  orderId: string;
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
}) {
  if (!isOrangeMoneyConfigured()) {
    throw new Error("Le paiement Orange Money n'est pas encore configuré.");
  }

  const credentials = Buffer.from(
    `${process.env.ORANGE_MONEY_CLIENT_ID}:${process.env.ORANGE_MONEY_CLIENT_SECRET}`
  ).toString("base64");
  const tokenResponse = await fetch(ORANGE_TOKEN_URL!, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Orange Money token error (${tokenResponse.status}).`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Token Orange Money manquant.");

  const plan = PLANS[input.plan];
  const response = await fetch(ORANGE_PAYMENT_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
      currency: process.env.ORANGE_MONEY_CURRENCY || "XOF",
      order_id: input.orderId,
      amount: plan.price,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      notif_url: input.notificationUrl,
      lang: "fr",
      reference: `Abonnement ${plan.label}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Orange Money payment error (${response.status}).`);
  }

  const data = (await response.json()) as {
    payment_url?: string;
    payment_token?: string;
    pay_token?: string;
  };
  if (!data.payment_url) throw new Error("URL de paiement Orange Money manquante.");

  return {
    paymentUrl: data.payment_url,
    paymentToken: data.payment_token || data.pay_token || null,
  };
}
