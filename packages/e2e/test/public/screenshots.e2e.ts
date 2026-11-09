import { defineScreenshotSuite } from "../support/screenshot-suite";

defineScreenshotSuite("public", [
  { name: "home", path: "/" },
  { name: "sign-in", path: "/sign-in" },
  { name: "dashboard", path: "/dashboard" },
  { name: "course", path: "/learn/sample-course" },
]);
