import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles.css";
import "./preview.css";

/**
 * Applies the toolbar theme. Dark is the `.dark` class (the shadcn and next-themes default; E1-2
 * keeps it). It goes on the story root and on <html>, so portalled content follows the theme.
 */
const withTheme: Decorator = (Story, context) => {
  const dark = context.globals["theme"] === "dark";
  document.documentElement.classList.toggle("dark", dark);
  return (
    <div className={dark ? "dark" : undefined}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
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
