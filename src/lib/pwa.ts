/**
 * Registro do service worker. Só roda em produção, fora de iframes
 * (preview do editor) e em contexto seguro — o site continua funcionando
 * normalmente sem ele.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (window.self !== window.top) return;
  if (!window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignorado: o site funciona sem service worker */
    });
  });
}
