import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { YAML11_SCHEMA, load } from "js-yaml";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const stack = load(read("infra/compose.prod.yml"), { schema: YAML11_SCHEMA });
const services = stack.services;
const names = Object.keys(services);
const apps = ["frontend-public", "frontend-internal", "api", "worker"];
const dataStores = ["postgres", "redis"];
const parseEnv = (text) =>
  Object.fromEntries(
    text
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

describe("production compose stack", () => {
  test("it runs nginx, both frontends, the API, the worker, Postgres and Redis", () => {
    expect([...names].sort()).toEqual(
      [
        "api",
        "frontend-internal",
        "frontend-public",
        "nginx",
        "postgres",
        "redis",
        "worker",
      ].sort(),
    );
  });

  test.each(names)("%s has a health check and restarts unless stopped", (name) => {
    expect(services[name].healthcheck.test).toBeDefined();
    expect(services[name].healthcheck.interval).toBeDefined();
    expect(services[name].restart).toBe("unless-stopped");
  });

  test.each(names)("%s has a CPU and a memory limit", (name) => {
    const limits = services[name].deploy.resources.limits;
    expect(Number(limits.cpus)).toBeGreaterThan(0);
    expect(limits.memory).toMatch(/^\d+[mg]$/);
  });

  test("the worker CPU budget does not exceed the API budget", () => {
    const cpus = (name) => Number(services[name].deploy.resources.limits.cpus);
    expect(cpus("worker")).toBeLessThanOrEqual(cpus("api"));
  });

  test.each(names)("%s runs in Asia/Dhaka time with rotated json-file logs", (name) => {
    expect(services[name].environment.TZ).toBe("Asia/Dhaka");
    expect(services[name].logging.driver).toBe("json-file");
    expect(services[name].logging.options).toEqual({ "max-size": "10m", "max-file": "5" });
  });

  test("only nginx publishes ports, 80 and 443 bound explicitly", () => {
    expect(names.filter((name) => services[name].ports)).toEqual(["nginx"]);
    expect(services.nginx.ports).toEqual(["0.0.0.0:80:80", "0.0.0.0:443:443"]);
  });

  test.each(dataStores)("%s is only on the internal network", (name) => {
    expect(services[name].networks).toEqual(["data"]);
    expect(stack.networks.data.internal).toBe(true);
  });

  test("nginx reaches only the web network and never the data stores", () => {
    expect(services.nginx.networks).toEqual(["web"]);
    expect(services["frontend-internal"].networks).toEqual(["web"]);
    expect(services["frontend-public"].networks).toEqual(["web", "revalidate"]);
  });

  test("the worker reaches frontend-public only through the internal revalidate network", () => {
    expect(stack.networks.revalidate.internal).toBe(true);
    expect(services.worker.networks).toEqual(["data", "egress", "revalidate"]);
    const members = names.filter((name) => (services[name].networks ?? []).includes("revalidate"));
    expect(members.sort()).toEqual(["frontend-public", "worker"]);
  });

  test.each([...apps, ...dataStores])("%s runs as a non-root user", (name) => {
    const user = String(services[name].user);
    expect(user).toBeTruthy();
    expect(user.split(":")[0]).not.toMatch(/^(0|root)$/);
  });

  test("nginx drops all capabilities except the ones it needs", () => {
    expect(services.nginx.cap_drop).toEqual(["ALL"]);
    expect(services.nginx.cap_add.sort()).toEqual(
      ["CHOWN", "DAC_READ_SEARCH", "NET_BIND_SERVICE", "SETGID", "SETUID"].sort(),
    );
  });

  test("nginx can read the deploy-owned TLS and site config mounts without write bypass", () => {
    expect(services.nginx.user).toBeUndefined();
    expect(services.nginx.cap_add).toContain("DAC_READ_SEARCH");
    expect(services.nginx.cap_add).not.toContain("DAC_OVERRIDE");
    const tls = services.nginx.volumes.find((volume) => volume.includes(":/etc/nginx/tls"));
    expect(tls.endsWith(":ro")).toBe(true);
  });

  test.each(names)("%s cannot gain privileges", (name) => {
    expect(services[name].security_opt).toContain("no-new-privileges:true");
  });

  test("secrets come from env files under ENV_DIR, never from the compose file", () => {
    const text = read("infra/compose.prod.yml");
    expect(text).not.toMatch(/PASSWORD|SECRET|_KEY|TOKEN/);
    for (const name of [...apps, "postgres", "nginx"]) {
      expect(services[name].env_file).toEqual([`\${ENV_DIR:-/etc/heat}/${name}.env`]);
    }
  });

  test("Redis keeps an append-only log, never evicts and stays under its memory limit", () => {
    const command = services.redis.command.join(" ");
    expect(command).toContain("--appendonly yes");
    expect(command).toContain("--maxmemory-policy noeviction");
    expect(command).toContain("--maxmemory 768mb");
    expect(services.redis.deploy.resources.limits.memory).toBe("1g");
  });

  test("Postgres and Redis keep their data in named volumes", () => {
    expect(services.postgres.volumes).toEqual(["postgres-data:/var/lib/postgresql/data"]);
    expect(services.redis.volumes).toEqual(["redis-data:/data"]);
    expect(Object.keys(stack.volumes).sort()).toEqual(["postgres-data", "redis-data"]);
  });

  test("video originals are mounted into the API and worker, never into nginx", () => {
    const mounts = (name) => (services[name].volumes ?? []).join("\n");
    expect(mounts("api")).toContain("/uploads:/srv/heat/uploads");
    expect(mounts("worker")).toContain("/uploads:/srv/heat/uploads");
    expect(mounts("nginx")).not.toContain("uploads");
    expect(mounts("nginx")).not.toMatch(/original/i);
  });

  test("nginx reads hls, certificates and media read-only", () => {
    const mounts = services.nginx.volumes.filter((volume) =>
      /\/(hls|certificates|media)[:]/.test(volume),
    );
    expect(mounts).toHaveLength(3);
    for (const mount of mounts) expect(mount.endsWith(":ro")).toBe(true);
  });

  test("the worker has a scratch directory and the API sees certificates read-only", () => {
    expect(services.worker.volumes.join("\n")).toContain("/tmp:/srv/heat/tmp");
    expect(services.api.volumes.join("\n")).toContain("/certificates:/srv/heat/certificates:ro");
  });

  test("nginx starts only after the API and both frontends are healthy", () => {
    for (const name of ["api", "frontend-public", "frontend-internal"])
      expect(services.nginx.depends_on[name].condition).toBe("service_healthy");
  });

  test("the API and worker wait for Postgres and Redis", () => {
    for (const name of ["api", "worker"])
      for (const store of dataStores)
        expect(services[name].depends_on[store].condition).toBe("service_healthy");
  });

  test("the API health check calls the route the API serves", () => {
    expect(services.api.healthcheck.test.join(" ")).toContain("127.0.0.1:4000/api/health");
    expect(read("apps/api/src/main.ts")).toContain("process.env.PORT ?? 4000");
  });

  test("images are pinned by registry prefix and release tag, with no latest", () => {
    const text = read("infra/compose.prod.yml");
    expect(text).not.toMatch(/:latest/);
    for (const name of apps)
      expect(services[name].image).toMatch(
        /^\$\{REGISTRY_PREFIX:\?[^}]+\}\/heat-[\w-]+:\$\{RELEASE_TAG:\?[^}]+\}$/,
      );
  });

  test("every variable the file reads is listed in the example env file", () => {
    const example = parseEnv(read("infra/compose.prod.env.example"));
    const used = [...read("infra/compose.prod.yml").matchAll(/(?<!\$)\$\{(\w+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !(name in example))).toEqual([]);
  });

  test("nginx mounts every include the shared Nginx config uses", () => {
    const text = read("infra/compose.prod.yml");
    for (const file of ["proxy.inc", "hls.inc", "certificates.inc", "media.inc"])
      expect(text).toContain(`./nginx/${file}:/etc/nginx/conf.d/${file}:ro`);
    expect(read("infra/nginx/nginx.conf")).toContain("env HLS_SIGNING_KEYS;");
  });
});
