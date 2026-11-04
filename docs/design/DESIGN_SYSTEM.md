# Design system foundation

## Confirmed source values

`brand/colors.svg` contains exactly three swatches: orange `#E43900`, light gray `#EAEAEA`, white `#FFFFFF`. Orange is also used in the official color/orange logos. `brand/logo/black.svg` uses `#191919`; color variants use black/white lettering. Six source variants are preserved without edits.

The initial Tailwind v4 CSS theme exposes `brand`, `brand-neutral`, `surface`, and `foreground`. These values are confirmed; their semantic application remains provisional until component review. Tailwind uses its Vite plugin ([official setup](https://tailwindcss.com/docs/installation/using-vite)). No new palette has been designed.

## Observed reference details, not yet normalized tokens

Screen fills repeatedly include `#AE2900`, `#08864E`, `#BA1A1A`, `#6A6A6A`, `#727272`, `#F6F5F5`, `#F0EDED`, and `#FCF9F8`. These suggest darker accents, status colors, muted text and surfaces; exact roles and contrast require component-level inspection. They are not promoted to global semantic tokens yet. No separate official secondary palette was supplied.

Typography is outlined as SVG paths: no font-family metadata is available. The system font used by the development placeholder is not an approved typeface. Font family, weights, line heights and licenses require confirmation.

## Patterns to inspect before implementation

- Spacing: derive repeated gaps and padding from approved components; no global scale confirmed. Tailwind defaults in the placeholder are development conveniences.
- Buttons: inspect orange action treatments, secondary actions, disabled/loading states and focus behavior across desktop/mobile pairs.
- Inputs: validate field heights, labels, errors, helper text and keyboard behavior from authentication references.
- Cards: inspect surface, border and grouping patterns across dashboard references.
- Navigation: blueprint specifies Home, Dashboard, Ganhos, Gastos and Investimentos. `frames/unclassified/Aside.svg` is an additional navigation reference; its viewport role is unconfirmed.
- Border radius and shadows: exports contain geometry/effects, but no common component specification is confirmed. Do not substitute arbitrary final tokens.
- Responsive behavior: paired exports confirm distinct narrow/wide layouts; breakpoints, collapsing navigation and intermediate widths require verification. Blueprint requests 1440×900 and 390×844; exported widths differ.

ApplicationShell, Sidebar, Header, PageContainer and shared UI are planned boundaries, not implemented designs. Review the reference pair for each component before coding it. Preserve official branding and support focus, keyboard, contrast and reduced motion without inventing product behavior.
