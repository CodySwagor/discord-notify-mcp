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

The webhook URL is **never stored in this repo**. It's read from the
`DISCORD_WEBHOOK_URL` environment variable.

## Setup

### 1. Create a Discord webhook

In Discord: **Server Settings → Integrations → Webhooks → New Webhook**, pick the
target channel, and **Copy Webhook URL**.

### 2. Install

```bash
git clone git@github.com:CodySwagor/discord-notify-mcp.git
cd discord-notify-mcp
npm install
```

### 3. Register with Claude Code (global)

Add to `~/.claude/settings.json`. Put the secret in the top-level `env` so both
the MCP server and the hooks can read it.

```jsonc
{
  "env": {
    "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/XXXX/XXXX"
  },
  "mcpServers": {
    "discord-notify": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/discord-notify-mcp/src/server.js"]
    }
  },
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /ABSOLUTE/PATH/TO/discord-notify-mcp/hooks/notify.mjs"
          }
        ]
      }
    ]
  }
}
```

Restart Claude Code (or `/hooks` reload) to pick up the changes.

> Only the `Notification` event is wired — it fires when Claude needs permission
> or has been waiting on your input, i.e. exactly when you need to come back. The
> `Stop` event (end of *every* turn) is intentionally not used; it pings on every
> response and drowns out the signal. Add it yourself if you want it.

### 4. Install the skill (optional)

Copy the skill so Claude can send deliberate, well-composed pings on request:

```bash
mkdir -p ~/.claude/skills/discord-notify
cp skill/discord-notify/SKILL.md ~/.claude/skills/discord-notify/SKILL.md
```

Then just say "ping me on Discord when you're done" or "notify me if you get
blocked" and Claude will use it.

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
