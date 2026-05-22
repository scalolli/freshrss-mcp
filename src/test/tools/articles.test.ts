import { describe, it, expect, vi } from "vitest";
import type { Article } from "../../freshrss.js";
import {
  handleGetUnreadArticles,
  handleGetArticleContent,
  handleMarkAsRead,
  handleSearchArticles,
} from "../../tools/articles.js";

const makeArticle = (n: number): Article => ({
  id: `tag:google.com,2005:reader/item/${String(n).padStart(16, "0")}`,
  title: `Article ${n}`,
  url: `https://example.com/${n}`,
  publishedAt: 1700000000 + n,
  content: `<p>Content ${n}</p>`,
  feedId: "feed/1",
  feedTitle: "Test Feed",
});

// ── get_unread_articles ───────────────────────────────────────────────────────

describe("get_unread_articles tool", () => {
  it("returns formatted articles with default limit", async () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const client = { getUnreadArticles: vi.fn().mockResolvedValue(articles) } as any;

    const result = await handleGetUnreadArticles(client, {});

    expect(client.getUnreadArticles).toHaveBeenCalledWith({ limit: 20, feedId: undefined });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Article 1");
    expect(text).toContain("Article 2");
  });

  it("passes limit and feedId to client", async () => {
    const client = { getUnreadArticles: vi.fn().mockResolvedValue([]) } as any;
    await handleGetUnreadArticles(client, { limit: 5, feedId: "feed/42" });

    expect(client.getUnreadArticles).toHaveBeenCalledWith({ limit: 5, feedId: "feed/42" });
  });

  it("returns message when no unread articles", async () => {
    const client = { getUnreadArticles: vi.fn().mockResolvedValue([]) } as any;
    const result = await handleGetUnreadArticles(client, {});

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("No unread");
  });
});

// ── get_article_content ───────────────────────────────────────────────────────

describe("get_article_content tool", () => {
  it("returns full article content", async () => {
    const article = makeArticle(42);
    const client = { getArticleContent: vi.fn().mockResolvedValue(article) } as any;

    const result = await handleGetArticleContent(client, { id: article.id });

    expect(client.getArticleContent).toHaveBeenCalledWith(article.id);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Article 42");
    expect(text).toContain("<p>Content 42</p>");
  });
});

// ── mark_as_read ──────────────────────────────────────────────────────────────

describe("mark_as_read tool", () => {
  it("calls markAsRead with given IDs", async () => {
    const ids = ["id-1", "id-2"];
    const client = { markAsRead: vi.fn().mockResolvedValue(undefined) } as any;

    const result = await handleMarkAsRead(client, { ids });

    expect(client.markAsRead).toHaveBeenCalledWith(ids);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("2");
  });
});

// ── search_articles ───────────────────────────────────────────────────────────

describe("search_articles tool", () => {
  it("returns formatted search results", async () => {
    const articles = [makeArticle(99)];
    const client = { searchArticles: vi.fn().mockResolvedValue(articles) } as any;

    const result = await handleSearchArticles(client, { query: "typescript" });

    expect(client.searchArticles).toHaveBeenCalledWith("typescript", 20);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Article 99");
  });

  it("returns message when no results", async () => {
    const client = { searchArticles: vi.fn().mockResolvedValue([]) } as any;
    const result = await handleSearchArticles(client, { query: "noresults" });

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("No articles");
  });
});
