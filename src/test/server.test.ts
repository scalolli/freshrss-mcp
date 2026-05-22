import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import { createApp } from "../server.js";

let server: Server;
let port: number;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      const app = createApp({ apiKey: "test-secret", mcpHandler: (_req, res) => res.json({ ok: true }) });
      server = app.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    })
);

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("Bearer token auth middleware", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("passes through with correct token", async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});
