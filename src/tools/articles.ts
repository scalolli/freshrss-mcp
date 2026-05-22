import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FreshRSSClient } from "../freshrss.js";

function text(content: string): CallToolResult {
  return { content: [{ type: "text", text: content }] };
}

export async function handleGetUnreadArticles(
  client: FreshRSSClient,
  args: { limit?: number; feedId?: string }
): Promise<CallToolResult> {
  const limit = args.limit ?? 20;
  const feedId = args.feedId;
  const articles = await client.getUnreadArticles({ limit, feedId });

  if (articles.length === 0) {
    return text("No unread articles found.");
  }

  const lines = articles.map(
    (a) =>
      `• [${a.id}] ${a.title}\n  Feed: ${a.feedTitle} | ${new Date(a.publishedAt * 1000).toISOString()}\n  ${a.url}`
  );
  return text(`Found ${articles.length} unread article(s):\n\n${lines.join("\n\n")}`);
}

export async function handleGetArticleContent(
  client: FreshRSSClient,
  args: { id: string }
): Promise<CallToolResult> {
  const article = await client.getArticleContent(args.id);
  return text(
    `# ${article.title}\n\nFeed: ${article.feedTitle}\nURL: ${article.url}\nPublished: ${new Date(article.publishedAt * 1000).toISOString()}\n\n${article.content}`
  );
}

export async function handleMarkAsRead(
  client: FreshRSSClient,
  args: { ids: string[] }
): Promise<CallToolResult> {
  await client.markAsRead(args.ids);
  return text(`Marked ${args.ids.length} article(s) as read.`);
}

export async function handleSearchArticles(
  client: FreshRSSClient,
  args: { query: string; limit?: number }
): Promise<CallToolResult> {
  const limit = args.limit ?? 20;
  const articles = await client.searchArticles(args.query, limit);

  if (articles.length === 0) {
    return text(`No articles found for query: "${args.query}"`);
  }

  const lines = articles.map(
    (a) =>
      `• [${a.id}] ${a.title}\n  Feed: ${a.feedTitle} | ${new Date(a.publishedAt * 1000).toISOString()}\n  ${a.url}`
  );
  return text(`Found ${articles.length} article(s) for "${args.query}":\n\n${lines.join("\n\n")}`);
}
