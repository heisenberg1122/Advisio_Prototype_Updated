function busy() {
  return Object.assign(
    new Error("The evaluation is busy. Please try again shortly."),
    { statusCode: 503 },
  );
}

// Bound database work independently of the number of admitted participants.
export class EvaluationRequestSlots {
  private active = 0;
  private pending = new Set<() => void>();

  constructor(
    private readonly limit = 3,
    private readonly timeoutMs = 25_000,
  ) {}

  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted || this.pending.size >= 500)
      return Promise.reject(busy());
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
        this.pending.delete(grant);
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(busy());
      };
      const grant = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.active++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active--;
          this.pending.values().next().value?.();
        });
      };
      if (this.active < this.limit) return grant();
      this.pending.add(grant);
      timer = setTimeout(cancel, this.timeoutMs);
      signal?.addEventListener("abort", cancel, { once: true });
    });
  }
}
