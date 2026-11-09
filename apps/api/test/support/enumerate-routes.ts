import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { RequestMethod, type Type } from "@nestjs/common";
import { resolveAccessPolicy } from "../../src/access";

export interface RouteAccess {
  route: string;
  allowed: boolean;
  reason?: string;
}

const joinPath = (...parts: unknown[]): string =>
  `/${parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter((part) => part !== "")
    .join("/")}`;

export const enumerateRouteAccess = (
  discovery: DiscoveryService,
  scanner: MetadataScanner,
  prefix = "api",
): RouteAccess[] => {
  const reflector = new Reflector();
  const routes: RouteAccess[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || typeof metatype !== "function") continue;
    const controllerPath: unknown = Reflect.getMetadata(PATH_METADATA, metatype);
    const prototype = Object.getPrototypeOf(instance) as object;
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = Reflect.get(prototype, name) as () => void;
      const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
      if (typeof method !== "number") continue;
      const path: unknown = Reflect.getMetadata(PATH_METADATA, handler);
      const route = `${RequestMethod[method]} ${joinPath(prefix, controllerPath, path)} (${metatype.name}.${name})`;
      const policy = resolveAccessPolicy(reflector, [handler, metatype as Type]);
      routes.push(
        policy.kind === "denied"
          ? { route, allowed: false, reason: policy.reason }
          : { route, allowed: true },
      );
    }
  }
  return routes;
};

export const unguardedRoutes = (routes: RouteAccess[]): string[] =>
  routes.filter((entry) => !entry.allowed).map((entry) => `${entry.route}: ${entry.reason}`);
