/**
 * Load test (k6, https://k6.io; not part of CI): ten organisations of 5,000 people each launch a
 * phishing simulation at the same moment, then the job runner has to drain the mail backlog while the
 * health endpoint keeps answering. Run it against a staging copy on PostgreSQL, never production.
 *
 * Preparation, outside this script: ten organisations with 5,000 active people each, one draft email
 * campaign (audience "all") per organisation, and a signed-in session of each organisation's admin.
 *
 *   k6 run load/launch.js \
 *     -e BASE_URL=https://staging.example \
 *     -e ACTION_ID=<id of launchCampaignAction in .next/server/server-reference-manifest.json> \
 *     -e TARGETS=<session cookie>:<campaign id>,<session cookie>:<campaign id>,...
 *
 * Production servers name the cookie __Host-cy_session (cy_session in development: set COOKIE_NAME).
 * Pass: every launch answers within 30 s and the health endpoint stays under 1 s at p95 (thresholds
 * below), and the logged mail backlog is back to 0 before the 15-minute health phase ends.
 */
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL;
const COOKIE_NAME = __ENV.COOKIE_NAME || "__Host-cy_session";
const TARGETS = (__ENV.TARGETS || "").split(",").filter(Boolean).map((pair) => {
  const [cookie, campaignId] = pair.split(":");
  return { cookie, campaignId };
});

export const options = {
  scenarios: {
    launch: { executor: "per-vu-iterations", vus: TARGETS.length || 1, iterations: 1, exec: "launch" },
    health: { executor: "constant-arrival-rate", rate: 1, timeUnit: "5s", duration: "15m", preAllocatedVUs: 2, exec: "health" },
  },
  thresholds: {
    "http_req_duration{scenario:launch}": ["max<30000"],
    "http_req_duration{scenario:health}": ["p(95)<1000"],
    checks: ["rate==1"],
  },
};

/** One admin presses Launch: the server action, called the way the browser calls it. */
export function launch() {
  const target = TARGETS[__VU - 1];
  const res = http.post(`${BASE_URL}/admin/campaigns`, JSON.stringify([target.campaignId]), {
    headers: { "Next-Action": __ENV.ACTION_ID, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE_URL, Cookie: `${COOKIE_NAME}=${target.cookie}` },
    timeout: "60s",
  });
  check(res, { "launch answered": (r) => r.status === 200 && r.body.includes('"ok":true') });
}

/** The health endpoint while the tick works through the backlog; its body reports the mail still queued. */
export function health() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health 200": (r) => r.status === 200 });
  if (res.status === 200) console.log(`mail backlog ${res.json("backlog.mail")}, last tick ${res.json("jobs.lastTickAt")}`);
}
