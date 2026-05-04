# Fix Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--fix-extensions` flag that detects the true file format of `.cbr`/`.cbz` files via magic bytes and corrects mismatched extensions as part of the existing rename flow.

**Architecture:** A new `detectFileFormat(filePath)` function reads the first 8 bytes of a file and returns `'zip'`, `'rar'`, or `null`. When `--fix-extensions` is passed, the main loop calls this function per file and replaces the extension in `newName` if needed. Extension-only fixes (where the name itself doesn't change) produce a `[ext fix]` output entry. Conflicts (target already exists) are skipped with a warning.

**Tech Stack:** Node.js (built-in `fs`), Node.js built-in test runner (`node:test`)

---

## File Map

| File | Change |
|---|---|
| `comics-renamer-lib.js` | Add + export `detectFileFormat(filePath)` |
| `comics-renamer-lib.test.js` | Add `detectFileFormat` test suite (4 tests), update imports |
| `comics-renamer.js` | Parse `--fix-extensions`, update `highlightDifferences`, integrate into rename loop, update help text |

---

## Task 1: `detectFileFormat` — tests then implementation

**Files:**
- Modify: `comics-renamer-lib.test.js`
- Modify: `comics-renamer-lib.js`

### Step 1.1 — Add the import for `os` and `detectFileFormat` to the test file

In `comics-renamer-lib.test.js`, update the top of the file:

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  isIssueNumber,
  extractIssueNumber,
  detectAnnual,
  padIssueNumber,
  extractParenContent,
  detectFileFormat,
} = require("./comics-renamer-lib");
```

- [ ] Make this edit to `comics-renamer-lib.test.js`

### Step 1.2 — Write the 4 failing tests

Append this new `describe` block at the end of `comics-renamer-lib.test.js`:

```javascript
describe("detectFileFormat", () => {
  function writeTempFile(bytes) {
    const tmpPath = path.join(os.tmpdir(), `comics-test-${Date.now()}.bin`);
    fs.writeFileSync(tmpPath, Buffer.from(bytes));
    return tmpPath;
  }

  it("should detect ZIP magic bytes as 'zip'", () => {
    const tmp = writeTempFile([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    try {
      assert.strictEqual(detectFileFormat(tmp), "zip");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("should detect RAR v4 magic bytes as 'rar'", () => {
    const tmp = writeTempFile([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0x00]);
    try {
      assert.strictEqual(detectFileFormat(tmp), "rar");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("should detect RAR v5 magic bytes as 'rar'", () => {
    const tmp = writeTempFile([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]);
    try {
      assert.strictEqual(detectFileFormat(tmp), "rar");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("should return null for unrecognized format", () => {
    const tmp = writeTempFile([0xff, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    try {
      assert.strictEqual(detectFileFormat(tmp), null);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
```

- [ ] Append this block to `comics-renamer-lib.test.js`

### Step 1.3 — Run tests to confirm they fail

```
node --test comics-renamer-lib.test.js
```

Expected: the 4 new `detectFileFormat` tests fail with `TypeError: detectFileFormat is not a function` (or similar). All existing 48 tests still pass.

- [ ] Run the command and confirm this

### Step 1.4 — Implement `detectFileFormat` in `comics-renamer-lib.js`

Add this function before the `module.exports` line:

```javascript
function detectFileFormat(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(8);
  try {
    fs.readSync(fd, buf, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }

  // ZIP: PK signature
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    return "zip";
  }

  // RAR: "Rar!" signature (v4 and v5)
  if (buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21) {
    return "rar";
  }

  return null;
}
```

Add `const fs = require("fs");` at the top of `comics-renamer-lib.js` if it isn't already there.

Add `detectFileFormat` to the `module.exports`:

```javascript
module.exports = {
  isIssueNumber,
  extractIssueNumber,
  detectAnnual,
  padIssueNumber,
  extractParenContent,
  detectFileFormat,
};
```

- [ ] Make these edits to `comics-renamer-lib.js`

### Step 1.5 — Run tests to confirm all pass

```
node --test comics-renamer-lib.test.js
```

Expected: all 52 tests pass (48 existing + 4 new).

- [ ] Run the command and confirm this

### Step 1.6 — Commit

```
git add comics-renamer-lib.js comics-renamer-lib.test.js
git commit -m "feat: add detectFileFormat for magic byte extension detection"
```

- [ ] Commit

---

## Task 2: Update `highlightDifferences` for yellow extension coloring

**Files:**
- Modify: `comics-renamer.js` (the `highlightDifferences` function, lines ~340–357)

### Step 2.1 — Update the function

Replace the existing `highlightDifferences` function with this version that accepts an optional `extensionStart` parameter:

```javascript
function highlightDifferences(oldStr, newStr, extensionStart = -1) {
  const GREEN = "\x1b[32m";
  const YELLOW = "\x1b[93m";
  const RESET = "\x1b[0m";

  let result = "";

  for (let i = 0; i < newStr.length; i++) {
    if (i >= oldStr.length || oldStr[i] !== newStr[i]) {
      const color = extensionStart >= 0 && i >= extensionStart ? YELLOW : GREEN;
      result += color + newStr[i] + RESET;
    } else {
      result += newStr[i];
    }
  }

  return result;
}
```

- [ ] Replace `highlightDifferences` in `comics-renamer.js`

### Step 2.2 — Commit

```
git add comics-renamer.js
git commit -m "feat: add yellow extension color support to highlightDifferences"
```

- [ ] Commit

---

## Task 3: Parse `--fix-extensions` flag and update help text

**Files:**
- Modify: `comics-renamer.js`

### Step 3.1 — Add `require` for `detectFileFormat`

Near the top of `comics-renamer.js`, note that all core functions are currently defined inline (not imported from the lib). `detectFileFormat` needs to be available. Add a require after the existing `require` calls:

```javascript
const { detectFileFormat } = require("./comics-renamer-lib");
```

Add this line near the top, after `const path = require("path");`.

- [ ] Add the require to `comics-renamer.js`

### Step 3.2 — Add the flag variable and parse it

After the `let capitalize = true;` line (around line 52), add:

```javascript
let fixExtensions = false;
```

After the existing flag-parsing block (around line 88, after the `--dry-run` check), add:

```javascript
// Check for --fix-extensions flag
if (args.includes("--fix-extensions")) {
  fixExtensions = true;
}
```

- [ ] Add both the variable and parsing to `comics-renamer.js`

### Step 3.3 — Update the help text

In the help text block (lines 9–41), add `--fix-extensions` to the Arguments list and Examples:

In the Arguments section, add after `--y`:
```
  --fix-extensions  - Check actual file format via magic bytes and fix wrong .cbr/.cbz extensions
```

In the Examples section, add:
```
  comics-renamer "." "Amazing Spider-Man" 3 --fix-extensions --dry-run
```

- [ ] Update the help text

### Step 3.4 — Add `--fix-extensions` to the startup summary printout

After the `yearOverride` log block (around line 109), add:

```javascript
if (fixExtensions) {
  console.log(`Fix Extensions: enabled`);
}
```

- [ ] Add to startup summary

### Step 3.5 — Commit

```
git add comics-renamer.js
git commit -m "feat: add --fix-extensions flag parsing and help text"
```

- [ ] Commit

---

## Task 4: Integrate extension fix into the rename loop and output

**Files:**
- Modify: `comics-renamer.js` (the main file loop and the display loop)

### Step 4.1 — Add extension fix logic inside the main file loop

The main loop (starting around line 381) ends with:

```javascript
  if (!newName || newName === file) {
    continue; // Skip if no change needed
  }

  changes.push({ oldName: file, newName });
```

Replace that block with:

```javascript
  // Extension fix logic
  let extFixed = false;
  if (fixExtensions) {
    const currentExt = path.extname(file).toLowerCase();
    if (currentExt === ".cbr" || currentExt === ".cbz") {
      const detectedFormat = detectFileFormat(path.join(resolvedFolder, file));
      if (detectedFormat === null) {
        console.log(`Warning: Could not detect format for ${file} — extension not changed`);
      } else {
        const correctExt = detectedFormat === "zip" ? ".cbz" : ".cbr";
        const base = newName || file;
        const baseWithoutExt = base.slice(0, base.length - path.extname(base).length);
        const candidate = baseWithoutExt + correctExt;
        if (correctExt !== path.extname(base).toLowerCase()) {
          if (candidate !== file && fs.existsSync(path.join(resolvedFolder, candidate))) {
            console.log(`Warning: Cannot fix extension for ${file} — ${candidate} already exists`);
          } else {
            newName = candidate;
            extFixed = true;
          }
        }
      }
    }
  }

  if (!newName || newName === file) {
    continue; // Skip if no change needed
  }

  changes.push({ oldName: file, newName, extFixed });
```

- [ ] Make this edit in `comics-renamer.js`

### Step 4.2 — Update the display loop to show ext-fix output

The display loop (around line 432) currently reads:

```javascript
for (let i = 0; i < changes.length; i++) {
  const { oldName, newName } = changes[i];
  console.log(`[${i + 1}] Rename:`);
  console.log(`  Old: ${oldName}`);
  console.log(`  New: ${highlightDifferences(oldName, newName)}`);
}
```

Replace it with:

```javascript
const YELLOW = "\x1b[93m";
const RESET = "\x1b[0m";

for (let i = 0; i < changes.length; i++) {
  const { oldName, newName, extFixed } = changes[i];
  const oldExt = path.extname(oldName);
  const newExt = path.extname(newName);
  const nameChanged = oldName.slice(0, oldName.length - oldExt.length) !==
                      newName.slice(0, newName.length - newExt.length);

  if (extFixed && !nameChanged) {
    // Extension-only fix: print directly with yellow extension
    const basePart = newName.slice(0, newName.length - newExt.length);
    console.log(`[${i + 1}] Ext fix:`);
    console.log(`  Old: ${oldName}`);
    console.log(`  New: ${basePart}${YELLOW}${newExt}${RESET}`);
  } else if (extFixed && nameChanged) {
    // Combined: green name changes, yellow extension
    const extensionStart = newName.length - newExt.length;
    console.log(`[${i + 1}] Rename + ext fix:`);
    console.log(`  Old: ${oldName}`);
    console.log(`  New: ${highlightDifferences(oldName, newName, extensionStart)}`);
  } else {
    // Normal rename only
    console.log(`[${i + 1}] Rename:`);
    console.log(`  Old: ${oldName}`);
    console.log(`  New: ${highlightDifferences(oldName, newName)}`);
  }
}
```

- [ ] Replace the display loop in `comics-renamer.js`

### Step 4.3 — Run the full test suite to confirm no regressions

```
node --test comics-renamer-lib.test.js
```

Expected: all 52 tests pass.

- [ ] Run and confirm

### Step 4.4 — Manual smoke test (dry run)

Create two small test files in a temp folder — one ZIP with `.cbr` extension, one RAR with `.cbz` extension — and run the tool in `--dry-run --fix-extensions` mode:

```powershell
# Create temp folder
$tmp = "$env:TEMP\comics-test"
New-Item -ItemType Directory -Force -Path $tmp

# Write a ZIP file with .cbr extension (PK magic bytes)
[System.IO.File]::WriteAllBytes("$tmp\Test 001 (2020) (Digital) (Group).cbr",
  [byte[]](0x50,0x4b,0x03,0x04) + [byte[]](0..99))

# Write a RAR file with .cbz extension (Rar! magic bytes)
[System.IO.File]::WriteAllBytes("$tmp\Test 002 (2020) (Digital) (Group).cbz",
  [byte[]](0x52,0x61,0x72,0x21,0x1a,0x07,0x00) + [byte[]](0..99))

# Run dry run
node comics-renamer.js $tmp "Test" 3 --dry-run --fix-extensions
```

Expected output:
- File 1: `[1] Rename + ext fix:` with `.cbr` → `.cbz` in yellow
- File 2: `[2] Rename + ext fix:` with `.cbz` → `.cbr` in yellow (since name also changes via series normalization)

- [ ] Run smoke test and verify output looks correct

### Step 4.5 — Commit

```
git add comics-renamer.js
git commit -m "feat: integrate --fix-extensions into rename loop with conflict detection and colored output"
```

- [ ] Commit
