---
name: discord-notify
description: >-
  Send a Discord ping to the user via the discord-notify MCP server. Use when the
  user asks to be notified/pinged/messaged on Discord ("ping me on Discord",
  "notify me when this is done", "let me know on Discord", "send me a Discord
  summary"), or when you've reached a point where the user must actively decide
  something and they've asked to be alerted. Composes a concise, context-rich
  message (ticket + what needs their attention) and delivers it via webhook.
---

# Discord Notify

Send the user a Discord message through the `discord-notify` MCP server.

## Tool

Call **`mcp__discord-notify__send_discord_message`** with:

- `content` (required) — the message. Discord markdown is supported (`**bold**`,
  `> quote`, backtick code, links). Hard limit 2000 chars; keep it tight.
- `username` (optional) — display-name override. Default to the ticket id (e.g.
  `P-2476`) or the project name so pings are scannable in the channel.

## What makes a good ping

The user reads this on their phone and decides whether to come back. Lead with
*why they're being pinged*, then give just enough context to act. Always include:

1. **Ticket number** if there is one — parse it from the conversation title, the
   git branch (`p-\d+` / `P-\d+`), or the task at hand. Put it up front.
2. **The headline** — one line: done / blocked / needs a decision.
3. **What needs their attention** — the specific question or choice, phrased so
   they could answer in one message.
4. **Brief context** — 1–3 lines of what led here. Don't paste logs or diffs.

### Template

```
🔔 **<TICKET>** — <one-line headline>

**Needs you:** <the specific question or decision>

<1–3 lines of context>
```

### Example

```
🔔 **P-2476** — blocked on a deploy question

**Needs you:** The scheduled-send/undo flow (p-2489) is throwing a DynamoDB
conditional-write error on dev. Should I roll back p-2489 on dev, or wait for
the owner? My thumbnail change is unaffected.
```

## When NOT to ping

- Routine progress the user didn't ask to be notified about.
- Mid-task chatter — only ping when they'd genuinely want to be pulled back.
- If the user hasn't opted into Discord notifications for this work, ask first.

## Notes

- The webhook URL is supplied at plugin install time (the `webhook_url` user
  config) and injected for you; you don't pass it. If the tool reports it's
  unset, tell the user to reconfigure it with
  `claude plugin install discord-notify@discord-notify --config webhook_url=...`
  (or the `/plugin` configure flow).
- An automatic `Notification` hook already fires when Claude is *waiting* for
  input. Use this skill for *deliberate* pings with a richer, hand-written
  summary, or when the user explicitly asks to be messaged.
