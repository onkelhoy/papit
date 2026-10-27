import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/network/');
  await page.waitForFunction(() => (window as any).ready === true);
});

test.describe("mesh", () => {
  test("delivers a to f directly in one hop", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log } = w.build("mesh", 6);

      const delivered = w.once(nodes.f, "message");
      const sent = nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: "f" }, { text: "hej" }));
      const event = await delivered;
      await w.settle();

      return {
        sent,
        hops: event.detail.meta.hops,
        text: event.detail.parse().text,
        counts: Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length])),
      };
    });

    expect(result.sent).toBe(true);
    expect(result.hops).toEqual(["a", "f"]);
    expect(result.text).toBe("hej");
    expect(result.counts).toEqual({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 1 });
  });

  test("broadcast reaches every other node exactly once", async ({ page }) => {
    const counts = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log, members } = w.build("mesh", 6);

      const all = members.filter((id: string) => id !== "a").map((id: string) => w.once(nodes[id], "message"));
      nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: w.BROADCAST }, {}));
      await Promise.all(all);
      await w.settle();

      return Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length]));
    });

    expect(counts).toEqual({ a: 0, b: 1, c: 1, d: 1, e: 1, f: 1 });
  });
});

test.describe("star", () => {
  test("routes leaf to leaf via the hub", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log } = w.build("star", 6, "a");

      const delivered = w.once(nodes.c, "message");
      nodes.b.send(w.Message.Create({ type: "chat", sender: "b", receiver: "c" }, {}));
      const event = await delivered;
      await w.settle();

      return {
        hops: event.detail.meta.hops,
        counts: Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length])),
      };
    });

    expect(result.hops).toEqual(["b", "a", "c"]);
    expect(result.counts).toEqual({ a: 0, b: 0, c: 1, d: 0, e: 0, f: 0 });
  });
});

test.describe("chord", () => {
  test("delivers a to every unlinked node of 16 in at most 6 hops", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, members } = w.build("chord", 16);
      const far = members.filter((id: string) => id !== "a" && !nodes.a.view.links.includes(id));

      const hops: Record<string, string[]> = {};
      for (const id of far)
      {
        const delivered = w.once(nodes[id], "message");
        nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: id }, {}));
        hops[id] = (await delivered).detail.meta.hops;
      }

      return { far: far.length, hops };
    });

    expect(result.far).toBeGreaterThan(0);
    for (const [id, hops] of Object.entries(result.hops))
    {
      expect(hops[0]).toBe("a");
      expect(hops[hops.length - 1]).toBe(id);
      expect(hops.length).toBeLessThanOrEqual(6);
    }
  });

  test("broadcast reaches every other node of 16 exactly once", async ({ page }) => {
    const counts = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log, members } = w.build("chord", 16);

      const all = members.filter((id: string) => id !== "a").map((id: string) => w.once(nodes[id], "message"));
      nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: w.BROADCAST }, {}));
      await Promise.all(all);
      await w.settle();

      return Object.values(log).map((l: any) => l.message.length);
    });

    expect(counts).toEqual([0, ...Array(15).fill(1)]);
  });
});
