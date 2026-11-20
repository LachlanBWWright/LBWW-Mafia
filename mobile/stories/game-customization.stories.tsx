import React, { useState } from "react";
import { View } from "react-native";
import type { Meta, StoryObj } from "@storybook/react-native";
import { LobbyRulesEditor } from "../components/LobbyRulesEditor";
import { CustomRoleEditor } from "../components/CustomRoleEditor";
import { GamePackEditor } from "../components/GamePackEditor";
import { resolveGameRules } from "../../shared/game/gameRules";
import { createCustomRoleDraft, type CustomRole } from "../../shared/game/customRoles";
import { LobbyPresets } from "../components/LobbyPresets";
const meta = { title: "Game/Customization", component: LobbyRulesEditor, args: { rules: resolveGameRules({}), onChange: () => undefined } } satisfies Meta<typeof LobbyRulesEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
function InteractiveRules() { const [rules, setRules] = useState(() => resolveGameRules({})); return <LobbyRulesEditor rules={rules} onChange={setRules} />; }
function InteractiveRoles() { const [roles, setRoles] = useState<CustomRole[]>([createCustomRoleDraft()]); return <CustomRoleEditor roles={roles} onChange={setRoles} />; }
const config = { size: 4, voteVisibility: "public" as const, roleSelection: { algorithm: "explicit-slots" as const, roles: [], explicitSlots: ["mafia", "doctor", "investigator", "bodyguard"] } };
export const Rules: Story = { render: () => <InteractiveRules /> };
export const CustomRoles: Story = { render: () => <InteractiveRoles /> };
export const Packs: Story = { render: () => <GamePackEditor getConfig={() => config} onApply={() => undefined} /> };
export const SignedOutPresets: Story = { render: () => <View><LobbyPresets signedIn={false} getConfig={() => config} onApply={() => undefined} /></View> };
