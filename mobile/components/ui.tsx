import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "../styles/colors";
import { useAppState } from "../context/AppStateContext";

type NavigationLike = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";
type BadgeVariant = "secondary" | "outline" | "primary" | "destructive";
type ListRowTone = "default" | "muted" | "danger" | "success";

type ScreenProps = {
  navigation: NavigationLike;
  activeRoute: string;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children: React.ReactNode;
};

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

type ButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  textClassName?: string;
};

type InputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  className?: string;
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
};

type ListRowProps = {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  tone?: ListRowTone;
  onPress?: () => void;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  trailingClassName?: string;
};

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionClassName?: string;
};

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

type LoadingCardProps = {
  label: string;
  className?: string;
  textClassName?: string;
};

function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

const navItems = [
  { label: "Lobby", route: "Lobby" },
  { label: "Roles", route: "Roles" },
  { label: "About", route: "About" },
  { label: "History", route: "History" },
  { label: "Profile", route: "Profile" },
  { label: "Admin", route: "Admin" },
];

function buttonClassName(variant: ButtonVariant, size: ButtonSize, disabled: boolean, className?: string) {
  return cn(
    "flex-row items-center justify-center rounded-lg border",
    variant === "primary"
      ? "border-primary bg-primary"
      : variant === "secondary"
        ? "border-border bg-secondary"
        : variant === "outline"
          ? "border-border bg-transparent"
          : variant === "destructive"
            ? "border-destructive bg-destructive"
            : "border-transparent bg-transparent",
    size === "sm"
      ? "min-h-8 px-md py-xs"
      : size === "lg"
        ? "min-h-12 px-xl py-md"
        : size === "icon"
          ? "min-h-8 w-8 px-0 py-0"
          : "min-h-10 px-lg py-sm",
    disabled ? "opacity-45" : "pressed:opacity-90",
    className,
  );
}

function buttonTextClassName(variant: ButtonVariant, textClassName?: string) {
  return cn(
    "text-sm font-bold",
    variant === "primary"
      ? "text-primary-foreground"
      : variant === "destructive"
        ? "text-destructive-foreground"
        : "text-foreground",
    textClassName,
  );
}

function badgeClassName(variant: BadgeVariant, className?: string) {
  return cn(
    "flex-row items-center justify-center rounded-full border px-3 py-1",
    variant === "primary"
      ? "border-primary bg-primary"
      : variant === "destructive"
        ? "border-destructive bg-destructive"
        : variant === "outline"
          ? "border-border bg-transparent"
          : "border-border bg-secondary",
    className,
  );
}

function badgeTextClassName(variant: BadgeVariant, textClassName?: string) {
  return cn(
    "text-[11px] font-extrabold leading-none tracking-[0.02em]",
    variant === "primary"
      ? "text-primary-foreground"
      : variant === "destructive"
        ? "text-destructive-foreground"
        : variant === "outline"
          ? "text-muted-foreground"
          : "text-secondary-foreground",
    textClassName,
  );
}

function rowToneClassName(tone: ListRowTone) {
  return tone === "muted"
    ? "bg-muted"
    : tone === "danger"
      ? "bg-destructive/15"
      : tone === "success"
        ? "bg-success/10"
        : "bg-secondary";
}

export function Screen({
  navigation,
  activeRoute,
  title,
  subtitle,
  scroll = true,
  className,
  contentClassName,
  titleClassName,
  subtitleClassName,
  children,
}: ScreenProps) {
  return (
    <View className={cn("relative flex-1 bg-background", className)}>
      <StatusBar style="light" />
      <View pointerEvents="none" className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/10" />
      <AppHeader navigation={navigation} activeRoute={activeRoute} />
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn("gap-lg p-lg", contentClassName)}
          showsVerticalScrollIndicator={false}
        >
          {title || subtitle ? (
            <View className="gap-sm">
              {title ? (
                <Text className={cn("text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-foreground", titleClassName)}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text className={cn("text-[15px] leading-[21px] text-muted-foreground", subtitleClassName)}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1 gap-lg p-lg", contentClassName)}>
          {title || subtitle ? (
            <View className="gap-sm">
              {title ? (
                <Text className={cn("text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-foreground", titleClassName)}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text className={cn("text-[15px] leading-[21px] text-muted-foreground", subtitleClassName)}>
                  {subtitle}
                </Text>
              ) : null}
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
    <View className="border-b border-border bg-background/95 px-lg pb-md pt-md">
      <View className="flex-row items-center justify-between gap-md">
        <Pressable onPress={() => navigation.navigate("Home")} className="shrink">
          <Text className="text-xl font-extrabold tracking-[-0.02em] text-foreground">
            LBWW <Text className="text-primary">Mafia</Text>
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-sm">
          <Badge variant="secondary">{playerName.trim() ? playerName : "Guest"}</Badge>
          {isAdmin ? <Badge variant="destructive">Admin</Badge> : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full" contentContainerClassName="gap-sm pt-md pb-xs">
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

export function Card({ children, className }: CardProps) {
  return <View className={cn("gap-md rounded-xl border border-border bg-card p-lg", className)}>{children}</View>;
}

export function Button({
  children,
  onPress,
  disabled = false,
  variant = "primary",
  size = "md",
  className,
  textClassName,
}: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className={buttonClassName(variant, size, disabled, className)}>
      <Text className={buttonTextClassName(variant, textClassName)}>{children}</Text>
    </Pressable>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  className,
}: InputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? "top" : "center"}
      className={cn(
        "rounded-lg border border-border bg-input px-md py-3 text-sm text-foreground placeholder:text-muted-foreground",
        multiline ? "min-h-[88px] py-md" : "h-12",
        className,
      )}
    />
  );
}

export function Badge({
  children,
  variant = "secondary",
  className,
  textClassName,
}: BadgeProps) {
  return (
    <View className={badgeClassName(variant, className)}>
      <Text className={badgeTextClassName(variant, textClassName)}>{children}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  tone = "default",
  onPress,
  className,
  contentClassName,
  titleClassName,
  subtitleClassName,
  trailingClassName,
}: ListRowProps) {
  const row = (
    <View className={cn("flex-row items-center justify-between gap-md rounded-lg border border-border p-md", rowToneClassName(tone), className)}>
      <View className={cn("flex-1 gap-xs", contentClassName)}>
        <Text className={cn("text-sm font-bold text-foreground", titleClassName)}>{title}</Text>
        {subtitle ? <Text className={cn("text-xs leading-[17px] text-muted-foreground", subtitleClassName)}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View className={cn("shrink-0", trailingClassName)}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) {
    return row;
  }

  return (
    <Pressable onPress={onPress} className="pressed:opacity-90">
      {row}
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
  titleClassName,
  descriptionClassName,
  actionClassName,
}: EmptyStateProps) {
  return (
    <Card className={cn("items-center", className)}>
      <Text className={cn("text-center text-lg font-extrabold text-foreground", titleClassName)}>{title}</Text>
      <Text className={cn("text-center text-sm leading-5 text-muted-foreground", descriptionClassName)}>{description}</Text>
      {action ? <View className={cn("mt-xs", actionClassName)}>{action}</View> : null}
    </Card>
  );
}

export function SectionHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: SectionHeaderProps) {
  return (
    <View className={cn("gap-xs", className)}>
      <Text className={cn("text-lg font-extrabold text-foreground", titleClassName)}>{title}</Text>
      {subtitle ? <Text className={cn("text-sm leading-5 text-muted-foreground", subtitleClassName)}>{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingCard({ label, className, textClassName }: LoadingCardProps) {
  return (
    <Card className={cn("items-center", className)}>
      <ActivityIndicator color={colors.primary} />
      <Text className={cn("text-sm text-muted-foreground", textClassName)}>{label}</Text>
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
      className={cn(
        "rounded-lg border px-md py-sm pressed:opacity-90",
        active ? "border-primary bg-primary" : "border-border bg-secondary",
      )}
    >
      <Text className={cn("text-xs font-bold", active ? "text-primary-foreground" : "text-muted-foreground")}>{label}</Text>
    </Pressable>
  );
}