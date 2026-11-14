import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerServiceWorker,
  SERVICE_WORKER_URL,
} from "@/lib/service-worker";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeContainer(register: () => Promise<unknown>) {
  return { register: vi.fn(register) } as unknown as ServiceWorkerContainer;
}

describe("registerServiceWorker", () => {
  it("registers the worker at the site's root", async () => {
    const container = fakeContainer(() => Promise.resolve({}));

    await registerServiceWorker(container);

    expect(container.register).toHaveBeenCalledWith(SERVICE_WORKER_URL);
  });

  it("does nothing where service workers aren't available", async () => {
    await expect(registerServiceWorker(undefined)).resolves.toBeUndefined();
  });

  it("reports a failed registration without breaking the page", async () => {
    const error = new Error("Blocked");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await registerServiceWorker(fakeContainer(() => Promise.reject(error)));

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("offline"),
      error,
    );
  });
});
