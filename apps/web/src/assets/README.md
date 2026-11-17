# Runtime assets

`brand/color.svg` and `brand/white.svg` are byte-identical copies of the official logo variants in `docs/design/brand/logo/`. Small intentional runtime copies keep editable references separate from served assets.

`brand/google.svg` and `brand/apple.svg` contain the individual icon paths extracted without geometry changes from `docs/design/frames/01-authentication/Login-1.svg`, with tightly scoped viewBoxes. These decorate disabled, explicitly unavailable social sign-in controls. No full-screen frame is served as UI, and all original exports remain untouched.
