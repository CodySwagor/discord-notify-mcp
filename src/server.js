#!/usr/bin/env node
import { postToDiscord } from './discord.js';

/**
 * Minimal, dependency-free MCP stdio server exposing a single `send_discord_message`
 * tool. Speaks newline-delimited JSON-RPC 2.0 over stdin/stdout — the same wire
 * format the official SDK's StdioServerTransport uses.
 *
 * Kept dependency-free on purpose: Claude Code installs plugins by cloning the
 * repo without running `npm install`, so the server must run with Node built-ins
 * only. The webhook URL is read from DISCORD_WEBHOOK_URL (the plugin maps
 * ${user_config.webhook_url} into that env var).
 */

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'discord-notify', version: '1.0.0' };

const TOOL = {
  name: 'send_discord_message',
  description:
    'Send a message to the configured Discord channel via webhook. Use this to notify the ' +
    'user when a task is complete, when input is needed, or to surface any noteworthy update.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        description: 'The message to post. Discord markdown is supported. Max 2000 characters.',
      },
      username: {
        type: 'string',
        description: 'Optional display name override for this message (e.g. the project name).',
      },
    },
    required: ['content'],
    additionalProperties: false,
  },
};

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const replyError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

const callTool = async (params) => {
  if (params?.name !== TOOL.name) {
    return { content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }], isError: true };
  }
  const { content, username } = params.arguments ?? {};
  try {
    const { status } = await postToDiscord({
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      content,
      username,
    });
    return { content: [{ type: 'text', text: `Message delivered to Discord (HTTP ${status}).` }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Failed to send: ${err.message}` }], isError: true };
  }
};

const handle = async (msg) => {
  const { id, method, params } = msg;
  // Notifications (no id) get no response.
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case 'initialize':
      if (isRequest) {
        reply(id, {
          protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        });
      }
      return;
    case 'tools/list':
      if (isRequest) reply(id, { tools: [TOOL] });
      return;
    case 'tools/call':
      if (isRequest) reply(id, await callTool(params));
      return;
    case 'ping':
      if (isRequest) reply(id, {});
      return;
    default:
      // Unknown notifications are ignored; unknown requests get a proper error.
      if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
  }
};

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignore malformed lines
    }
    handle(msg).catch(() => {});
  }
});
process.stdin.on('error', () => {});
