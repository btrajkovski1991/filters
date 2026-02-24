import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>🍋 Lemon Filters App</h1>
      <p style={{ marginBottom: 24 }}>If you see this, /app route works.</p>
      <Outlet />
    </div>
  );
}