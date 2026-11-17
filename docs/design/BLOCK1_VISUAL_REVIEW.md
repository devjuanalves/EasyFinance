# Block 1 visual review

Review target: Chromium at **1440×900 desktop** and **390×844 mobile**. The six original SVG exports were rendered to PNG for visual inspection. Browser screenshots were opened and compared to those references, including all four pages at both sizes. This is a manual visual comparison plus automated layout checks, not a pixel-diff certification or Figma approval.

| Screen     | Supplied references                                                                            | Findings                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login      | `frames/01-authentication/Login.svg` and `Login-1.svg`                                         | Orange desktop split, official logo, portfolio illustration, form structure and mobile single-column layout retained. Social icons extracted from original paths. Session/OAuth notices and demo help added. |
| Sign Up    | `frames/01-authentication/[ ] Criar conta (Sign Up).svg` and `[ ] Criar conta (Sign Up)-1.svg` | Pale desktop branding panel, inline sample chart, four fields, consent region and mobile form retained. Static state-simulator strip omitted; actual validation drives states.                               |
| Recovery   | `frames/01-authentication/Recuperar senha.svg` and `Recuperar senha-1.svg`                     | Dark desktop recovery panel, light form, orange action and mobile single-column layout retained. Prototype tabs and token-reset previews omitted because no token/email backend exists.                      |
| Onboarding | None supplied                                                                                  | Four-step functional composition reuses signup layout/controls. Desktop and mobile are provisional and await design approval.                                                                                |

## Explicit differences and limitations

- Exported canvases are 1280–1324 pixels wide on desktop and 884–909 pixels tall on mobile, unlike the requested target sizes. Layouts adapt proportionally and scroll naturally, rather than scaling a screenshot.
- Typeface metadata is absent because text is outlined. The consistent system sans fallback is provisional; no exact typography claim is made.
- Reference compliance/encryption, premium-trial and zero-liability claims are not substantiated for this mock. These are replaced by demo notices; decorative promotional metrics are explicitly illustrative, not a financial feature.
- Terms/privacy open unavailable-document notices, and the required checkbox acknowledges the demo. No invented legal documents or real consent claim.
- Button/action shading and small-text link colors are adjusted minimally for contrast. Original palette and source assets remain unchanged.
- Custom line icons reproduce the reference roles; Google/Apple paths and official logos are reused directly. Exact per-icon Figma geometry is not asserted for generic line icons.
- Mobile registration's extra promotional benefit badges were omitted because the claimed features are unavailable; required account fields and navigation remain.
- No unsupported desktop marketing panel is added on mobile.

## Reproducible evidence

Run `npm run test:e2e`. Local captures (ignored build artifacts):

- `test-results/auth-layouts/desktop-login.png` and `mobile-login.png`
- `test-results/auth-layouts/desktop-signup.png` and `mobile-signup.png`
- `test-results/auth-layouts/desktop-recovery.png` and `mobile-recovery.png`
- `test-results/auth-layouts/desktop-onboarding.png` and `mobile-onboarding.png`

CI uploads the test-results directory. Automated checks assert no horizontal overflow, missing images or browser page/console errors through the lifecycle. Keyboard tests cover the native support dialog. Wider browser/assistive-technology coverage and formal design sign-off are still future QA work.
