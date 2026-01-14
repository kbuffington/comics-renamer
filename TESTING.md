# Testing Guide for Comic Book Renamer

This project includes comprehensive unit tests for all core functions.

## Test Structure

### Unit Tests (`comics-renamer-lib.test.js`)
Tests individual functions in isolation using the exported library functions from `comics-renamer-lib.js`.

**Coverage:**
- ✅ Issue number detection (simple, decimal, with letters, negative)
- ✅ Period-separated filename handling
- ✅ Year detection with realistic range validation
- ✅ Year override functionality
- ✅ Scan type detection (Digital, Digital-HD, c2c)
- ✅ Cover notation (numeric and text-based)
- ✅ Extra flags (single-letter and "fixed")
- ✅ Release group preservation
- ✅ Annual detection
- ✅ Issue number padding
- ✅ Complex integration scenarios

**Total: 48 unit tests across 11 test suites**

### Integration Tests (`comics-renamer.test.js`)
End-to-end tests that create actual test files and run the full script.

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Verbose Output
```bash
npm run test:verbose
```

### Watch Mode (auto-rerun on file changes)
```bash
npm run test:watch
```

## Test Results

Latest unit test run:
```
✓ 48 tests passed
✓ 0 tests failed
✓ Duration: ~71ms
```

## Writing New Tests

### Adding a Unit Test

1. Open `comics-renamer-lib.test.js`
2. Add your test to the appropriate `describe` block:

```javascript
it("should handle your new case", () => {
  const result = extractIssueNumber("Your Test Input");
  assert.strictEqual(result, "expected output");
});
```

### Test Coverage

Current test coverage includes:

#### `isIssueNumber(token)`
- Simple integers: `"1"`, `"100"`, `"001"`
- Decimals: `"500.1"`, `"1.5"`
- With letters: `"501AU"`, `"100A"`
- Negative: `"-1"`
- Years (rejected): `"2020"`, `"1999"`

#### `extractIssueNumber(filename)`
- Space-separated: `"Batman 001 (2020)"`
- Period-separated: `"Dark.Wolverine.076.(2009)"`
- Decimal issues: `"Spider-Man 500.1"`
- "of" pattern: `"Batman 001 of 004"`

#### `extractParenContent(filename, capitalize)`
- Years: `1938` to `currentYear + 1`
- Unrealistic years filtered: `(1920)` image sizes
- First year priority: `(2020) (2021)` → uses `2020`
- Scan types: Digital, Digital-HD, Digital-SD, c2c
- c2c anywhere: `"Batman c2c (2020)"` or `"(c2c)"`
- Covers: `"3 covers"`, `"two covers"`, `"both covers"`
- Flags: `(F)`, `(fixed)`
- Release groups: preserved as-is

#### `padIssueNumber(issueNum, numDigits)`
- Simple padding: `padIssueNumber("1", 3)` → `"001"`
- Preserves decimals: `padIssueNumber("500.1", 3)` → `"500.1"`
- Preserves letters: `padIssueNumber("1A", 3)` → `"001A"`
- No negative padding: `padIssueNumber("-1", 3)` → `"-1"`

#### `detectAnnual(filename)`
- Case insensitive: `"Batman Annual"`, `"batman annual"`

## Manual Testing

### Create Test Files

```bash
# Create a test directory
mkdir test-comics
cd test-comics

# Create test files
echo "" > "Batman 001 (2020) (Digital).cbr"
echo "" > "Dark.Wolverine.076.(2009).(Digital).(Empire).cbr"
echo "" > "Amazing Spider-Man 500.1 (2023) (Digital).cbr"
```

### Run Script in Dry-Run Mode

```bash
comics-renamer "." "Test Series" 3 --dry-run
```

### Test Specific Features

```bash
# Test year override
comics-renamer "." "Test" 3 --year=2023 --dry-run

# Test renumbering
comics-renamer "." "Test" 3 --start-number=1 --dry-run

# Test with 4-digit padding
comics-renamer "." "Test" 4 --dry-run
```

## Bug Regression Tests

Key bugs that are covered by tests:

1. **Year vs Image Size Bug** (Fixed)
   - Test: `"Astonishing X-Men 066 (2013) (Digital) (1920)"`
   - Expected: Uses `(2013)`, ignores `(1920)`
   - Test file: `comics-renamer-lib.test.js:170`

2. **Period-Separated Filenames** (Fixed)
   - Test: `"Dark.Wolverine.076.(2009)"`
   - Expected: Detects `076` as issue number
   - Test file: `comics-renamer-lib.test.js:62`

3. **Decimal Issue with Period Separator** (Fixed)
   - Test: `"X-Men.500.1.(2022)"`
   - Expected: Preserves `500.1` as issue
   - Test file: `comics-renamer-lib.test.js:63`

4. **Issue Not Combined with Year** (Fixed)
   - Test: `"Dark.Wolverine.076.(2009)"`
   - Expected: Returns `"076"`, not `"076.2009"`
   - Test file: `comics-renamer-lib.test.js:66`

## Continuous Testing

Consider setting up a pre-commit hook to run tests automatically:

```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run test:unit
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Test File Cleanup

Unit tests automatically clean up test files after execution. The `test-fixtures` directory is created and removed automatically.

## Troubleshooting

### Tests Fail with "Cannot find module"
Make sure you're in the correct directory:
```bash
cd /path/to/comics
npm run test:unit
```

### Node Version Issues
Tests require Node.js >= 18.0.0 for the built-in test runner:
```bash
node --version  # Should be v18.0.0 or higher
```

If you have an older version, install a newer Node.js or use a different test framework.
