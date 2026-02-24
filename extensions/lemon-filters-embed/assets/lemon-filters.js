// lemon-filters.js (FULL UPDATED)

// -----------------------------
// Basics / helpers
// -----------------------------
function getResultsList() {
  return document.querySelector("results-list");
}

function getSectionIdFromResultsList(rl) {
  // Horizon stores the actual section id here:
  // section-id="template--...__main"
  return rl?.getAttribute("section-id") || null;
}

function setLoading(isLoading) {
  const html = document.documentElement;
  if (isLoading) {
    html.classList.add("lemon-filter-loading");
    html.classList.remove("lemon-filter-ready");
  } else {
    html.classList.remove("lemon-filter-loading");
    html.classList.add("lemon-filter-ready");
  }
}

setLoading(false);

const rl = getResultsList();
const sectionId = getSectionIdFromResultsList(rl);

console.log("[LemonFilters] results-list:", rl);
console.log("[LemonFilters] sectionId:", sectionId);

(function () {
  const root = document.querySelector("[data-lemon-filters]");
  if (!root) return;

  // Only run on /collections/*
  if (!window.location.pathname.startsWith("/collections/")) return;

  const parts = window.location.pathname.split("/").filter(Boolean);
  const collectionHandle = parts[0] === "collections" ? parts[1] : null;
  if (!collectionHandle) return;

  // -----------------------------
  // Grid detection (Horizon)
  // -----------------------------
  function getGrid() {
    return (
      document.querySelector('ul[data-testid="product-grid"]') ||
      document.querySelector("#product-grid") ||
      document.querySelector("ul.product-grid") ||
      document.querySelector(".product-grid") ||
      document.querySelector("ul.grid")
    );
  }

  let grid = getGrid();
  if (!grid) {
    console.warn("[LemonFilters] Could not find product grid");
    return;
  }

  const resultsList =
    grid.closest("results-list") || document.querySelector("results-list");

  // ---- Place filters near theme filters on desktop, fallback to wrapper ----
  function getDesktopMount() {
    return (
      document.querySelector(".facets-wrapper") ||
      document.querySelector("facet-filters-form") ||
      document.querySelector("#main-collection-filters") ||
      document.querySelector(".collection-filters") ||
      document.querySelector(".collection__filters")
    );
  }

  function ensureLayout() {
    const desktopMount = getDesktopMount();
    if (desktopMount) {
      if (!desktopMount.contains(root)) desktopMount.prepend(root);
      root.classList.remove("hidden", "md:hidden", "lg:hidden");
      root.style.display = "block";
      return;
    }

    // fallback: wrap root + grid parent
    const wrapTarget = grid.closest(".collection-wrapper") || grid.parentElement;
    if (!wrapTarget || !wrapTarget.parentElement) return;

    if (!wrapTarget.parentElement.classList.contains("lemon-filters-layout")) {
      const layout = document.createElement("div");
      layout.className = "lemon-filters-layout";
      wrapTarget.parentElement.insertBefore(layout, wrapTarget);
      layout.appendChild(root);
      layout.appendChild(wrapTarget);
    }

    root.classList.remove("hidden", "md:hidden", "lg:hidden");
    root.style.display = "block";
  }

  ensureLayout();

  // -----------------------------
  // UI (Dropdowns)
  // -----------------------------
  root.innerHTML = `
    <aside class="lemon-filters" aria-label="Product filters">
      <div class="lemon-filters__row">
        <div class="lemon-filters__group">
          <label class="lemon-filters__label">Color</label>
          <select class="lemon-filters__select" data-color>
            <option value="">All</option>
          </select>
        </div>

        <div class="lemon-filters__group">
          <label class="lemon-filters__label">Size</label>
          <select class="lemon-filters__select" data-size>
            <option value="">All</option>
          </select>
        </div>

        <div class="lemon-filters__group">
          <label class="lemon-filters__label">Vendor</label>
          <select class="lemon-filters__select" data-vendor>
            <option value="">All</option>
          </select>
        </div>

        <div class="lemon-filters__group">
          <label class="lemon-filters__label">Tag</label>
          <select class="lemon-filters__select" data-tag>
            <option value="">All</option>
          </select>
        </div>

        <div class="lemon-filters__group">
          <label class="lemon-filters__label">Type</label>
          <select class="lemon-filters__select" data-type>
            <option value="">All</option>
          </select>
        </div>
      </div>

      <div class="lemon-filters__row lemon-filters__row--bottom">
        <div class="lemon-filters__group lemon-filters__group--price">
          <label class="lemon-filters__label">Price</label>
          <div class="lemon-filters__price">
            <input class="lemon-filters__input" data-min type="number" min="0" inputmode="numeric" placeholder="Min" />
            <input class="lemon-filters__input" data-max type="number" min="0" inputmode="numeric" placeholder="Max" />
            <button class="lemon-filters__button" data-apply type="button">Apply</button>
          </div>
        </div>

        <div class="lemon-filters__group lemon-filters__group--actions">
          <button class="lemon-filters__button lemon-filters__button--secondary" data-clear type="button">
            Clear
          </button>
        </div>
      </div>
    </aside>
  `;

  const colorSelect = root.querySelector("[data-color]");
  const sizeSelect = root.querySelector("[data-size]");
  const vendorSelect = root.querySelector("[data-vendor]");
  const tagSelect = root.querySelector("[data-tag]");
  const typeSelect = root.querySelector("[data-type]");

  const minEl = root.querySelector("[data-min]");
  const maxEl = root.querySelector("[data-max]");
  const applyBtn = root.querySelector("[data-apply]");
  const clearBtn = root.querySelector("[data-clear]");

  // -----------------------------
  // Helpers
  // -----------------------------
  function normalizeOpt(v) {
    return (v ?? "").toString().trim();
  }

  function resetSelectToAll(selectEl) {
    if (!selectEl) return;
    selectEl.value = "";
  }

  function setSelectOptions(selectEl, values) {
    if (!selectEl) return;
    if (!Array.isArray(values)) return;

    const currentValue = selectEl.value;

    // keep first option ("All"), then rebuild unique list
    const keepFirst = selectEl.options[0]
      ? selectEl.options[0].cloneNode(true)
      : null;
    selectEl.innerHTML = "";
    if (keepFirst) selectEl.appendChild(keepFirst);

    const seen = new Set([""]);
    values
      .map(normalizeOpt)
      .filter(Boolean)
      .forEach((v) => {
        if (seen.has(v)) return;
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        selectEl.appendChild(opt);
        seen.add(v);
      });

    // restore selection if still present
    if (
      currentValue &&
      Array.from(selectEl.options).some((o) => o.value === currentValue)
    ) {
      selectEl.value = currentValue;
    } else {
      selectEl.value = "";
    }
  }

  // --- Professional URL (shareable), no page= ---
  function buildPrettyUrlParams() {
    const p = new URLSearchParams();

    const color = normalizeOpt(colorSelect?.value);
    const size = normalizeOpt(sizeSelect?.value);
    const vendor = normalizeOpt(vendorSelect?.value);
    const tag = normalizeOpt(tagSelect?.value);
    const type = normalizeOpt(typeSelect?.value);

    if (vendor) p.set("vendor", vendor);
    if (color) p.set("color", color);
    if (size) p.set("size", size);
    if (tag) p.set("tag", tag);
    if (type) p.set("type", type);

    if (minEl?.value) p.set("min", String(minEl.value));
    if (maxEl?.value) p.set("max", String(maxEl.value));

    p.delete("page");
    return p;
  }

  function syncUrl({ mode = "replace" } = {}) {
    const url = new URL(window.location.href);
    const pretty = buildPrettyUrlParams();
    url.search = pretty.toString() ? `?${pretty.toString()}` : "";

    if (mode === "push")
      history.pushState({ lemonFilters: true }, "", url.toString());
    else history.replaceState({ lemonFilters: true }, "", url.toString());
  }

  function applyUrlToUI() {
    const url = new URL(window.location.href);
    const p = url.searchParams;

    const setIfExists = (selectEl, key) => {
      if (!selectEl) return;
      selectEl.value = p.get(key) || "";
    };

    setIfExists(vendorSelect, "vendor");
    setIfExists(colorSelect, "color");
    setIfExists(sizeSelect, "size");
    setIfExists(tagSelect, "tag");
    setIfExists(typeSelect, "type");

    if (minEl) minEl.value = p.get("min") || "";
    if (maxEl) maxEl.value = p.get("max") || "";
  }

  // Backend query builder (map URL min/max -> backend minPrice/maxPrice)
  function buildFilterQuery() {
    const params = new URLSearchParams();
    params.set("collectionHandle", collectionHandle);

    const color = normalizeOpt(colorSelect?.value);
    const size = normalizeOpt(sizeSelect?.value);
    const vendor = normalizeOpt(vendorSelect?.value);
    const tag = normalizeOpt(tagSelect?.value);
    const type = normalizeOpt(typeSelect?.value);

    if (color) params.set("color", color);
    if (size) params.set("size", size);
    if (vendor) params.set("vendor", vendor);
    if (tag) params.set("tag", tag);
    if (type) params.set("type", type);

    if (minEl?.value) params.set("minPrice", minEl.value);
    if (maxEl?.value) params.set("maxPrice", maxEl.value);

    return params.toString();
  }

  function extractHandleFromLi(li) {
    const a = li.querySelector('a[href*="/products/"]');
    if (!a) return null;
    const href = a.getAttribute("href") || "";
    const m = href.match(/\/products\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  // -----------------------------
  // NEW: Robust response parsing
  // -----------------------------
  function getHandlesFromResponse(data) {
    const candidates = [
      data?.filteredHandles,
      data?.handles,
      data?.productHandles,
      data?.products,
      data?.data?.handles,
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }

    const nodes =
      data?.products?.nodes ||
      data?.data?.products?.nodes ||
      data?.products ||
      data?.data?.products;

    if (Array.isArray(nodes) && nodes.length && typeof nodes[0] === "object") {
      const h = nodes.map((p) => p?.handle).filter(Boolean);
      if (h.length) return h;
    }

    return [];
  }

  async function fetchFilteredHandles() {
    // Use absolute URL + same-origin credentials (best for Shopify storefront)
    const url = new URL("/apps/filter/products", window.location.origin);

    const qs = new URLSearchParams(buildFilterQuery());
    for (const [k, v] of qs.entries()) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Non-JSON response from /apps/filter/products (content-type: ${contentType})`
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON from /apps/filter/products");
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    }

    // Debug payload
    console.log("[LemonFilters] proxy response keys:", Object.keys(data || {}));

    return data;
  }

  // ✅ Horizon-safe: filter existing DOM in-place
  function filterExistingGrid(handlesSet) {
    grid = getGrid() || grid;
    if (!grid) return;

    const lis = Array.from(grid.querySelectorAll("li")).filter((li) =>
      li.querySelector('a[href*="/products/"]')
    );

    let visibleCount = 0;

    for (const li of lis) {
      const handle = extractHandleFromLi(li);
      const show = handle && handlesSet.has(handle);

      li.style.display = show ? "" : "none";
      li.setAttribute("aria-hidden", show ? "false" : "true");

      if (show) visibleCount++;
    }

    let empty = grid.querySelector("[data-lemon-empty]");
    if (visibleCount === 0) {
      if (!empty) {
        empty = document.createElement("li");
        empty.setAttribute("data-lemon-empty", "true");
        empty.innerHTML = `
          <div style="padding:40px;text-align:center;width:100%;">
            <strong>No products found</strong>
            <div style="margin-top:8px;opacity:.75;">Try changing your filters.</div>
          </div>
        `;
        grid.appendChild(empty);
      }
      empty.style.display = "";
    } else if (empty) {
      empty.style.display = "none";
    }

    if (resultsList) resultsList.setAttribute("infinite-scroll", "false");
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
  }

  // ✅ Accept both response formats:
  // - V1: { vendors, colors, sizes, tags, types }
  // - V2: { facets: { vendors, colors, sizes, tags, types } }
  function hydrateOptionsFromResponse(data) {
    const facets = data?.facets || {};

    const vendors = facets.vendors ?? data?.vendors ?? [];
    const colors = facets.colors ?? data?.colors ?? [];
    const sizes = facets.sizes ?? data?.sizes ?? [];
    const tags = facets.tags ?? data?.tags ?? [];
    const types = facets.types ?? data?.types ?? [];

    setSelectOptions(vendorSelect, vendors);
    setSelectOptions(colorSelect, colors);
    setSelectOptions(sizeSelect, sizes);
    setSelectOptions(tagSelect, tags);
    setSelectOptions(typeSelect, types);

    console.log("[LemonFilters] hydrate facets:", {
      vendors: Array.isArray(vendors) ? vendors.length : 0,
      colors: Array.isArray(colors) ? colors.length : 0,
      sizes: Array.isArray(sizes) ? sizes.length : 0,
      tags: Array.isArray(tags) ? tags.length : 0,
      types: Array.isArray(types) ? types.length : 0,
    });
  }

  // -----------------------------
  // Apply filters
  // -----------------------------
  let inFlight = 0;

  async function applyFilters({ urlMode = "replace" } = {}) {
    const reqId = ++inFlight;

    root.classList.add("is-loading");
    setLoading(true);
    syncUrl({ mode: urlMode });

    try {
      const data = await fetchFilteredHandles();
      if (reqId !== inFlight) return;

      hydrateOptionsFromResponse(data);

      const handles = getHandlesFromResponse(data);
      console.log("[LemonFilters] handles count:", handles.length);

      filterExistingGrid(new Set(handles));
    } catch (e) {
      console.error("[LemonFilters] applyFilters failed:", e);
      alert("Filters failed. Check DevTools > Console and Network.");
    } finally {
      root.classList.remove("is-loading");
      setLoading(false);
    }
  }

  // -----------------------------
  // Events
  // -----------------------------
  function onChangeAutoApply() {
    applyFilters({ urlMode: "push" });
  }

  colorSelect?.addEventListener("change", onChangeAutoApply);
  sizeSelect?.addEventListener("change", onChangeAutoApply);
  vendorSelect?.addEventListener("change", onChangeAutoApply);
  tagSelect?.addEventListener("change", onChangeAutoApply);
  typeSelect?.addEventListener("change", onChangeAutoApply);

  applyBtn?.addEventListener("click", () => applyFilters({ urlMode: "push" }));

  clearBtn?.addEventListener("click", () => {
    resetSelectToAll(colorSelect);
    resetSelectToAll(sizeSelect);
    resetSelectToAll(vendorSelect);
    resetSelectToAll(tagSelect);
    resetSelectToAll(typeSelect);
    if (minEl) minEl.value = "";
    if (maxEl) maxEl.value = "";
    applyFilters({ urlMode: "push" });
  });

  [minEl, maxEl].forEach((el) => {
    el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters({ urlMode: "push" });
    });
  });

  window.addEventListener("popstate", () => {
    applyUrlToUI();
    applyFilters({ urlMode: "replace" });
  });

  // Initial load
  applyUrlToUI();
  applyFilters({ urlMode: "replace" });

  // If Horizon re-renders the list, re-apply filters automatically
  // Guard against loops: only re-run if childList mutations happen
  const observer = new MutationObserver((mutations) => {
    const hasChildListChange = mutations.some((m) => m.type === "childList");
    if (!hasChildListChange) return;

    clearTimeout(observer.__t);
    observer.__t = setTimeout(() => {
      applyFilters({ urlMode: "replace" });
    }, 120);
  });

  observer.observe(grid, { childList: true, subtree: true });
})();
