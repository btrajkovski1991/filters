// app/routes/apps.filter.products.ts
import { unauthenticatedStorefrontClient } from "~/shopify.server";

function okJson(data: any) {
  // ✅ Always 200 so Shopify App Proxy doesn't replace body with HTML on errors
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeShopDomain(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) return new URL(s).host;
  } catch {}
  return s.replace(/^\/+|\/+$/g, "");
}

function inferShopDomain(request: Request, url: URL) {
  // Try headers first
  const headerShop =
    request.headers.get("x-shopify-shop-domain") ||
    request.headers.get("X-Shopify-Shop-Domain");

  // Then query param
  const qpShop = url.searchParams.get("shop");

  // Then env fallback (best for direct Render testing)
  const envShop = process.env.SHOPIFY_STORE_DOMAIN;

  const candidate = headerShop || qpShop || envShop || "";
  return normalizeShopDomain(candidate);
}

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);

    // ignore theme hydration noise
    url.searchParams.delete("section_id");
    url.searchParams.delete("sections");
    url.searchParams.delete("path");

    const collectionHandle = url.searchParams.get("collectionHandle");
    if (!collectionHandle) {
      return okJson({ ok: false, message: "Missing collectionHandle" });
    }

    const shopDomain = inferShopDomain(request, url);
    if (!shopDomain) {
      return okJson({
        ok: false,
        message:
          "Missing shop domain (no X-Shopify-Shop-Domain header, no ?shop=, and no SHOPIFY_STORE_DOMAIN env)",
      });
    }

    // ✅ Option 2: use your new helper from shopify.server.ts
    const storefront = unauthenticatedStorefrontClient(shopDomain);

    // ---- filters
    const vendor = url.searchParams.get("vendor");
    const tag = url.searchParams.get("tag");
    const type = url.searchParams.get("type");
    const color = url.searchParams.get("color");
    const size = url.searchParams.get("size");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");

    const terms: string[] = [];
    if (vendor) terms.push(`vendor:${escapeQuery(vendor)}`);
    if (type) terms.push(`product_type:${escapeQuery(type)}`);
    if (tag) terms.push(`tag:${escapeQuery(tag)}`);

    const minN = minPrice !== null && minPrice !== "" ? Number(minPrice) : null;
    const maxN = maxPrice !== null && maxPrice !== "" ? Number(maxPrice) : null;
    if (minN != null && Number.isFinite(minN)) terms.push(`price:>=${minN}`);
    if (maxN != null && Number.isFinite(maxN)) terms.push(`price:<=${maxN}`);

    const query = terms.length ? terms.join(" ") : null;

    // ✅ IMPORTANT: /collections/all is not a real collection handle in APIs
    let products: any[] = [];
    if (collectionHandle === "all") {
      const data = await storefront.query(ALL_PRODUCTS_QUERY, {
        variables: { first: 250, query },
      });
      products = data?.products?.nodes ?? [];
    } else {
      const data = await storefront.query(PRODUCTS_IN_COLLECTION_QUERY, {
        variables: { collectionHandle, first: 250, query },
      });
      products = data?.collection?.products?.nodes ?? [];
    }

    // ---- facets + handles
    const vendorsSet = new Set<string>();
    const tagsSet = new Set<string>();
    const typesSet = new Set<string>();
    const colorsSet = new Set<string>();
    const sizesSet = new Set<string>();

    const wantedColor = normalize(color);
    const wantedSize = normalize(size);

    const filteredHandles: string[] = [];

    for (const p of products) {
      if (!p) continue;

      if (p.vendor) vendorsSet.add(String(p.vendor));
      if (p.productType) typesSet.add(String(p.productType));
      if (Array.isArray(p.tags)) p.tags.forEach((t: any) => tagsSet.add(String(t)));

      const options: Array<{ name: string; values: string[] }> = Array.isArray(p.options)
        ? p.options
        : [];

      for (const opt of options) {
        const n = normalize(opt?.name);
        const vals = Array.isArray(opt?.values) ? opt.values : [];
        if (n === "color" || n === "colour") vals.forEach((v) => colorsSet.add(String(v)));
        if (n === "size") vals.forEach((v) => sizesSet.add(String(v)));
      }

      let match = true;
      if (wantedColor) match = match && hasOptionValue(options, ["color", "colour"], wantedColor);
      if (wantedSize) match = match && hasOptionValue(options, ["size"], wantedSize);

      if (match) filteredHandles.push(p.handle);
    }

    const facets = {
      vendors: sortAlpha([...vendorsSet]),
      tags: sortAlpha([...tagsSet]),
      types: sortAlpha([...typesSet]),
      colors: sortAlpha([...colorsSet]),
      sizes: sortAlpha([...sizesSet]),
    };

    return okJson({
      ok: true,
      marker: "FILTER_HANDLES_OK_V4",
      shop: shopDomain,
      collectionHandle,
      facets,

      // legacy keys
      vendors: facets.vendors,
      colors: facets.colors,
      sizes: facets.sizes,
      tags: facets.tags,
      types: facets.types,

      filteredHandles,
    });
  } catch (err: any) {
    console.error("[apps.filter.products] error:", err);

    // ✅ always 200 JSON
    return okJson({
      ok: false,
      marker: "FILTER_HANDLES_ERROR_V4",
      message: err?.message || String(err),
    });
  }
}

// helpers
function normalize(v: any) {
  return (v ?? "").toString().trim().toLowerCase();
}
function sortAlpha(arr: string[]) {
  return arr
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
function escapeQuery(v: string) {
  const s = String(v).trim();
  if (/[ :"]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}
function hasOptionValue(
  options: Array<{ name: string; values: string[] }>,
  names: string[],
  wanted: string
) {
  const wantedNorm = normalize(wanted);
  for (const opt of options) {
    const nameNorm = normalize(opt?.name);
    if (!names.includes(nameNorm)) continue;
    const vals = Array.isArray(opt?.values) ? opt.values : [];
    if (vals.some((v) => normalize(v) === wantedNorm)) return true;
  }
  return false;
}

// GraphQL
const PRODUCT_FIELDS = `
  handle
  vendor
  productType
  tags
  options { name values }
`;

const ALL_PRODUCTS_QUERY = `#graphql
query AllProducts($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    nodes { ${PRODUCT_FIELDS} }
  }
}
`;

const PRODUCTS_IN_COLLECTION_QUERY = `#graphql
query ProductsInCollection($collectionHandle: String!, $first: Int!, $query: String) {
  collection(handle: $collectionHandle) {
    products(first: $first, query: $query) {
      nodes { ${PRODUCT_FIELDS} }
    }
  }
}
`;
