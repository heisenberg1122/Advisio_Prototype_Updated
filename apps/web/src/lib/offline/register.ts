export async function prepareOfflineShell() {
  if (import.meta.env.DEV)
    throw new Error(
      "Offline access is available in the production build. Use the built preview to test it locally.",
    );
  if (!("serviceWorker" in navigator) || !window.isSecureContext)
    throw new Error(
      "This browser needs a secure connection to enable offline access.",
    );
  const registration = await navigator.serviceWorker.register(
    "/advisio-sw.js",
    { scope: "/", updateViaCache: "none" },
  );
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () =>
        reject(
          new Error(
            "The offline app download timed out. Check your connection and try again.",
          ),
        ),
      90_000,
    );
    navigator.serviceWorker.ready.then(
      () => {
        clearTimeout(timeout);
        resolve();
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "redundant" && !registration.active) {
        clearTimeout(timeout);
        reject(
          new Error(
            "The offline app download failed. Please try again when your connection is stable.",
          ),
        );
      }
    });
  });
  return registration;
}
