# discord-notify-mcp

A tiny [MCP](https://modelcontextprotocol.io) server — plus a pair of Claude Code
hooks — that pushes messages to a Discord channel through an
[incoming webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Three ways to use it:

- **MCP tool** (`send_discord_message`): Claude can deliberately post a message
  mid-task ("ping me on Discord when the build finishes").
- **Skill** (`discord-notify`): teaches Claude *when* and *how* to send a good
  ping (ticket + a concise "what needs you" summary) via the MCP tool.
- **Notification hook**: the Claude Code harness auto-posts a context-rich ping
  when Claude is **waiting on you** — it mines the session transcript for the
  conversation title, ticket, your last prompt, and Claude's last message.

The webhook URL is **never stored in this repo**. It's supplied once at install
time (stored securely by Claude Code) and reaches the MCP server and hook as the
`DISCORD_WEBHOOK_URL` environment variable.

This repo is a self-contained **Claude Code plugin**: it bundles the MCP server,
the skill, and the Notification hook, and has **no runtime dependencies** (pure
Node — nothing to `npm install`). Install it straight from GitHub.

## Setup

### 1. Create a Discord webhook

In Discord: **Server Settings → Integrations → Webhooks → New Webhook**, pick the
target channel, and **Copy Webhook URL**.

### 2. Install the plugin

The repo is its own plugin marketplace. Add it, then install:

```bash
claude plugin marketplace add CodySwagor/discord-notify-mcp
claude plugin install discord-notify@discord-notify
```

You'll be prompted for the **Discord Webhook URL** (the plugin's `webhook_url`
user config). It's stored securely and injected into both the MCP server and the
hook — you never edit `settings.json` by hand. To pass it non-interactively:

```bash
claude plugin install discord-notify@discord-notify \
  --config webhook_url="https://discord.com/api/webhooks/XXXX/XXXX"
```

Restart Claude Code to pick up the plugin. That's it — the MCP tool, the skill,
and the Notification hook are all wired up.

> Only the `Notification` event is wired — it fires when Claude needs permission
> or has been waiting on your input, i.e. exactly when you need to come back. The
> `Stop` event (end of *every* turn) is intentionally not used; it pings on every
> response and drowns out the signal. Add it yourself if you want it.

### Updating / removing

```bash
claude plugin update discord-notify       # pull the latest from GitHub
claude plugin uninstall discord-notify    # remove it
```

## The MCP tool

| Tool | Arguments | Description |
| --- | --- | --- |
| `send_discord_message` | `content` (string, required), `username` (string, optional) | Posts `content` to the channel. `username` overrides the webhook display name for that message. |

## The Notification hook

Fires when Claude needs permission or has been waiting on your input. It reads
`transcript_path` and posts a Discord **embed**:

| Embed part | Source |
| --- | --- |
| Title — `🔔 <ticket> — Claude needs you` | ticket parsed from the conversation title (`ai-title`), falling back to the git branch |
| Author | the conversation title (`ai-title`) |
| Description | the notification message (what Claude is waiting on) |
| `You said` field | your last prompt (`last-prompt`) |
| Footer | git branch |
| Color | deterministically derived from the conversation title (`ai-title`) — same title always gets the same color, hues spread across the full spectrum so different conversations stand out at a glance; amber fallback when there's no title |

Preview the embed JSON without sending:

```bash
DISCORD_NOTIFY_DRY_RUN=1 node hooks/notify.mjs < some-hook-payload.json
```

## Manual test

```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/XXXX/XXXX" \
  node -e "import('./src/discord.js').then(m => m.postToDiscord({webhookUrl: process.env.DISCORD_WEBHOOK_URL, content: 'hello from discord-notify-mcp'}))"
```

## License

MIT
