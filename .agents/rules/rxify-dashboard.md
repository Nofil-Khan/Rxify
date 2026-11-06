---
trigger: always_on
description: Pharmacy Dispensary Dashboard (Rxify) Design & Development Standards
---

# Rxify Pharmacy Dispensary Dashboard Standards

## 1. Visual Source of Truth
- The reference screenshot (`media_1793801719834_a9c91df8.jpg`) is the visual spec and source of truth for the dispensary workspace.
- Dark botanical green aesthetic with glassmorphism panels (`#04120D`, `#0A2A20`, `#0F3A2C`), mint glow accents (`#A7F3D0`, `#6EE7B7`, `#10B981`), warm cream contrast cards (`#F8F0E5` to `#EADFCF`), and rich ink typography (`#1F2A24`).

## 2. TypeScript & Code Standards
- **Strict TypeScript**: `noImplicitAny: true`, no usage of `any`. Always use explicit domain types or interfaces.
- **Functional Components**: All React components must be functional components with typed props.
- **Component File Size**: Keep components concise and modular (**under 150 lines** per file). Break complex UI into subcomponents in `features/dispensary/components`.
- **CSS & Styling**:
  - Tailwind utilities plus tokens only — **no hardcoded hex color codes** inside components. Use CSS variables and token classes defined in `src/styles/tokens.css`.
  - Use the shared glass utility classes from `src/styles/glass.css` (`.glass-panel`, `.glass-chip`, `.cream-card`).

## 3. Accessibility & Interactive Controls
- Every interactive element (button, link, tab, input, dialog trigger) must have:
  - An accessible `aria-label` or visible text.
  - A distinct focus indicator ring (`focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none`).
- Respect `prefers-reduced-motion`: disable or reduce animations/motion when `prefers-reduced-motion: reduce` is detected.
- Keyboard navigation enabled (Tab, Enter, Space, arrow keys, and Ctrl+K command bar shortcut).

## 4. Media & Performance
- All images and graphics must specify explicit `width` and `height` attributes and set `loading="lazy"`.

