# Mobile App

This app uses NativeWind for all app-owned styling.

## Styling rules

- Prefer `className` on components and screens.
- Avoid `StyleSheet.create` for app-owned UI.
- Avoid inline `style={{ ... }}` and `style={[... ]}` unless the API is a third-party exception that cannot accept `className`.
- Keep Tailwind utilities colocated with the component or screen they style.

## Checks

- `pnpm run lint`
- `pnpm run check:styles`

## Visual development

- `pnpm run storybook` opens the isolated React Native component workshop in Expo.
- `pnpm run storybook:ios` or `pnpm run storybook:android` opens it directly on a simulator.
- `pnpm run visual:screenshots` exports the real Expo web app and captures independent screen states at small-phone, phone, and tablet viewports. Long screens receive additional scroll-position captures. Open `visual/screenshots/index.html` to review the generated gallery.

Storybook is enabled only when `STORYBOOK_ENABLED=true`, so its code is excluded from normal application bundles.
