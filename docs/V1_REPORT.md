# HowlNotes v1 Dogfooding Report

This report evaluates HowlFrame (`howlcipher/howlframe`) from the perspective of an external application developer building a complete, persistent notes web application.

---

## 1. Executive Summary & Core Answers

| Question | Answer |
|---|---|
| **1. How much of the application is actually expressed in HowlFrame?** | **~95% of application logic.** Backend routing, CRUD business logic, validation, error handling, static asset serving, and state persistence are authored entirely in `app/backend.howl`. Frontend rendering, state updates, modal toggles, search filtering, error/status reporting, and API communications are authored in `app/frontend.howl`. Only the minimal HTML skeleton (`static/index.html`) and stylesheet (`static/app.css`) are handwritten. |
| **2. Which backend(s) are involved?** | **Two HowlFrame backends:** (1) The **Standalone Bytecode VM** target (`-compile-bc` / `-run-bc`) for the entire backend and HTTP server; (2) The **JavaScript backend** (`web_app`) for browser client logic. |
| **3. Which capabilities are required?** | Exactly **`network,database,filesystem`**. `network` for HTTP serving/routing; `database` for store record operations; `filesystem` for file-backed storage sync (`file://data/notes.json`) and static asset reading. |
| **4. Is persistence native to HowlFrame?** | **Yes.** HowlFrame's native record store supports `file://...` URIs (`store_open`, `store_put`, `store_get`, `store_delete`). Records are stored as structured JSON on disk and reliably survive process restarts. |
| **5. What required changes to HowlFrame?** | **Zero changes required to HowlFrame core.** All features and workarounds were achieved using HowlFrame's existing constructs (`type_hint`, `try_let`, `str_split` + `list_len`, `file://` stores, `res_header`). |
| **6. What still prevents standalone VM execution?** | **Nothing prevents standalone VM execution for the backend.** The backend runs 100% on the standalone Bytecode VM. For the browser frontend, web standards require JavaScript/WASM execution in the browser environment, which HowlFrame satisfies via its JS generator. |
| **7. Which problems would HFIR materially improve?** | **Four major areas:** (a) Eliminating surface syntax nesting/parenthesis fatigue in S-expressions; (b) Cross-backend semantic parity (e.g. uniform `len`, `encode_json`); (c) Static capability and effect inference across function calls; (d) Decoupling type inference from syntax defaults. |
| **8. Which problems have nothing to do with HFIR?** | Packaging/DX (CLI flags, dependency management, distribution binaries), browser DOM API differences, and OS process management. |
| **9. What are the three highest-value improvements HowlFrame should make next?** | **1.** Native string/collection parity across backends (e.g., `len`, `json_encode`, `json_decode`); **2.** Context and capability propagation through `defun` calls in the Bytecode VM (e.g., passing response writer and store handles); **3.** Atomic store mutations (compare-and-swap or atomic increment) to prevent ID race conditions under high concurrency. |

---

## 2. What Works

HowlNotes is fully functional from a fresh clone:
1. **Local Launch:** Starts with `./scripts/run.sh` on `http://localhost:8088`.
2. **Browser Client:** Clean, responsive UI with real-time feedback.
3. **View Saved Notes:** Fast listing with search filtering.
4. **Create Note:** Instant creation with validation against empty and oversized input.
5. **Edit Note:** In-place modal editing updating content and timestamp.
6. **Delete Note:** Removing notes updates active ID lists and removes records from disk.
7. **Validation & Errors:** Structured 400 (invalid JSON, missing fields, oversized content) and 404 (not found) responses.
8. **Restart Persistence:** Full test coverage proving notes survive process death and restart.
9. **Automated Testing:** 100% passing E2E test suite (`./scripts/test.sh`) verifying CRUD, persistence, negative capability gates, and compilation.

---

## 3. HowlFrame Utilization

```text
+------------------------+---------------------+-------------------------------+
| Application Component  | Authored In         | Target Execution Target       |
+------------------------+---------------------+-------------------------------+
| HTTP Server & Router   | app/backend.howl    | Standalone Bytecode VM        |
| Persistent Note Store  | app/backend.howl    | HowlFrame Native Store (file) |
| Static File Server     | app/backend.howl    | Bytecode OpReadFile & OpRes   |
| Input Validation       | app/backend.howl    | Bytecode try_let & conditions |
| Client UI & DOM Logic  | app/frontend.howl   | HowlFrame JS Backend (app.js) |
| HTML Skeleton & CSS    | static/index.html   | Browser HTML5 / CSS3          |
+------------------------+---------------------+-------------------------------+
```

---

## 4. Framework Gaps Discovered

1. **`len` String Operator Missing in Bytecode Target:**
   `len` is unsupported in bytecode compilation, necessitating `(list_len (str_split content ""))` to count characters.
2. **Checker Default Parameter Type Inferences:**
   `defun` parameter inference defaults to `string`, requiring `type_hint` annotations for `dict` structures.
3. **Response Writer Context Isolation:**
   `res_header` and response writing fail inside `defun` in the Bytecode VM because environment context is not propagated across `OpCall`.
4. **No Native `encode_json` in `web_app`:**
   Client-side JSON construction requires manual string formatting via `str_join`.

---

## 5. HFIR Findings

### HFIR WOULD HELP
- **IR Graph Transformation:** Replacing deep `(let ...)` S-expression nesting with a dataflow graph eliminates code generation syntax errors and enables localized model-driven refactoring.
- **Cross-Backend Semantic Normalization:** Abstracting operations like `Length(v)` or `Serialize(v, JSON)` into explicit HFIR nodes ensures uniform behavior across VM, Go, JS, and WASM.
- **Effect & Context Analysis:** Static representation of ambient capabilities and effects (e.g. `Effect: HttpResponse`) makes context dependencies explicit and verifiable before runtime.

### HFIR WOULD NOT HELP
- **Toolchain Distribution & Developer Experience:** Bootstrapping, environment variables, and CLI usability are packaging concerns outside IR representation.
- **Browser DOM Integration:** Direct browser DOM bindings (`querySelector`, `addEventListener`) map to host platform APIs regardless of intermediate representation.

### HFIR QUESTION STILL OPEN
- **Capability Inference vs. Explicit Annotation:** Can HFIR statically infer the exact minimal capability set (e.g. `[network, database, filesystem]`) from the graph topology without requiring manual runner specification?

---

## 6. Verification Evidence

Running `./scripts/test.sh`:

```text
==> Running HowlNotes test suite...
=== RUN   TestHowlFrameCompilation
=== RUN   TestHowlFrameCompilation/ValidateBackend
=== RUN   TestHowlFrameCompilation/ValidateFrontend
=== RUN   TestHowlFrameCompilation/CompileArtifacts
--- PASS: TestHowlFrameCompilation (0.12s)
=== RUN   TestCapabilityDenial
=== RUN   TestCapabilityDenial/DenyWhenNoNetworkCapability
=== RUN   TestCapabilityDenial/DenyWhenNoDatabaseCapability
=== RUN   TestCapabilityDenial/DenyWhenNoFilesystemCapability
--- PASS: TestCapabilityDenial (0.52s)
=== RUN   TestNotesEndToEndAndPersistence
=== RUN   TestNotesEndToEndAndPersistence/HealthCheck
=== RUN   TestNotesEndToEndAndPersistence/ListNotesInitialEmpty
=== RUN   TestNotesEndToEndAndPersistence/CreateNote1
=== RUN   TestNotesEndToEndAndPersistence/CreateNote2
=== RUN   TestNotesEndToEndAndPersistence/ListNotesAfterCreates
=== RUN   TestNotesEndToEndAndPersistence/GetNote1
=== RUN   TestNotesEndToEndAndPersistence/UpdateNote1
=== RUN   TestNotesEndToEndAndPersistence/DeleteNote2
=== RUN   TestNotesEndToEndAndPersistence/VerifyListAfterDelete
=== RUN   TestNotesEndToEndAndPersistence/StaticFilesServing
=== RUN   TestNotesEndToEndAndPersistence/ValidationAndErrorCases
=== RUN   TestNotesEndToEndAndPersistence/RestartPersistence
--- PASS: TestNotesEndToEndAndPersistence (0.31s)
PASS
ok  	github.com/howlcipher/howlnotes/tests	0.965s
==> All tests passed!
```

---

## 7. Conclusion

HowlNotes proves that **it is genuinely possible to build real, persistent, capability-bounded web applications with HowlFrame today**. The platform's core thesis—that intent can be separated from execution authority—is verified by deterministic capability enforcement and robust native state persistence.
