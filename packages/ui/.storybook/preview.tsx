import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles.css";
import "./preview.css";

const withGlobals: Decorator = (Story, context) => {
  const dark = context.globals["theme"] === "dark";
  const lang = context.globals["locale"] === "bn" ? "bn" : "en";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.lang = lang;
  return (
    <div className={dark ? "dark" : undefined} lang={lang}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: { a11y: { test: "error" } },
  decorators: [withGlobals],
  initialGlobals: { theme: "light", locale: "en" },
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
    locale: {
      description: "Interface language",
      toolbar: {
        title: "Locale",
        icon: "globe",
        dynamicTitle: true,
        items: [
          { value: "en", title: "English" },
          { value: "bn", title: "বাংলা" },
        ],
      },
    },
  },
};

export default preview;
