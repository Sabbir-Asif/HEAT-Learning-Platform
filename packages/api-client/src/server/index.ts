// Server-only entry: import from "@heat/api-client/server" in Server Components, Route Handlers and the data access layer.
export { ApiClientConfigError, serverFetch } from "./server-fetch";
export type { ServerFetchOptions } from "./server-fetch";
export * from "../generated/server/endpoints";
