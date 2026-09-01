// CAMPROT — landing page: theme toggle (shares the "camprot-theme"
// key with the internal app, so the choice carries across the site).

(function initTheme() {
  const saved = localStorage.getItem("camprot-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    updateIcon(btn, theme, false);
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("camprot-theme", next);
      updateIcon(btn, next, true);
    });
  });
})();

function updateIcon(btn, theme, animate) {
  const svg =
    theme === "dark"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>`;

  if (!animate) {
    btn.innerHTML = svg;
    return;
  }
  btn.style.transition = "opacity 110ms cubic-bezier(0.16, 1, 0.3, 1)";
  btn.style.opacity = "0";
  setTimeout(() => {
    btn.innerHTML = svg;
    btn.style.opacity = "1";
  }, 110);
}