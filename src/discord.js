const DISCORD_MAX_CONTENT = 2000;

/**
 * Post a message to a Discord channel via an incoming webhook. Supply `content`,
 * `embeds`, or both — Discord requires at least one.
 *
 * @param {object} params
 * @param {string} params.webhookUrl - Discord webhook URL.
 * @param {string} [params.content] - Plain message body (truncated to 2000 chars).
 * @param {object[]} [params.embeds] - Discord embed objects.
 * @param {string} [params.username] - Override the webhook's display name.
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
export async function postToDiscord({ webhookUrl, content, embeds, username }) {
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL is not set');
  }
  const hasContent = Boolean(content && content.trim());
  const hasEmbeds = Array.isArray(embeds) && embeds.length > 0;
  if (!hasContent && !hasEmbeds) {
    throw new Error('provide content or embeds');
  }

  const body = {
    ...(hasContent && { content: content.slice(0, DISCORD_MAX_CONTENT) }),
    ...(hasEmbeds && { embeds }),
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
