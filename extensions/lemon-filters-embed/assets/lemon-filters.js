// lemon-filters.js (FULL UPDATED - SAFE + HORIZON-PROOF + STABLE FILTER UI)

// -----------------------------
// Basics / helpers
// -----------------------------
function getResultsList() {
  return document.querySelector("results-list");
}

function getSectionIdFromResultsList(rl) {
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

  function getResultsListEl() {
    return document.querySelector("results-list");
  }

  let grid = getGrid();
  if (!grid) {
    console.warn("[LemonFilters] Could not find product grid (yet)");
  }

  let resultsList = (grid && grid.closest("results-list")) || getResultsListEl();

  // -----------------------------
  // Mounting (CRITICAL: keep filters OUTSIDE results-list)
  // -----------------------------
  function ensureLayout() {
    const rlEl = getResultsListEl();
    if (!rlEl || !rlEl.parentElement) return;

    // Create a stable host right BEFORE results-list (inside the same section container)
    let host =
      rlEl.parentElement.querySelector(":scope > .lemon-filters-host") || null;

    if (!host) {
      host = document.createElement("div");
      host.className = "lemon-filters-host";
      rlEl.parentElement.insertBefore(host, rlEl);
    }

    // If root is currently inside results-list, move it out
    if (root.closest("results-list")) {
      root.remove();
    }

    if (!host.contains(root)) host.appendChild(root);

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
  // Stop Horizon facets from intercepting our controls
  // -----------------------------
  const stopThemeFacets = (e) => {
    e.stopPropagation();
  };
  root.addEventListener("change", stopThemeFacets, true);
  root.addEventListener("input", stopThemeFacets, true);
  root.addEventListener("click", stopThemeFacets, true);
  root.addEventListener("submit", stopThemeFacets, true);

  // -----------------------------
  // Helpers
  // -----------------------------
  function normalizeOpt(v) {
    return (v ?? "").toString().trim();
  }

  function hasActiveFilters() {
    return Boolean(
      normalizeOpt(colorSelect?.value) ||
        normalizeOpt(sizeSelect?.value) ||
        normalizeOpt(vendorSelect?.value) ||
        normalizeOpt(tagSelect?.value) ||
        normalizeOpt(typeSelect?.value) ||
        (minEl?.value ?? "").toString().trim() ||
        (maxEl?.value ?? "").toString().trim()
    );
  }

  function resetSelectToAll(selectEl) {
    if (!selectEl) return;
    selectEl.value = "";
  }

  function setSelectOptions(selectEl, values) {
    if (!selectEl) return;
    if (!Array.isArray(values)) return;

    const currentValue = selectEl.value;

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

    if (
      currentValue &&
      Array.from(selectEl.options).some((o) => o.value === currentValue)
    ) {
      selectEl.value = currentValue;
    } else {
      selectEl.value = "";
    }
  }

  function buildPrettyUrlParams() {
    const p = new URLSearchParams();

    const vendor = normalizeOpt(vendorSelect?.value);
    const color = normalizeOpt(colorSelect?.value);
    const size = normalizeOpt(sizeSelect?.value);
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

    // ignore theme noise
    params.delete("section_id");
    params.delete("sections");
    params.delete("path");

    return params.toString();
  }

  function extractHandleFromLi(li) {
    const a = li.querySelector('a[href*="/products/"]');
    if (!a) return null;
    const href = a.getAttribute("href") || "";
    const m = href.match(/\/products\/([^/?#]+)/);
    return m ? m[1] : null;
  }

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
    const APP_PROXY_BASE = "/apps/lemonfilters39";
    const url = new URL(`${APP_PROXY_BASE}/products`, window.location.origin);

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
        `Non-JSON response from ${APP_PROXY_BASE}/products (content-type: ${contentType})`
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON from ${APP_PROXY_BASE}/products`);
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    }

    return data;
  }

  // Guard to prevent observer loop while WE manipulate the grid
  let suppressObserver = false;

  function filterExistingGrid(handlesSet) {
    grid = getGrid() || grid;
    if (!grid) return;

    const lis = Array.from(grid.querySelectorAll("li")).filter((li) =>
      li.querySelector('a[href*="/products/"]')
    );

    suppressObserver = true;

    if (!hasActiveFilters()) {
      for (const li of lis) {
        li.style.display = "";
        li.setAttribute("aria-hidden", "false");
      }
      const empty = grid.querySelector("[data-lemon-empty]");
      if (empty) empty.style.display = "none";
      suppressObserver = false;
      return;
    }

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

    suppressObserver = false;
  }

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
      filterExistingGrid(new Set(handles));
    } catch (e) {
      console.error("[LemonFilters] applyFilters failed:", e);
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

  // Observe results-list rerenders: re-find grid and re-apply DOM filtering
  const observer = new MutationObserver(() => {
    if (suppressObserver) return;

    ensureLayout(); // keeps filters outside results-list

    const newGrid = getGrid();
    if (newGrid && newGrid !== grid) grid = newGrid;

    // Re-apply current filter state to new DOM
    clearTimeout(observer.__t);
    observer.__t = setTimeout(() => {
      applyFilters({ urlMode: "replace" });
    }, 160);
  });

  const rlObs = getResultsListEl();
  if (rlObs) observer.observe(rlObs, { childList: true, subtree: true });
})();
