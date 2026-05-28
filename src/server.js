#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { postToDiscord } from './discord.js';

const server = new McpServer({
  name: 'discord-notify',
  version: '1.0.0',
});

server.tool(
  'send_discord_message',
  'Send a message to the configured Discord channel via webhook. Use this to notify the ' +
    'user when a task is complete, when input is needed, or to surface any noteworthy update.',
  {
    content: z
      .string()
      .min(1)
      .describe('The message to post. Discord markdown is supported. Max 2000 characters.'),
    username: z
      .string()
      .optional()
      .describe('Optional display name override for this message (e.g. the project name).'),
  },
  async ({ content, username }) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const { status } = await postToDiscord({ webhookUrl, content, username });
    return {
      content: [{ type: 'text', text: `Message delivered to Discord (HTTP ${status}).` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
