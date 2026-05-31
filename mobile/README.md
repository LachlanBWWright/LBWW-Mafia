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
