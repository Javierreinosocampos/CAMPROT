// ============================================================
// CAMPROT — shared app logic (auth, nav, theme, helpers)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.CAMPROT_CONFIG || {};
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

/* ---------------- Theme ---------------- */

export function initTheme() {
  const saved = localStorage.getItem("camprot-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  const btn = document.getElementById("themeToggle");
  if (btn) {
    updateThemeIcon(btn, theme, false);
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("camprot-theme", next);
      updateThemeIcon(btn, next, true);
    });
  }
}

function updateThemeIcon(btn, theme, animate) {
  const svg =
    theme === "dark"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>`;

  if (!animate) {
    btn.innerHTML = svg;
    return;
  }

  // Quiet crossfade instead of an abrupt icon swap.
  btn.style.transition = "opacity 110ms cubic-bezier(0.16, 1, 0.3, 1)";
  btn.style.opacity = "0";
  setTimeout(() => {
    btn.innerHTML = svg;
    btn.style.opacity = "1";
  }, 110);
}

/* ---------------- Reveal helper ----------------
   Adds/removes the .anim-in class (see style.css) so a panel that
   was `.hidden` fades and settles in each time it's shown, instead
   of just popping into view. Forces a reflow so the animation
   restarts even if the element was already revealed before. */

export function reveal(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.remove("anim-in");
  void el.offsetWidth; // force reflow
  el.classList.add("anim-in");
}

export function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.classList.remove("anim-in");
}

/* ---------------- Access gate (shared code, no accounts) ----------------
   No hay Supabase Auth ni email/contraseña: es una herramienta de solo
   empleados protegida por un único código compartido, guardado en este
   dispositivo tras introducirlo correctamente. Ajusta ACCESS_CODE en
   assets/config.js. Ver README para el aviso de seguridad. */

const ACCESS_KEY = "camprot-access";

export function hasAccess() {
  return localStorage.getItem(ACCESS_KEY) === "granted";
}

export function grantAccess(code) {
  const expected = (cfg.ACCESS_CODE || "").trim();
  if (!expected || code !== expected) return false;
  localStorage.setItem(ACCESS_KEY, "granted");
  return true;
}

export function revokeAccess() {
  localStorage.removeItem(ACCESS_KEY);
}

export async function initPage(activePage) {
  initTheme();
  if (!hasAccess()) {
    window.location.href = "index.html";
    return null;
  }

  const links = document.querySelectorAll(".nav-links a[data-page]");
  links.forEach((a) => a.classList.toggle("active", a.dataset.page === activePage));

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      revokeAccess();
      window.location.href = "index.html";
    });
  }

  const burger = document.getElementById("hamburger");
  const nav = document.querySelector(".nav-links");
  if (burger && nav) {
    burger.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("open"))
    );
  }

  return true;
}

/* ---------------- Small helpers ---------------- */

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function monogram(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export function formatEUR(value) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

let toastTimer;
export function toast(message, type = "") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
