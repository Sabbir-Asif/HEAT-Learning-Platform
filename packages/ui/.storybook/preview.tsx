import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles.css";
import "./preview.css";

const withGlobals: Decorator = (Story, context) => {
  const dark = context.globals["theme"] === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.lang = "en";
  return (
    <div className={dark ? "dark" : undefined} lang="en">
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: { a11y: { test: "error" } },
  decorators: [withGlobals],
  initialGlobals: { theme: "light" },
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
};

export default preview;
