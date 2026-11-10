import { describe, expect, it, vi } from "vitest";
import { attemptReports } from "@/components/player/attempt";

describe("the player's attempt reports", () => {
  it("sends a lost start again with the next scene report, and never rejects", async () => {
    const start = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
    const reach = vi.fn().mockResolvedValue(undefined);
    const r = attemptReports(start, reach);
    await expect(r.begin(2)).resolves.toBeUndefined();
    expect(reach).not.toHaveBeenCalled();
    await r.reach(3);
    expect(start).toHaveBeenCalledTimes(2);
    expect(reach).toHaveBeenCalledWith(3);
    // Once the start is through, scene reports go alone.
    await r.reach(4);
    expect(start).toHaveBeenCalledTimes(2);
    expect(reach).toHaveBeenLastCalledWith(4);
  });

  it("reports the furthest scene of a resumed attempt after its start, and nothing for the first scene", async () => {
    const order: string[] = [];
    const r = attemptReports(async () => void order.push("start"), async (n) => void order.push(`reach ${n}`));
    await r.begin(5);
    await r.begin(0);
    expect(order).toEqual(["start", "reach 5", "start"]);
  });
});
