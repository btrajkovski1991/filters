import "@shopify/shopify-app-remix/server/adapters/node";
import { ApiVersion, shopifyApp } from "@shopify/shopify-app-remix/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";

import { createStorefrontApiClient } from "@shopify/storefront-api-client";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  appUrl: process.env.SHOPIFY_APP_URL!,
  scopes: (process.env.SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  apiVersion: ApiVersion.January25,

  // ✅ REQUIRED
  sessionStorage: new MemorySessionStorage(),
});

export default shopify;

export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

// ---- Storefront helper ----
function normalizeShopDomain(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) return new URL(s).host;
  } catch {}
  return s.replace(/^\/+|\/+$/g, "");
}

export function shopifyStorefront(shopDomain: string, accessToken: string) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) throw new Error("Missing SHOPIFY_STORE_DOMAIN");
  if (!accessToken) throw new Error("Missing SHOPIFY_STOREFRONT_TOKEN");

  return createStorefrontApiClient({
    storeDomain: domain,
    publicAccessToken: accessToken,
    apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01",
  });
}