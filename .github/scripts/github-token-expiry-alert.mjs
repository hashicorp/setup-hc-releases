import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const DAY = 86400 * 1000;
const FEED_CHANNEL = "#feed-selfmanaged-releng-alerts";
const URGENT_CHANNEL = "#team-selfmanaged-releng";

export function parseExpiration(value) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|GMT|[+-]\d{4})$/.exec(value);
  if (!match) {
    throw new Error("GitHub returned an unrecognized token expiration header.");
  }
  const [, date, time, zone] = match;
  const offset = zone === "UTC" || zone === "GMT"
    ? "Z"
    : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const timestamp = Date.parse(`${date}T${time}${offset}`);
  const calendarTime = Date.parse(`${date}T${time}Z`);
  if (!Number.isFinite(timestamp) || !Number.isFinite(calendarTime)
    || new Date(calendarTime).toISOString().slice(0, 19) !== `${date}T${time}`) {
    throw new Error("GitHub returned an invalid token expiration date.");
  }
  return timestamp;
}

export async function checkToken(env, {
  fetch: request = globalThis.fetch,
  now = Date.now(),
  pause = sleep,
  log = console.log,
} = {}) {
  for (const name of [
    "TOKEN_DOWNLOAD_RELAPI", "SLACK_BOT_TOKEN", "SLACK_MANAGER_ID",
    "SLACK_ONCALL_GROUP_ID", "GITHUB_REPOSITORY", "WORKFLOW_RUN_URL",
  ]) {
    if (!env[name]?.trim()) {
      throw new Error(`Required GitHub Actions configuration ${name} is missing.`);
    }
  }
  if (!/^U[A-Z0-9]+$/.test(env.SLACK_MANAGER_ID)
    || !/^S[A-Z0-9]+$/.test(env.SLACK_ONCALL_GROUP_ID)) {
    throw new Error("Slack manager or on-call group ID is invalid.");
  }

  // Transport errors and response bodies may contain credentials.
  async function send(url, options, provider) {
    try {
      return await request(url, { ...options, signal: AbortSignal.timeout(30000) });
    } catch {
      throw new Error(`${provider} request failed or timed out; check connectivity and rerun.`);
    }
  }

  const response = await send("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${env.TOKEN_DOWNLOAD_RELAPI}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
  }, "GitHub");

  const subject = `GitHub Actions secret TOKEN_DOWNLOAD_RELAPI in ${env.GITHUB_REPOSITORY}`;
  let remaining;
  let status;
  const invalid = response.status === 401;
  if (invalid) {
    remaining = 0;
    status = "was rejected by GitHub (HTTP 401): EXPIRED, revoked, or invalid";
  } else {
    if (response.status !== 200) {
      throw new Error(`GitHub token check failed (HTTP ${response.status}).`);
    }
    const header = response.headers.get("github-authentication-token-expiration");
    if (!header) {
      log("::warning::GitHub returned no expiration header for TOKEN_DOWNLOAD_RELAPI; expiry cannot be determined. Confirm the token's expiry policy in GitHub.");
      return;
    }
    const expiry = parseExpiration(header);
    remaining = expiry - now;
    status = remaining <= 0
      ? `EXPIRED at ${new Date(expiry).toISOString()}`
      : `expires in ${Math.ceil(remaining / DAY)} day(s), at ${new Date(expiry).toISOString()}`;
  }

  if (remaining > 30 * DAY) {
    log("TOKEN_DOWNLOAD_RELAPI expires in more than 30 days; no alert needed.");
    return;
  }
  const text = `GitHub token-expiry alert: ${subject} ${status}. Rotate the token and update the GitHub Actions secret and any other consumers. Workflow: ${env.WORKFLOW_RUN_URL}`;
  const alerts = [{ channel: FEED_CHANNEL, text }];
  if (remaining <= 7 * DAY) {
    alerts.push({
      channel: URGENT_CHANNEL,
      text: `<!subteam^${env.SLACK_ONCALL_GROUP_ID}> <@${env.SLACK_MANAGER_ID}> URGENT: ${text}`,
    });
  }

  const failures = [];
  for (const alert of alerts) {
    try {
      await pause(1000);
      const slack = await send("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ ...alert, unfurl_links: false, unfurl_media: false }),
        redirect: "error",
      }, "Slack");
      if (!slack.ok) {
        throw new Error(`Slack delivery to ${alert.channel} failed (HTTP ${slack.status}).`);
      }
      let result;
      try {
        result = await slack.json();
      } catch {
        throw new Error(`Slack returned invalid JSON for ${alert.channel}.`);
      }
      if (result?.ok !== true) {
        throw new Error(`Slack rejected delivery to ${alert.channel}; check bot credentials, chat:write scope, and channel membership.`);
      }
      log(`Sent token-expiry alert to ${alert.channel}.`);
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (invalid) {
    failures.push("TOKEN_DOWNLOAD_RELAPI was rejected by GitHub; rotate or repair the token.");
  }
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkToken(process.env).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
