import type { InitialSelection } from "@storybook/react-native";
import { view } from "./storybook.requires";

const initialSelectionId = (
  process.env.EXPO_PUBLIC_STORYBOOK_INITIAL_SELECTION ??
  process.env.EXPO_STORYBOOK_INITIAL_SELECTION
) as string | undefined;

const initialSelection = (initialSelectionId
  ? initialSelectionId === "mobile-ui-kit--component-gallery"
    ? ({ kind: "Mobile/UI kit", name: "Component Gallery" } satisfies InitialSelection)
    : initialSelectionId === "mobile-ui-kit--button-controls"
      ? ({ kind: "Mobile/UI kit", name: "Button Controls" } satisfies InitialSelection)
      : initialSelectionId === "mobile-ui-kit--badge-controls"
        ? ({ kind: "Mobile/UI kit", name: "Badge Controls" } satisfies InitialSelection)
        : initialSelectionId
  : undefined) as InitialSelection | undefined;

export default view.getStorybookUI({
  onDeviceUI: false,
  ...(initialSelection ? { initialSelection } : {}),
});
