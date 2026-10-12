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
