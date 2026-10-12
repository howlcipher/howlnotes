# HowlNotes

> **Website & Documentation:** https://howlcipher.github.io/howlnotes/

> HowlNotes is a small notes application built to determine how much ordinary application development can currently be expressed through HowlFrame and to expose concrete gaps in the language, runtime, HFIR, capability model, and developer experience.

HowlNotes is a genuinely complete, usable notes web application built as an **external dogfood consumer** of [HowlFrame](https://github.com/howlcipher/howlframe).

It does not reside inside the HowlFrame tree or fake HowlFrame execution with handwritten wrappers. The backend executes directly on HowlFrame's standalone bytecode runtime, the frontend is compiled from HowlFrame `web_app` definitions, and data is stored in HowlFrame's native persistent record store.

---

## Verified HowlFrame Revision

HowlNotes is tested and verified against:

* **Repository:** `howlcipher/howlframe`
* **Pinned Revision:** `7631ce5d4008534ef681f35c3436922507d3f441`
* **HowlFrame Version:** `0.1.0` (HFBC Format v1)

---

## Features

* **Full Notes CRUD:** View, create, edit, and delete notes.
* **Native State Persistence:** Notes are saved to disk (`file://data/notes.json`) and survive application restarts.
* **Capability-Enforced Runtime:** The backend executes inside the HowlFrame Bytecode VM under strict runner-granted capabilities (`network,database,filesystem`).
* **Input Validation & Error Handling:** Handles malformed JSON, empty fields, oversized notes, and nonexistent records.
* **Restrained Vanilla UI:** Responsive, clean interface compiled from HowlFrame `web_app` DSL to vanilla browser JavaScript.
* **Automated Verification:** Native tests assert network startup denial and database/filesystem denial for reads and writes, CRUD, process-restart persistence and compilation. Chromium tests cover the browser workflow and inert stored HTML.

---

## Architecture

```text
Browser Client (Vanilla HTML/CSS + generated static/app.js)
       |
       |  HTTP (REST & RPC JSON)
       v
HowlFrame Bytecode VM (executing build/backend.hfbc)
  * Capabilities: network, database, filesystem
  * Static file serving + Notes API router
       |
       |  Structured Record Store
       v
Native File-Backed Store (file://data/notes.json)
```

---

## Quick Start

### Prerequisites
* Linux / macOS
* [Go](https://go.dev/) 1.22+ (for building HowlFrame during bootstrap)
* Git

### 1. Bootstrap
Resolve and build the HowlFrame compiler toolchain from the verified immutable revision above (the older `v0.1.0` tag lacks backend constructs used by this app):
```bash
./scripts/bootstrap.sh
```
Bootstrap fetches and builds the pinned source by default, requiring network access, Git and Go. It does not automatically select a `howlframe` executable from `PATH`: matching version strings do not establish the backend and browser contracts this app needs.

Optionally set `HOWLFRAME_BIN` to an explicitly selected executable or `HOWLFRAME_ROOT` to a compatible source checkout. The binary override takes precedence when both are provided; explicit overrides are developer choices outside the default pin.

### 2. Build
Compile HowlFrame source files:
```bash
./scripts/build.sh
```
* Compiles `app/backend.howl` -> `build/backend.hfbc` (standalone bytecode)
* Compiles `app/frontend.howl` -> `static/app.js` with `build --target=js` (browser client)
* The HTML host grants only `network` to the generated browser client.

### 3. Run
Start the HowlNotes server:
```bash
./scripts/run.sh
```
Then open your browser at **`http://localhost:8088`**. The port is compiled from `app/backend.howl`; changing a `PORT` environment variable does not override it.

---

## Running Tests

Run the automated E2E test suite:
```bash
./scripts/test.sh
```

Tests cover:
* Compilation and AST validation
* Network startup denial; database/filesystem HTTP 500 `CAPABILITY_DENIED` diagnostics for both GET and POST, unchanged store, and a healthy server after rejection
* Complete CRUD lifecycle
* Input validation & error responses (400, 404)
* Static asset delivery
* True process-restart persistence

---

### Browser regression checks

With an isolated server running through `./scripts/run.sh`, install Python Playwright and Chromium, then run:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser_test.py
```

Set `HOWLNOTES_URL` to change the test URL and `HOWLNOTES_EVIDENCE` to choose the screenshot/result directory. The test creates and deletes its own note; use a disposable development store. It covers literal punctuation and Unicode CRUD/search, inert stored HTML, keyboard input, desktop/mobile layout, validation, offline recovery and reload. The native suite separately verifies process-restart persistence. The edit dialog focuses its textarea, contains Tab/Shift+Tab and closes with Escape.

Note content is displayed as literal text. Edit reads that text from the DOM instead of placing content inside JavaScript. Search performs a case-sensitive literal substring match.

## Dogfooding & Architecture Reports

* **[Architecture Document](docs/ARCHITECTURE.md):** Detailed breakdown of system components, data schemas, API contracts, and capability boundaries.
* **[Dogfooding Journal](docs/DOGFOOD.md):** Complete catalog of discovered friction points, compiler behaviors, workarounds, and classification categories.
* **[v1 Final Report](docs/V1_REPORT.md):** Comprehensive answers to the 9 core dogfooding questions, HFIR analysis, and next recommendations for HowlFrame.

---

## License

MIT
