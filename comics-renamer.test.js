#!/usr/bin/env node

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// We need to extract the functions from comics-renamer.js to test them
// Since they're not exported, we'll use a wrapper that executes the script

// Helper to execute the script and capture output
function runScript(folder, seriesName, options = []) {
  const { execSync } = require("child_process");
  const args = [
    "node",
    "comics-renamer.js",
    `"${folder}"`,
    `"${seriesName}"`,
    ...options,
  ];

  try {
    const output = execSync(args.join(" "), {
      cwd: __dirname,
      encoding: "utf8",
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.stdout || error.stderr, error };
  }
}

// Create test fixtures directory
const fixturesDir = path.join(__dirname, "test-fixtures");
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir);
}

function createTestFile(filename) {
  const filepath = path.join(fixturesDir, filename);
  fs.writeFileSync(filepath, "");
  return filepath;
}

function cleanupTestFiles() {
  if (fs.existsSync(fixturesDir)) {
    const files = fs.readdirSync(fixturesDir);
    files.forEach((file) => {
      fs.unlinkSync(path.join(fixturesDir, file));
    });
  }
}

describe("Comic Book Renamer - Unit Tests", () => {
  describe("Issue Number Detection", () => {
    it("should detect simple issue numbers", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Batman 001"));
    });

    it("should detect decimal issue numbers", () => {
      cleanupTestFiles();
      createTestFile("Amazing Spider-Man 500.1 (2023) (Digital).cbr");
      const result = runScript(fixturesDir, "Amazing Spider-Man", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("500.1"));
    });

    it("should detect issue numbers with letters", () => {
      cleanupTestFiles();
      createTestFile("X-Men 501AU (2022) (Digital).cbr");
      const result = runScript(fixturesDir, "X-Men", ["3", "--dry-run"]);
      assert.ok(result.output.includes("501AU"));
    });

    it("should detect negative issue numbers", () => {
      cleanupTestFiles();
      createTestFile("Spider-Man -1 (2021) (Digital).cbr");
      const result = runScript(fixturesDir, "Spider-Man", ["3", "--dry-run"]);
      assert.ok(result.output.includes("-1"));
    });

    it("should handle 'of' pattern", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 of 004 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Batman 001"));
      assert.ok(!result.output.includes("of 004"));
    });
  });

  describe("Period-Separated Filenames", () => {
    it("should handle period-separated filenames", () => {
      cleanupTestFiles();
      createTestFile("Dark.Wolverine.076.(2009).(Digital).(Empire).cbr");
      const result = runScript(fixturesDir, "Dark Wolverine", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("Dark Wolverine 076"));
      assert.ok(result.output.includes("(2009)"));
    });

    it("should handle period-separated with decimal issues", () => {
      cleanupTestFiles();
      createTestFile("X-Men.500.1.(2022).(Digital).(Group).cbr");
      const result = runScript(fixturesDir, "X-Men", ["3", "--dry-run"]);
      assert.ok(result.output.includes("X-Men 500.1"));
      assert.ok(result.output.includes("(2022)"));
    });
  });

  describe("Year Detection", () => {
    it("should detect realistic years (1938-current+1)", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(2020)"));
    });

    it("should ignore unrealistic years like (1920) image sizes", () => {
      cleanupTestFiles();
      createTestFile("Astonishing X-Men 066 (2013) (Digital) (1920).cbr");
      const result = runScript(fixturesDir, "Astonishing X-Men", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("(2013)"));
      assert.ok(!result.output.includes("(1920)"));
    });

    it("should use first valid year found", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (2021) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(2020)"));
      // Should only have one year in output
      const matches = result.output.match(/\(202\d\)/g) || [];
      assert.strictEqual(matches.length, 1);
    });
  });

  describe("Year Override (--year flag)", () => {
    it("should override detected year", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", [
        "3",
        "--year=2023",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("(2023)"));
      assert.ok(!result.output.includes("(2020)"));
    });

    it("should add year when none exists", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", [
        "3",
        "--year=2023",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("(2023)"));
    });
  });

  describe("Scan Type Detection", () => {
    it("should detect and capitalize Digital", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(Digital)"));
    });

    it("should detect Digital-HD", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (digital-hd).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(Digital-HD)"));
    });

    it("should detect c2c anywhere in filename", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 c2c (2020).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(c2c)"));
    });

    it("should detect c2c case-insensitively", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 C2C (2020).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(c2c)"));
    });

    it("should handle --capitalize=false flag", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (DIGITAL).cbr");
      const result = runScript(fixturesDir, "Batman", [
        "3",
        "--capitalize=false",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("(digital)"));
    });
  });

  describe("Cover Notation", () => {
    it("should detect numeric cover counts", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (3 covers) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(3 covers)"));
    });

    it("should detect text-based cover counts", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (two covers) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(two covers)"));
    });

    it("should detect 'both covers'", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (both covers) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(both covers)"));
    });
  });

  describe("Extra Flags", () => {
    it("should preserve single-letter flags", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (F) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(F)"));
    });

    it("should preserve (fixed) flag", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (fixed) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(fixed)"));
    });
  });

  describe("Release Groups", () => {
    it("should preserve release groups", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (Digital) (Empire).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(Empire)"));
    });

    it("should handle complex release groups", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020) (Digital) (AnPymGold-Empire).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("(AnPymGold-Empire)"));
    });
  });

  describe("Annuals", () => {
    it("should detect annuals and use 2-digit padding", () => {
      cleanupTestFiles();
      createTestFile("Batman Annual 01 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Batman Annual 01"));
      assert.ok(!result.output.includes("Annual 001"));
    });
  });

  describe("Issue Number Padding", () => {
    it("should pad to 3 digits by default", () => {
      cleanupTestFiles();
      createTestFile("Batman 1 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["--dry-run"]);
      assert.ok(result.output.includes("Batman 001"));
    });

    it("should respect custom digit padding", () => {
      cleanupTestFiles();
      createTestFile("Batman 1 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["4", "--dry-run"]);
      assert.ok(result.output.includes("Batman 0001"));
    });

    it("should not pad negative issue numbers", () => {
      cleanupTestFiles();
      createTestFile("Batman -1 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Batman -1"));
      assert.ok(!result.output.includes("-001"));
    });

    it("should not pad decimal issue numbers", () => {
      cleanupTestFiles();
      createTestFile("Batman 500.1 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Batman 500.1"));
    });
  });

  describe("Complex Integration Tests", () => {
    it("should handle complete filename with all components", () => {
      cleanupTestFiles();
      createTestFile(
        "Astonishing X-Men 066 (2013) (3 covers) (Digital) (F) (G85-Empire).cbr"
      );
      const result = runScript(fixturesDir, "Astonishing X-Men", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("Astonishing X-Men 066"));
      assert.ok(result.output.includes("(2013)"));
      assert.ok(result.output.includes("(3 covers)"));
      assert.ok(result.output.includes("(Digital)"));
      assert.ok(result.output.includes("(F)"));
      assert.ok(result.output.includes("(G85-Empire)"));
    });

    it("should handle period-separated with all components", () => {
      cleanupTestFiles();
      createTestFile(
        "Dark.Wolverine.076.(2009).(Digital).(AnPymGold.Empire).cbr"
      );
      const result = runScript(fixturesDir, "Dark Wolverine", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("Dark Wolverine 076"));
      assert.ok(result.output.includes("(2009)"));
      assert.ok(result.output.includes("(Digital)"));
      assert.ok(result.output.includes("(AnPymGold.Empire)"));
    });

    it("should handle the original bug case (year vs size)", () => {
      cleanupTestFiles();
      createTestFile(
        "Astonishing X-Men 066 (2013) (Digital) (1920) (G85-Empire).cbr"
      );
      const result = runScript(fixturesDir, "Astonishing X-Men", [
        "3",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("(2013)"));
      assert.ok(!result.output.includes("(1920)"));
      assert.ok(result.output.includes("(G85-Empire)"));
    });
  });

  describe("Renumbering (--start-number)", () => {
    it("should renumber files sequentially", () => {
      cleanupTestFiles();
      createTestFile("Batman 050 (2020) (Digital).cbr");
      createTestFile("Batman 051 (2020) (Digital).cbr");
      createTestFile("Batman 052 (2020) (Digital).cbr");
      const result = runScript(fixturesDir, "Batman", [
        "3",
        "--start-number=1",
        "--dry-run",
      ]);
      assert.ok(result.output.includes("Batman 001"));
      assert.ok(result.output.includes("Batman 002"));
      assert.ok(result.output.includes("Batman 003"));
    });
  });

  describe("File Extensions", () => {
    it("should handle .cbr files", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020).cbr");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Found 1 files"));
    });

    it("should handle .cbz files", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020).cbz");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Found 1 files"));
    });

    it("should handle .cb7 files", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020).cb7");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(result.output.includes("Found 1 files"));
    });

    it("should ignore non-comic files", () => {
      cleanupTestFiles();
      createTestFile("Batman 001 (2020).txt");
      createTestFile("Batman 001 (2020).pdf");
      const result = runScript(fixturesDir, "Batman", ["3", "--dry-run"]);
      assert.ok(
        result.output.includes("No comic files found") ||
          result.output.includes("Found 0 files")
      );
    });
  });
});

// Cleanup after all tests
process.on("exit", () => {
  cleanupTestFiles();
  if (fs.existsSync(fixturesDir)) {
    fs.rmdirSync(fixturesDir);
  }
});

console.log("\nRunning tests...\n");
