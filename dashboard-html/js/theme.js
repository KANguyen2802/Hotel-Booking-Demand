(function () {
  const root = document.documentElement;
  const btn = () => document.getElementById("btnTheme");
  const iconSun = () => document.getElementById("iconSun");
  const iconMoon = () => document.getElementById("iconMoon");

  function preferred() {
    const saved = localStorage.getItem("hbd-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncIcons(theme) {
    const sun = iconSun();
    const moon = iconMoon();
    if (!sun || !moon) return;
    const dark = theme === "dark";
    sun.hidden = dark;
    moon.hidden = !dark;
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("hbd-theme", theme);
    syncIcons(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function toggle() {
    apply(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  apply(preferred());

  document.addEventListener("DOMContentLoaded", () => {
    syncIcons(root.getAttribute("data-theme"));
    btn()?.addEventListener("click", toggle);
  });

  window.HBDTheme = { apply, toggle, get: () => root.getAttribute("data-theme") };
})();
