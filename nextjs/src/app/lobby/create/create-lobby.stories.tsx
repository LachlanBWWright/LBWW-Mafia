import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import CreateLobbyPage from "./page";
import { installEmptyPresetStoryFixture } from "./presets-story-fixture";
const meta = {
  title: "Features/Custom lobby",
  component: CreateLobbyPage,
  beforeEach: installEmptyPresetStoryFixture,
  parameters: { nextjs: { appDirectory: true }, layout: "fullscreen" },
} satisfies Meta<typeof CreateLobbyPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RolePool: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText("Players", { exact: true }),
    ).toBeVisible();
    await userEvent.click(canvas.getByLabelText("List publicly"));
    await expect(canvas.getByLabelText("Lobby name")).toBeVisible();
  },
};
export const ExplicitSlots: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Advanced setup", { exact: true }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Explicit slots" }),
    );
    await expect(canvas.getByLabelText("Role slots")).toBeVisible();
  },
};
export const InvalidRules: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Advanced setup", { exact: true }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Weighted random" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Create lobby" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enable at least one role.",
    );
  },
};
export const HouseRules: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Advanced setup", { exact: true }));
    const duration = canvas.getByLabelText("Day duration (seconds)");
    await userEvent.clear(duration);
    await userEvent.type(duration, "120");
    await userEvent.click(canvas.getByText("Information and communication"));
    await userEvent.selectOptions(
      canvas.getByLabelText("Death reveals"),
      "none",
    );
    await expect(duration).toHaveValue(120);
    await expect(canvas.getByLabelText("Death reveals")).toHaveValue("none");
  },
};
export const CustomRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Advanced setup", { exact: true }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Weighted random" }),
    );
    await userEvent.click(canvas.getByText("Custom roles and variants"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Add custom role" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Edit Field Medic" }),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Field Medic weight")).toHaveValue(1);
  },
};
export const InvalidPack: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Advanced setup", { exact: true }));
    await userEvent.click(canvas.getByText("Import and share a game pack"));
    await userEvent.type(
      canvas.getByLabelText("Pack JSON or share link"),
      "invalid",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Import pack" }));
    await expect(
      canvas.getByText("Game pack is not valid JSON."),
    ).toBeVisible();
  },
};
