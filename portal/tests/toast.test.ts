import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/ui/toast";

describe("toast", () => {
  afterEach(() => vi.restoreAllMocks());

  it("closes a plain toast on a timer but keeps one with an action until it is dismissed", () => {
    const timer = vi.spyOn(globalThis, "setTimeout");
    toast("Saved");
    expect(timer).toHaveBeenCalledOnce();
    toast("Something went wrong", "error", undefined, { label: "Retry", onClick: () => {} });
    expect(timer).toHaveBeenCalledOnce();
  });
});
