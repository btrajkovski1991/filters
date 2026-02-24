import "@shopify/shopify-app-remix/server/adapters/node";
import { ApiVersion, shopifyApp } from "@shopify/shopify-app-remix/server";
import type { LoginError } from "@shopify/shopify-app-remix/server";
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

  // ✅ OK for now (but resets on restart)
  sessionStorage: new MemorySessionStorage(),
});

export default shopify;

// ✅ Used by many routes
export const authenticate = shopify.authenticate;

// ✅ Used by root/entry templates
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;

// ✅ Used by auth.login route
export async function login(request: Request): Promise<LoginError> {
  return shopify.login(request);
}

// ---- helpers ----
function normalizeShopDomain(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) return new URL(s).host;
  } catch {}
  return s.replace(/^\/+|\/+$/g, "");
}

function getStorefrontToken() {
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!token) throw new Error("Missing SHOPIFY_STOREFRONT_TOKEN");
  return token;
}

// ---- Storefront helper (token passed in) ----
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

// ✅ Back-compat export some routes may expect (object form)
export const unauthenticatedStorefront = {
  storefront: ({ shop }: { shop: string }) => {
    const domain = normalizeShopDomain(shop);
    if (!domain) throw new Error("Missing shop domain");

    return createStorefrontApiClient({
      storeDomain: domain,
      publicAccessToken: getStorefrontToken(),
      apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01",
    });
  },
};

// ✅ NEW: easy function form (so routes can do unauthenticatedStorefrontClient(shopDomain))
export function unauthenticatedStorefrontClient(shopDomain: string) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) throw new Error("Missing shop domain");

  return createStorefrontApiClient({
    storeDomain: domain,
    publicAccessToken: getStorefrontToken(),
    apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01",
  });
}
