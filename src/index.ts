import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { FreshRSSClient } from "./freshrss.js";
import { createApp } from "./server.js";
import { handleGetFeeds } from "./tools/feeds.js";
import {
  handleGetUnreadArticles,
  handleGetArticleContent,
  handleMarkAsRead,
  handleSearchArticles,
} from "./tools/articles.js";

const {
  FRESHRSS_URL,
  FRESHRSS_USERNAME,
  FRESHRSS_API_PASSWORD,
  MCP_API_KEY,
  PORT = "3000",
} = process.env;

if (!FRESHRSS_URL || !FRESHRSS_USERNAME || !FRESHRSS_API_PASSWORD || !MCP_API_KEY) {
  console.error(
    "Missing required env vars: FRESHRSS_URL, FRESHRSS_USERNAME, FRESHRSS_API_PASSWORD, MCP_API_KEY"
  );
  process.exit(1);
}

const client = new FreshRSSClient(FRESHRSS_URL, FRESHRSS_USERNAME, FRESHRSS_API_PASSWORD);
await client.authenticate();
console.log("Authenticated with FreshRSS");

const mcp = new McpServer({ name: "freshrss", version: "1.0.0" });

mcp.tool("get_feeds", "List all subscribed RSS feeds", {}, async () =>
  handleGetFeeds(client, {})
);

mcp.tool(
  "get_unread_articles",
  "Get unread articles, optionally filtered by feed",
  {
    limit: z.number().int().min(1).max(100).optional().describe("Max articles to return (default 20)"),
    feedId: z.string().optional().describe("Filter to a specific feed ID"),
  },
  async (args) => handleGetUnreadArticles(client, args)
);

mcp.tool(
  "get_article_content",
  "Get the full content of a single article by its ID",
  { id: z.string().describe("Article ID") },
  async (args) => handleGetArticleContent(client, args)
);

mcp.tool(
  "mark_as_read",
  "Mark one or more articles as read",
  { ids: z.array(z.string()).describe("Array of article IDs to mark as read") },
  async (args) => handleMarkAsRead(client, args)
);

mcp.tool(
  "search_articles",
  "Search articles by keyword",
  {
    query: z.string().describe("Search query"),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
  },
  async (args) => handleSearchArticles(client, args)
);

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

const app = createApp({
  apiKey: MCP_API_KEY,
  mcpHandler: async (req, res) => {
    await transport.handleRequest(req, res, req.body as unknown);
  },
});

await mcp.connect(transport);

app.listen(Number(PORT), () => {
  console.log(`FreshRSS MCP server listening on port ${PORT}`);
});
