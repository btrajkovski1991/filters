import { authenticate } from "~/shopify.server";

const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CollectionProducts($handle: String!, $first: Int!) {
    collectionByHandle(handle: $handle) {
      products(first: $first) {
        nodes {
          handle
          vendor
          variants(first: 1) {
            nodes { price }
          }
        }
      }
    }
  }
`;

function okJson(data: any) {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function toNumber(v: string | null) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);

  const collectionHandle = url.searchParams.get("collectionHandle");
  const vendor = url.searchParams.get("vendor") || null;
  const minPrice = toNumber(url.searchParams.get("minPrice"));
  const maxPrice = toNumber(url.searchParams.get("maxPrice"));

  if (!collectionHandle) {
    return okJson({ ok: false, error: "Missing collectionHandle" });
  }

  try {
    // Validate proxy signature + get Admin client
    const { admin, session } = await authenticate.public.appProxy(request);

    const resp = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
      variables: { handle: collectionHandle, first: 250 },
    });

    const json = await resp.json();

    if (json.errors) {
      return okJson({ ok: false, step: "admin.graphql", errors: json.errors });
    }

    const nodes = json?.data?.collectionByHandle?.products?.nodes ?? [];

    const vendors = Array.from(new Set(nodes.map((p: any) => p.vendor).filter(Boolean))).sort();

    const filteredHandles = nodes
      .filter((p: any) => {
        const priceStr = p?.variants?.nodes?.[0]?.price;
        const price = priceStr != null ? Number(priceStr) : null;

        if (vendor && p.vendor !== vendor) return false;
        if (minPrice != null && (price == null || price < minPrice)) return false;
        if (maxPrice != null && (price == null || price > maxPrice)) return false;

        return true;
      })
      .map((p: any) => p.handle);

    return okJson({
      ok: true,
      marker: "FILTER_HANDLES_OK_V1",
      shop: session.shop,
      collectionHandle,
      sectionId: "main-collection",
      vendors,
      filteredHandles,
    });
  } catch (err: any) {
    return okJson({
      ok: false,
      marker: "FILTER_HANDLES_ERROR_V1",
      message: String(err?.message || err),
    });
  }
}