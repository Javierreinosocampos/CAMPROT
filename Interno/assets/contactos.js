import { supabase, initPage, escapeHtml, monogram, toast, reveal, hide } from "./app.js";

const searchInput = document.getElementById("searchInput");
const viaFilter = document.getElementById("viaFilter");
const respuestaFilter = document.getElementById("respuestaFilter");
const sortFilter = document.getElementById("sortFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const contactsBody = document.getElementById("contactsBody");
const tableWrap = document.getElementById("tableWrap");
const emptyCard = document.getElementById("emptyCard");
const emptyMsg = document.getElementById("emptyMsg");

let contacts = [];

init();

async function init() {
  const session = await initPage("contactos");
  if (!session) return;

  document.getElementById("addContactBtn").addEventListener("click", () => openContactModal());
  document.getElementById("cancelContactBtn").addEventListener("click", closeContactModal);
  document.getElementById("contactModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "contactModalBackdrop") closeContactModal();
  });
  document.getElementById("contactForm").addEventListener("submit", saveContact);

  searchInput.addEventListener("input", render);
  viaFilter.addEventListener("change", render);
  respuestaFilter.addEventListener("change", render);
  sortFilter.addEventListener("change", render);
  clearFiltersBtn.addEventListener("click", clearFilters);

  await loadContacts();
}

function clearFilters() {
  searchInput.value = "";
  viaFilter.value = "";
  respuestaFilter.value = "";
  sortFilter.value = "date-desc";
  render();
}

async function loadContacts() {
  const { data, error } = await supabase
    .from("camprot_contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    toast("No se pudieron cargar los contactos: " + error.message, "error");
    return;
  }
  contacts = data || [];
  refreshViaFilterOptions();
  render();
}

function refreshViaFilterOptions() {
  const vias = [...new Set(contacts.map((c) => c.via).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const current = viaFilter.value;
  viaFilter.innerHTML =
    `<option value="">Toda vía de contacto</option>` +
    vias.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  viaFilter.value = vias.includes(current) ? current : "";
}

const RESPUESTA_ORDER = { Pendiente: 0, No: 1, "Sí": 2 };
const SORTERS = {
  "date-desc": (a, b) => new Date(b.created_at) - new Date(a.created_at),
  "date-asc": (a, b) => new Date(a.created_at) - new Date(b.created_at),
  "nombre-asc": (a, b) => a.nombre.localeCompare(b.nombre, "es"),
  "nombre-desc": (a, b) => b.nombre.localeCompare(a.nombre, "es"),
  "respuesta": (a, b) => (RESPUESTA_ORDER[a.respuesta] ?? 0) - (RESPUESTA_ORDER[b.respuesta] ?? 0),
};

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const via = viaFilter.value;
  const resp = respuestaFilter.value;
  const sorter = SORTERS[sortFilter.value] || SORTERS["date-desc"];

  const filtered = contacts.filter((c) => {
    const matchesQ = !q ||
      c.nombre.toLowerCase().includes(q) ||
      (c.notas || "").toLowerCase().includes(q) ||
      (c.detalle || "").toLowerCase().includes(q);
    const matchesVia = !via || c.via === via;
    const matchesResp = !resp || c.respuesta === resp;
    return matchesQ && matchesVia && matchesResp;
  });

  if (!filtered.length) {
    contactsBody.innerHTML = "";
    hide(tableWrap);
    emptyMsg.textContent = contacts.length
      ? "Ningún contacto coincide con la búsqueda o los filtros."
      : "Todavía no hay contactos registrados. Añade el primero con \"+ Añadir contacto\".";
    reveal(emptyCard);
    return;
  }
  hide(emptyCard);
  reveal(tableWrap);

  const rows = [...filtered].sort(sorter);

  contactsBody.innerHTML = rows
    .map((c, i) => `
      <tr class="row-in" style="animation-delay:${Math.min(i * 22, 200)}ms">
        <td data-label="Nombre">
          <div class="prod-cell">
            <div class="mono">${escapeHtml(monogram(c.nombre))}</div>
            <div>
              <span class="prod-name">${escapeHtml(c.nombre)}</span>
              <span class="prod-sku">${formatDate(c.created_at)}${c.detalle ? " · " + escapeHtml(c.detalle) : ""}</span>
            </div>
          </div>
        </td>
        <td data-label="Vía de contacto">${c.via ? `<span class="badge neutral">${escapeHtml(c.via)}</span>` : "—"}</td>
        <td data-label="Respuesta">
          <button type="button" class="badge-btn" data-cycle="${c.id}" data-current="${escapeHtml(c.respuesta)}" title="Cambiar respuesta">
            <span class="badge ${respuestaClass(c.respuesta)}">${escapeHtml(respuestaLabel(c.respuesta))}</span>
          </button>
        </td>
        <td data-label="Notas"><span style="color:var(--muted);">${c.notas ? escapeHtml(c.notas) : "—"}</span></td>
        <td data-label="">
          <div class="actions-cell">
            <button type="button" class="row-action" data-edit="${c.id}" title="Editar">✎</button>
            <button type="button" class="row-action" data-del="${c.id}" title="Eliminar">✕</button>
          </div>
        </td>
      </tr>`)
    .join("");

  contactsBody.querySelectorAll("[data-cycle]").forEach((btn) => {
    btn.addEventListener("click", () => cycleRespuesta(btn.dataset.cycle, btn.dataset.current));
  });
  contactsBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openContactModal(contacts.find((c) => String(c.id) === btn.dataset.edit)));
  });
  contactsBody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteContact(btn.dataset.del));
  });
}

function respuestaClass(r) {
  if (r === "Sí") return "ok";
  if (r === "No") return "danger";
  return "warn";
}
function respuestaLabel(r) {
  if (r === "Sí") return "Ha respondido";
  if (r === "No") return "Sin respuesta";
  return "Pendiente";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

/* ---------------- Quick response cycling ---------------- */

const NEXT_RESPUESTA = { Pendiente: "Sí", "Sí": "No", No: "Pendiente" };

async function cycleRespuesta(id, current) {
  const next = NEXT_RESPUESTA[current] || "Pendiente";
  const { error } = await supabase.from("camprot_contacts").update({ respuesta: next }).eq("id", id);
  if (error) {
    toast("No se pudo actualizar la respuesta: " + error.message, "error");
    return;
  }
  const row = contacts.find((c) => String(c.id) === String(id));
  if (row) row.respuesta = next;
  render();
}

/* ---------------- Add / edit / delete ---------------- */

function openContactModal(contact) {
  const isEdit = !!contact;
  document.getElementById("contactModalTitle").textContent = isEdit ? "Editar contacto" : "Añadir contacto";
  document.getElementById("fId").value = isEdit ? contact.id : "";
  document.getElementById("fNombre").value = isEdit ? contact.nombre : "";
  document.getElementById("fVia").value = isEdit ? contact.via || "" : "Email";
  document.getElementById("fRespuesta").value = isEdit ? contact.respuesta : "Pendiente";
  document.getElementById("fDetalle").value = isEdit ? contact.detalle || "" : "";
  document.getElementById("fNotes").value = isEdit ? contact.notas || "" : "";
  document.getElementById("contactModalBackdrop").classList.add("open");
  document.getElementById("fNombre").focus();
}

function closeContactModal() {
  document.getElementById("contactModalBackdrop").classList.remove("open");
}

async function saveContact(e) {
  e.preventDefault();
  const id = document.getElementById("fId").value;
  const nombre = document.getElementById("fNombre").value.trim();
  const via = document.getElementById("fVia").value.trim() || "Email";
  const respuesta = document.getElementById("fRespuesta").value;
  const detalle = document.getElementById("fDetalle").value.trim() || null;
  const notas = document.getElementById("fNotes").value.trim() || null;

  if (!nombre) return;

  const saveBtn = document.getElementById("saveContactBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando…";

  const payload = { nombre, via, respuesta, detalle, notas };
  const { error } = id
    ? await supabase.from("camprot_contacts").update(payload).eq("id", id)
    : await supabase.from("camprot_contacts").insert(payload);

  saveBtn.disabled = false;
  saveBtn.textContent = "Guardar";

  if (error) {
    toast("No se pudo guardar: " + error.message, "error");
    return;
  }

  toast(id ? "Contacto actualizado." : "Contacto guardado.");
  closeContactModal();
  await loadContacts();
}

async function deleteContact(id) {
  if (!confirm("¿Eliminar este contacto?")) return;
  const { error } = await supabase.from("camprot_contacts").delete().eq("id", id);
  if (error) {
    toast("No se pudo eliminar: " + error.message, "error");
    return;
  }
  toast("Contacto eliminado.");
  await loadContacts();
}