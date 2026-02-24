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

  // ✅ For now (sessions reset on restart). Later switch to Prisma/Postgres.
  sessionStorage: new MemorySessionStorage(),
});

export default shopify;

// ✅ Needed by your routes
export const authenticate = shopify.authenticate;

// ✅ Used by entry/root in many templates
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

// ---- helpers ----
function normalizeShopDomain(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) return new URL(s).host;
  } catch {}
  return s.replace(/^\/+|\/+$/g, "");
}

// ---- Storefront helper (authenticated via token you pass in) ----
export function shopifyStorefront(shopDomain: string, accessToken: string) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) throw new Error("Missing shop domain");
  if (!accessToken) throw new Error("Missing Storefront access token");

  return createStorefrontApiClient({
    storeDomain: domain,
    publicAccessToken: accessToken,
    apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01",
  });
}

/**
 * ✅ Some routes expect `unauthenticatedStorefront.storefront({ shop })`
 * This uses env SHOPIFY_STOREFRONT_TOKEN.
 */
export const unauthenticatedStorefront = {
  storefront: ({ shop }: { shop: string }) => {
    const domain = normalizeShopDomain(shop);
    if (!domain) throw new Error("Missing shop domain");

    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
    if (!token) throw new Error("Missing SHOPIFY_STOREFRONT_TOKEN");

    return createStorefrontApiClient({
      storeDomain: domain,
      publicAccessToken: token,
      apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01",
    });
  },
};
