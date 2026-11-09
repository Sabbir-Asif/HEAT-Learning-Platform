import { provideInfrastructure } from "@heat/db/testing";
import type { TestProject } from "vitest/node";

export default function setup(project: TestProject) {
  return provideInfrastructure(project);
}
