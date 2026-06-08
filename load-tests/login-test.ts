import http from "k6/http";
import { check, sleep } from "k6";
import { Options } from "k6/options";

// ─── Configurable Variables ───────────────────────────────────────────────────
// Override via CLI: k6 run --env BASE_URL=http://... --env TARGET_RPM=10000 login-test.ts

const BASE_URL: string =
  __ENV.BASE_URL || "https://sentra-dev-gateway.acc.co.id";

/**
 * Target logins per minute. Range: 5000–10000.
 * With only 5 pre-allocated VUs, sustained rate requires <12ms avg response time.
 * k6 will escalate to maxVUs (20) automatically if VUs are exhausted.
 */
const TARGET_RPM: number = parseInt(__ENV.TARGET_RPM || "1000", 10);
const TEST_DURATION: string = __ENV.TEST_DURATION || "1m";
const WARMUP_DURATION: string = __ENV.WARMUP_DURATION || "30s";
const WARMUP_RPM: number = parseInt(__ENV.WARMUP_RPM || "500", 10);

// ─── Test Credentials ─────────────────────────────────────────────────────────
// Populate with real test accounts. Using multiple accounts avoids server-side
// rate limiting per-user. Replace these placeholders before running.
const TEST_CREDENTIALS = [
  {
    identifier:
      __ENV.TEST_USER_1 ||
      "2nseFU5M8sBajhhs1kduZQ%3D%3D%3AoYtOUpG8tYgaV3fU6Cm5mw",
    password:
      __ENV.TEST_PASS_1 ||
      "LS5vk83hz8wZcFVAKUpB9g%3D%3D%3ALbjqGXJbIAAE6bBtvHHTgg",
  },
  {
    identifier:
      __ENV.TEST_USER_2 ||
      "DICwS5uAZH-tr1a_EcPBDg%3D%3D%3AJOQXj0Qz7AuMHoNCpq7lNg",
    password:
      __ENV.TEST_PASS_2 ||
      "6twbQGtCo2boQXMfSqZLOw%3D%3D%3AVCMmMGfQc_xMm7GyYGrmZw",
  },
  //   {
  //     identifier: __ENV.TEST_USER_3 || "testuser3",
  //     password: __ENV.TEST_PASS_3 || "password3",
  //   },
  //   {
  //     identifier: __ENV.TEST_USER_4 || "testuser4",
  //     password: __ENV.TEST_PASS_4 || "password4",
  //   },
  //   {
  //     identifier: __ENV.TEST_USER_5 || "testuser5",
  //     password: __ENV.TEST_PASS_5 || "password5",
  //   },
];

// ─── k6 Options ───────────────────────────────────────────────────────────────
export const options: Options = {
  scenarios: {
    /**
     * Warmup: ramp from 0 to WARMUP_RPM so the Next.js process isn't cold-started
     * at full target concurrency. Remove if target server is already warm.
     */
    warmup: {
      executor: "constant-arrival-rate",
      rate: WARMUP_RPM,
      timeUnit: "1m",
      duration: WARMUP_DURATION,
      preAllocatedVUs: 5,
      maxVUs: 20,
      tags: { scenario: "warmup" },
    },

    /**
     * Main load: constant-arrival-rate fires exactly TARGET_RPM iterations/min
     * regardless of iteration response time fluctuations.
     *
     * preAllocatedVUs: 5 — exactly as requested.
     * maxVUs: 20        — k6 safety valve; if 5 VUs are all blocked (slow server),
     *                     k6 can spawn up to 20 to sustain the target rate.
     *                     Hard-constrain to 5 by setting maxVUs: 5 if desired.
     */
    main_load: {
      executor: "constant-arrival-rate",
      rate: TARGET_RPM,
      timeUnit: "1m",
      duration: TEST_DURATION,
      preAllocatedVUs: 5,
      maxVUs: 20,
      startTime: WARMUP_DURATION, // start after warmup
      tags: { scenario: "main_load" },
    },
  },

  thresholds: {
    // abortOnFail removed — let test run to completion so errors are visible
    http_req_failed: [{ threshold: "rate<0.01" }],
    http_req_duration: [
      { threshold: "p(95)<2000" },
      { threshold: "p(99)<5000" },
    ],
    checks: [{ threshold: "rate>0.95" }],
    "http_req_duration{scenario:main_load}": [{ threshold: "p(95)<2000" }],
    "http_req_failed{scenario:main_load}": [{ threshold: "rate<0.01" }],
  },
};

// ─── Request Config ───────────────────────────────────────────────────────────
const LOGIN_URL = `${BASE_URL}/public/login`;

const HEADERS = {
  "Content-Type": "application/json",
  "X-App-Identifier": "acc.me",
  APIKey: "03768ae42a3dfc95dc4d13e64226b27b1096f8545c120152383d5060d628c726",
  "X-Timestamp": "2026-04-22T04:12:09.000Z",
  "X-Signature":
    "kGt1ZdxpBwvBtpHTOTWmzLax/cpS/TpbVrtO6TO0UU1v8+3YpctqQyIr8URWFNm6/nKQ7hEHWr7yVVGuyxOldYmLlXJiQvShDfKRCmwfpoyhc9v038khpjrdFtxR5FnWVeXQ2RgfrW6UA4dltzmzhcIL+BuA+FthzsVWh4YN3ATmJIA2zdvrddvGNYGm0g6IG+aPbL0ypGrD+QBs+1OVdgCm8nKnb/fWCu1Ur5EHQev4yX5oHxcFNRZ79/6FWjCW4M/+q/Cz2KOlswhP07G3DSPAWYeWRreEtO4q53c6mqoMB+0JbGnt628R2Fl/bcOz04+eDbrEaZonXMBgud5Z2w==",
  "X-Key-Id": "mm4o0qqt-b5197ebcea5eb321",
  "X-Nonce": "e68ddecd-3c9d-47f5-83d8-49b2104c3f07",
  Authorization:
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjM0IiwianRpIjoiOTdjMzE3ZTktMWE0MC00ZDE5LWFjMzMtZjJjNmQ3OWYxYTI1IiwiYXBwX2lkIjoiOCIsImNvZGUiOiIiLCJhcHBfaWRlbnRpZmllciI6ImFjYy5tZSIsIm5wayI6IjgwOTIyIiwiZW1haWwiOiJ3YWh5dXVjYW5kcmFAZ21haWwuY29tIiwiZnVsbF9uYW1lIjoiQ2FuZHJhIEJ1YW5hIiwicGhvbmVfbnVtYmVyIjoiMDgyMTEyNDI2Mjg0IiwiZXhwIjoxNzc2ODMyMzMxLCJpc3MiOiJTc29CYWNrZW5kQVBJIiwiYXVkIjoiU3NvRnJvbnRlbmRBcHAifQ.ndz7ImFLUxMdCx5SVBNQAoc5IbSZQBqK9db7Wk2yYjs",
  "x-app-id": "acc.me",
  "x-app-secret":
    "03768ae42a3dfc95dc4d13e64226b27b1096f8545c120152383d5060d628c726",
  "x-username-source": "Npk",
};

// ─── Default Function (VU Iteration) ─────────────────────────────────────────
export default function (): void {
  // Distribute credentials evenly across VUs to spread server-side rate limits.
  const cred = TEST_CREDENTIALS[__VU % TEST_CREDENTIALS.length];

  const payload = JSON.stringify({
    identifier: cred.identifier,
    password: cred.password,
  });

  const res = http.post(LOGIN_URL, payload, {
    headers: HEADERS,
    tags: { name: "login" },
  });

  // Log every non-200 response so you can see exact server error
  if (res.status !== 200) {
    console.error(
      `[FAIL] status=${res.status} url=${LOGIN_URL} body=${res.body?.toString().substring(0, 500)}`,
    );
  }

  check(res, {
    "status is 200": (r) => r.status === 200,
    "accessToken present": (r) => {
      try {
        const body = r.json() as Record<string, unknown>;
        return (
          typeof body?.accessToken === "string" && body.accessToken.length > 0
        );
      } catch {
        return false;
      }
    },
    "refreshToken present": (r) => {
      try {
        const body = r.json() as Record<string, unknown>;
        return (
          typeof body?.refreshToken === "string" && body.refreshToken.length > 0
        );
      } catch {
        return false;
      }
    },
  });

  // No sleep — constant-arrival-rate scenario controls iteration pacing.
  // Adding sleep here would reduce effective concurrency without reducing rate.
  sleep(0);
}
