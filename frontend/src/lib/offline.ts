/** Register the service worker for production deployments only. */
export async function registerOfflineApp() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD || window.self !== window.top) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((r) =>
          [r.active, r.waiting, r.installing].some(
            (w) => w && new URL(w.scriptURL).pathname === "/sw.js",
          ),
        )
        .map((r) => r.unregister()),
    );
    return;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update();
}
