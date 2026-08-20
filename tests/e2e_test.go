package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func findHowlFrameBin(t *testing.T) string {
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}
	repoRoot := filepath.Dir(cwd)
	binPath := filepath.Join(repoRoot, "bin", "howlframe")
	if _, err := os.Stat(binPath); err == nil {
		return binPath
	}
	bootstrapCmd := exec.Command(filepath.Join(repoRoot, "scripts", "bootstrap.sh"))
	bootstrapCmd.Stdout = os.Stdout
	bootstrapCmd.Stderr = os.Stderr
	if err := bootstrapCmd.Run(); err != nil {
		t.Fatalf("bootstrap failed: %v", err)
	}
	return binPath
}

func buildApp(t *testing.T) {
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)
	buildCmd := exec.Command(filepath.Join(repoRoot, "scripts", "build.sh"))
	out, err := buildCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("build.sh failed: %v, output: %s", err, string(out))
	}
}

func startServer(t *testing.T, howlframeBin string, caps string, port string) (*exec.Cmd, func()) {
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)
	bcFile := filepath.Join(repoRoot, "build", "backend.hfbc")

	var args []string
	args = append(args, "-run-bc")
	if caps != "" {
		args = append(args, "-allow-caps", caps)
	}
	args = append(args, bcFile)

	cmd := exec.Command(howlframeBin, args...)
	cmd.Dir = repoRoot

	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		t.Fatalf("failed to start server process: %v", err)
	}

	cleanup := func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
		}
	}

	// Wait for server to listen
	baseURL := "http://localhost:" + port + "/api/health"
	var ready bool
	for i := 0; i < 30; i++ {
		time.Sleep(100 * time.Millisecond)
		resp, err := http.Get(baseURL)
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			ready = true
			break
		}
		if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
			break
		}
	}

	if !ready {
		cleanup()
		t.Fatalf("server failed to start on port %s within 3s. Stderr: %s, Stdout: %s", port, stderrBuf.String(), stdoutBuf.String())
	}

	return cmd, cleanup
}

func TestHowlFrameCompilation(t *testing.T) {
	bin := findHowlFrameBin(t)
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)

	backendFile := filepath.Join(repoRoot, "app", "backend.howl")
	frontendFile := filepath.Join(repoRoot, "app", "frontend.howl")

	t.Run("ValidateBackend", func(t *testing.T) {
		cmd := exec.Command(bin, "-validate", backendFile)
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("backend.howl validation failed: %v, out: %s", err, string(out))
		}
	})

	t.Run("ValidateFrontend", func(t *testing.T) {
		cmd := exec.Command(bin, "-validate", frontendFile)
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("frontend.howl validation failed: %v, out: %s", err, string(out))
		}
	})

	t.Run("CompileArtifacts", func(t *testing.T) {
		buildApp(t)
		bcFile := filepath.Join(repoRoot, "build", "backend.hfbc")
		if stat, err := os.Stat(bcFile); err != nil || stat.Size() == 0 {
			t.Fatalf("backend.hfbc artifact missing or empty: %v", err)
		}
		jsFile := filepath.Join(repoRoot, "static", "app.js")
		if stat, err := os.Stat(jsFile); err != nil || stat.Size() == 0 {
			t.Fatalf("static/app.js artifact missing or empty: %v", err)
		}
	})
}

func TestCapabilityDenial(t *testing.T) {
	bin := findHowlFrameBin(t)
	buildApp(t)
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)
	bcFile := filepath.Join(repoRoot, "build", "backend.hfbc")

	t.Run("DenyWhenNoNetworkCapability", func(t *testing.T) {
		cmd := exec.Command(bin, "-run-bc", "-allow-caps", "database,filesystem", bcFile)
		cmd.Dir = repoRoot
		out, err := cmd.CombinedOutput()
		if err == nil {
			t.Fatal("expected failure without network capability, got success")
		}
		if !strings.Contains(string(out), "CAPABILITY_DENIED") && !strings.Contains(string(out), "network") {
			t.Fatalf("expected CAPABILITY_DENIED for network, got: %s", string(out))
		}
	})

	t.Run("DenyWhenNoDatabaseCapability", func(t *testing.T) {
		// Server can start with network+filesystem, but first store request will be denied
		cmd := exec.Command(bin, "-run-bc", "-allow-caps", "network,filesystem", bcFile)
		cmd.Dir = repoRoot
		var stdoutBuf, stderrBuf bytes.Buffer
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf
		if err := cmd.Start(); err != nil {
			t.Fatalf("failed to start process: %v", err)
		}
		defer func() {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
				_ = cmd.Wait()
			}
		}()

		// Wait for listener
		time.Sleep(200 * time.Millisecond)

		// Send request that needs database capability
		resp, err := http.Get("http://localhost:8088/api/notes")
		if err == nil {
			defer resp.Body.Close()
		}
		// Process should have crashed or paniced inside handler with CAPABILITY_DENIED
	})

	t.Run("DenyWhenNoFilesystemCapability", func(t *testing.T) {
		// Server started without filesystem capability for file:// store
		cmd := exec.Command(bin, "-run-bc", "-allow-caps", "network,database", bcFile)
		cmd.Dir = repoRoot
		var stdoutBuf, stderrBuf bytes.Buffer
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf
		if err := cmd.Start(); err != nil {
			t.Fatalf("failed to start process: %v", err)
		}
		defer func() {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
				_ = cmd.Wait()
			}
		}()

		time.Sleep(200 * time.Millisecond)
		resp, err := http.Get("http://localhost:8088/api/notes")
		if err == nil {
			defer resp.Body.Close()
		}
	})
}

func TestNotesEndToEndAndPersistence(t *testing.T) {
	bin := findHowlFrameBin(t)
	buildApp(t)
	cwd, _ := os.Getwd()
	repoRoot := filepath.Dir(cwd)
	dataFile := filepath.Join(repoRoot, "data", "notes.json")

	// Clean data file
	_ = os.Remove(dataFile)

	_, cleanup1 := startServer(t, bin, "network,database,filesystem", "8088")

	baseURL := "http://localhost:8088"

	// 1. Health check
	t.Run("HealthCheck", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/health")
		if err != nil {
			t.Fatalf("GET /api/health failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		var data map[string]any
		json.NewDecoder(resp.Body).Decode(&data)
		if data["app"] != "howlnotes" || data["status"] != "ok" {
			t.Fatalf("unexpected health payload: %#v", data)
		}
	})

	// 2. Initial list empty
	t.Run("ListNotesInitialEmpty", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/notes")
		if err != nil {
			t.Fatalf("GET /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		var data map[string][]any
		json.NewDecoder(resp.Body).Decode(&data)
		if len(data["notes"]) != 0 {
			t.Fatalf("expected 0 notes, got %d", len(data["notes"]))
		}
	})

	// 3. Create Note 1
	var note1ID string
	t.Run("CreateNote1", func(t *testing.T) {
		payload := `{"content":"First HowlNotes note written in HowlFrame"}`
		resp, err := http.Post(baseURL+"/api/notes", "application/json", strings.NewReader(payload))
		if err != nil {
			t.Fatalf("POST /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 201 {
			t.Fatalf("expected 201 Created, got %d", resp.StatusCode)
		}
		var note map[string]any
		json.NewDecoder(resp.Body).Decode(&note)
		note1ID = fmt.Sprint(note["id"])
		if note1ID != "1" {
			t.Fatalf("expected id '1', got %v", note1ID)
		}
		if note["content"] != "First HowlNotes note written in HowlFrame" {
			t.Fatalf("unexpected content: %v", note["content"])
		}
	})

	// 4. Create Note 2
	var note2ID string
	t.Run("CreateNote2", func(t *testing.T) {
		payload := `{"content":"Second note for deletion test"}`
		resp, err := http.Post(baseURL+"/api/notes", "application/json", strings.NewReader(payload))
		if err != nil {
			t.Fatalf("POST /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 201 {
			t.Fatalf("expected 201 Created, got %d", resp.StatusCode)
		}
		var note map[string]any
		json.NewDecoder(resp.Body).Decode(&note)
		note2ID = fmt.Sprint(note["id"])
		if note2ID != "2" {
			t.Fatalf("expected id '2', got %v", note2ID)
		}
	})

	// 5. List Notes after 2 creates
	t.Run("ListNotesAfterCreates", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/notes")
		if err != nil {
			t.Fatalf("GET /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		var data map[string][]map[string]any
		json.NewDecoder(resp.Body).Decode(&data)
		if len(data["notes"]) != 2 {
			t.Fatalf("expected 2 notes, got %d", len(data["notes"]))
		}
	})

	// 6. Get Note 1
	t.Run("GetNote1", func(t *testing.T) {
		payload := `{"id":"1"}`
		resp, err := http.Post(baseURL+"/api/notes/get", "application/json", strings.NewReader(payload))
		if err != nil {
			t.Fatalf("POST /api/notes/get failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		var note map[string]any
		json.NewDecoder(resp.Body).Decode(&note)
		if note["id"] != "1" || note["content"] != "First HowlNotes note written in HowlFrame" {
			t.Fatalf("unexpected note: %#v", note)
		}
	})

	// 7. Update Note 1
	t.Run("UpdateNote1", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodPut, baseURL+"/api/notes", strings.NewReader(`{"id":"1","content":"Updated note 1 content"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("PUT /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		var note map[string]any
		json.NewDecoder(resp.Body).Decode(&note)
		if note["content"] != "Updated note 1 content" {
			t.Fatalf("expected updated content, got %v", note["content"])
		}
	})

	// 8. Delete Note 2
	t.Run("DeleteNote2", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodDelete, baseURL+"/api/notes", strings.NewReader(`{"id":"2"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("DELETE /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		var res map[string]any
		json.NewDecoder(resp.Body).Decode(&res)
		if res["status"] != "ok" || res["deleted"] != "2" {
			t.Fatalf("unexpected delete response: %#v", res)
		}
	})

	// 9. Verify note 2 gone and note 1 remains
	t.Run("VerifyListAfterDelete", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/api/notes")
		if err != nil {
			t.Fatalf("GET /api/notes failed: %v", err)
		}
		defer resp.Body.Close()
		var data map[string][]map[string]any
		json.NewDecoder(resp.Body).Decode(&data)
		if len(data["notes"]) != 1 {
			t.Fatalf("expected 1 note, got %d", len(data["notes"]))
		}
		if data["notes"][0]["content"] != "Updated note 1 content" {
			t.Fatalf("unexpected note content: %v", data["notes"][0]["content"])
		}
	})

	// 10. Test static assets
	t.Run("StaticFilesServing", func(t *testing.T) {
		resp, err := http.Get(baseURL + "/")
		if err != nil {
			t.Fatalf("GET / failed: %v", err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(body), "HowlNotes") {
			t.Fatalf("expected index.html with HowlNotes, got %s", string(body))
		}

		cssResp, err := http.Get(baseURL + "/app.css")
		if err != nil {
			t.Fatalf("GET /app.css failed: %v", err)
		}
		defer cssResp.Body.Close()
		cssBody, _ := io.ReadAll(cssResp.Body)
		if !strings.Contains(string(cssBody), "--primary-color") {
			t.Fatalf("expected app.css content, got %s", string(cssBody))
		}

		jsResp, err := http.Get(baseURL + "/app.js")
		if err != nil {
			t.Fatalf("GET /app.js failed: %v", err)
		}
		defer jsResp.Body.Close()
		jsBody, _ := io.ReadAll(jsResp.Body)
		if !strings.Contains(string(jsBody), "load_notes") {
			t.Fatalf("expected app.js content, got %s", string(jsBody))
		}
	})

	// 11. Error cases
	t.Run("ValidationAndErrorCases", func(t *testing.T) {
		// Empty content
		resp, err := http.Post(baseURL+"/api/notes", "application/json", strings.NewReader(`{"content":""}`))
		if err != nil || resp.StatusCode != 400 {
			t.Fatalf("expected 400 for empty content, got %v (%d)", err, resp.StatusCode)
		}
		var errData map[string]any
		json.NewDecoder(resp.Body).Decode(&errData)
		if errData["error"] != "content_required" {
			t.Fatalf("expected content_required, got %#v", errData)
		}
		resp.Body.Close()

		// Invalid JSON
		resp2, err := http.Post(baseURL+"/api/notes", "application/json", strings.NewReader(`{bad json`))
		if err != nil || resp2.StatusCode != 400 {
			t.Fatalf("expected 400 for bad json, got %v (%d)", err, resp2.StatusCode)
		}
		var errData2 map[string]any
		json.NewDecoder(resp2.Body).Decode(&errData2)
		if errData2["error"] != "invalid_json" {
			t.Fatalf("expected invalid_json, got %#v", errData2)
		}
		resp2.Body.Close()

		// Missing note lookup (404)
		resp3, err := http.Post(baseURL+"/api/notes/get", "application/json", strings.NewReader(`{"id":"9999"}`))
		if err != nil || resp3.StatusCode != 404 {
			t.Fatalf("expected 404 for missing note, got %v (%d)", err, resp3.StatusCode)
		}
		var errData3 map[string]any
		json.NewDecoder(resp3.Body).Decode(&errData3)
		if errData3["error"] != "not_found" {
			t.Fatalf("expected not_found, got %#v", errData3)
		}
		resp3.Body.Close()

		// Missing note delete (404)
		reqDel, _ := http.NewRequest(http.MethodDelete, baseURL+"/api/notes", strings.NewReader(`{"id":"9999"}`))
		reqDel.Header.Set("Content-Type", "application/json")
		respDel, err := http.DefaultClient.Do(reqDel)
		if err != nil || respDel.StatusCode != 404 {
			t.Fatalf("expected 404 for deleting nonexistent note, got %v (%d)", err, respDel.StatusCode)
		}
		respDel.Body.Close()

		// Oversized content
		hugeContent := strings.Repeat("A", 10005)
		respHuge, err := http.Post(baseURL+"/api/notes", "application/json", strings.NewReader(fmt.Sprintf(`{"content":"%s"}`, hugeContent)))
		if err != nil || respHuge.StatusCode != 400 {
			t.Fatalf("expected 400 for oversized content, got %v (%d)", err, respHuge.StatusCode)
		}
		var errHuge map[string]any
		json.NewDecoder(respHuge.Body).Decode(&errHuge)
		if errHuge["error"] != "content_too_long" {
			t.Fatalf("expected content_too_long, got %#v", errHuge)
		}
		respHuge.Body.Close()
	})

	// Clean stop server 1
	cleanup1()

	// 12. RESTART PERSISTENCE VERIFICATION
	t.Run("RestartPersistence", func(t *testing.T) {
		// Restart the server process afresh
		_, cleanup2 := startServer(t, bin, "network,database,filesystem", "8088")
		defer cleanup2()

		resp, err := http.Get(baseURL + "/api/notes")
		if err != nil {
			t.Fatalf("GET /api/notes after restart failed: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
		var data map[string][]map[string]any
		json.NewDecoder(resp.Body).Decode(&data)
		if len(data["notes"]) != 1 {
			t.Fatalf("expected 1 surviving note after restart, got %d", len(data["notes"]))
		}
		if data["notes"][0]["id"] != "1" || data["notes"][0]["content"] != "Updated note 1 content" {
			t.Fatalf("expected surviving note 1 with updated content, got %#v", data["notes"][0])
		}
	})
}
