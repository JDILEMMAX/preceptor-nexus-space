/** Register only on the exported/published app, never in editor previews. */
export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  const { hostname, search } = window.location;
  const preview = hostname.startsWith("id-preview--") || hostname.startsWith("preview--") ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (!import.meta.env.PROD || window.self !== window.top || preview || new URLSearchParams(search).get("sw") === "off") {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing].some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")
    ).map((registration) => registration.unregister()));
    return;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update();
}