import express, { type RequestHandler } from "express";

interface AppOptions {
  apiKey: string;
  mcpHandler: RequestHandler;
}

export function createApp({ apiKey, mcpHandler }: AppOptions) {
  const app = express();
  app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));

  const bearerAuth: RequestHandler = (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token !== apiKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };

  app.post("/mcp", bearerAuth, mcpHandler);

  return app;
}
