import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("..", import.meta.url));
const standalone = `${app}.next/standalone/apps/frontend-public`;

cpSync(`${app}.next/static`, `${standalone}/.next/static`, { recursive: true });
cpSync(`${app}public`, `${standalone}/public`, { recursive: true });

await import(`${standalone}/server.js`);
