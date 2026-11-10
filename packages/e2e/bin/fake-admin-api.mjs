import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 4010);

const session = {
  user: {
    id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
    email: "super.admin@du.ac.bd",
    role: "SUPER_ADMIN",
    mustChangePassword: false,
  },
};

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/admin/me") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(session));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(
    JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found.", requestId: "e2e" } }),
  );
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
