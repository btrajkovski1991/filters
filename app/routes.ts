import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  route("auth/:", "routes/auth.$.tsx"),
  route("auth/login", "routes/auth.login/route.tsx"),

  layout("routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("app/additional", "routes/app.additional.tsx"),
  ]),

  // App proxy endpoints
  route("proxy", "routes/proxy.ts"),
  route("proxy/products", "routes/proxy.products.ts"),
] satisfies RouteConfig;