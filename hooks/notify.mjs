#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { postToDiscord } from '../src/discord.js';

/**
 * Claude Code Notification hook. Fires when Claude needs your input (permission
 * prompt or idle-waiting). Reads the hook payload from stdin, mines the session
 * transcript for context (conversation title, ticket, your last prompt, Claude's
 * last message), and posts a rich "come talk to me" ping to Discord.
 *
 * Soft-fails (exit 0) so a Discord/transcript problem never blocks the session.
 */

const TICKET_RE = /\b[pP]-\d{1,6}\b/;
const TOTAL_LIMIT = 1900; // headroom under Discord's 2000-char cap

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

const mineTranscript = (path) => {
  const out = { aiTitle: null, lastPrompt: null, lastAssistant: null };
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
    if (o.type === 'assistant' && Array.isArray(o.message?.content)) {
      const text = o.message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (text) out.lastAssistant = text;
    }
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

const buildMessage = ({ payload, aiTitle, lastPrompt, lastAssistant }) => {
  const branch = branchName(payload.cwd);
  const ticket = (aiTitle?.match(TICKET_RE) || branch?.match(TICKET_RE) || [])[0] || null;
  const ask = payload.message?.trim() || 'Claude is waiting for your input.';

  const header = ticket ? `🔔 **${ticket}** — Claude needs you` : '🔔 **Claude needs you**';

  const lines = [
    header,
    ...(aiTitle ? [`📋 ${truncate(aiTitle, 120)}`] : []),
    `> ${truncate(ask, 300)}`,
    ...(lastPrompt ? [`🗣️ **You:** ${truncate(lastPrompt, 280)}`] : []),
  ];

  // Fill remaining budget with Claude's last message (the most useful context).
  const used = lines.join('\n').length;
  const assistantBudget = TOTAL_LIMIT - used - 16;
  if (lastAssistant && assistantBudget > 80) {
    lines.push(`🤖 **Claude:** ${truncate(lastAssistant, assistantBudget)}`);
  }

  return lines.join('\n');
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

  const { aiTitle, lastPrompt, lastAssistant } = mineTranscript(payload.transcript_path);
  const content = buildMessage({ payload, aiTitle, lastPrompt, lastAssistant });

  if (process.env.DISCORD_NOTIFY_DRY_RUN) {
    process.stdout.write(`${content}\n`);
    return;
  }

  try {
    await postToDiscord({ webhookUrl, content, username: 'Claude Code' });
  } catch {
    // soft-fail
  }
};

await main();
