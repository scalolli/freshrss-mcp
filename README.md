# FreshRSS MCP Server

An MCP (Model Context Protocol) server that bridges Claude with FreshRSS via the Google Reader API.

## Prerequisites

- [mise](https://mise.jdx.dev/) for Node.js version management
- Node.js 22 LTS (managed via mise)

## Setup

```bash
mise install          # installs Node 22 LTS
npm install
cp .env.example .env  # fill in your FreshRSS credentials
```

## Environment Variables

| Variable | Description |
|---|---|
| `FRESHRSS_URL` | Base URL of your FreshRSS instance (e.g. `https://rss.example.com`) |
| `FRESHRSS_USERNAME` | Your FreshRSS username |
| `FRESHRSS_API_PASSWORD` | FreshRSS API password (set in FreshRSS settings → Profile) |
| `MCP_API_KEY` | A strong random Bearer token to protect the MCP endpoint |
| `PORT` | Port to listen on (default: `3000`) |

## Running Locally

```bash
npm run dev     # development mode with tsx
npm run build   # compile TypeScript
npm start       # run compiled output
```

## Running Tests

Tests use Vitest + msw (HTTP mocking) and run fully offline:

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Docker

```bash
cp .env.example .env  # fill in your credentials
docker compose up
```

The image is published to `ghcr.io/scalolli/freshrss-mcp:latest` on every push to `main`.
To build locally instead:

```bash
docker build -t freshrss-mcp .
docker run -p 3000:3000 --env-file .env freshrss-mcp
```

## Claude Code / MCP Config

Add to your `~/.claude/claude_desktop_config.json` (or equivalent MCP config):

```json
{
  "mcpServers": {
    "freshrss": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <your-MCP_API_KEY>"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|---|---|
| `get_feeds` | List all subscribed feeds |
| `get_unread_articles` | Get unread articles (supports `limit` and `feedId` params) |
| `get_article_content` | Get full content of a single article by ID |
| `mark_as_read` | Mark one or more articles as read |
| `search_articles` | Search articles by keyword |
