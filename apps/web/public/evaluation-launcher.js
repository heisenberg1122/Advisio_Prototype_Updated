(() => {
  // The destination is fixed: invitation links can supply assignments only.
  const destination = new URL("https://advisio-tam-evaluation-2026.onrender.com/evaluate");
  const invitation = new URLSearchParams(window.location.search);
  for (const key of ["role", "course", "scenario"]) {
    for (const value of invitation.getAll(key)) destination.searchParams.append(key, value);
  }
  const title = document.getElementById("startup-title");
  const message = document.getElementById("startup-message");
  const retry = document.getElementById("startup-retry");
  const dots = document.querySelector(".loading-dots");
  let run = 0;
  let timer;
  let request;

  function start() {
    const current = ++run;
    clearTimeout(timer);
    request?.abort();
    const deadline = Date.now() + 120_000;
    title.textContent = "Starting your evaluation environment…";
    message.textContent = "This may take about a minute. Keep this page open—we’ll continue automatically.";
    retry.hidden = true;
    dots.hidden = false;

    async function check() {
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        // Vercel forwards only this public health check. No account cookies,
        // session tokens, or questionnaire answers are sent to the service.
        const response = await fetch(`/evaluate/status?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "omit",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const health = response.ok && response.headers.get("content-type")?.includes("application/json")
          ? await response.json() : null;
        if (current !== run) return;
        if (health?.status === "ok" && health.mode === "evaluation" && health.database === "connected") {
          window.location.replace(destination.toString());
          return;
        }
      } catch {
        // A sleeping service may return HTML, time out, or refuse a connection.
      } finally {
        clearTimeout(timeout);
      }
      if (current !== run) return;
      if (Date.now() < deadline) {
        timer = setTimeout(check, 3_000);
      } else {
        title.textContent = "Your evaluation is taking longer to start";
        message.textContent = "Please try again. If it still won’t open, contact us using the help link below.";
        dots.hidden = true;
        retry.hidden = false;
      }
    }
    void check();
  }

  retry.addEventListener("click", start);
  window.addEventListener("pagehide", () => {
    ++run;
    clearTimeout(timer);
    request?.abort();
  });
  window.addEventListener("pageshow", (event) => { if (event.persisted) start(); });
  start();
})();
