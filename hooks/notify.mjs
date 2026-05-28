#!/usr/bin/env node
import { basename } from 'node:path';
import { postToDiscord } from '../src/discord.js';

/**
 * Claude Code hook handler. Reads the hook JSON payload from stdin and posts a
 * context-aware message to Discord. Wired to the Stop and Notification events.
 *
 * Failures are swallowed (exit 0) so a Discord outage never blocks the session.
 */

const readStdin = () =>
  new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });

const buildMessage = (payload) => {
  const project = payload.cwd ? basename(payload.cwd) : 'unknown project';
  const event = payload.hook_event_name;

  if (event === 'Notification') {
    const note = payload.message?.trim() || 'Claude needs your attention.';
    return `🔔 **${project}** — ${note}`;
  }
  if (event === 'SubagentStop') {
    return `🧩 **${project}** — a subagent finished.`;
  }
  // Stop (and any unknown event) → a turn completed.
  return `✅ **${project}** — Claude finished and is ready for you.`;
};

const main = async () => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return; // nothing configured; stay silent

  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  try {
    await postToDiscord({ webhookUrl, content: buildMessage(payload), username: 'Claude Code' });
  } catch {
    // soft-fail: never block the session on a notification error
  }
};

await main();
