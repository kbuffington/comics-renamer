# Comic Book Renamer

A Node.js tool to standardize comic book file naming conventions.

## Features

- ✅ Standardizes comic file naming across your collection
- ✅ Handles `.cbr`, `.cbz`, and `.cb7` files
- ✅ Detects and preserves:
  - Issue numbers (simple, decimal like 500.1, with letters like 501AU)
  - Years (with realistic range validation 1938-present)
  - Scan types (Digital, Digital-HD, Digital-SD, c2c)
  - Cover counts (numeric and text-based like "two covers")
  - Extra flags like (F) or (fixed)
  - Release groups
- ✅ Handles both space-separated and period-separated filenames
- ✅ Supports annuals with automatic 2-digit padding
- ✅ Dry-run mode for previewing changes
- ✅ Year override capability
- ✅ Sequential renumbering
- ✅ Comprehensive test suite (48 unit tests)

## Installation

Requires Node.js >= 18.0.0

```bash
# No installation needed - just run the script directly
node comics-renamer.js [options]
```

## Usage

### Basic Usage

```bash
node comics-renamer.js "path/to/folder" "Series Name" [numDigits] [options]
```

### Examples

```bash
# Basic rename with 3-digit padding
node comics-renamer.js "." "Amazing Spider-Man" 3 --dry-run

# Override year for all files
node comics-renamer.js "." "Batman" 3 --year=2020 --dry-run

# Renumber files sequentially starting from 001
node comics-renamer.js "." "X-Men" 3 --start-number=1 --dry-run

# Use lowercase for scan types
node comics-renamer.js "." "Superman" 3 --capitalize=false --dry-run

# Auto-confirm without prompt
node comics-renamer.js "." "Wonder Woman" 3 --y
```

### Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `Folder Path` | Path to comic files (required) | `"."` or `"C:\\Comics"` |
| `Series Name` | Standardized series name (required) | `"Amazing Spider-Man"` |
| `numDigits` | Issue number padding (default: 3) | `3` or `4` |
| `--dry-run` | Preview without renaming | `--dry-run` |
| `--start-number=N` | Renumber from N | `--start-number=1` |
| `--year=YYYY` | Override year | `--year=2023` |
| `--capitalize` | Capitalize scan types (default: true) | `--capitalize=false` |
| `--y` | Auto-confirm | `--y` |

## Filename Format

### Input Formats Supported

Space-separated:
```
Amazing Spider-Man 066 (2013) (Digital) (Empire).cbr
```

Period-separated:
```
Dark.Wolverine.076.(2009).(Digital).(Empire).cbr
```

### Output Format

```
SeriesName IssueNumber (Year) (Covers) (ScanType) (Flag) (ReleaseGroup).ext
```

Example:
```
Amazing Spider-Man 066 (2013) (3 covers) (Digital) (F) (Empire).cbr
```

## Testing

This project includes a comprehensive test suite with 48 unit tests.

### Run Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:verbose

# Watch mode (auto-rerun on changes)
npm run test:watch
```

### Test Coverage

✅ 48 tests across 11 test suites
✅ 100% pass rate
✅ Coverage includes:
- Issue number detection
- Period-separated filenames
- Year detection with validation
- Scan type detection
- Cover notation
- Release groups
- Complex integration scenarios

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Files

| File | Purpose |
|------|---------|
| `comics-renamer.js` | Main CLI script |
| `comics-renamer-lib.js` | Exported functions for testing |
| `comics-renamer-lib.test.js` | Unit tests (48 tests) |
| `comics-renamer.test.js` | Integration tests |
| `package.json` | NPM configuration |
| `TESTING.md` | Testing documentation |
| `README.md` | This file |

## Known Issues & Features

### Handled Edge Cases

1. **Year vs Image Size** - Ignores unrealistic years like `(1920)` which are actually image resolutions
2. **Period Separators** - Correctly handles `Dark.Wolverine.076` style filenames
3. **Decimal Issues** - Preserves `500.1` style issue numbers
4. **c2c Detection** - Finds "c2c" anywhere in filename, not just in parentheses
5. **First Year Priority** - Uses first valid year found, ignores duplicates

### Special Behaviors

- **Annuals**: Automatically use 2-digit padding regardless of `numDigits` setting
- **Negative Issues**: Issue `-1` is not padded
- **Decimal Issues**: Base number is padded but decimal part preserved (e.g., `1.5` → `001.5`)
- **Letters**: Letters after issue number preserved (e.g., `1AU` → `001AU`)

## Examples

### Before & After

```
Before: Dark.Wolverine.076.(2009).(Digital).(AnPymGold.Empire).cbr
After:  Dark Wolverine 076 (2009) (Digital) (AnPymGold.Empire).cbr

Before: Astonishing X-Men 066 (2013) (Digital) (1920) (G85-Empire).cbr
After:  Astonishing X-Men 066 (2013) (Digital) (G85-Empire).cbr

Before: Amazing Spider-Man 500.1 (2023) (Digital) (TestGroup).cbr
After:  Amazing Spider-Man 500.1 (2023) (Digital) (TestGroup).cbr

Before: Batman 001 c2c (2020) (TestGroup).cbr
After:  Batman 001 (2020) (c2c) (TestGroup).cbr

Before: Batman 001 (1999) (Digital) (TestGroup).cbr (with --year=2023)
After:  Batman 001 (2023) (Digital) (TestGroup).cbr
```

## Development

### Project Structure

```
comics-renamer.js          # Main CLI application
comics-renamer-lib.js      # Exported core functions
comics-renamer-lib.test.js # Unit tests
package.json              # NPM configuration
TESTING.md               # Testing guide
README.md                # Documentation
```

### Adding New Features

1. Add function to `comics-renamer-lib.js`
2. Add tests to `comics-renamer-lib.test.js`
3. Run tests: `npm test`
4. Update `comics-renamer.js` to use new function
5. Update documentation

## License

MIT

## Contributing

Contributions welcome! Please:
1. Add tests for new features
2. Ensure all tests pass (`npm test`)
3. Update documentation
