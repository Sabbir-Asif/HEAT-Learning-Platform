import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const parseEnv = (text) =>
  Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

const compose = read("infra/compose/docker-compose.dev.yml");
const nginx = read("infra/nginx/dev.conf");
const composeEnv = parseEnv(read("infra/compose/.env.example"));
const apps = ["api", "worker", "frontend-public", "frontend-internal"];
const services = ["postgres", "redis", "mailpit", "nginx"];

// The text of one top-level service block.
const service = (name) =>
  compose.match(new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)+)`, "m"))?.[1] ?? "";
const server = (host) =>
  nginx.match(new RegExp(`server_name ${host};([\\s\\S]*?)\\n}\\n`))?.[1] ?? "";

describe("dev compose stack", () => {
  test.each(services)("%s is defined with a health check", (name) => {
    expect(service(name)).toContain("healthcheck:");
  });

  test("Redis keeps an append-only log and never evicts, as BullMQ requires", () => {
    expect(service("redis")).toMatch(/"--appendonly", "yes"/);
    expect(service("redis")).toMatch(/"--maxmemory-policy", "noeviction"/);
  });

  test("Postgres 17 and Redis keep their data in named volumes", () => {
    expect(service("postgres")).toContain("image: postgres:17");
    expect(service("postgres")).toContain("postgres-data:/var/lib/postgresql/data");
    expect(service("redis")).toContain("redis-data:/data");
    expect(compose).toMatch(/^volumes:\n {2}postgres-data:\n {2}redis-data:/m);
  });

  test("every published port is bound to loopback", () => {
    const ports = [...compose.matchAll(/^ {6}- "([^"]+:\d+)"$/gm)].map((m) => m[1]);
    expect(ports).toHaveLength(5);
    expect(ports.filter((port) => !port.startsWith("127.0.0.1:"))).toEqual([]);
  });

  test("every variable the compose file reads has a default in .env.example", () => {
    const used = [...compose.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !(name in composeEnv))).toEqual([]);
  });
});

describe("dev Nginx config", () => {
  test("learn.localhost serves the public frontend and /api goes to the API", () => {
    const block = server("learn.localhost");
    expect(block).toMatch(/location \/api\/ \{\s*proxy_pass http:\/\/api;/);
    expect(block).toMatch(/location \/ \{\s*proxy_pass http:\/\/frontend_public;/);
  });

  test("admin.localhost serves the internal frontend and /api goes to the API", () => {
    const block = server("admin.localhost");
    expect(block).toMatch(/location \/api\/ \{\s*proxy_pass http:\/\/api;/);
    expect(block).toMatch(/location \/ \{\s*proxy_pass http:\/\/frontend_internal;/);
  });

  test("upstreams match the app ports", () => {
    expect(nginx).toMatch(/upstream frontend_public \{\s*server host\.docker\.internal:3000;/);
    expect(nginx).toMatch(/upstream frontend_internal \{\s*server host\.docker\.internal:3001;/);
    expect(nginx).toMatch(/upstream api \{\s*server host\.docker\.internal:4000;/);
  });
});

describe("environment files", () => {
  test.each(apps)("apps/%s has an .env.example", (app) => {
    expect(Object.keys(parseEnv(read(`apps/${app}/.env.example`))).length).toBeGreaterThan(0);
  });

  test("API and worker connect to the ports the stack publishes", () => {
    for (const app of ["api", "worker"]) {
      const env = parseEnv(read(`apps/${app}/.env.example`));
      expect(env.DATABASE_URL).toContain(
        `${composeEnv.POSTGRES_USER}:${composeEnv.POSTGRES_PASSWORD}@localhost:${composeEnv.POSTGRES_PORT}/${composeEnv.POSTGRES_DB}`,
      );
      expect(env.REDIS_URL).toBe(`redis://localhost:${composeEnv.REDIS_PORT}`);
      expect(env.SMTP_PORT).toBe(composeEnv.MAILPIT_SMTP_PORT);
    }
  });

  test("the only env files in git are .env.example files", () => {
    const tracked = execFileSync("git", ["ls-files", "--", "*.env", "*.env.*", "*/.env*"], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    expect(tracked.filter((file) => !file.endsWith(".env.example"))).toEqual([]);
    expect(tracked).toEqual(
      expect.arrayContaining([
        "infra/compose/.env.example",
        ...apps.map((a) => `apps/${a}/.env.example`),
      ]),
    );
  });

  test("real .env files are ignored by git", () => {
    const ignored = (path) => {
      try {
        execFileSync("git", ["check-ignore", "-q", path], { cwd: root });
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored("infra/compose/.env")).toBe(true);
    expect(ignored("apps/api/.env.local")).toBe(true);
    expect(ignored("infra/compose/.env.example")).toBe(false);
  });
});

test("root scripts drive the stack", () => {
  const { scripts } = JSON.parse(read("package.json"));
  expect(scripts["dev:up"]).toBe("node infra/scripts/dev.mjs up");
  expect(scripts["dev:down"]).toBe("node infra/scripts/dev.mjs down");
  expect(scripts["dev:reset"]).toBe("node infra/scripts/dev.mjs reset");
});
