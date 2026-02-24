import { unauthenticatedStorefront } from "~/shopify.server";

// If you prefer Remix json() you can, but Response.json is OK.

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);

    // ------------------------------------------------------------
    // 1) Ignore Shopify/theme section params that may be appended
    // ------------------------------------------------------------
    url.searchParams.delete("section_id");
    url.searchParams.delete("sections");
    url.searchParams.delete("path");

    // ------------------------------------------------------------
    // 2) Required params
    // ------------------------------------------------------------
    const collectionHandle = url.searchParams.get("collectionHandle");
    if (!collectionHandle) {
      return Response.json(
        { ok: false, message: "Missing collectionHandle" },
        { status: 400 }
      );
    }

    // Proxy usually passes ?shop=... but keep env fallback
    let shopDomain =
      url.searchParams.get("shop") ||
      process.env.SHOPIFY_STORE_DOMAIN ||
      "";

    if (!shopDomain) {
      return Response.json(
        { ok: false, message: "Missing shop domain" },
        { status: 400 }
      );
    }

    // Normalize shop domain (remove protocol if present)
    shopDomain = shopDomain
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .trim();

    // ------------------------------------------------------------
    // 3) Filters
    // ------------------------------------------------------------
    const vendor = url.searchParams.get("vendor");
    const tag = url.searchParams.get("tag");
    const type = url.searchParams.get("type");
    const color = url.searchParams.get("color");
    const size = url.searchParams.get("size");
    const minPriceRaw = url.searchParams.get("minPrice");
    const maxPriceRaw = url.searchParams.get("maxPrice");

    // Safe numeric parsing (avoid NaN in Storefront search)
    const minPrice =
      minPriceRaw != null && minPriceRaw !== ""
        ? Number(minPriceRaw)
        : null;
    const maxPrice =
      maxPriceRaw != null && maxPriceRaw !== ""
        ? Number(maxPriceRaw)
        : null;

    // Storefront search query supports:
    // vendor:, product_type:, tag:, price:>=, price:<=
    const terms: string[] = [];

    if (vendor) terms.push(`vendor:${escapeQuery(vendor)}`);
    if (type) terms.push(`product_type:${escapeQuery(type)}`);
    if (tag) terms.push(`tag:${escapeQuery(tag)}`);

    if (minPrice != null && Number.isFinite(minPrice))
      terms.push(`price:>=${minPrice}`);
    if (maxPrice != null && Number.isFinite(maxPrice))
      terms.push(`price:<=${maxPrice}`);

    const query = terms.length ? terms.join(" ") : null;

    const storefront = unauthenticatedStorefront(shopDomain);

    // ------------------------------------------------------------
    // 4) Fetch products
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // 5) Build facets + filtered handles
    // ------------------------------------------------------------
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

      // collect facet values
      for (const opt of options) {
        const n = normalize(opt?.name);
        const vals = Array.isArray(opt?.values) ? opt.values : [];
        if (n === "color" || n === "colour") vals.forEach((v) => colorsSet.add(String(v)));
        if (n === "size") vals.forEach((v) => sizesSet.add(String(v)));
      }

      // filter by color/size (done locally)
      let match = true;
      if (wantedColor) match = match && hasOptionValue(options, ["color", "colour"], wantedColor);
      if (wantedSize) match = match && hasOptionValue(options, ["size"], wantedSize);

      if (match && p.handle) filteredHandles.push(p.handle);
    }

    const facets = {
      vendors: sortAlpha([...vendorsSet]),
      tags: sortAlpha([...tagsSet]),
      types: sortAlpha([...typesSet]),
      colors: sortAlpha([...colorsSet]),
      sizes: sortAlpha([...sizesSet]),
    };

    return Response.json(
      {
        ok: true,
        marker: "FILTER_HANDLES_OK_V3",
        shop: shopDomain,
        collectionHandle,
        facets,

        // legacy keys (client supports both)
        vendors: facets.vendors,
        colors: facets.colors,
        sizes: facets.sizes,
        tags: facets.tags,
        types: facets.types,

        filteredHandles,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    // IMPORTANT: Storefront API errors commonly throw => avoid crashing into 500 w/ HTML
    console.error("[apps.filter.products] error:", err);

    return Response.json(
      {
        ok: false,
        message: err?.message || "Proxy loader failed",
      },
      { status: 500 }
    );
  }
}

// ------------------ helpers ------------------
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

// ------------------ GraphQL ------------------
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
