#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { postToDiscord } from '../src/discord.js';
import { colorForTitle } from '../src/color.js';

/**
 * Claude Code Notification hook. Fires when Claude needs your input (permission
 * prompt or idle-waiting). Reads the hook payload from stdin, mines the session
 * transcript for context (conversation title, ticket, your last prompt), and
 * posts a clean Discord embed asking you to come back.
 *
 * Soft-fails (exit 0) so a Discord/transcript problem never blocks the session.
 */

const TICKET_RE = /\b[pP]-\d{1,6}\b/;
const FIELD_LIMIT = 1024; // Discord embed field value cap

const readStdin = () =>
  new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });

const truncate = (s, n) => {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

const webhookName = () => {
  let name = '';
  try {
    name = userInfo().username || '';
  } catch {
    name = process.env.USER || process.env.LOGNAME || '';
  }
  const pascal = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
  return pascal || 'Claude Code';
};

const mineTranscript = (path) => {
  const out = { aiTitle: null, lastPrompt: null };
  if (!path) return out;
  let lines;
  try {
    lines = readFileSync(path, 'utf8').trim().split('\n');
  } catch {
    return out;
  }
  for (const line of lines) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type === 'ai-title' && o.aiTitle) out.aiTitle = o.aiTitle;
    if (o.type === 'last-prompt' && o.lastPrompt) out.lastPrompt = o.lastPrompt;
  }
  return out;
};

const branchName = (cwd) => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const buildEmbed = ({ payload, aiTitle, lastPrompt }) => {
  const branch = branchName(payload.cwd);
  const ticket = (aiTitle?.match(TICKET_RE) || branch?.match(TICKET_RE) || [])[0] || null;
  const ask = payload.message?.trim() || 'Claude is waiting for your input.';

  return {
    color: colorForTitle(aiTitle),
    title: ticket ? `🔔 ${ticket} — Claude needs you` : '🔔 Claude needs you',
    description: truncate(ask, 400),
    ...(aiTitle && { author: { name: truncate(aiTitle, 256) } }),
    ...(lastPrompt && {
      fields: [{ name: 'You said', value: truncate(lastPrompt, FIELD_LIMIT) }],
    }),
    ...(branch && { footer: { text: branch } }),
  };
};

const main = async () => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const { aiTitle, lastPrompt } = mineTranscript(payload.transcript_path);
  const embed = buildEmbed({ payload, aiTitle, lastPrompt });

  if (process.env.DISCORD_NOTIFY_DRY_RUN) {
    process.stdout.write(`${JSON.stringify(embed, null, 2)}\n`);
    return;
  }

  try {
    await postToDiscord({ webhookUrl, embeds: [embed], username: webhookName() });
  } catch {
    // soft-fail
  }
};

await main();
