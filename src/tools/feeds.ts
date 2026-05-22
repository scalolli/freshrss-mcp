import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FreshRSSClient } from "../freshrss.js";

export async function handleGetFeeds(client: FreshRSSClient, _args: object): Promise<CallToolResult> {
  const feeds = await client.getFeeds();

  if (feeds.length === 0) {
    return text("No feeds found.");
  }

  const lines = feeds.map((f) => `• [${f.id}] ${f.title}\n  ${f.url}`);
  return text(`Found ${feeds.length} feed(s):\n\n${lines.join("\n\n")}`);
}

function text(content: string): CallToolResult {
  return { content: [{ type: "text", text: content }] };
}
