# EasyFinance development rules

- Application source is JavaScript ESM/JSX only. No TypeScript, TSX, Next.js, NestJS, Firebase, Supabase or additional frontend framework. SQL and Prisma declarative schemas are allowed.
- Preserve approved SVGs, logos, palette, blueprint and PDF. Do not overwrite originals or redesign the UI. Reference the frame index and document missing assets instead of guessing.
- Follow the supplied Draw.io blueprint and database dictionary. Resolve documented inconsistencies before schema implementation.
- Respect the npm workspace architecture. Reuse components and shared browser-safe contracts; keep server secrets out of frontend code and VITE variables.
- Support desktop and mobile, keyboard interaction and accessible states. Confirm component styling from the appropriate references.
- Implement only the authorized block. No unauthorized features, invented API operations, real accounts or integrations ahead of scope.
- Keep HTTP controllers, business services, repositories and request validation separate as concrete functionality arrives. Enforce workspace authorization on all future data access.
- Do not modify unrelated modules. Do not fabricate scaffolding with no concrete purpose.
- Keep architecture, screen mapping, roadmap and progress documentation synchronized.
- Run checks appropriate to changes; for foundation changes run `npm run check`. Report blockers and actual results accurately.
- Preserve asset byte integrity using `docs/design/ASSET_MANIFEST.json`. Formatting excludes authoritative source assets.
- Do not stage, commit, push or create a remote unless explicitly requested. Block 0 ends before authentication implementation.
