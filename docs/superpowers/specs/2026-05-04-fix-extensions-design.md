# Design: `--fix-extensions` Flag

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Add a `--fix-extensions` flag that detects the true file format of `.cbr` and `.cbz` files via magic bytes and corrects mismatched extensions. Operates as part of the existing combined rename flow.

## Problem

Comic files sometimes have incorrect extensions — a `.cbr` file that is actually a ZIP archive, or a `.cbz` that is actually a RAR archive. The current tool preserves whatever extension the source file has, propagating the mismatch through renames.

## Scope

- Only `.cbr` and `.cbz` files are checked. `.cb7` files are excluded.
- Operates combined with the existing rename flow — no new top-level mode required.

---

## Design

### 1. Detection: `detectFileFormat(filePath)`

A new exported function in `comics-renamer-lib.js`. Reads the first 8 bytes of the file synchronously and returns:

| Return value | Condition |
|---|---|
| `'zip'` | First 2 bytes = `50 4B` |
| `'rar'` | First 7 bytes = `52 61 72 21 1A 07 00` (RAR v4) or first 8 bytes = `52 61 72 21 1A 07 01 00` (RAR v5) |
| `null` | Unrecognized format |

Extension mapping:
- `'zip'` → correct extension is `.cbz`
- `'rar'` → correct extension is `.cbr`

### 2. Integration with the Rename Loop

When `--fix-extensions` is passed, the main file loop gains one extra step per `.cbr`/`.cbz` file:

1. Call `detectFileFormat(filePath)` to get the true format.
2. Determine the correct extension from the format.
3. If format is `null`: print a warning and skip the file.
4. Use the correct extension when constructing `newName` (replacing whatever extension the source file has).

Three outcome cases:

| Case | Source | Result |
|---|---|---|
| Name change + extension fix | `old.cbr` (ZIP) | `New Name.cbz` — single rename |
| Extension fix only | `Batman 001.cbr` (ZIP) | `Batman 001.cbz` — single rename |
| Conflict | target `Batman 001.cbz` already exists | Skip, print warning |

Conflict check: before adding any entry to `changes`, verify the target path does not already exist in the folder.

The existing `--dry-run` flag requires no extra handling — it already skips `performRenames`.

### 3. Output / Color Coding

`highlightDifferences` is extended to accept an optional `extensionStart` index. Characters at or after that index in the changed portion use **bright yellow** (`\x1b[93m`) instead of the existing green (`\x1b[32m`).

- Name changes: green (existing behavior, unchanged)
- Extension corrections: bright yellow
- Combined (name + extension fix): name portion green, extension portion yellow

Extension-only fixes include an `[ext fix]` label in the output to distinguish them from full renames:

```
[1] Ext fix:
  Old: Batman 001.cbr
  New: Batman 001.cbz   ← extension in bright yellow
```

### 4. New Flag Parsing

```
--fix-extensions    Detect and correct mismatched .cbr/.cbz extensions via magic bytes
```

Parsed as a boolean alongside the existing flags. Added to the usage help block.

---

## Testing

New test suite in `comics-renamer-lib.test.js`: **`detectFileFormat`**

Tests create small temp files with specific magic byte sequences, call `detectFileFormat`, assert the return value, then delete the temp file. No mocking of `fs`.

| Test | Input | Expected |
|---|---|---|
| ZIP magic bytes | `50 4B 03 04 ...` | `'zip'` |
| RAR v4 magic bytes | `52 61 72 21 1A 07 00 ...` | `'rar'` |
| RAR v5 magic bytes | `52 61 72 21 1A 07 01 00` | `'rar'` |
| Unrecognized bytes | `FF FE ...` | `null` |

---

## Files Changed

| File | Change |
|---|---|
| `comics-renamer-lib.js` | Add and export `detectFileFormat` |
| `comics-renamer.js` | Parse `--fix-extensions`, integrate into rename loop, update `highlightDifferences`, update help text |
| `comics-renamer-lib.test.js` | Add `detectFileFormat` test suite (4 tests) |
