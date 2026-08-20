# HowlNotes Dogfooding Journal

HowlNotes is an external dogfood application built to evaluate how much genuine application behavior can currently be expressed, compiled, verified, and executed using HowlFrame (`howlcipher/howlframe`).

This journal documents all architectural obstacles, limitations, classification categories, workarounds, framework implications, and HFIR analysis discovered during development.

---

## 1. Missing String Length Primitive in Bytecode Target

* **Problem:** We attempted to validate note content length against an upper bound (10,000 characters) using `(if (> (len content) 10000) ...)`.
* **Observed behavior:** The bytecode compiler rejected the program with a diagnostic:
  `[{"code":"HFIR_TARGET_INFEASIBLE","severity":"ERROR","message":"construct \"len\" cannot be compiled for the standalone bytecode target: no bytecode lowering exists for it","location":{"filename":"backend.howl","line":X,"column":Y},"contract_version":"v1","target":"bytecode"}]`
* **Classification:** `BACKEND GAP` / `LANGUAGE GAP`
* **Root cause:** The `len` construct is not mapped to an opcode in `internal/bytecode/bytecode.go`. While the VM possesses an `OpListLen` opcode (`(list_len list)`), string length is not exposed as a single native bytecode opcode.
* **Workaround:** Used `(list_len (str_split content ""))` to split the string into a character list and measure the length of the list in the bytecode VM.
* **Framework change:** None required for v1; workaround functions cleanly.
* **HFIR implication:** **HFIR WOULD HELP.** In HFIR, string length and collection size are distinct, typed operation nodes (`StringLength`, `ListLength`) with defined semantics and lowering rules across all backends (Go, JS, Bytecode, WASM), eliminating surface-syntax overloading ambiguities.
* **Evidence:** `tests/e2e_test.go` -> `TestNotesEndToEndAndPersistence/ValidationAndErrorCases` validates that note content exceeding 10,000 characters is rejected with `400 {"error":"content_too_long"}`.

---

## 2. Checker Parameter Type Inference Defaults to String

* **Problem:** In `app/frontend.howl`, defining a helper function `(defun render_note (note) ...)` that queries dict properties with `(map_get note "content")` triggered a type checker error: `map_get target must be dict, got string`. Similarly, `(defun set_status (msg is_error))` where `is_error` is used in `(if is_error ...)` failed with `if condition must be bool, got string`.
* **Observed behavior:** The compiler refused to generate JavaScript for `web_app`.
* **Classification:** `CHECKER GAP`
* **Root cause:** HowlFrame's semantic checker (`internal/checker/types.go`) defaults untyped function arguments to `string` instead of `any` or inferring parameter types from intra-procedural operations.
* **Workaround:** Added explicit `(type_hint note "dict")` annotations to dictate dict structure, and compared boolean flags as string literals `(if (= is_error "true") ...)`.
* **Framework change:** None for v1; existing `type_hint` construct handles dict parameters.
* **HFIR implication:** **HFIR WOULD HELP.** HFIR represents typed nodes and parameter constraints directly in the IR graph, decoupling type inference and flow-sensitive type refinement from syntactic token defaults.
* **Evidence:** `scripts/build.sh` compiles `app/frontend.howl` without checker diagnostics and emits `static/app.js`.

---

## 3. Strict Binary `let` Arity and Nesting Friction

* **Problem:** Chaining multiple local variable bindings or executing sequential statements after a `let` binding produced syntax errors such as `let expects 2 arguments, got 3`.
* **Observed behavior:** The parser expects either a single nested expression or an explicit `(do ...)` wrapper containing sequential statements.
* **Classification:** `LANGUAGE GAP`
* **Root cause:** Howl's S-expression syntax enforces strict binary `(let (var expr) body)` semantics. When generating or editing code, parenthesis counting and deep nesting trees (often 5–8 levels deep) become error-prone.
* **Workaround:** Formatted all bindings as strictly nested single-expression chains terminated by explicit `(do ...)` blocks.
* **Framework change:** None.
* **HFIR implication:** **HFIR WOULD HELP.** A major design motivation for HFIR is representing computational steps as a directed acyclic graph of value definitions and control blocks. Machine-generated and model-edited mutations operate on graph nodes without brittle text-level parenthesis balancing.
* **Evidence:** `app/backend.howl` and `app/frontend.howl` compile cleanly after adhering to canonical nested `let` structures.

---

## 4. Response Context Does Not Propagate Across Bytecode `defun` Calls

* **Problem:** Attempting to extract shared HTTP headers (such as CORS headers or Content-Type) into a reusable `(defun set_cors_headers () (res_header "Access-Control-Allow-Origin" "*"))` caused the VM to panic with `no response writer`.
* **Observed behavior:** The `http.ResponseWriter` is stored in the local request environment `reqEnv` of the route handler. When a `defun` is invoked, its execution environment does not inherit the response writer context.
* **Classification:** `VM GAP`
* **Root cause:** The bytecode VM's function call mechanism (`OpCall`) creates an isolated environment frame that does not propagate the HTTP response writer without explicit context passing.
* **Workaround:** Inlined `res_header` and response handling directly inside each route handler.
* **Framework change:** Documented as an architectural finding.
* **HFIR implication:** **HFIR WOULD HELP.** In HFIR, HTTP response writing is an explicit effect capability passed through the call graph, making context requirements visible and verifiable at compile time rather than relying on dynamic ambient variables.
* **Evidence:** `app/backend.howl` sets CORS headers directly per route; verified across all API endpoints in `tests/e2e_test.go`.

---

## 5. Lack of Native JSON Serialization in Frontend `web_app`

* **Problem:** In `app/frontend.howl`, sending structured JSON bodies in `(fetch url method body)` required manual string construction.
* **Observed behavior:** HowlFrame provides `parse_json` (compiling to `JSON.parse`), but lacks an inverse `encode_json` / `json_stringify` AST node for the JavaScript backend.
* **Classification:** `BACKEND GAP` / `LANGUAGE GAP`
* **Root cause:** The JS backend currently supports `parse_json` but has not implemented an `encode_json` mapping to `JSON.stringify`.
* **Workaround:** Used `str_join` to format JSON request payloads (e.g. `(str_join (list "{\"content\":\"" content "\"}") "")`).
* **Framework change:** None for v1.
* **HFIR implication:** **HFIR WOULD HELP.** Standard serialization/deserialization primitives in HFIR provide uniform lowering across Go, JS, and Bytecode backends.
* **Evidence:** `app/frontend.howl` successfully sends JSON payloads to `/api/notes` (POST, PUT, DELETE); verified by E2E test suite.

---

## 6. Granular Capability Enforcement for File-Backed Persistence

* **Problem:** Verifying the minimum necessary capabilities for HowlNotes.
* **Observed behavior:** Running the bytecode VM with only `network` or `network,database` resulted in immediate, deterministic runtime failure:
  - Without `network`: VM terminates at startup with `CAPABILITY_DENIED: network`.
  - With `network` but without `database`: Store open operations fail with `CAPABILITY_DENIED: database`.
  - With `network,database` but without `filesystem`: `file://` store operations fail with `CAPABILITY_DENIED: filesystem`.
  - With `network,database,filesystem`: Complete CRUD and restart persistence succeed.
* **Classification:** `CAPABILITY/POLICY GAP` (System behaving as designed)
* **Root cause:** HowlFrame enforces multi-capability gating where a file-backed store (`file://...`) requires both `database` authority (for state operations) and `filesystem` authority (for disk synchronization).
* **Workaround:** Runner explicitly grants `--allow-caps network,database,filesystem`.
* **HFIR implication:** **HFIR QUESTION STILL OPEN.** HFIR can perform static capability inference over the whole program graph, computing the exact capability manifest before execution.
* **Evidence:** `tests/e2e_test.go` -> `TestCapabilityDenial` verifies negative denial cases for each missing capability.

---

## Summary Matrix

| ID | Issue Description | Classification | Workaround Used | HFIR Impact |
|---|---|---|---|---|
| 1 | Missing `len` string operator in bytecode | `BACKEND GAP` | `(list_len (str_split content ""))` | Would Help |
| 2 | Untyped `defun` parameter inference | `CHECKER GAP` | `type_hint` & string comparisons | Would Help |
| 3 | Strict binary `let` nesting & parens | `LANGUAGE GAP` | Canonical nested `let` + `do` | Would Help |
| 4 | Response writer context across `defun` | `VM GAP` | Inlined route headers | Would Help |
| 5 | No `encode_json` in `web_app` | `BACKEND GAP` | `str_join` JSON formatting | Would Help |
| 6 | File-store multi-capability requirement | `CAPABILITY/POLICY GAP` | Explicit minimal grants | Question Open |
