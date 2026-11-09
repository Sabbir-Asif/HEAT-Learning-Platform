import { defineScreenshotSuite } from "../support/screenshot-suite";

defineScreenshotSuite("internal", [
  { name: "overview", path: "/" },
  { name: "students", path: "/students" },
  { name: "sign-in", path: "/sign-in" },
]);
