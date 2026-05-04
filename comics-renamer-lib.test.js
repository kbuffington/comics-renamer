#!/usr/bin/env node

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

describe("isIssueNumber", () => {
  it("should accept simple integers", () => {
    assert.strictEqual(isIssueNumber("1"), true);
    assert.strictEqual(isIssueNumber("100"), true);
    assert.strictEqual(isIssueNumber("001"), true);
  });

  it("should accept decimal issues", () => {
    assert.strictEqual(isIssueNumber("500.1"), true);
    assert.strictEqual(isIssueNumber("1.5"), true);
  });

  it("should accept issues with letters", () => {
    assert.strictEqual(isIssueNumber("501AU"), true);
    assert.strictEqual(isIssueNumber("100A"), true);
  });

  it("should accept negative issue numbers", () => {
    assert.strictEqual(isIssueNumber("-1"), true);
  });

  it("should reject 4-digit years", () => {
    assert.strictEqual(isIssueNumber("2020"), false);
    assert.strictEqual(isIssueNumber("1999"), false);
    assert.strictEqual(isIssueNumber("1920"), false);
  });

  it("should reject non-numeric strings", () => {
    assert.strictEqual(isIssueNumber("Digital"), false);
    assert.strictEqual(isIssueNumber("Empire"), false);
  });

  it("should reject empty or null", () => {
    assert.strictEqual(isIssueNumber(""), false);
    assert.strictEqual(isIssueNumber(null), false);
  });
});

describe("extractIssueNumber", () => {
  it("should extract simple issue numbers", () => {
    assert.strictEqual(extractIssueNumber("Batman 001 (2020)"), "001");
    assert.strictEqual(extractIssueNumber("Spider-Man 100 (2021)"), "100");
  });

  it("should extract decimal issue numbers", () => {
    assert.strictEqual(
      extractIssueNumber("Amazing Spider-Man 500.1 (2023)"),
      "500.1"
    );
    assert.strictEqual(extractIssueNumber("X-Men 1.5 (2022)"), "1.5");
  });

  it("should extract issues with letters", () => {
    assert.strictEqual(extractIssueNumber("X-Men 501AU (2022)"), "501AU");
  });

  it("should extract negative issue numbers", () => {
    assert.strictEqual(extractIssueNumber("Spider-Man -1 (2021)"), "-1");
  });

  it("should handle 'of' pattern", () => {
    assert.strictEqual(
      extractIssueNumber("Batman 001 of 004 (2020)"),
      "001"
    );
  });

  it("should extract from period-separated filenames", () => {
    assert.strictEqual(
      extractIssueNumber("Dark.Wolverine.076.(2009)"),
      "076"
    );
    assert.strictEqual(extractIssueNumber("X-Men.500.1.(2022)"), "500.1");
  });

  it("should extract from underscore-separated filenames", () => {
    assert.strictEqual(
      extractIssueNumber("New_Excalibur_001_(2006)_(Digital)_(AnPymGold-Empire)"),
      "001"
    );
    assert.strictEqual(
      extractIssueNumber("Batman_066_(2013)_(Digital)"),
      "066"
    );
  });

  it("should not combine issue with year", () => {
    assert.strictEqual(
      extractIssueNumber("Dark.Wolverine.076.(2009)"),
      "076"
    );
    // Should NOT return "076.2009"
    const result = extractIssueNumber("Dark.Wolverine.076.(2009)");
    assert.ok(!result.includes("2009"));
  });

  it("should extract issue number preceded by #", () => {
    assert.strictEqual(
      extractIssueNumber("Strange Tales #1 (1987) (digital-HD) (Marika-Empire)"),
      "1"
    );
    assert.strictEqual(extractIssueNumber("Batman #066 (2013) (Digital)"), "066");
  });

  it("should return null for filenames without issue numbers", () => {
    assert.strictEqual(extractIssueNumber("Batman (2020) Digital"), null);
  });
});

describe("detectAnnual", () => {
  it("should detect annual in filename", () => {
    assert.strictEqual(detectAnnual("Batman Annual 01 (2020)"), true);
    assert.strictEqual(detectAnnual("Batman annual 01 (2020)"), true);
  });

  it("should detect annual in underscore-separated filenames", () => {
    assert.strictEqual(detectAnnual("Batman_Annual_01_(2020)"), true);
  });

  it("should not detect non-annual files", () => {
    assert.strictEqual(detectAnnual("Batman 001 (2020)"), false);
  });
});

describe("padIssueNumber", () => {
  it("should pad simple integers", () => {
    assert.strictEqual(padIssueNumber("1", 3), "001");
    assert.strictEqual(padIssueNumber("50", 3), "050");
    assert.strictEqual(padIssueNumber("1", 4), "0001");
  });

  it("should not pad negative numbers", () => {
    assert.strictEqual(padIssueNumber("-1", 3), "-1");
  });

  it("should preserve decimals and pad base number", () => {
    assert.strictEqual(padIssueNumber("500.1", 3), "500.1");
    assert.strictEqual(padIssueNumber("1.5", 3), "001.5");
  });

  it("should preserve letters and pad base number", () => {
    assert.strictEqual(padIssueNumber("501AU", 3), "501AU");
    assert.strictEqual(padIssueNumber("1A", 3), "001A");
  });

  it("should not add extra padding to already-padded numbers", () => {
    assert.strictEqual(padIssueNumber("001", 3), "001");
    assert.strictEqual(padIssueNumber("0050", 3), "0050");
  });
});

describe("extractParenContent", () => {
  describe("year detection", () => {
    it("should extract valid years", () => {
      const result = extractParenContent("Batman 001 (2020) (Digital)");
      assert.strictEqual(result.year, "2020");
    });

    it("should accept years from 1938 to current+1", () => {
      const currentYear = new Date().getFullYear();
      const result1938 = extractParenContent("Batman 001 (1938)");
      assert.strictEqual(result1938.year, "1938");

      const resultCurrent = extractParenContent(
        `Batman 001 (${currentYear})`
      );
      assert.strictEqual(resultCurrent.year, String(currentYear));

      const resultNext = extractParenContent(
        `Batman 001 (${currentYear + 1})`
      );
      assert.strictEqual(resultNext.year, String(currentYear + 1));
    });

    it("should reject unrealistic years (image sizes)", () => {
      const result = extractParenContent("Batman 001 (2020) (1920)");
      assert.strictEqual(result.year, "2020");
      // 1920 should be ignored
    });

    it("should use first valid year found", () => {
      const result = extractParenContent("Batman 001 (2020) (2021)");
      assert.strictEqual(result.year, "2020");
    });

    it("should reject years before 1938", () => {
      const result = extractParenContent("Batman 001 (1920)");
      assert.strictEqual(result.year, null);
    });

    it("should reject years in future (current+2 or more)", () => {
      const currentYear = new Date().getFullYear();
      const futureYear = currentYear + 2;
      const result = extractParenContent(`Batman 001 (${futureYear})`);
      assert.strictEqual(result.year, null);
    });
  });

  describe("scan type detection", () => {
    it("should detect Digital (capitalized by default)", () => {
      const result = extractParenContent("Batman 001 (2020) (digital)");
      assert.strictEqual(result.scanType, "Digital");
    });

    it("should detect Digital (lowercase when capitalize=false)", () => {
      const result = extractParenContent(
        "Batman 001 (2020) (DIGITAL)",
        false
      );
      assert.strictEqual(result.scanType, "digital");
    });

    it("should detect Digital-HD", () => {
      const result = extractParenContent("Batman 001 (2020) (digital-hd)");
      assert.strictEqual(result.scanType, "Digital-HD");
    });

    it("should detect Digital-SD", () => {
      const result = extractParenContent("Batman 001 (2020) (digital-sd)");
      assert.strictEqual(result.scanType, "Digital-SD");
    });

    it("should detect c2c in parentheses", () => {
      const result = extractParenContent("Batman 001 (2020) (c2c)");
      assert.strictEqual(result.scanType, "c2c");
    });

    it("should detect c2c anywhere in filename", () => {
      const result = extractParenContent("Batman 001 c2c (2020)");
      assert.strictEqual(result.scanType, "c2c");
    });

    it("should detect c2c case-insensitively", () => {
      const result1 = extractParenContent("Batman 001 C2C (2020)");
      assert.strictEqual(result1.scanType, "c2c");

      const result2 = extractParenContent("Batman 001 (C2c)");
      assert.strictEqual(result2.scanType, "c2c");
    });
  });

  describe("cover notation detection", () => {
    it("should detect numeric cover counts", () => {
      const result = extractParenContent("Batman 001 (2020) (3 covers)");
      assert.strictEqual(result.covers, "3 covers");
    });

    it("should detect text-based cover counts", () => {
      const result1 = extractParenContent("Batman 001 (2020) (two covers)");
      assert.strictEqual(result1.covers, "two covers");

      const result2 = extractParenContent("Batman 001 (2020) (both covers)");
      assert.strictEqual(result2.covers, "both covers");
    });

    it("should handle singular 'cover'", () => {
      const result = extractParenContent("Batman 001 (2020) (1 cover)");
      assert.strictEqual(result.covers, "1 covers");
    });

    it("should normalize to lowercase", () => {
      const result = extractParenContent("Batman 001 (2020) (3 Covers)");
      assert.strictEqual(result.covers, "3 covers");
    });
  });

  describe("extra flag detection", () => {
    it("should detect single-letter flags", () => {
      const result = extractParenContent("Batman 001 (2020) (F)");
      assert.strictEqual(result.extraFlag, "F");
    });

    it("should detect fixed flag", () => {
      const result = extractParenContent("Batman 001 (2020) (fixed)");
      assert.strictEqual(result.extraFlag, "fixed");
    });

    it("should detect fixed case-insensitively", () => {
      const result = extractParenContent("Batman 001 (2020) (FIXED)");
      assert.strictEqual(result.extraFlag, "fixed");
    });
  });

  describe("release group detection", () => {
    it("should extract release groups", () => {
      const result = extractParenContent("Batman 001 (2020) (Digital) (Empire)");
      assert.strictEqual(result.releaseGroup, "Empire");
    });

    it("should handle complex release groups", () => {
      const result = extractParenContent(
        "Batman 001 (2020) (Digital) (AnPymGold-Empire)"
      );
      assert.strictEqual(result.releaseGroup, "AnPymGold-Empire");
    });

    it("should preserve dots in release groups", () => {
      const result = extractParenContent(
        "Batman 001 (2020) (Digital) (AnPymGold.Empire)"
      );
      assert.strictEqual(result.releaseGroup, "AnPymGold.Empire");
    });
  });

  describe("complex cases", () => {
    it("should handle all components together", () => {
      const result = extractParenContent(
        "Astonishing X-Men 066 (2013) (3 covers) (Digital) (F) (G85-Empire)"
      );
      assert.strictEqual(result.year, "2013");
      assert.strictEqual(result.covers, "3 covers");
      assert.strictEqual(result.scanType, "Digital");
      assert.strictEqual(result.extraFlag, "F");
      assert.strictEqual(result.releaseGroup, "G85-Empire");
    });

    it("should handle the original bug (year vs image size)", () => {
      const result = extractParenContent(
        "Astonishing X-Men 066 (2013) (Digital) (1920) (G85-Empire)"
      );
      assert.strictEqual(result.year, "2013");
      assert.strictEqual(result.releaseGroup, "G85-Empire");
      // 1920 should be treated as release group or ignored
    });

    it("should handle period-separated filenames", () => {
      const result = extractParenContent(
        "Dark.Wolverine.076.(2009).(Digital).(AnPymGold.Empire)"
      );
      assert.strictEqual(result.year, "2009");
      assert.strictEqual(result.scanType, "Digital");
      assert.strictEqual(result.releaseGroup, "AnPymGold.Empire");
    });

    it("should handle underscore-separated filenames", () => {
      const result = extractParenContent(
        "New_Excalibur_001_(2006)_(Digital)_(AnPymGold-Empire)"
      );
      assert.strictEqual(result.year, "2006");
      assert.strictEqual(result.scanType, "Digital");
      assert.strictEqual(result.releaseGroup, "AnPymGold-Empire");
    });
  });
});

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

console.log("\nRunning library unit tests...\n");
