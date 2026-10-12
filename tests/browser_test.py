"""Browser behavior regressions; run against an isolated HowlNotes server."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

base_url = os.environ.get("HOWLNOTES_URL", "http://127.0.0.1:8088")
evidence = Path(os.environ.get("HOWLNOTES_EVIDENCE", "build/browser-evidence"))
evidence.mkdir(parents=True, exist_ok=True)
sentinel = '<img src="/benign-missing" onerror="window.howlNotesSentinel=1">'
content = 'Owner\'s "quotes", backslash \\, newline\n[] .* + ? <tag> & 🙂 ' + sentinel
updated = content + '\nUpdated literally [('

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base_url)
    expect(page.locator("#status-banner")).to_be_hidden()
    before = page.locator(".note-card").count()
    page.locator("#new-note-content").fill(content)
    page.locator("#create-btn").focus()
    page.keyboard.press("Enter")
    expect(page.locator(".note-card")).to_have_count(before + 1)
    expect(page.locator("#new-note-content")).to_have_value("")
    card = page.locator(".note-card").filter(has=page.get_by_text(content, exact=True))
    expect(card.locator(".note-body")).to_have_text(content)
    assert card.locator("img, script").count() == 0
    assert page.evaluate("window.howlNotesSentinel === undefined")
    card.get_by_role("button", name="Edit", exact=True).click()
    expect(page.locator("#edit-note-content")).to_have_value(content)
    expect(page.locator("#edit-note-content")).to_be_focused()
    page.keyboard.press("Shift+Tab")
    expect(page.locator("#save-edit-btn")).to_be_focused()
    page.keyboard.press("Tab")
    expect(page.locator("#edit-note-content")).to_be_focused()
    page.keyboard.press("Escape")
    expect(page.locator("#edit-modal")).to_be_hidden()
    card.get_by_role("button", name="Edit", exact=True).click()
    page.locator("#edit-note-content").fill(updated)
    page.locator("#save-edit-btn").click()
    expect(page.locator("#edit-modal")).to_be_hidden()
    expect(page.locator(".note-body").filter(has_text=updated)).to_have_count(1)
    for term in ["[(", "[]", ".*", "Owner's", "🙂"]:
        page.locator("#search-input").fill(term)
        expect(page.locator(".note-card")).to_have_count(1)
    page.locator("#search-input").fill("does-not-exist-unique")
    expect(page.locator(".empty-state")).to_be_visible()
    page.locator("#search-input").fill("")
    expect(page.locator(".note-card")).to_have_count(before + 1)
    page.screenshot(path=str(evidence / "desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(evidence / "mobile.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.locator("#create-btn").click()
    expect(page.locator("#status-banner")).to_have_text("Note content cannot be empty")
    page.locator("#new-note-content").fill("x" * 10001)
    page.locator("#create-btn").click()
    expect(page.locator("#status-banner")).to_contain_text("10,000")
    page.locator("#new-note-content").fill("")
    page.context.set_offline(True)
    page.locator("#refresh-btn").click()
    expect(page.locator("#status-banner")).to_have_text("Failed to connect to HowlNotes server")
    page.context.set_offline(False)
    page.locator("#refresh-btn").click()
    expect(page.locator("#status-banner")).to_be_hidden()
    page.reload()
    expect(page.locator(".note-body").filter(has_text=updated)).to_have_count(1)
    card = page.locator(".note-card").filter(has=page.get_by_text(updated, exact=True))
    card.get_by_role("button", name="Delete", exact=True).click()
    expect(page.locator(".note-card")).to_have_count(before)
    # A hostile API id must remain attribute data, never JavaScript source.
    hostile_id = "x');window.howlNotesIDSentinel=1;//"
    requests = []

    def fixture(route):
        if route.request.method == "DELETE":
            requests.append(route.request.post_data_json)
            route.fulfill(json={"status": "ok", "deleted": hostile_id})
        else:
            route.fulfill(json={"notes": [{"id": hostile_id, "content": "fixture text",
                                          "created_at": "now", "updated_at": "now"}]})

    page.route("**/api/notes", fixture)
    page.locator("#refresh-btn").click()
    expect(page.locator(".note-card")).to_have_count(1)
    page.get_by_role("button", name="Edit", exact=True).click()
    expect(page.locator("#edit-note-content")).to_have_value("fixture text")
    page.locator("#cancel-edit-btn").click()
    page.get_by_role("button", name="Delete", exact=True).click()
    expect(page.locator("#status-banner")).to_be_hidden()
    assert requests == [{"id": hostile_id}]
    assert page.evaluate("window.howlNotesIDSentinel === undefined")
    assert not errors, errors
    (evidence / "browser-results.json").write_text(json.dumps({
        "passed": True, "page_errors": errors,
        "coverage": "literal CRUD/search, inert stored HTML, keyboard, mobile, validation, offline recovery, reload",
    }, indent=2))
    browser.close()
