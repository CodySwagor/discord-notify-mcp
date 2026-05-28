const DISCORD_MAX_CONTENT = 2000;

/**
 * Post a message to a Discord channel via an incoming webhook.
 *
 * @param {object} params
 * @param {string} params.webhookUrl - Discord webhook URL.
 * @param {string} params.content - Message body (truncated to Discord's 2000-char limit).
 * @param {string} [params.username] - Override the webhook's display name.
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
export async function postToDiscord({ webhookUrl, content, username }) {
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL is not set');
  }
  if (!content || !content.trim()) {
    throw new Error('content must be a non-empty string');
  }

  const body = {
    content: content.slice(0, DISCORD_MAX_CONTENT),
    ...(username && { username }),
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Discord webhook returned ${res.status} ${res.statusText} ${detail}`.trim());
  }

  return { ok: true, status: res.status };
}
