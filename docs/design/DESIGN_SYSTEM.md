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

## Block 1 implementation observations

The authentication module now shares AuthLayout, native labeled fields, password toggles, primary/secondary actions and feedback. It preserves each reference's desktop side-panel variant: orange login, pale signup, dark recovery. Narrow layouts omit desktop marketing content, use the official logo, and use 24px login / 16px signup-recovery gutters. Input heights are 44px desktop and 48px mobile. The layout collapses at 900px as an implementation choice; no Figma breakpoint metadata was supplied.

SVG geometry confirms login mobile input radii near 12px, signup near 8px and recovery near 4px. Desktop form columns are constrained to 440px and main columns use roughly the reference 52/48 or 50/50 proportions. Original exports have different canvas sizes from the required target viewports, so geometry is responsively adapted rather than stretched.

The font still cannot be identified from outlined paths. A system sans fallback is used consistently; exact font metrics and visual sign-off remain pending. Onboarding reuses these components and is **provisional**, not Figma-approved.

Accessibility adjustment: white on official `#E43900` is approximately 4.30:1. Small white action labels use a 95% brand / 5% black mix to exceed 4.5:1; small text links use the existing darker `#AE2900`. The base brand token and original logo assets are unchanged. Focus rings, error descriptions, 44px password toggles and reduced-motion behavior are added where static exports cannot specify interaction.

Prototype state-selector strips were omitted; state changes are driven by real form interaction. Unavailable OAuth buttons are disabled and explained. Unsupported certification/encryption claims and legal acceptance are replaced with honest demo information, retaining the visual region. See [visual review](BLOCK1_VISUAL_REVIEW.md) for detailed differences.

## Block 2 application components

The authenticated shell and finance styles live in `apps/web/src/components/layout/workspace.css`, scoped under application classes. F05/F06 retain warm neutral surfaces, orange actions, rounded metric/response cards and compact native filters. SVG charts expose full data in expandable tables. At widths up to 900px the desktop sidebar becomes a modal history/navigation drawer and bottom navigation; charts stack and recent transactions become cards. This breakpoint and the missing mobile Dashboard composition remain provisional. No change was made to the Block 1 global auth stylesheet. See BLOCK2_VISUAL_REVIEW.md for source mapping and screenshots.
