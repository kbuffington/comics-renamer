# CLAUDE.md - AI Development Context

This document provides context for AI assistants (like Claude) working on this project.

## Project Overview

**Comic Book Renamer** is a Node.js CLI tool that standardizes comic book file naming conventions. It was developed iteratively through AI-assisted debugging and feature additions.

**Primary Use Case:** Batch rename comic files (`.cbr`, `.cbz`, `.cb7`) to a consistent naming format while preserving metadata like years, scan types, and release groups.

## Development History

### Session 1: Initial Bug Fixes

**Original Bug Report:**

```
User: "The script is seeing (1920) and thinking that's a year instead of a size"
Input:  Astonishing X-Men 066 (2013) (Digital) (1920) (G85-Empire).cbr
Output: Astonishing X-Men 066 (1920) (Digital) (G85-Empire).cbr  ❌
```

**Root Cause Analysis (Systematic Debugging Used):**

1. The `extractParenContent` function checked if any 4-digit number started with "19" or "20"
2. `(1920)` matched this pattern (it IS technically a valid year from 1920)
3. Multiple year-like values were processed, and the LAST one overwrote earlier ones
4. `(1920)` overwrote `(2013)`

**Solution Implemented:**

- Added realistic year range validation: 1938 (Golden Age comics) to `currentYear + 1`
- Changed logic to accept FIRST valid year only (ignore subsequent matches)
- Result: `(1920)` now filtered out as unrealistic, `(2013)` preserved

### Session 2: Period-Separated Filenames

**Bug Report:**

```
Input:  Dark.Wolverine.076.(2009).(Digital).(AnPymGold.Empire).cbr
Output: No files renamed (file not detected) ❌
```

**Root Cause:**

- Tokenizer only split by spaces and parentheses: `/[\s()]+/`
- `"Dark.Wolverine.076"` became a single token
- `isIssueNumber("Dark.Wolverine.076")` returned false (starts with 'D')

**Solution:**

- Updated split pattern to include periods: `/[\s().]+/`
- Added smart decimal handling to recombine `"500"` + `"1"` → `"500.1"`
- Added year-detection guard to prevent `"076"` + `"2009"` → `"076.2009"`

**Critical Implementation Detail:**

```javascript
// Check for decimal issues FIRST before accepting single numbers
// This prevents "500" from being accepted when "500.1" is intended
if (/^[0-9]+$/.test(token) && i + 1 < tokens.length) {
  const nextToken = tokens[i + 1];
  const isYear =
    nextToken.length === 4 &&
    (nextToken.startsWith("19") || nextToken.startsWith("20"));
  if (!isYear && /^[0-9]+$/.test(nextToken)) {
    return token + "." + nextToken; // Decimal issue
  }
}
```

### Session 3: Feature Additions

**Features Added:**

1. **Year Override (`--year=YYYY`)**

   - Replaces any detected year OR adds year if missing
   - Applied in both `processFile` and renumbering logic
   - Variable: `yearOverride`

2. **c2c Detection Anywhere**

   - Original: Only detected `(c2c)` in parentheses
   - Enhanced: Detects "c2c" anywhere in filename (case-insensitive)
   - Always outputs as `(c2c)` in normalized position

3. **Extended Cover Notation**

   - Original: Only numeric like `"3 covers"`
   - Enhanced: Text-based like `"two covers"`, `"both covers"`
   - Pattern: `/^.+\s+covers?$/i`

4. **(fixed) Flag Support**
   - Treated same as single-letter flags like `(F)`
   - Case-insensitive detection

### Session 4: Testing Infrastructure

**Created comprehensive test suite:**

- 48 unit tests across 11 test suites
- Modular library version (`comics-renamer-lib.js`)
- Test framework using Node.js built-in test runner (requires Node >= 18)

### Running Git Commands

When running git commands there is no need to generate commands like

```
cd "D:/Source/comics-renamer" && git diff --staged --stat && echo "---" && git rev-parse HEAD
```

We will always be inside "D:/Source/comics-renamer" so the `cd D:/Source/comics-renamer` is extraneous. Do not ever include this.

## Architecture

### File Structure

```
comics-renamer.js          # Main CLI application (original)
comics-renamer-lib.js      # Exported functions for testing
comics-renamer-lib.test.js # Unit tests (48 tests)
comics-renamer.test.js     # Integration tests
package.json              # NPM config and test scripts
README.md                 # User documentation
TESTING.md                # Testing guide
CLAUDE.md                 # This file (AI context)
```

### Core Functions

#### `isIssueNumber(token)`

**Purpose:** Determine if a token is a valid issue number

**Accepts:**

- Simple integers: `"1"`, `"100"`, `"001"`
- Decimals: `"500.1"`, `"1.5"`
- With letters: `"501AU"`, `"100A"`
- Negative: `"-1"`

**Rejects:**

- 4-digit years: `"2020"`, `"1999"`, `"1920"`
- Non-numeric: `"Digital"`, `"Empire"`

**Critical Detail:** This function prevents years from being detected as issue numbers, which is essential for proper filename parsing.

#### `extractIssueNumber(filename)`

**Purpose:** Find and return the issue number from a filename

**Tokenization Strategy:**

```javascript
// Split by spaces, periods, and parentheses
const tokens = working.split(/[\s().]+/);
```

**Processing Order (CRITICAL):**

1. Check for decimal combinations FIRST (e.g., `"500" + "1"` → `"500.1"`)
2. Guard against combining with years
3. Then check if single token is valid issue number

**Why This Order Matters:** If we check single tokens first, `"500"` would be accepted immediately, preventing `"500.1"` from being detected.

#### `extractParenContent(filename, capitalize)`

**Purpose:** Extract all metadata from parentheses in filename

**Processing Order:**

1. **c2c check** - Done FIRST, searches entire filename (not just parentheses)
2. **Year validation** - 4 digits, starts with 19/20, within realistic range (1938-currentYear+1), first match only
3. **Cover notation** - Pattern: `/^.+\s+covers?$/i`
4. **Scan types** - Digital, Digital-HD, Digital-SD, c2c (case-insensitive)
5. **Extra flags** - Single letters or "fixed"
6. **Release groups** - Everything else (last one wins)

**Critical Implementation:**

```javascript
// Year validation with realistic range
const currentYear = new Date().getFullYear();
const minYear = 1938; // Golden Age comics
const maxYear = currentYear + 1; // Upcoming releases

if (yearNum >= minYear && yearNum <= maxYear && !result.year) {
  result.year = content; // First valid year only
}
```

#### `padIssueNumber(issueNum, numDigits)`

**Purpose:** Pad issue numbers with leading zeros

**Special Cases:**

- Negative numbers: NOT padded (`"-1"` stays `"-1"`)
- Decimals: Base number padded, decimal preserved (`"1.5"` → `"001.5"`)
- Letters: Base number padded, letters preserved (`"1A"` → `"001A"`)

## Key Design Decisions

### 1. Realistic Year Range (1938 to currentYear + 1)

**Rationale:**

- 1938: First appearance of Superman (beginning of Golden Age)
- currentYear + 1: Allows for upcoming releases solicited in advance
- Filters out image resolution indicators like `(1920)`, `(1080)`, `(2160)`

**Trade-offs:**

- Won't handle hypothetical pre-1938 comics
- Requires year validation to be dynamic (uses `new Date().getFullYear()`)

### 2. Period Tokenization with Decimal Reconstruction

**Problem:** Periods serve dual purposes:

- Filename separators: `"Dark.Wolverine.076"`
- Decimal indicators: `"500.1"`

**Solution:** Split by periods, then intelligently recombine when pattern suggests decimal

**Why This Works:**

- Most decimal issues are two parts: `"500" + "1"`
- Years are 4 digits starting with 19/20, easily identified and skipped
- Checked BEFORE accepting single numeric tokens

### 3. First-Year-Only Policy

**Rationale:**

- Multiple years in filename are ambiguous
- First occurrence is most likely to be publication year
- Later occurrences might be edition dates, reprint info, or artifacts

**Alternative Considered:** Use last year (rejected - last year more likely to be artifact)

### 4. c2c Global Detection

**Rationale:**

- c2c (cover-to-cover) often appears outside parentheses in source filenames
- Users want it normalized to `(c2c)` position regardless of input location
- Case-insensitive for flexibility

**Implementation:**

```javascript
// Check BEFORE processing parentheses
if (/c2c/i.test(filename)) {
  result.scanType = "c2c";
}
```

### 5. Modular Library for Testing

**Decision:** Create `comics-renamer-lib.js` that exports functions

**Rationale:**

- Enables true unit testing without subprocess execution
- Faster test execution (~74ms vs potential seconds)
- Better error messages and debugging
- Functions testable in isolation

**Trade-off:** Need to maintain both files, but worth it for test quality

## Common Pitfalls & Solutions

### Pitfall 1: Accepting Single Tokens Before Checking Decimals

**Problem:**

```javascript
// ❌ WRONG ORDER
if (isIssueNumber(token)) return token; // Returns "500"
// Never reaches decimal check
```

**Solution:**

```javascript
// ✅ CORRECT ORDER
// Check decimals FIRST
if (isNextTokenDecimalPart) return combined; // Returns "500.1"
// Then check single token
if (isIssueNumber(token)) return token;
```

### Pitfall 2: Combining Issue Numbers with Years

**Problem:** After splitting by periods, `"076.(2009)"` becomes `["076", "2009"]`

- Without guard: Returns `"076.2009"` ❌
- With guard: Returns `"076"` ✅

**Solution:**

```javascript
const isYear =
  nextToken.length === 4 &&
  (nextToken.startsWith("19") || nextToken.startsWith("20"));
if (!isYear) {
  // Safe to combine
}
```

### Pitfall 3: Overwriting Year with Later Matches

**Problem:**

```javascript
// ❌ Every match overwrites
if (isValidYear(content)) {
  result.year = content; // (2013) gets overwritten by (1920)
}
```

**Solution:**

```javascript
// ✅ Only set if not already set
if (isValidYear(content) && !result.year) {
  result.year = content; // First match wins
}
```

### Pitfall 4: Treating Release Groups as Other Metadata

**Problem:** Release groups can contain periods, numbers, etc. that match other patterns

**Solution:** Process release groups LAST, as "everything else" after all other patterns checked

## Testing Strategy

### Test Pyramid

```
Integration Tests (comics-renamer.test.js)
  - Create actual files
  - Execute full script
  - Verify end-to-end behavior

Unit Tests (comics-renamer-lib.test.js) ⭐ Primary
  - Test individual functions
  - Fast execution (~74ms)
  - 48 tests, 11 suites
  - 100% pass rate
```

**Focus on Unit Tests:**

- Faster feedback loop
- Easier debugging
- Better coverage of edge cases
- Can test internal logic not visible in end-to-end tests

### Critical Test Cases

**Always test these when modifying code:**

1. **Year vs Image Size**

   ```javascript
   extractParenContent("Batman 066 (2013) (1920)");
   // Must return: { year: "2013", ... }
   ```

2. **Period-Separated with Decimal**

   ```javascript
   extractIssueNumber("X-Men.500.1.(2022)");
   // Must return: "500.1"
   ```

3. **Issue Not Combined with Year**

   ```javascript
   extractIssueNumber("Dark.Wolverine.076.(2009)");
   // Must return: "076", NOT "076.2009"
   ```

4. **c2c Anywhere Detection**
   ```javascript
   extractParenContent("Batman 001 c2c (2020)");
   extractParenContent("Batman 001 (c2c) (2020)");
   extractParenContent("Batman 001 C2C (2020)");
   // All must return: { scanType: "c2c", ... }
   ```

## Future Development Guidance

### Adding New Features

**Recommended Process:**

1. **Read existing code** in `comics-renamer.js` to understand current behavior
2. **Check tests** in `comics-renamer-lib.test.js` for relevant test cases
3. **Add function** to `comics-renamer-lib.js` (for testability)
4. **Write tests FIRST** in `comics-renamer-lib.test.js`
5. **Implement feature** and verify tests pass
6. **Integrate** into `comics-renamer.js`
7. **Update documentation** (README.md, TESTING.md)

### Debugging Approach

**Use Systematic Debugging (see superpowers:systematic-debugging skill):**

**Phase 1: Root Cause Investigation**

- Read error messages carefully
- Reproduce consistently
- Check recent changes
- Gather evidence (add diagnostic logging)
- Trace data flow

**Phase 2: Pattern Analysis**

- Find working examples
- Compare against references
- Identify differences

**Phase 3: Hypothesis and Testing**

- Form single hypothesis
- Test minimally (one change at a time)
- Verify before continuing

**Phase 4: Implementation**

- Create failing test case first
- Implement single fix
- Verify fix works
- If 3+ fixes failed: Question the architecture

**Never:**

- Make multiple changes at once
- Skip writing tests
- Assume without verifying
- Fix symptoms instead of root cause

### Potential Enhancements

**Ideas for future development:**

1. **Enhanced Metadata Detection**

   - Variant covers: `(Variant)`, `(1:25 Incentive)`
   - Edition info: `(Director's Cut)`, `(Remastered)`
   - Format info: `(TPB)`, `(HC)` for trades/hardcovers

2. **Series Detection**

   - Auto-detect series name from existing filenames
   - Suggest most common series name in directory

3. **Undo Functionality**

   - Save rename log
   - Implement `--undo` to reverse last operation

4. **Batch Processing**

   - Process multiple series in subdirectories
   - `--recursive` flag for folder hierarchies

5. **Config File Support**

   - `.comicrenamerrc` for default settings
   - Per-directory config files

6. **Enhanced Validation**
   - Check for duplicate issue numbers before rename
   - Warn about gaps in numbering
   - Validate series name against online databases (GCD, Marvel API)

### Maintenance Notes

**When Node.js Updates:**

- Test suite requires Node.js >= 18 for built-in test runner
- If supporting older Node, consider switching to Jest or Mocha

**When Adding Dependencies:**

- Keep dependencies minimal (currently zero runtime dependencies)
- Only add dependencies for dev/test if necessary

**When Modifying Core Logic:**

- Always run `npm test` before committing
- Add new test cases for new edge cases discovered
- Update TESTING.md with any new test patterns

## Working with Claude

### Providing Context

**When starting a new session, provide:**

1. **What you want to do**: Feature request or bug description
2. **Example input/output**: Concrete examples of current vs. desired behavior
3. **Relevant files**: Point to specific files if you know them
4. **Constraints**: Any requirements (e.g., "don't break existing tests")

**Good example:**

```
"The script should handle variant cover notation like (Variant A).
Currently: Batman 001 (2020) (Variant A) (Digital).cbr
The (Variant A) gets treated as a release group, but I want it
as a separate field that appears before the release group."
```

### Iterative Development

**Claude works best with:**

1. **One problem at a time**: Fix one bug or add one feature per request
2. **Test-driven**: Ask Claude to write tests first, then implement
3. **Verification**: Run tests after each change to confirm success
4. **Clarification**: If Claude's solution doesn't work, provide error output

### Code Review Requests

**When asking Claude to review code:**

```
"Review this implementation for potential issues:
[paste code]

Focus on:
- Edge cases I might have missed
- Performance concerns
- Test coverage gaps"
```

### Testing Assistance

**Claude can help:**

- Generate test cases for new features
- Debug failing tests
- Suggest edge cases you might have missed
- Write additional integration tests

**Example request:**

```
"Write unit tests for a new feature that detects (Variant)
covers and adds them to extractParenContent result"
```

## Project Statistics

**Current State (as of last session):**

- **Lines of Code:** ~440 (main script) + ~200 (library)
- **Test Coverage:** 48 unit tests, 11 test suites
- **Test Success Rate:** 100%
- **Test Execution Time:** ~74ms
- **Dependencies:** 0 runtime, 0 dev (uses built-in Node test runner)
- **Node Version Required:** >= 18.0.0
- **Supported File Types:** .cbr, .cbz, .cb7
- **Command-Line Flags:** 6 (--dry-run, --year, --start-number, --capitalize, --y)

## Session Context

**This project was developed through multiple AI-assisted sessions:**

1. **Bug fix:** Year vs image size detection
2. **Bug fix:** Period-separated filename handling
3. **Feature additions:** Year override, c2c detection, cover notation
4. **Testing infrastructure:** Created comprehensive test suite

**Total development time:** ~4 sessions over 1 day
**Token usage per session:** ~40,000-80,000 tokens
**Final test results:** 48/48 passing

---

**Last Updated:** 2026-01-14
**Claude Model Used:** Claude Sonnet 4.5
**Development Approach:** Test-Driven Development with Systematic Debugging
