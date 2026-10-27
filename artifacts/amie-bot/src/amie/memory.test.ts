import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAmieMemoryStore } from "./memory.js";

test("both owners share one persistent memory file", () => {
  const directory = mkdtempSync(join(tmpdir(), "amie-memory-test-"));
  const memoryFile = join(directory, "amie-memory.json");

  try {
    const chakalaView = createAmieMemoryStore(memoryFile);
    const darkfillView = createAmieMemoryStore(memoryFile);

    assert.deepEqual(chakalaView.getFacts(), []);
    chakalaView.addFacts(["We prefer short voice replies."]);

    assert.deepEqual(darkfillView.getFacts(), ["We prefer short voice replies."]);
    assert.deepEqual(JSON.parse(readFileSync(memoryFile, "utf8")), {
      facts: ["We prefer short voice replies."],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
