import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { FreshRSSClient } from "../freshrss.js";

const BASE_URL = "https://rss.example.com";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Iteration 1: authenticate ─────────────────────────────────────────────────

describe("FreshRSSClient.authenticate()", () => {
  it("sends credentials and stores Auth token", async () => {
    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, async ({ request }) => {
        const body = await request.text();
        expect(body).toContain("Email=testuser");
        expect(body).toContain("Passwd=secret");
        return HttpResponse.text(
          "SID=sid_value\nLSID=lsid_value\nAuth=GoogleLogin auth=tok123\n"
        );
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    expect(client.authToken).toBe("GoogleLogin auth=tok123");
  });
});

// ── Iteration 2: getFeeds ─────────────────────────────────────────────────────

describe("FreshRSSClient.getFeeds()", () => {
  it("returns mapped Feed[]", async () => {
    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/subscription/list`, ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("GoogleLogin auth=tok");
        return HttpResponse.json({
          subscriptions: [
            { id: "feed/1", title: "Feed One", url: "https://feed1.com/feed" },
            { id: "feed/2", title: "Feed Two", url: "https://feed2.com/feed" },
          ],
        });
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    const feeds = await client.getFeeds();

    expect(feeds).toHaveLength(2);
    expect(feeds[0]).toEqual({ id: "feed/1", title: "Feed One", url: "https://feed1.com/feed" });
    expect(feeds[1]).toEqual({ id: "feed/2", title: "Feed Two", url: "https://feed2.com/feed" });
  });
});

// ── Iteration 3: getUnreadArticles ────────────────────────────────────────────

describe("FreshRSSClient.getUnreadArticles()", () => {
  it("returns mapped Article[] excluding read, respects limit", async () => {
    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/stream/contents/reading-list`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("xt")).toBe("user/-/state/com.google/read");
        expect(url.searchParams.get("n")).toBe("10");
        return HttpResponse.json({
          items: [
            {
              id: "tag:google.com,2005:reader/item/0000000000000001",
              title: "Article One",
              published: 1700000000,
              canonical: [{ href: "https://example.com/1" }],
              summary: { content: "<p>Content one</p>" },
              origin: { streamId: "feed/1", title: "Feed One" },
            },
          ],
        });
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    const articles = await client.getUnreadArticles({ limit: 10 });

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      id: "tag:google.com,2005:reader/item/0000000000000001",
      title: "Article One",
      url: "https://example.com/1",
      feedTitle: "Feed One",
      feedId: "feed/1",
    });
  });

  it("filters by feedId when provided", async () => {
    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/stream/contents/reading-list`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("s")).toBe("feed/42");
        return HttpResponse.json({ items: [] });
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    await client.getUnreadArticles({ feedId: "feed/42" });
  });
});

// ── Iteration 4: getArticleContent ───────────────────────────────────────────

describe("FreshRSSClient.getArticleContent()", () => {
  it("returns a single Article by ID", async () => {
    const articleId = "tag:google.com,2005:reader/item/0000000000000042";

    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/stream/contents`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("i")).toBe(articleId);
        return HttpResponse.json({
          items: [
            {
              id: articleId,
              title: "Deep Article",
              published: 1700000042,
              canonical: [{ href: "https://example.com/deep" }],
              summary: { content: "<p>Full content here</p>" },
              origin: { streamId: "feed/1", title: "Feed One" },
            },
          ],
        });
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    const article = await client.getArticleContent(articleId);

    expect(article).toMatchObject({
      id: articleId,
      title: "Deep Article",
      content: "<p>Full content here</p>",
    });
  });
});

// ── Iteration 5: markAsRead ───────────────────────────────────────────────────

describe("FreshRSSClient.markAsRead()", () => {
  it("fetches an edit token then posts to edit-tag", async () => {
    const ids = [
      "tag:google.com,2005:reader/item/0000000000000001",
      "tag:google.com,2005:reader/item/0000000000000002",
    ];

    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/token`, () =>
        HttpResponse.text("edit_token_abc")
      ),
      http.post(`${BASE_URL}/api/greader.php/reader/api/0/edit-tag`, async ({ request }) => {
        const body = await request.text();
        const decoded = new URLSearchParams(body);
        expect(decoded.get("T")).toBe("edit_token_abc");
        expect(decoded.get("a")).toBe("user/-/state/com.google/read");
        expect(decoded.getAll("i")).toEqual(ids);
        return HttpResponse.text("OK");
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    await client.markAsRead(ids);
  });
});

// ── Iteration 6: searchArticles ───────────────────────────────────────────────

describe("FreshRSSClient.searchArticles()", () => {
  it("passes query via s param and maps results", async () => {
    server.use(
      http.post(`${BASE_URL}/api/greader.php/accounts/ClientLogin`, () =>
        HttpResponse.text("Auth=tok\n")
      ),
      http.get(`${BASE_URL}/api/greader.php/reader/api/0/stream/contents`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("s")).toBe("user/-/state/com.google/reading-list");
        expect(url.searchParams.get("q")).toBe("typescript");
        return HttpResponse.json({
          items: [
            {
              id: "tag:google.com,2005:reader/item/0000000000000099",
              title: "TypeScript Guide",
              published: 1700000099,
              canonical: [{ href: "https://example.com/ts" }],
              summary: { content: "<p>TS content</p>" },
              origin: { streamId: "feed/1", title: "Dev Feed" },
            },
          ],
        });
      })
    );

    const client = new FreshRSSClient(BASE_URL, "testuser", "secret");
    await client.authenticate();
    const results = await client.searchArticles("typescript");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: "TypeScript Guide" });
  });
});
