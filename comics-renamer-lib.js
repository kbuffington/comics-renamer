// Library version of comics-renamer functions for unit testing
// This exports all the core logic functions

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
  // Remove " of ##" pattern
  let working = filename.replace(/ of [0-9]+/g, "");

  // Split by spaces, periods, and parentheses to get tokens
  const tokens = working.split(/[\s().]+/);

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
        const isYear =
          nextToken.length === 4 &&
          (nextToken.startsWith("19") || nextToken.startsWith("20"));
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
  return /\bannual\b/i.test(filename);
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

function extractParenContent(filename, capitalize = true) {
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

module.exports = {
  isIssueNumber,
  extractIssueNumber,
  detectAnnual,
  padIssueNumber,
  extractParenContent,
};
