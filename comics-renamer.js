#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { detectFileFormat } = require("./comics-renamer-lib");

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2 || args.includes("-h") || args.includes("--help")) {
  console.log(`
Comic Book Renamer

Usage: comics-renamer "Folder Path" "Series Name" [numDigits] [--dry-run] [--start-number=N] [--year=YYYY] [--capitalize]

Arguments:
  Folder Path       - Path to folder containing comic files (required)
  Series Name       - The standardized series name (required)
  numDigits         - Number of digits for issue padding (default: 3)
  --dry-run         - Preview changes without renaming files
  --start-number=N  - Renumber files starting from N (e.g., --start-number=001)
  --year=YYYY       - Override year in all files (e.g., --year=2000)
  --capitalize      - Capitalize scan types like "Digital" (default: true, use --capitalize=false for lowercase)
  --fix-extensions  - Detect and fix wrong .cbr/.cbz extensions via magic bytes (does not apply to .cb7)
  --y               - Auto-confirm renaming without prompt

Examples:
  comics-renamer "." "Amazing Spider-Man"
  comics-renamer "C:\\Comics" "Amazing Spider-Man" 4
  comics-renamer "." "Amazing Spider-Man" 3 --dry-run
  comics-renamer "." "Amazing Spider-Man" 3 --start-number=001 --dry-run
  comics-renamer "." "Amazing Spider-Man" 3 --year=2023 --dry-run
  comics-renamer "." "Amazing Spider-Man" 3 --capitalize=false
  comics-renamer "." "Amazing Spider-Man" 3 --fix-extensions --dry-run

Expected input format:
  seriesName ###(YYYY)(scan-type)(Release Group).ext
  Handles: 001, 000, -1, 500.1, 501AU, "001 of 004"

Accepted scan types: digital, digital-hd, c2c (case insensitive)
Note: c2c is detected anywhere in filename, even without parentheses
Release groups are preserved as-is
Negative issue numbers (-1) are not padded
Single-letter flags like (F) and (fixed) are preserved
`);
  process.exit(0);
}

const folder = args[0];
const seriesName = args[1];
let numDigits = 3;
let dryRun = false;
let autoConfirm = false;
let startNumber = null;
let yearOverride = null;
let capitalize = true;
let fixExtensions = false;

// Check for --start-number flag
const startNumberArg = args.find((arg) => arg.startsWith("--start-number="));
if (startNumberArg) {
  const startValue = startNumberArg.split("=")[1];
  startNumber = parseInt(startValue) || 1;
}

// Check for --year flag
const yearArg = args.find((arg) => arg.startsWith("--year="));
if (yearArg) {
  yearOverride = yearArg.split("=")[1];
}

// Check for --capitalize flag
const capitalizeArg = args.find((arg) => arg.startsWith("--capitalize"));
if (capitalizeArg) {
  if (capitalizeArg === "--capitalize=false") {
    capitalize = false;
  }
}

// Check for -y flag (auto-confirm)
if (args.includes("--y")) {
  autoConfirm = true;
}

// Check for --dry-run flag
if (args.includes("--dry-run")) {
  dryRun = true;
  if (args[2] && !args[2].startsWith("--") && !args[2].startsWith("-")) {
    numDigits = parseInt(args[2]) || 3;
  }
} else if (args[2] && !args[2].startsWith("--") && !args[2].startsWith("-")) {
  numDigits = parseInt(args[2]) || 3;
}

// Check for --fix-extensions flag
if (args.includes("--fix-extensions")) {
  fixExtensions = true;
}

// Verify folder exists
if (!fs.existsSync(folder)) {
  console.error(`Error: Folder not found: ${folder}`);
  process.exit(1);
}

const resolvedFolder = path.resolve(folder);

console.log("");
console.log("============================================");
console.log("Comic Book Renamer");
console.log("============================================");
console.log(`Folder: ${resolvedFolder}`);
console.log(`Series Name: ${seriesName}`);
console.log(`Digit Padding: ${numDigits}`);
if (startNumber !== null) {
  console.log(`Renumbering: Starting from ${startNumber}`);
}
if (yearOverride !== null) {
  console.log(`Year Override: ${yearOverride}`);
}
if (fixExtensions) {
  console.log(`Fix Extensions: enabled`);
}
console.log(
  `Mode: ${
    dryRun
      ? "DRY RUN (no files will be renamed)"
      : "LIVE (files will be renamed)"
  }`
);
console.log("============================================");
console.log("");

// Get all comic files
const files = fs.readdirSync(resolvedFolder).filter((file) => {
  const ext = path.extname(file).toLowerCase();
  return [".cbr", ".cbz", ".cb7"].includes(ext);
});

if (files.length === 0) {
  console.log("No comic files found (*.cbr, *.cbz, *.cb7)");
  process.exit(0);
}

function isIssueNumber(token) {
  if (!token) return false;

  // Skip if it's a 4-digit year starting with 19 or 20
  if (
    token.length === 4 &&
    (token.startsWith("19") || token.startsWith("20"))
  ) {
    return false;
  }

  // Check if it starts with a digit or minus sign
  const firstChar = token[0];
  if (!/^[0-9-]$/.test(firstChar)) {
    return false;
  }

  // Valid issue number pattern: digits, possibly with -, ., or trailing letters
  return /^-?[0-9]+(\.[0-9]+)?([A-Za-z]+)?$/.test(token);
}

function extractIssueNumber(filename) {
  // Remove " of ##" pattern (space or underscore separated)
  let working = filename.replace(/[\s_]of[\s_][0-9]+/g, "");

  // Split by spaces, periods, underscores, parentheses, and # to get tokens
  // # is included so "#1" is split into ["", "1"] and the number is found
  const tokens = working.split(/[\s()._#]+/);

  // Find first token that looks like an issue number
  // Check for decimal issues FIRST (e.g., "500.1" split into ["500", "1"])
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check if this could be the first part of a decimal issue (e.g., "500" in "500.1")
    // Do this BEFORE checking if token alone is valid, to prioritize decimal issues
    if (/^[0-9]+$/.test(token) && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      // Check if next token is pure digits (potential decimal part)
      // BUT: Don't combine if next token looks like a year (4 digits starting with 19/20)
      if (/^[0-9]+$/.test(nextToken)) {
        const isYear = nextToken.length === 4 && (nextToken.startsWith("19") || nextToken.startsWith("20"));
        if (!isYear) {
          const combined = token + "." + nextToken;
          if (isIssueNumber(combined)) {
            return combined;
          }
        }
      }
      // Check if next token has digits + letters (e.g., "1AU")
      else if (/^[0-9]+[A-Za-z]+$/.test(nextToken)) {
        const combined = token + "." + nextToken;
        if (isIssueNumber(combined)) {
          return combined;
        }
      }
    }

    // Check if current token is an issue number
    if (isIssueNumber(token)) {
      return token;
    }
  }

  return null;
}

function detectAnnual(filename) {
  // Check if filename contains "Annual" (case insensitive)
  // Replace underscores with spaces so \b word boundaries work correctly
  return /\bannual\b/i.test(filename.replace(/_/g, " "));
}

function padIssueNumber(issueNum, numDigits) {
  // Don't pad negative numbers
  if (issueNum.startsWith("-")) {
    return issueNum;
  }

  // Extract base number and suffix (for formats like 500.1 or 501AU)
  let baseNum = issueNum;
  let suffix = "";

  // Check for decimal
  const decimalMatch = issueNum.match(/^(\d+)\.(.+)$/);
  if (decimalMatch) {
    baseNum = decimalMatch[1];
    suffix = "." + decimalMatch[2];
  } else {
    // Check for letters at the end
    const letterMatch = issueNum.match(/^(\d+)([A-Za-z]+)$/);
    if (letterMatch) {
      baseNum = letterMatch[1];
      suffix = letterMatch[2];
    }
  }

  // Pad the base number
  const padded = baseNum.padStart(numDigits, "0");
  return padded + suffix;
}

function extractParenContent(filename) {
  const result = {
    year: null,
    covers: null,
    scanType: null,
    extraFlag: null,
    releaseGroup: null,
  };

  // Check for c2c anywhere in filename (not just in parentheses)
  if (/c2c/i.test(filename)) {
    result.scanType = "c2c";
  }

  // Extract all parenthetical content
  const parenRegex = /\(([^)]+)\)/g;
  const matches = [...filename.matchAll(parenRegex)].map((m) => m[1]);

  // Define realistic year range for comic books
  const currentYear = new Date().getFullYear();
  const minYear = 1938; // Earliest Golden Age comics
  const maxYear = currentYear + 1; // Allow next year for upcoming releases

  for (const content of matches) {
    if (!content) continue;

    // Check if it's a realistic 4-digit year starting with 19 or 20
    if (
      content.length === 4 &&
      (content.startsWith("19") || content.startsWith("20"))
    ) {
      const yearNum = parseInt(content, 10);
      // Only accept realistic years, and only the FIRST one found
      if (yearNum >= minYear && yearNum <= maxYear && !result.year) {
        result.year = content;
      }
    }
    // Check if it's a covers notation (e.g., "3 covers", "two covers", "both covers")
    else if (/^.+\s+covers?$/i.test(content)) {
      result.covers = content.toLowerCase().replace(/covers?/, "covers");
    }
    // Check if it's a scan type (case insensitive)
    else if (content.toLowerCase() === "digital") {
      result.scanType = capitalize ? "Digital" : "digital";
    } else if (content.toLowerCase() === "digital-hd") {
      result.scanType = capitalize ? "Digital-HD" : "digital-HD";
    } else if (content.toLowerCase() === "digital-sd") {
      result.scanType = capitalize ? "Digital-SD" : "digital-SD";
    } else if (content.toLowerCase() === "c2c") {
      // c2c detected in parentheses (already handled above, just skip it here)
      continue;
    }
    // Check if it's a single letter flag or "fixed"
    else if (content.length === 1) {
      result.extraFlag = content;
    } else if (content.toLowerCase() === "fixed") {
      result.extraFlag = "fixed";
    }
    // Otherwise it's the release group (last one wins)
    else {
      result.releaseGroup = content;
    }
  }

  return result;
}

function processFile(filename) {
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);

  // Check if it's an annual
  const isAnnual = detectAnnual(nameWithoutExt);

  // Extract issue number
  const issueNum = extractIssueNumber(nameWithoutExt);
  if (!issueNum) {
    return null; // Skip files without issue numbers
  }

  // Pad issue number (annuals always use 2 digits)
  const padding = isAnnual ? 2 : numDigits;
  const paddedIssue = padIssueNumber(issueNum, padding);

  // Extract parenthetical content
  const { year, covers, scanType, extraFlag, releaseGroup } =
    extractParenContent(nameWithoutExt);

  // Build new filename
  let newName = `${seriesName}`;
  if (isAnnual) newName += ` Annual`;
  newName += ` ${paddedIssue}`;

  // Use year override if provided, otherwise use detected year
  const finalYear = yearOverride || year;
  if (finalYear) newName += ` (${finalYear})`;
  if (covers) newName += ` (${covers})`;
  if (scanType) newName += ` (${scanType})`;
  if (extraFlag) newName += ` (${extraFlag})`;
  if (releaseGroup) newName += ` (${releaseGroup})`;

  newName += ext;

  return newName;
}

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

// If renumbering, sort files by their current issue number first
if (startNumber !== null) {
  files.sort((a, b) => {
    const issueA = extractIssueNumber(path.basename(a, path.extname(a)));
    const issueB = extractIssueNumber(path.basename(b, path.extname(b)));

    if (!issueA || !issueB) return 0;

    // Parse issue numbers, handling decimals and letters
    const parseIssue = (issue) => {
      const match = issue.match(/^-?(\d+)/);
      return match ? parseFloat(match[1]) : 0;
    };

    return parseIssue(issueA) - parseIssue(issueB);
  });
}

// Collect all changes first
let changes = [];
let renumberCounter = startNumber;

for (const file of files) {
  let newName;

  if (startNumber !== null) {
    // Override the issue number with the sequential counter
    const ext = path.extname(file);
    const nameWithoutExt = path.basename(file, ext);

    // Check if it's an annual
    const isAnnual = detectAnnual(nameWithoutExt);

    // Extract issue number to verify file has one
    const issueNum = extractIssueNumber(nameWithoutExt);
    if (!issueNum) {
      continue; // Skip files without issue numbers
    }

    // Pad the new issue number (annuals always use 2 digits)
    const padding = isAnnual ? 2 : numDigits;
    const paddedIssue = renumberCounter.toString().padStart(padding, "0");

    // Extract parenthetical content
    const { year, covers, scanType, extraFlag, releaseGroup } =
      extractParenContent(nameWithoutExt);

    // Build new filename with renumbered issue
    newName = `${seriesName}`;
    if (isAnnual) newName += ` Annual`;
    newName += ` ${paddedIssue}`;
    // Use year override if provided, otherwise use detected year
    const finalYear = yearOverride || year;
    if (finalYear) newName += ` (${finalYear})`;
    if (covers) newName += ` (${covers})`;
    if (scanType) newName += ` (${scanType})`;
    if (extraFlag) newName += ` (${extraFlag})`;
    if (releaseGroup) newName += ` (${releaseGroup})`;
    newName += ext;

    renumberCounter++;
  } else {
    newName = processFile(file);
  }

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
          if (fs.existsSync(path.join(resolvedFolder, candidate))) {
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
}

// Display all changes
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

console.log("");
console.log("============================================");
console.log(`Found ${changes.length} files to rename`);
console.log("============================================");

if (changes.length === 0) {
  process.exit(0);
}

// If dry-run, just exit
if (dryRun) {
  console.log("Dry run mode - no files were renamed");
  process.exit(0);
}

// If not auto-confirm, prompt user
if (!autoConfirm) {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Would you like to process these changes? (y/n): ", (answer) => {
    rl.close();
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("Operation cancelled");
      process.exit(0);
    }

    // Process the renames
    performRenames(changes);
  });
} else {
  // Auto-confirm, process immediately
  performRenames(changes);
}

function performRenames(changes) {
  console.log("");
  console.log("Processing renames...");
  let successCount = 0;
  let failCount = 0;

  for (const { oldName, newName } of changes) {
    try {
      const oldPath = path.join(resolvedFolder, oldName);
      const newPath = path.join(resolvedFolder, newName);
      fs.renameSync(oldPath, newPath);
      successCount++;
    } catch (error) {
      console.log(`Failed to rename: ${oldName}`);
      console.log(`  Error: ${error.message}`);
      failCount++;
    }
  }

  console.log("");
  console.log("============================================");
  console.log(`Successfully renamed: ${successCount} files`);
  if (failCount > 0) {
    console.log(`Failed: ${failCount} files`);
  }
  console.log("============================================");
}
