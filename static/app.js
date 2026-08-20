async function set_status(message, is_error) {
//line frontend.howl:4
{
let banner = document.querySelector("#status-banner");
//line frontend.howl:5
{
//line frontend.howl:6
if ((message === "")) {
//line frontend.howl:7
{
banner.textContent = "";
banner.setAttribute("style", "display: none;");
}
} else {
//line frontend.howl:11
{
banner.textContent = message;
//line frontend.howl:13
if ((is_error === "true")) {
banner.setAttribute("class", "status-banner status-error")
} else {
banner.setAttribute("class", "status-banner status-success")
};
banner.setAttribute("style", "display: block;");
}
};
}
}
}

async function render_note(note) {
//line frontend.howl:26
{
let id = String((note["id"] ?? ""));
let content = String((note["content"] ?? ""));
let created_at = String((note["created_at"] ?? ""));
let updated_at = String((note["updated_at"] ?? ""));
let html = "";
//line frontend.howl:31
{
//line frontend.howl:32
html = (["<div class=\"note-card\" id=\"note-", id, "\">"]).join("");
//line frontend.howl:33
html = ([html, "<div class=\"note-header\"><span class=\"note-badge\">Note #", id, "</span><span class=\"note-timestamp\">", created_at, "</span></div>"]).join("");
//line frontend.howl:34
html = ([html, "<div class=\"note-body\" id=\"note-content-", id, "\">", content, "</div>"]).join("");
//line frontend.howl:35
html = ([html, "<div class=\"note-actions\">"]).join("");
//line frontend.howl:36
html = ([html, "<button class=\"btn btn-secondary\" onclick=\"start_edit('", id, "','", content, "')\">Edit</button>"]).join("");
//line frontend.howl:37
html = ([html, "<button class=\"btn btn-danger\" onclick=\"delete_note('", id, "')\">Delete</button>"]).join("");
//line frontend.howl:38
html = ([html, "</div></div>"]).join("");
//line frontend.howl:39
return html;;
}
}
}

async function load_notes() {
//line frontend.howl:49
{
//line frontend.howl:50
(await set_status("Loading notes...", "false"));
//line frontend.howl:51
{
	let resp;
	let err = null;
	try {
		resp = (await fetch("/api/notes", { method: "GET" }).then(r => r.text()));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:53
(await set_status("Failed to connect to HowlNotes server", "true"))
	} else {
		//line frontend.howl:55
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = JSON.parse(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:57
(await set_status("Received invalid response from server", "true"))
	} else {
		//line frontend.howl:59
{
let notes = (json_resp["notes"] ?? "");
let filter_text = document.querySelector("#search-input").value;
let cards_html = "";
let count = 0;
//line frontend.howl:63
{
//line frontend.howl:64
for (let note of notes) {
//line frontend.howl:65
{
let content = String((note["content"] ?? ""));
let id = String((note["id"] ?? ""));
let match = true;
//line frontend.howl:68
{
//line frontend.howl:69
if ((filter_text !== "")) {
//line frontend.howl:70
if ((new RegExp(filter_text).test(content) === false)) {
//line frontend.howl:71
match = false
} else {
//line frontend.howl:72
{
}
}
} else {
//line frontend.howl:74
{
}
};
//line frontend.howl:76
if (match) {
//line frontend.howl:77
{
let card = (await render_note(note));
//line frontend.howl:78
{
//line frontend.howl:79
cards_html = ([cards_html, card]).join("");
//line frontend.howl:80
count = (count + 1);
}
}
} else {
//line frontend.howl:83
{
}
};
}
}
};
//line frontend.howl:90
if ((count === 0)) {
document.querySelector("#notes-container").innerHTML = "<div class=\"empty-state\">No notes found. Create your first note above!</div>"
} else {
document.querySelector("#notes-container").innerHTML = cards_html
};
//line frontend.howl:94
(await set_status("", "false"));
}
}
	}
}
	}
};
}
}

async function create_note() {
//line frontend.howl:106
{
let input = document.querySelector("#new-note-content");
let content = input.value;
//line frontend.howl:108
{
//line frontend.howl:109
if ((content === "")) {
//line frontend.howl:110
(await set_status("Note content cannot be empty", "true"))
} else {
//line frontend.howl:111
if ((((content).split("")).length > 10000)) {
//line frontend.howl:112
(await set_status("Note content exceeds 10,000 characters limit", "true"))
} else {
//line frontend.howl:113
{
//line frontend.howl:114
(await set_status("Saving note...", "false"));
//line frontend.howl:115
{
let req_body = (["{\"content\":\"", content, "\"}"]).join("");
//line frontend.howl:116
{
	let resp;
	let err = null;
	try {
		resp = (await fetch("/api/notes", { method: "POST", body: req_body }).then(r => r.text()));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:118
(await set_status("Failed to save note", "true"))
	} else {
		//line frontend.howl:120
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = JSON.parse(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:122
(await set_status("Server error while saving note", "true"))
	} else {
		//line frontend.howl:124
{
let err_msg = (json_resp["error"] ?? "");
//line frontend.howl:125
if ((err_msg !== "")) {
//line frontend.howl:126
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:127
{
input.setAttribute("value", "");
//line frontend.howl:129
(await set_status("Note created successfully!", "false"));
//line frontend.howl:130
(await load_notes());
}
}
}
	}
}
	}
}
};
}
}
};
}
}
}

async function start_edit(id, content) {
//line frontend.howl:146
{
let modal = document.querySelector("#edit-modal");
let id_input = document.querySelector("#edit-note-id");
let content_input = document.querySelector("#edit-note-content");
//line frontend.howl:149
{
id_input.setAttribute("value", id);
content_input.setAttribute("value", content);
modal.setAttribute("style", "display: flex;");
}
}
}

async function cancel_edit() {
//line frontend.howl:160
{
let modal = document.querySelector("#edit-modal");
//line frontend.howl:161
{
modal.setAttribute("style", "display: none;");
//line frontend.howl:163
(await set_status("", "false"));
}
}
}

async function save_edit() {
//line frontend.howl:169
{
let id = document.querySelector("#edit-note-id").value;
let content = document.querySelector("#edit-note-content").value;
//line frontend.howl:171
{
//line frontend.howl:172
if ((content === "")) {
//line frontend.howl:173
(await set_status("Note content cannot be empty", "true"))
} else {
//line frontend.howl:174
if ((((content).split("")).length > 10000)) {
//line frontend.howl:175
(await set_status("Note content exceeds 10,000 characters limit", "true"))
} else {
//line frontend.howl:176
{
//line frontend.howl:177
(await set_status("Updating note...", "false"));
//line frontend.howl:178
{
let req_body = (["{\"id\":\"", id, "\",\"content\":\"", content, "\"}"]).join("");
//line frontend.howl:179
{
	let resp;
	let err = null;
	try {
		resp = (await fetch("/api/notes", { method: "PUT", body: req_body }).then(r => r.text()));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:181
(await set_status("Failed to update note", "true"))
	} else {
		//line frontend.howl:183
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = JSON.parse(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:185
(await set_status("Server error while updating note", "true"))
	} else {
		//line frontend.howl:187
{
let err_msg = (json_resp["error"] ?? "");
//line frontend.howl:188
if ((err_msg !== "")) {
//line frontend.howl:189
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:190
{
//line frontend.howl:191
(await cancel_edit());
//line frontend.howl:192
(await set_status("Note updated successfully!", "false"));
//line frontend.howl:193
(await load_notes());
}
}
}
	}
}
	}
}
};
}
}
};
}
}
}

async function delete_note(id) {
//line frontend.howl:209
{
//line frontend.howl:210
(await set_status("Deleting note...", "false"));
//line frontend.howl:211
{
let req_body = (["{\"id\":\"", id, "\"}"]).join("");
//line frontend.howl:212
{
	let resp;
	let err = null;
	try {
		resp = (await fetch("/api/notes", { method: "DELETE", body: req_body }).then(r => r.text()));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:214
(await set_status("Failed to delete note", "true"))
	} else {
		//line frontend.howl:216
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = JSON.parse(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:218
(await set_status("Server error while deleting note", "true"))
	} else {
		//line frontend.howl:220
{
let err_msg = (json_resp["error"] ?? "");
//line frontend.howl:221
if ((err_msg !== "")) {
//line frontend.howl:222
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:223
{
//line frontend.howl:224
(await set_status("Note deleted successfully!", "false"));
//line frontend.howl:225
(await load_notes());
}
}
}
	}
}
	}
}
};
}
}

document.querySelector("#create-btn").addEventListener("click", async (e) => {
//line frontend.howl:236
(await create_note())
})
document.querySelector("#search-input").addEventListener("input", async (e) => {
//line frontend.howl:240
(await load_notes())
})
document.querySelector("#refresh-btn").addEventListener("click", async (e) => {
//line frontend.howl:244
(await load_notes())
})
document.querySelector("#save-edit-btn").addEventListener("click", async (e) => {
//line frontend.howl:248
(await save_edit())
})
document.querySelector("#cancel-edit-btn").addEventListener("click", async (e) => {
//line frontend.howl:252
(await cancel_edit())
})
//line frontend.howl:255
(await load_notes())
