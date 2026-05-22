import { describe, it, expect, vi } from "vitest";
import type { Feed } from "../../freshrss.js";
import { handleGetFeeds } from "../../tools/feeds.js";

const mockFeeds: Feed[] = [
  { id: "feed/1", title: "Hacker News", url: "https://news.ycombinator.com/rss" },
  { id: "feed/2", title: "Dev.to", url: "https://dev.to/feed" },
];

describe("get_feeds tool", () => {
  it("returns a formatted list of feeds", async () => {
    const client = { getFeeds: vi.fn().mockResolvedValue(mockFeeds) } as any;
    const result = await handleGetFeeds(client, {});

    expect(client.getFeeds).toHaveBeenCalledOnce();
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Hacker News");
    expect(text).toContain("feed/1");
    expect(text).toContain("Dev.to");
  });

  it("returns a message when no feeds exist", async () => {
    const client = { getFeeds: vi.fn().mockResolvedValue([]) } as any;
    const result = await handleGetFeeds(client, {});

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("No feeds");
  });
});
