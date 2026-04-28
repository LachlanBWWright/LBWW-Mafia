import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors, radius, spacing } from "../styles/colors";
import { useAppState } from "../context/AppStateContext";

type NavigationLike = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

type ScreenProps = {
  navigation: NavigationLike;
  activeRoute: string;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const navItems = [
  { label: "Lobby", route: "Lobby" },
  { label: "Roles", route: "Roles" },
  { label: "About", route: "About" },
  { label: "History", route: "History" },
  { label: "Profile", route: "Profile" },
  { label: "Admin", route: "Admin" },
];

export function Screen({
  navigation,
  activeRoute,
  title,
  subtitle,
  scroll = true,
  contentStyle,
  children,
}: ScreenProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.backgroundGlow} />
      <AppHeader navigation={navigation} activeRoute={activeRoute} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {title || subtitle ? (
            <View style={styles.pageHeading}>
              {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
              {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenBody, contentStyle]}>
          {title || subtitle ? (
            <View style={styles.pageHeading}>
              {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
              {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </View>
      )}
    </View>
  );
}

function AppHeader({
  navigation,
  activeRoute,
}: {
  navigation: NavigationLike;
  activeRoute: string;
}) {
  const { playerName, isAdmin } = useAppState();

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Pressable onPress={() => navigation.navigate("Home")} style={styles.brandWrap}>
          <Text style={styles.brand}>
            LBWW <Text style={styles.brandAccent}>Mafia</Text>
          </Text>
        </Pressable>
        <View style={styles.statusCluster}>
          <Badge variant="secondary">{playerName.trim() ? playerName : "Guest"}</Badge>
          {isAdmin ? <Badge variant="destructive">Admin</Badge> : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navRow}
      >
        {navItems.map((item) => (
          <NavChip
            key={item.route}
            label={item.label}
            active={item.route === activeRoute}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
  size = "md",
  style,
  textStyle,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonBase,
        buttonVariantStyles[variant],
        buttonSizeStyles[size],
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      <Text style={[styles.buttonText, buttonTextVariantStyles[variant], textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      numberOfLines={numberOfLines}
      style={[styles.input, multiline ? styles.inputMultiline : null]}
    />
  );
}

export function Badge({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: "secondary" | "outline" | "primary" | "destructive";
}) {
  return (
    <View style={[styles.badge, badgeVariants[variant]]}>
      <Text style={[styles.badgeText, badgeTextVariants[variant]]}>{children}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  tone = "default",
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  tone?: "default" | "muted" | "danger" | "success";
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.listRow, toneStyles[tone]]}>
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.listRowTrailing}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDescription}>{description}</Text>
      {action ? <View style={styles.emptyStateAction}>{action}</View> : null}
    </Card>
  );
}

export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <Card style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </Card>
  );
}

function NavChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navChip,
        active ? styles.navChipActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={[styles.navChipText, active ? styles.navChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundGlow: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(91, 140, 255, 0.12)",
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(6, 9, 18, 0.96)",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  brandWrap: {
    flexShrink: 1,
  },
  brand: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  brandAccent: {
    color: colors.primary,
  },
  statusCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  navRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  navChip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  navChipText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  navChipTextActive: {
    color: colors.primaryForeground,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  screenBody: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  pageHeading: {
    gap: spacing.sm,
  },
  pageTitle: {
    color: colors.foreground,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  buttonBase: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontWeight: "700",
    fontSize: 14,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.secondary,
  },
  listRowText: {
    flex: 1,
    gap: 3,
  },
  listRowTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  listRowSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  listRowTrailing: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  emptyState: {
    alignItems: "center",
  },
  emptyStateTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyStateDescription: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  emptyStateAction: {
    marginTop: spacing.xs,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    alignItems: "center",
  },
  loadingText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
});

const buttonVariantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.border,
  },
  destructive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
};

const buttonTextVariantStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.primaryForeground },
  secondary: { color: colors.foreground },
  outline: { color: colors.foreground },
  destructive: { color: colors.destructiveForeground },
  ghost: { color: colors.foreground },
};

const buttonSizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  md: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  lg: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
  },
  icon: {
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
};

const badgeVariants: Record<string, ViewStyle> = {
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: colors.border,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  destructive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
};

const badgeTextVariants: Record<string, TextStyle> = {
  secondary: { color: colors.secondaryForeground },
  outline: { color: colors.mutedForeground },
  primary: { color: colors.primaryForeground },
  destructive: { color: colors.destructiveForeground },
};

const toneStyles: Record<string, ViewStyle> = {
  default: {},
  muted: {
    backgroundColor: colors.secondary,
  },
  danger: {
    backgroundColor: "rgba(169, 63, 87, 0.18)",
  },
  success: {
    backgroundColor: "rgba(61, 220, 151, 0.12)",
  },
};
