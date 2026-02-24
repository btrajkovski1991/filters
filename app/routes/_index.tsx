// app/routes/_index/route.tsx

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // 👇 THIS is the important part
  return redirect("/app");
};

export default function Index() {
  return null;
}