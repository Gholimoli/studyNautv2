# UI/UX Guidelines

This document defines the UI design system and guidelines for Studynaut, ensuring a consistent and user-friendly experience, primarily based on Tailwind CSS and shadcn/ui.

## 1. Core Principles (From Instructions)

*   **Typography System:**
    *   Use only **4 font sizes**: headings, subheadings, body, small text (Map to Tailwind classes like `text-2xl`, `text-xl`, `text-base`, `text-sm`).
    *   Use only **2 font weights**: `semibold` (headings - `font-semibold`), `regular` (body - `font-normal`).
    *   Enforce consistent visual hierarchy.
*   **8pt Grid System:**
    *   All spacing values must be divisible by **8 or 4** (`p-2`, `m-3`, `gap-4`, `p-6`, `m-8`).
    *   Use Tailwind spacing utilities.
*   **60/30/10 Color Rule:**
    *   **60%**: Neutral background (`bg-background`).
    *   **30%**: Complementary text/UI (`text-foreground`, `text-muted-foreground`).
    *   **10%**: Accent/brand color (`primary`, `accent` - used sparingly).
    *   Use OKLCH color format (configured in Tailwind theme) for better accessibility.
*   **Visual Hierarchy:** Clarity over flash, group related items, consistent spacing/alignment, subtle highlighting.
*   **Component Architecture:** Follow shadcn/ui (Radix + Tailwind + CVA + data-slots), use CVA for variants, align with "New-York" style.
*   **Dark Mode:** Use OKLCH colors, Tailwind's dark mode variant (`dark:`).
*   **Responsiveness:** Use Tailwind breakpoints, container queries (`@container`, `@min-*`).
*   **Animation & Motion:** Purpose-driven, improve UX, consistent (Framer Motion).

## 2. Design System Details (shadcn/ui based)

Refer to the shadcn/ui documentation and the configuration within the `client/` package (`tailwind.config.js`, `components.json`, `lib/utils.ts`' `cn` function, `styles/globals.css`) for the specific implementation details.

### 2.1. Colors

Colors are defined in `tailwind.config.js` using CSS variables, likely sourced from `styles/globals.css`. Key semantic names provided by shadcn/ui:

*   `background`, `foreground`
*   `card`, `card-foreground`
*   `popover`, `popover-foreground`
*   `primary`, `primary-foreground`
*   `secondary`, `secondary-foreground`
*   `muted`, `muted-foreground`
*   `accent`, `accent-foreground`
*   `destructive`, `destructive-foreground`
*   `border`
*   `input`
*   `ring`

Use these semantic color names via Tailwind utilities (e.g., `bg-primary`, `text-destructive`, `border-border`).

### 2.2. Typography

*   **Font Family:** Defined in `tailwind.config.js` or `styles/globals.css` (e.g., Inter).
*   **Font Sizes:** Use Tailwind's text utilities (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, etc.), mapping them to the 4 main conceptual sizes.
*   **Font Weights:** Use `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-bold` (700).
*   **Line Heights:** Use Tailwind's leading utilities (`leading-tight`, `leading-normal`, `leading-relaxed`).

### 2.3. Spacing

Use Tailwind's spacing scale (`p-1`, `m-2`, `gap-4`, `space-x-6`, etc.). Ensure values align with the 4/8pt grid principle.

### 2.4. Border Radius

Configured in `tailwind.config.js` and applied via `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full`.

### 2.5. Shadows

Use Tailwind's shadow utilities: `shadow-sm`, `shadow`, `shadow-lg`, `shadow-xl`.

## 3. Components

Utilize the components provided by `shadcn/ui`, imported from `@client/components/ui/*`.

*   **Buttons:** Use variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`) and sizes (`default`, `sm`, `lg`, `icon`).
*   **Forms:** `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label`. Combine with React Hook Form for state management and validation.
*   **Data Display:** `Card`, `Table`, `Badge`, `Avatar`.
*   **Feedback:** `Alert`, `Progress`, `Skeleton`, `Toast` (via `useToast` hook).
*   **Navigation:** `Menubar`, `NavigationMenu`, `DropdownMenu`, `Tabs`.
*   **Overlays:** `Dialog`, `Popover`, `Tooltip`, `Sheet`.

Refer to the [shadcn/ui documentation](https://ui.shadcn.com/docs) for usage examples and available props/variants.

## 4. Layout Guidelines

*   **Page Structure:** Use layout components (`components/layout/`) to wrap route content, providing consistent headers, footers, or sidebars.
*   **Containers:** Use `container` class for centered content with max-width, applying appropriate padding (`px-4`, `py-8`).
*   **Responsiveness:** Design mobile-first. Use Tailwind's breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`) to adapt layouts.
*   **Grids:** Use CSS Grid (`grid`, `grid-cols-*`, `gap-*`) or Flexbox (`flex`, `flex-col`, `items-*`, `justify-*`) for layout.

## 5. Animation Guidelines

*   Use `Framer Motion` for animations.
*   Apply animations subtly for transitions (page loads, component mounts, hover effects).
*   Use consistent timing and easing.
*   Wrap page components in `motion.div` for page transitions if desired.
*   Use `staggerChildren` for list animations.
*   Respect `prefers-reduced-motion`.

## 6. Accessibility (A11y)

*   **Semantic HTML:** Use appropriate HTML tags.
*   **Keyboard Navigation:** Ensure all interactive elements are focusable and have visible focus states (`focus-visible`).
*   **ARIA Attributes:** Use ARIA attributes correctly when semantic HTML is insufficient (shadcn/ui components often handle this).
*   **Labels:** Ensure all form inputs have associated labels.
*   **Color Contrast:** Adhere to WCAG AA contrast ratios.

## 7. Implementation Notes

*   **`cn` Utility:** Use the `cn` utility function (from `lib/utils`) provided by shadcn/ui to merge Tailwind classes, especially for conditional styling.
    ```tsx
    import { cn } from "@client/lib/utils"

    <div className={cn("p-4", isActive && "bg-primary", className)}>
      {/* ... */}
    </div>
    ```
*   **CVA:** For creating custom components with complex variants, use the `cva` (Class Variance Authority) library, following the pattern used in shadcn/ui components. 