import type { AccessibilityState } from "react-native";

/** RN Web consumes individual ARIA props; native retains accessibilityState. */
export function buttonWebAccessibility(
  state: AccessibilityState | undefined,
  disabled: boolean,
) {
  return {
    "aria-pressed": state?.selected ?? state?.checked,
    "aria-expanded": state?.expanded,
    "aria-busy": state?.busy,
    "aria-disabled": disabled,
  };
}
