import { shopifyStorefront } from "~/shopify.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);

  const collectionHandle = url.searchParams.get("collectionHandle");
  if (!collectionHandle) {
    return Response.json({ ok: false, message: "Missing collectionHandle" }, { status: 400 });
  }

  const shopDomain =
    url.searchParams.get("shop") ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    "";

  if (!shopDomain) {
    return Response.json({ ok: false, message: "Missing shop domain" }, { status: 400 });
  }

  const vendor = url.searchParams.get("vendor");
  const tag = url.searchParams.get("tag");
  const type = url.searchParams.get("type");
  const color = url.searchParams.get("color");
  const size = url.searchParams.get("size");
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");

  // Build Storefront search query (Shopify syntax)
  const terms: string[] = [];
  if (vendor) terms.push(`vendor:${escapeQuery(vendor)}`);
  if (type) terms.push(`product_type:${escapeQuery(type)}`);
  if (tag) terms.push(`tag:${escapeQuery(tag)}`);
  if (minPrice) terms.push(`price:>=${Number(minPrice)}`);
  if (maxPrice) terms.push(`price:<=${Number(maxPrice)}`);

  const query = terms.length ? terms.join(" ") : null;

  // ✅ Create Storefront client using your exported helper

const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

if (!token) {
  return Response.json(
    { ok: false, message: "Missing SHOPIFY_STOREFRONT_TOKEN" },
    { status: 500 }
  );
}

const storefront = shopifyStorefront(shopDomain, token);



  // ✅ /collections/all support
  let products: any[] = [];
  if (collectionHandle === "all") {
    const data: any = await storefront.request(ALL_PRODUCTS_QUERY, {
      variables: { first: 250, query },
    });
    products = data?.products?.nodes ?? [];
  } else {
    const data: any = await storefront.request(PRODUCTS_IN_COLLECTION_QUERY, {
      variables: { collectionHandle, first: 250, query },
    });
    products = data?.collection?.products?.nodes ?? [];
  }

  // Facets
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

    // Collect facet values
    for (const opt of options) {
      const n = normalize(opt?.name);
      const vals = Array.isArray(opt?.values) ? opt.values : [];
      if (n === "color" || n === "colour") vals.forEach((v) => colorsSet.add(String(v)));
      if (n === "size") vals.forEach((v) => sizesSet.add(String(v)));
    }

    // Filter by color/size (Storefront query doesn't reliably filter option values)
    let match = true;
    if (wantedColor) match = match && hasOptionValue(options, ["color", "colour"], wantedColor);
    if (wantedSize) match = match && hasOptionValue(options, ["size"], wantedSize);

    if (match) filteredHandles.push(p.handle);
  }

  const facets = {
    vendors: sortAlpha([...vendorsSet]),
    colors: sortAlpha([...colorsSet]),
    sizes: sortAlpha([...sizesSet]),
    tags: sortAlpha([...tagsSet]),
    types: sortAlpha([...typesSet]),
  };

  return Response.json({
    ok: true,
    marker: "FILTER_HANDLES_OK_V3",
    shop: shopDomain,
    collectionHandle,
    facets,
    filteredHandles,
  });
}

// ---------------- helpers ----------------
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

// ---------------- GraphQL ----------------
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