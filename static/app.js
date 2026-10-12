function howlFrameGrantHas(name) {
  var raw = "";
  if (typeof process !== "undefined" && process.env) {
    raw = process.env.HOWLFRAME_ALLOW_CAPS || "";
  } else if (typeof globalThis !== "undefined") {
    raw = globalThis.HOWLFRAME_ALLOW_CAPS;
  }
  if (typeof raw !== "string") return false;
  var parts = raw.split(",");
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].trim() === name) return true;
  }
  return false;
}

function howlFrameFetch(url, method, body) {
  if (!howlFrameGrantHas("network")) {
    throw new Error("CAPABILITY_DENIED: capability denied: network");
  }
  var init = { method: method };
  if (arguments.length >= 3) {
    init.body = body;
  }
  return fetch(url, init).then(function (r) { return r.text(); });
}

function howlFrameToInt(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to int");
    }
    var t = Math.trunc(v);
    if (t < Number.MIN_SAFE_INTEGER || t > Number.MAX_SAFE_INTEGER) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to int");
    }
    return t;
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (!/^[+-]?\d+$/.test(s)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to int");
    }
    var n = Number(s);
    if (!Number.isInteger(n) || n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to int");
    }
    return n;
  }
  throw new Error("CONVERSION_ERROR: cannot convert " + (typeof v) + " to int");
}
function howlFrameSafeInt(v) {
  if (!Number.isSafeInteger(v)) {
    throw new Error("RUNTIME_ERROR: integer result is outside the exact JavaScript integer range");
  }
  return v;
}
function howlFrameArith(op, a, b) {
  var v = op === "+" ? a + b : op === "-" ? a - b : a * b;
  if (typeof v === "number" && !Number.isSafeInteger(v) && Number.isInteger(a) && Number.isInteger(b)) {
    throw new Error("RUNTIME_ERROR: integer result is outside the exact JavaScript integer range");
  }
  return v;
}
function howlFrameParseJSON(text) {
  // JavaScript numbers cannot hold every int64. When the engine exposes the
  // token source, reject only integer tokens that would lose precision. Without
  // it, fail closed on any integer-valued number outside the exact range:
  // an integer beyond 2^53 always decodes to such a value.
  return JSON.parse(text, function (key, value, context) {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      var unsafe = context && typeof context.source === "string" ? /^-?\d+$/.test(context.source) : Number.isInteger(value);
      if (unsafe) {
        throw new Error("CONVERSION_ERROR: integer is outside the exact JavaScript integer range");
      }
    }
    return value;
  });
}
function howlFrameToFloat(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to float");
    }
    return v;
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (s === "") {
      throw new Error("CONVERSION_ERROR: cannot convert \"\" to float");
    }
    var n = Number(s);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to float");
    }
    return n;
  }
  throw new Error("CONVERSION_ERROR: cannot convert " + (typeof v) + " to float");
}
function howlFrameDiv(a, b) {
  var af = howlFrameToFloat(a);
  var bf = howlFrameToFloat(b);
  if (bf === 0) {
    throw new Error("RUNTIME_ERROR: division by zero");
  }
  var res = af / bf;
  if (!Number.isFinite(res)) {
    throw new Error("RUNTIME_ERROR: division produced an invalid floating-point result");
  }
  return res;
}
function howlFrameValueKind(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "list";
  return typeof v;
}
function howlFrameIsDict(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function howlFrameMapGet(dict, key) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_get expected dict, got " + howlFrameValueKind(dict));
  }
  return dict[key] ?? "";
}
function howlFrameMapSet(dict, key, val) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_set expected dict, got " + howlFrameValueKind(dict));
  }
  dict[key] = val;
}
function howlFrameMapDelete(dict, key) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_delete expected dict, got " + howlFrameValueKind(dict));
  }
  delete dict[key];
}
function howlFrameAppend(list, item) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: append expected list, got " + howlFrameValueKind(list));
  }
  list.push(item);
  return list;
}
function howlFrameListIndex(idx) {
  if (typeof idx === "number" && Number.isInteger(idx)) return idx;
  if (typeof idx === "string" && /^[+-]?\d+$/.test(idx.trim())) return parseInt(idx.trim(), 10);
  throw new Error("TYPE_ERROR: list_get index must be a number, got " + howlFrameValueKind(idx));
}
function howlFrameListGet(list, idx) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: list_get expected list, got " + howlFrameValueKind(list));
  }
  var i = howlFrameListIndex(idx);
  if (i < 0 || i >= list.length) return "";
  return list[i] ?? "";
}
function howlFrameListLen(list) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: list_len expected list, got " + howlFrameValueKind(list));
  }
  return list.length;
}
function howlFrameHTMLEscape(kind, v) {
  if (typeof v !== "string") {
    throw new Error("TYPE_ERROR: " + kind + " expected string, got " + (v === null ? "null" : typeof v));
  }
  return v.replace(/[&<>"']/g, function (c) {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&#34;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
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
let id = howlFrameHTMLEscape("attr_escape", String(howlFrameMapGet(note, "id")));
let content = String(howlFrameMapGet(note, "content"));
let created_at = String(howlFrameMapGet(note, "created_at"));
let updated_at = String(howlFrameMapGet(note, "updated_at"));
let html = "";
//line frontend.howl:31
{
//line frontend.howl:32
html = (["<div class=\"note-card\" id=\"note-", id, "\">"]).join("");
//line frontend.howl:33
html = ([html, "<div class=\"note-header\"><span class=\"note-badge\">Note #", id, "</span><span class=\"note-timestamp\">", howlFrameHTMLEscape("html_escape", created_at), "</span></div>"]).join("");
//line frontend.howl:34
html = ([html, "<div class=\"note-body\" id=\"note-content-", id, "\">", howlFrameHTMLEscape("html_escape", content), "</div>"]).join("");
//line frontend.howl:35
html = ([html, "<div class=\"note-actions\">"]).join("");
//line frontend.howl:36
html = ([html, "<button class=\"btn btn-secondary\" data-note-id=\"", id, "\" onclick=\"start_edit(this.dataset.noteId)\">Edit</button>"]).join("");
//line frontend.howl:37
html = ([html, "<button class=\"btn btn-danger\" data-note-id=\"", id, "\" onclick=\"delete_note(this.dataset.noteId)\">Delete</button>"]).join("");
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
		resp = (await howlFrameFetch("/api/notes", "GET"));
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
		json_resp = howlFrameParseJSON(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:57
(await set_status("Received invalid response from server", "true"))
	} else {
		//line frontend.howl:59
{
let notes = howlFrameMapGet(json_resp, "notes");
let filter_text = document.querySelector("#search-input").value;
let cards_html = "";
let count = 0;
//line frontend.howl:63
{
//line frontend.howl:64
for (let note of notes) {
//line frontend.howl:65
{
let content = String(howlFrameMapGet(note, "content"));
let id = String(howlFrameMapGet(note, "id"));
let match = true;
//line frontend.howl:68
{
//line frontend.howl:69
if ((filter_text !== "")) {
//line frontend.howl:70
if (((howlFrameListLen((content).split(filter_text)) > 1) === false)) {
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
count = howlFrameSafeInt(count + 1);
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
if ((howlFrameListLen((content).split("")) > 10000)) {
//line frontend.howl:112
(await set_status("Note content exceeds 10,000 characters limit", "true"))
} else {
//line frontend.howl:113
{
//line frontend.howl:114
(await set_status("Saving note...", "false"));
//line frontend.howl:115
{
let req_body = JSON.stringify({"content": content});
//line frontend.howl:116
{
	let resp;
	let err = null;
	try {
		resp = (await howlFrameFetch("/api/notes", "POST", req_body));
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
		json_resp = howlFrameParseJSON(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:122
(await set_status("Server error while saving note", "true"))
	} else {
		//line frontend.howl:124
{
let err_msg = howlFrameMapGet(json_resp, "error");
//line frontend.howl:125
if ((err_msg !== "")) {
//line frontend.howl:126
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:127
{
//line frontend.howl:128
input.value = "";
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

async function start_edit(id) {
//line frontend.howl:146
{
let modal = document.querySelector("#edit-modal");
let id_input = document.querySelector("#edit-note-id");
let content_input = document.querySelector("#edit-note-content");
//line frontend.howl:149
{
id_input.setAttribute("value", id);
//line frontend.howl:151
{
let content_node = (await document.getElementById((["note-content-", id]).join("")));
//line frontend.howl:152
content_input.value = content_node.textContent
};
modal.setAttribute("style", "display: flex;");
//line frontend.howl:155
(await content_input.focus());
}
}
}

async function cancel_edit() {
//line frontend.howl:163
{
let modal = document.querySelector("#edit-modal");
//line frontend.howl:164
{
modal.setAttribute("style", "display: none;");
//line frontend.howl:166
{
let input = document.querySelector("#new-note-content");
//line frontend.howl:166
(await input.focus())
};
//line frontend.howl:167
(await set_status("", "false"));
}
}
}

async function save_edit() {
//line frontend.howl:173
{
let id = document.querySelector("#edit-note-id").value;
let content = document.querySelector("#edit-note-content").value;
//line frontend.howl:175
{
//line frontend.howl:176
if ((content === "")) {
//line frontend.howl:177
(await set_status("Note content cannot be empty", "true"))
} else {
//line frontend.howl:178
if ((howlFrameListLen((content).split("")) > 10000)) {
//line frontend.howl:179
(await set_status("Note content exceeds 10,000 characters limit", "true"))
} else {
//line frontend.howl:180
{
//line frontend.howl:181
(await set_status("Updating note...", "false"));
//line frontend.howl:182
{
let req_body = JSON.stringify({"id": id, "content": content});
//line frontend.howl:183
{
	let resp;
	let err = null;
	try {
		resp = (await howlFrameFetch("/api/notes", "PUT", req_body));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:185
(await set_status("Failed to update note", "true"))
	} else {
		//line frontend.howl:187
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = howlFrameParseJSON(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:189
(await set_status("Server error while updating note", "true"))
	} else {
		//line frontend.howl:191
{
let err_msg = howlFrameMapGet(json_resp, "error");
//line frontend.howl:192
if ((err_msg !== "")) {
//line frontend.howl:193
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:194
{
//line frontend.howl:195
(await cancel_edit());
//line frontend.howl:196
(await set_status("Note updated successfully!", "false"));
//line frontend.howl:197
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
//line frontend.howl:213
{
//line frontend.howl:214
(await set_status("Deleting note...", "false"));
//line frontend.howl:215
{
let req_body = JSON.stringify({"id": id});
//line frontend.howl:216
{
	let resp;
	let err = null;
	try {
		resp = (await howlFrameFetch("/api/notes", "DELETE", req_body));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		//line frontend.howl:218
(await set_status("Failed to delete note", "true"))
	} else {
		//line frontend.howl:220
{
	let json_resp;
	let parse_err = null;
	try {
		json_resp = howlFrameParseJSON(resp);
	} catch (e) {
		parse_err = e;
	}
	if (parse_err !== null) {
		//line frontend.howl:222
(await set_status("Server error while deleting note", "true"))
	} else {
		//line frontend.howl:224
{
let err_msg = howlFrameMapGet(json_resp, "error");
//line frontend.howl:225
if ((err_msg !== "")) {
//line frontend.howl:226
(await set_status(err_msg, "true"))
} else {
//line frontend.howl:227
{
//line frontend.howl:228
(await set_status("Note deleted successfully!", "false"));
//line frontend.howl:229
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

;(async () => {
document.querySelector("#create-btn").addEventListener("click", async (e) => {
//line frontend.howl:240
(await create_note())
});
document.querySelector("#search-input").addEventListener("input", async (e) => {
//line frontend.howl:244
(await load_notes())
});
document.querySelector("#refresh-btn").addEventListener("click", async (e) => {
//line frontend.howl:248
(await load_notes())
});
document.querySelector("#save-edit-btn").addEventListener("click", async (e) => {
//line frontend.howl:252
(await save_edit())
});
document.querySelector("#cancel-edit-btn").addEventListener("click", async (e) => {
//line frontend.howl:256
(await cancel_edit())
});
document.querySelector("#edit-modal").addEventListener("keydown", async (e) => {
//line frontend.howl:260
{
let content_input = document.querySelector("#edit-note-content");
let save_button = document.querySelector("#save-edit-btn");
//line frontend.howl:262
{
//line frontend.howl:263
if ((e.key === "Escape")) {
//line frontend.howl:264
{
//line frontend.howl:264
(await cancel_edit());
//line frontend.howl:264
(await e.preventDefault());
//line frontend.howl:264
e.returnValue = false;
}
} else {
//line frontend.howl:265
e.returnValue = true
};
//line frontend.howl:267
if ((e.key === "Tab")) {
//line frontend.howl:268
{
//line frontend.howl:269
if (e.shiftKey) {
//line frontend.howl:270
if ((e.target === content_input)) {
//line frontend.howl:271
{
//line frontend.howl:271
(await save_button.focus());
//line frontend.howl:271
(await e.preventDefault());
//line frontend.howl:271
e.returnValue = false;
}
} else {
//line frontend.howl:272
e.returnValue = true
}
} else {
//line frontend.howl:274
if ((e.target === save_button)) {
//line frontend.howl:275
{
//line frontend.howl:275
(await content_input.focus());
//line frontend.howl:275
(await e.preventDefault());
//line frontend.howl:275
e.returnValue = false;
}
} else {
//line frontend.howl:276
e.returnValue = true
}
};
}
} else {
//line frontend.howl:280
e.returnValue = true
};
}
}
});
//line frontend.howl:287
(await load_notes())

})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  if (typeof process !== "undefined" && typeof process.exit === "function") {
    process.exit(1);
  } else {
    throw err;
  }
});
