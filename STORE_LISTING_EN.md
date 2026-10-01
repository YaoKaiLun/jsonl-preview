# Chrome Web Store form copy (English)

This is copy for the current v0.1.0 package. Check each field against the actual dashboard form and extension before submission. The package currently has a Chinese display name and a Simplified Chinese interface; English text here does not change the installed UI.

## Store listing

**Short description / summary (if shown as an editable field)**

```text
Preview JSONL and JSONL.ZSTD locally with searchable records, malformed-line inspection, and a JSON tree.
```

**Detailed description**

```text
Preview JSONL and compressed JSONL files directly in Chrome. Paste text, choose a file, or drag a file into the preview page. Parsing and decompression happen locally in your browser.

Features:
• Open .jsonl, .ndjson, .jsonl.zstd, and .jsonl.zst files.
• Browse records even when each line has a different structure or no type field.
• Search nested field names, field values, or raw line text.
• Compare common fields across records and inspect malformed lines with their source line numbers.
• Expand a JSON tree, copy JSON or field paths, and read long text in a dedicated view.

The extension does not upload files or send search terms to the developer. No account or network connection is required. The current interface is in Simplified Chinese.
```

**Category:** Developer Tools (or the closest available category)

**Homepage URL:** `https://github.com/YaoKaiLun/jsonl-preview`

**Support URL:** `https://github.com/YaoKaiLun/jsonl-preview/issues`

**Store icon:** `icons/icon128.png`

**Small promo image:** `store/promo-440x280.png`

**Screenshot:** A real, sanitized screenshot of the installed extension, 1280×800 or 640×400 pixels. Do not use a screenshot containing private log data.

## Privacy practices

**Single purpose description**

```text
Preview and search JSONL and zstd-compressed JSONL content that the user explicitly provides, entirely within the browser.
```

**Permissions justification:** The manifest declares no extension permissions or host permissions. If the dashboard has no permission fields, there is nothing to justify.

**Data handling disclosure**

```text
The extension temporarily processes user-provided files and pasted text locally to parse, display, and search JSONL records. This content may include personal information depending on what the user provides. The extension does not transmit it to the developer or third parties, store it across sessions, or use it for analytics or advertising. Copy actions write only user-selected text to the device clipboard.
```

For data-type checkboxes, disclose any category that the dashboard considers applicable to user-provided JSONL content; do not claim that the extension does not handle user data merely because it operates locally. Complete the dashboard's Limited Use certifications only after checking they match the extension's actual behavior.

**Privacy policy URL:** `https://github.com/YaoKaiLun/jsonl-preview/blob/main/PRIVACY_EN.md`

## Test instructions (if requested)

```text
Click the extension toolbar icon to open the preview page. Click “试用示例” (Try sample) to load built-in JSONL data, including one intentionally invalid line. The “逐行预览” tab shows records, “公共字段表” compares common fields, and “异常行” shows malformed lines. Click a record to inspect its JSON tree. No account or test credentials are needed.
```

Do not submit for review until the listing, privacy answers, and real screenshot are complete. Chrome's current [listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/), [privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) explain the form and disclosure requirements.
