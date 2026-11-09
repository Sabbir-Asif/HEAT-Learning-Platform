import type { TestProject } from "vitest/node";
import { provideInfrastructure } from "../../src/testing";

export default function setup(project: TestProject) {
  return provideInfrastructure(project);
}
