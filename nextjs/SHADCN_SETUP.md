# ShadCN/UI Components Setup

This project has been refactored to use ShadCN/UI components instead of Bootstrap components. ShadCN/UI provides a collection of copy-and-paste components built with Radix UI and Tailwind CSS.

## What's Included

### Components
- **Button** - Various button variants (default, secondary, outline, ghost, link)
- **Card** - Card components with header, content, and footer
- **Input** - Form input component
- **Badge** - Small status indicators

### Configuration
- `components.json` - ShadCN configuration file
- `src/lib/utils.ts` - Utility functions including `cn()` helper
- `src/components/ui/` - All ShadCN components
- Updated `globals.css` with ShadCN design tokens
- `tailwind.config.js` - Tailwind configuration for ShadCN

## Adding New Components

To add new ShadCN components, you can:

1. **Manual Installation** (recommended for this setup):
   - Copy component code from https://ui.shadcn.com/docs/components
   - Add to `src/components/ui/`
   - Update the index file in `src/components/ui/index.ts`

2. **CLI Installation** (if ShadCN CLI is available):
   ```bash
   pnpm dlx shadcn@latest add [component-name]
   ```

## Features

- **Consistent Design System**: All components follow ShadCN's design principles
- **Accessibility**: Built with Radix UI primitives for better accessibility
- **Customizable**: Easy to customize with CSS variables and Tailwind classes
- **TypeScript Support**: Full TypeScript support with proper type definitions
- **Responsive**: Components are responsive by default

## Migration from Bootstrap

The following Bootstrap components have been replaced:

| Bootstrap | ShadCN/UI |
|-----------|-----------|
| Bootstrap Cards | ShadCN Card components |
| Bootstrap Buttons | ShadCN Button components |
| Bootstrap Forms | ShadCN Input components |
| Bootstrap Badges | ShadCN Badge components |

## Usage Example

```tsx
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Card</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

## Design Tokens

ShadCN uses CSS variables for theming. You can customize the theme by modifying the CSS variables in `src/styles/globals.css`.

The setup includes both light and dark mode support through CSS custom properties.