# HowlNotes

> HowlNotes is a small notes application built to determine how much ordinary application development can currently be expressed through HowlFrame and to expose concrete gaps in the language, runtime, HFIR, capability model, and developer experience.

HowlNotes is a genuinely complete, usable notes web application built as an **external dogfood consumer** of [HowlFrame](https://github.com/howlcipher/howlframe).

It does not reside inside the HowlFrame tree or fake HowlFrame execution with handwritten wrappers. The backend executes directly on HowlFrame's standalone bytecode runtime, the frontend is compiled from HowlFrame `web_app` definitions, and data is stored in HowlFrame's native persistent record store.

---

## Verified HowlFrame Revision

HowlNotes is tested and verified against:

* **Repository:** `howlcipher/howlframe`
* **Pinned Revision:** `7cdc5116d426cc05c505d6457dc24aeb4fcc2046`
* **HowlFrame Version:** `0.1.0` (HFBC Format v1)

---

## Features

* **Full Notes CRUD:** View, create, edit, and delete notes.
* **Native State Persistence:** Notes are saved to disk (`file://data/notes.json`) and survive application restarts.
* **Capability-Enforced Runtime:** The backend executes inside the HowlFrame Bytecode VM under strict runner-granted capabilities (`network,database,filesystem`).
* **Input Validation & Error Handling:** Handles malformed JSON, empty fields, oversized notes, and nonexistent records.
* **Restrained Vanilla UI:** Responsive, clean interface compiled from HowlFrame `web_app` DSL to vanilla browser JavaScript.
* **100% Automated Test Suite:** End-to-end testing covering CRUD, persistence across server restart, capability denials, and compilation.

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
Resolve and build the HowlFrame compiler toolchain:
```bash
./scripts/bootstrap.sh
```
*(Optionally set `HOWLFRAME_ROOT` or `HOWLFRAME_BIN` to point to a custom HowlFrame build).*

### 2. Build
Compile HowlFrame source files:
```bash
./scripts/build.sh
```
* Compiles `app/backend.howl` -> `build/backend.hfbc` (standalone bytecode)
* Compiles `app/frontend.howl` -> `static/app.js` (browser client)

### 3. Run
Start the HowlNotes server:
```bash
./scripts/run.sh
```
Then open your browser at **`http://localhost:8088`**.

---

## Running Tests

Run the automated E2E test suite:
```bash
./scripts/test.sh
```

Tests cover:
* Compilation and AST validation
* Capability denial verification (missing `network`, `database`, or `filesystem`)
* Complete CRUD lifecycle
* Input validation & error responses (400, 404)
* Static asset delivery
* True process-restart persistence

---

## Dogfooding & Architecture Reports

* **[Architecture Document](docs/ARCHITECTURE.md):** Detailed breakdown of system components, data schemas, API contracts, and capability boundaries.
* **[Dogfooding Journal](docs/DOGFOOD.md):** Complete catalog of discovered friction points, compiler behaviors, workarounds, and classification categories.
* **[v1 Final Report](docs/V1_REPORT.md):** Comprehensive answers to the 9 core dogfooding questions, HFIR analysis, and next recommendations for HowlFrame.

---

## License

MIT
