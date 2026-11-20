import { createElement } from "react";
import type { Preview } from "@storybook/nextjs-vite";

import "../src/styles/globals.css";

const preview: Preview = {
  decorators: [
    (Story) =>
      createElement(
        "div",
        {
          className:
            "bg-background text-foreground font-sans antialiased [&_*]:border-border [&_*]:outline-ring/50",
        },
        createElement(Story),
      ),
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "error",
    },
    layout: "centered",
  },
};

export default preview;
