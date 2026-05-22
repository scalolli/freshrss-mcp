export interface Feed {
  id: string;
  title: string;
  url: string;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  publishedAt: number;
  content: string;
  feedId: string;
  feedTitle: string;
}

interface StreamItem {
  id: string;
  title: string;
  published: number;
  canonical?: Array<{ href: string }>;
  summary?: { content: string };
  origin?: { streamId: string; title: string };
}

export class FreshRSSClient {
  authToken: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  async authenticate(): Promise<void> {
    const body = new URLSearchParams({
      Email: this.username,
      Passwd: this.password,
    });

    const res = await fetch(`${this.baseUrl}/api/greader.php/accounts/ClientLogin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

    const text = await res.text();
    const match = text.match(/^Auth=(.+)$/m);
    if (!match) throw new Error("Auth token not found in response");
    this.authToken = match[1].trim();
  }

  private authHeaders(): Record<string, string> {
    if (!this.authToken) throw new Error("Not authenticated");
    return { Authorization: `GoogleLogin auth=${this.authToken.replace(/^GoogleLogin auth=/, "")}` };
  }

  async getFeeds(): Promise<Feed[]> {
    const res = await fetch(
      `${this.baseUrl}/api/greader.php/reader/api/0/subscription/list?output=json`,
      { headers: this.authHeaders() }
    );
    if (!res.ok) throw new Error(`getFeeds failed: ${res.status}`);
    const data = await res.json() as { subscriptions: Array<{ id: string; title: string; url: string }> };
    return data.subscriptions.map((s) => ({ id: s.id, title: s.title, url: s.url }));
  }

  async getUnreadArticles(options: { limit?: number; feedId?: string } = {}): Promise<Article[]> {
    const params = new URLSearchParams({
      xt: "user/-/state/com.google/read",
      output: "json",
      n: String(options.limit ?? 20),
    });
    if (options.feedId) {
      params.set("s", options.feedId);
    }

    const res = await fetch(
      `${this.baseUrl}/api/greader.php/reader/api/0/stream/contents/reading-list?${params}`,
      { headers: this.authHeaders() }
    );
    if (!res.ok) throw new Error(`getUnreadArticles failed: ${res.status}`);
    const data = await res.json() as { items: StreamItem[] };
    return data.items.map(toArticle);
  }

  async getArticleContent(id: string): Promise<Article> {
    const params = new URLSearchParams({ i: id, output: "json" });
    const res = await fetch(
      `${this.baseUrl}/api/greader.php/reader/api/0/stream/contents?${params}`,
      { headers: this.authHeaders() }
    );
    if (!res.ok) throw new Error(`getArticleContent failed: ${res.status}`);
    const data = await res.json() as { items: StreamItem[] };
    if (!data.items[0]) throw new Error(`Article not found: ${id}`);
    return toArticle(data.items[0]);
  }

  async markAsRead(ids: string[]): Promise<void> {
    const token = await this.getEditToken();
    const params = new URLSearchParams({ T: token, a: "user/-/state/com.google/read" });
    ids.forEach((id) => params.append("i", id));

    const res = await fetch(`${this.baseUrl}/api/greader.php/reader/api/0/edit-tag`, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`markAsRead failed: ${res.status}`);
  }

  async searchArticles(query: string, limit = 20): Promise<Article[]> {
    const params = new URLSearchParams({
      s: "user/-/state/com.google/reading-list",
      q: query,
      output: "json",
      n: String(limit),
    });

    const res = await fetch(
      `${this.baseUrl}/api/greader.php/reader/api/0/stream/contents?${params}`,
      { headers: this.authHeaders() }
    );
    if (!res.ok) throw new Error(`searchArticles failed: ${res.status}`);
    const data = await res.json() as { items: StreamItem[] };
    return data.items.map(toArticle);
  }

  private async getEditToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/greader.php/reader/api/0/token`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`getEditToken failed: ${res.status}`);
    return res.text();
  }
}

function toArticle(item: StreamItem): Article {
  return {
    id: item.id,
    title: item.title,
    url: item.canonical?.[0]?.href ?? "",
    publishedAt: item.published,
    content: item.summary?.content ?? "",
    feedId: item.origin?.streamId ?? "",
    feedTitle: item.origin?.title ?? "",
  };
}
