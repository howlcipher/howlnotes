# Change log

## Browser workflow repair

- Select the JavaScript build target explicitly for the HowlFrame frontend and grant browser API requests the host's network capability.
- Encode API JSON structurally so quotes, backslashes and newlines round-trip; update textarea live values when creating and editing.
- Escape stored note HTML and read edit content from rendered text instead of embedding it in an inline JavaScript handler.
- Treat search input as a literal substring, including unmatched brackets and regular-expression punctuation.
- Add accessible field names and status announcements, focus the editor, close it with Escape with Tab/Shift+Tab contained in the dialog, and wrap long note text on mobile.
- Keep API/store identifiers in escaped data attributes, with constant action handlers; test adversarial identifiers remain inert.
- Advertise the fixed bytecode port accurately even if `PORT` is set.
- Add a Chromium regression test for literal CRUD/search, inert stored HTML, keyboard actions, mobile layout, validation and offline recovery.

- Bootstrap fallback now fetches verified immutable HowlFrame revision `7631ce5d4008534ef681f35c3436922507d3f441` rather than the incompatible older release tag. CI runs the real Chromium regressions and preserves their evidence using the locally verified Go toolchain.

- Replace database/filesystem capability tests that made no assertions with real GET and POST denial checks: HTTP 500, exact structured `CAPABILITY_DENIED`/`STORE_OPEN` diagnostic, unchanged persistent store and server survival. Tighten network denial assertions. An isolated grant-leak fault experiment passes the old tests and fails both corrected tests; the actual runtime passes the corrected suite.
