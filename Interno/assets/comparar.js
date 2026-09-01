import { supabase, initPage, escapeHtml, formatEUR, toast, reveal, hide } from "./app.js";

const searchInput = document.getElementById("searchInput");
const materialFilter = document.getElementById("materialFilter");
const sortFilter = document.getElementById("sortFilter");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const groupsWrap = document.getElementById("groupsWrap");
const emptyCard = document.getElementById("emptyCard");
const emptyMsg = document.getElementById("emptyMsg");
const proveedorList = document.getElementById("proveedorList");

let quotes = [];

init();

async function init() {
  const session = await initPage("comparar");
  if (!session) return;

  document.getElementById("addQuoteBtn").addEventListener("click", openQuoteModal);
  document.getElementById("cancelQuoteBtn").addEventListener("click", closeQuoteModal);
  document.getElementById("quoteModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "quoteModalBackdrop") closeQuoteModal();
  });
  document.getElementById("quoteForm").addEventListener("submit", saveQuote);
  searchInput.addEventListener("input", render);
  materialFilter.addEventListener("change", render);
  sortFilter.addEventListener("change", render);
  minPrice.addEventListener("input", render);
  maxPrice.addEventListener("input", render);
  clearFiltersBtn.addEventListener("click", clearFilters);

  await loadQuotes();
}

function clearFilters() {
  searchInput.value = "";
  materialFilter.value = "";
  sortFilter.value = "price-asc";
  minPrice.value = "";
  maxPrice.value = "";
  render();
}

async function loadQuotes() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("price", { ascending: true });

  if (error) {
    toast("No se pudieron cargar los presupuestos: " + error.message, "error");
    return;
  }
  quotes = data || [];
  refreshSuggestions();
  render();
}

function refreshSuggestions() {
  const proveedores = [...new Set(quotes.map((q) => q.proveedor))].sort((a, b) => a.localeCompare(b, "es"));
  proveedorList.innerHTML = proveedores.map((p) => `<option value="${escapeHtml(p)}"></option>`).join("");
}

const SORTERS = {
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  "date-desc": (a, b) => new Date(b.created_at) - new Date(a.created_at),
  "date-asc": (a, b) => new Date(a.created_at) - new Date(b.created_at),
  "proveedor-asc": (a, b) => a.proveedor.localeCompare(b.proveedor, "es"),
};

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const materialSel = materialFilter.value;
  const min = minPrice.value !== "" ? parseFloat(minPrice.value) : null;
  const max = maxPrice.value !== "" ? parseFloat(maxPrice.value) : null;
  const sorter = SORTERS[sortFilter.value] || SORTERS["price-asc"];

  const filtered = quotes.filter((row) => {
    const matchesQ = !q || row.proveedor.toLowerCase().includes(q) || row.material.toLowerCase().includes(q);
    const matchesMaterial = !materialSel || row.material === materialSel;
    const matchesMin = min === null || row.price >= min;
    const matchesMax = max === null || row.price <= max;
    return matchesQ && matchesMaterial && matchesMin && matchesMax;
  });

  if (!filtered.length) {
    groupsWrap.innerHTML = "";
    emptyMsg.textContent = quotes.length
      ? "Ningún presupuesto coincide con la búsqueda o los filtros."
      : "Todavía no hay presupuestos registrados. Añade el primero con \"+ Añadir presupuesto\".";
    reveal(emptyCard);
    return;
  }
  hide(emptyCard);

  // group by material, each group sorted according to the chosen sort order
  const groups = new Map();
  filtered.forEach((row) => {
    if (!groups.has(row.material)) groups.set(row.material, []);
    groups.get(row.material).push(row);
  });
  groups.forEach((rows) => rows.sort(sorter));

  const sortedMaterials = [...groups.keys()].sort((a, b) => a.localeCompare(b, "es"));

  groupsWrap.innerHTML = sortedMaterials
    .map((material) => {
      const rows = groups.get(material);
      const cheapestPrice = Math.min(...rows.map((r) => r.price));
      return `
        <div class="card material-group" style="margin-bottom:18px;">
          <h2>${escapeHtml(material)} <span class="count">${rows.length} presupuesto${rows.length === 1 ? "" : "s"}</span></h2>
          <div class="compare-list">
            ${rows
              .map((row, i) => `
                <div class="compare-row anim-in ${row.price === cheapestPrice ? "best" : ""}" style="animation-delay:${Math.min(i * 24, 200)}ms">
                  <div class="supplier">
                    <b>${escapeHtml(row.proveedor)}</b>
                    <small>${formatDate(row.created_at)}${row.notes ? " · " + escapeHtml(row.notes) : ""}</small>
                  </div>
                  <div class="price">
                    ${formatEUR(row.price)} <span class="unit">/ ${escapeHtml(row.unit)}</span>
                    ${row.price === cheapestPrice ? `<span class="tag">Mejor precio</span>` : ""}
                    <button type="button" class="row-action" data-del="${row.id}" title="Eliminar">✕</button>
                  </div>
                </div>`)
              .join("")}
          </div>
        </div>`;
    })
    .join("");

  groupsWrap.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteQuote(btn.dataset.del));
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

/* ---------------- Add / delete ---------------- */

function openQuoteModal() {
  document.getElementById("fMaterial").value = "";
  document.getElementById("fProveedor").value = "";
  document.getElementById("fPrice").value = "";
  document.getElementById("fUnit").value = "€/kg";
  document.getElementById("fNotes").value = "";
  document.getElementById("quoteModalBackdrop").classList.add("open");
  document.getElementById("fMaterial").focus();
}

function closeQuoteModal() {
  document.getElementById("quoteModalBackdrop").classList.remove("open");
}

async function saveQuote(e) {
  e.preventDefault();
  const material = document.getElementById("fMaterial").value.trim();
  const proveedor = document.getElementById("fProveedor").value.trim();
  const price = parseFloat(document.getElementById("fPrice").value);
  const unit = document.getElementById("fUnit").value.trim() || "€/kg";
  const notes = document.getElementById("fNotes").value.trim() || null;

  if (!material || !proveedor || isNaN(price)) return;

  const saveBtn = document.getElementById("saveQuoteBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando…";

  const { error } = await supabase.from("quotes").insert({ material, proveedor, price, unit, notes });

  saveBtn.disabled = false;
  saveBtn.textContent = "Guardar";

  if (error) {
    toast("No se pudo guardar: " + error.message, "error");
    return;
  }

  toast("Presupuesto guardado.");
  closeQuoteModal();
  await loadQuotes();
}

async function deleteQuote(id) {
  if (!confirm("¿Eliminar este presupuesto?")) return;
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) {
    toast("No se pudo eliminar: " + error.message, "error");
    return;
  }
  toast("Presupuesto eliminado.");
  await loadQuotes();
}