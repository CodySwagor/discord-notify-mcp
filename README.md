# discord-notify-mcp

A tiny [MCP](https://modelcontextprotocol.io) server — plus a pair of Claude Code
hooks — that pushes messages to a Discord channel through an
[incoming webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Two ways to use it:

- **MCP tool** (`send_discord_message`): Claude can deliberately post a message
  mid-task ("ping me on Discord when the build finishes").
- **Hooks** (`Stop`, `Notification`): the Claude Code harness auto-posts when a
  turn completes or when Claude needs your input — even if you've walked away.

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
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /ABSOLUTE/PATH/TO/discord-notify-mcp/hooks/notify.mjs"
          }
        ]
      }
    ],
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

## The MCP tool

| Tool | Arguments | Description |
| --- | --- | --- |
| `send_discord_message` | `content` (string, required), `username` (string, optional) | Posts `content` to the channel. `username` overrides the webhook display name for that message. |

## The hooks

| Event | When it fires | Message |
| --- | --- | --- |
| `Stop` | Claude finishes a response turn | `✅ <project> — Claude finished and is ready for you.` |
| `Notification` | Claude needs permission or has been waiting on you | `🔔 <project> — <notification text>` |

> **Noise note:** `Stop` fires at the *end of every turn*, so during active
> back-and-forth you'll get a ping each time Claude responds. If that's too much,
> remove the `Stop` block and keep only `Notification` (which fires just when
> Claude is actually waiting on you).

## Manual test

```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/XXXX/XXXX" \
  node -e "import('./src/discord.js').then(m => m.postToDiscord({webhookUrl: process.env.DISCORD_WEBHOOK_URL, content: 'hello from discord-notify-mcp'}))"
```

## License

MIT
