import { describe, expect, it } from "vitest";
import { buttonWebAccessibility } from "../components/buttonAccessibility";
import { colors } from "../styles/colors";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("native button web accessibility", () => {
  it("announces toggle, disclosure, busy and disabled state", () => {
    expect(buttonWebAccessibility({ selected: true, expanded: true, busy: true }, true)).toEqual({
      "aria-pressed": true,
      "aria-expanded": true,
      "aria-busy": true,
      "aria-disabled": true,
    });
  });

  it.each([true, false, "mixed"] as const)("maps checked %s to a button's pressed state", (checked) => {
    expect(buttonWebAccessibility({ checked }, false)["aria-pressed"]).toBe(checked);
  });

  it("preserves explicit false selection ahead of checked", () => {
    expect(buttonWebAccessibility({ selected: false, checked: true, expanded: false, busy: false }, false)).toEqual({
      "aria-pressed": false,
      "aria-expanded": false,
      "aria-busy": false,
      "aria-disabled": false,
    });
  });

  it("does not announce ordinary buttons as collapsed or toggled off", () => {
    expect(buttonWebAccessibility(undefined, false)).toEqual({
      "aria-pressed": undefined,
      "aria-expanded": undefined,
      "aria-busy": undefined,
      "aria-disabled": false,
    });
  });

  it("uses the effective disabled prop ahead of stale accessibility state", () => {
    expect(buttonWebAccessibility({ disabled: true }, false)["aria-disabled"]).toBe(false);
    expect(buttonWebAccessibility({ disabled: false }, true)["aria-disabled"]).toBe(true);
  });

  it("keeps primary button text above 4.5:1 contrast", () => {
    expect(contrast(colors.primary, colors.primaryForeground)).toBeGreaterThanOrEqual(4.5);
  });
});
