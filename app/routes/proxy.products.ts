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

function okJson(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
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

  // ✅ ignore theme hydration noise
  url.searchParams.delete("section_id");
  url.searchParams.delete("sections");
  url.searchParams.delete("path");

  const collectionHandle = url.searchParams.get("collectionHandle");
  const vendor = url.searchParams.get("vendor") || null;
  const minPrice = toNumber(url.searchParams.get("minPrice"));
  const maxPrice = toNumber(url.searchParams.get("maxPrice"));

  if (!collectionHandle) {
    return okJson({ ok: false, error: "Missing collectionHandle" }, 400);
  }

  try {
    const auth = await authenticate.public.appProxy(request);
    const admin = auth?.admin;
    const session = auth?.session;

    // ✅ guard: do NOT call admin.graphql if admin missing
    if (!admin) {
      return okJson(
        {
          ok: false,
          marker: "FILTER_HANDLES_ERROR_V1",
          message:
            "App proxy auth did not provide an admin client. This usually means the request is not a valid signed App Proxy request (missing signature params) or proxy URL/subpath mismatch.",
        },
        500
      );
    }

    const resp = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
      variables: { handle: collectionHandle, first: 250 },
    });

    const json = await resp.json();

    if (json.errors) {
      return okJson({ ok: false, step: "admin.graphql", errors: json.errors }, 500);
    }

    const nodes = json?.data?.collectionByHandle?.products?.nodes ?? [];

    const vendors = Array.from(
      new Set(nodes.map((p: any) => p?.vendor).filter(Boolean))
    ).sort();

    const filteredHandles = nodes
      .filter((p: any) => {
        const priceStr = p?.variants?.nodes?.[0]?.price;
        const price = priceStr != null ? Number(priceStr) : null;

        if (vendor && p?.vendor !== vendor) return false;
        if (minPrice != null && (price == null || price < minPrice)) return false;
        if (maxPrice != null && (price == null || price > maxPrice)) return false;

        return true;
      })
      .map((p: any) => p?.handle)
      .filter(Boolean);

    return okJson({
      ok: true,
      marker: "FILTER_HANDLES_OK_V1",
      shop: session?.shop,
      collectionHandle,
      vendors,
      filteredHandles,
    });
  } catch (err: any) {
    return okJson(
      {
        ok: false,
        marker: "FILTER_HANDLES_ERROR_V1",
        message: String(err?.message || err),
      },
      500
    );
  }
}
