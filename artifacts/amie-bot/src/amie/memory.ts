import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const MEMORY_FILE = join(DATA_DIR, "amie-memory.json");

interface AmieMemory {
  facts: string[];
}

function emptyMemory(): AmieMemory {
  return { facts: [] };
}

export function createAmieMemoryStore(memoryFile = MEMORY_FILE) {
  const dataDirectory = dirname(memoryFile);

  function load(): AmieMemory {
    if (!existsSync(memoryFile)) return emptyMemory();

    try {
      const parsed = JSON.parse(readFileSync(memoryFile, "utf8")) as Partial<AmieMemory>;
      if (!Array.isArray(parsed.facts) || !parsed.facts.every((fact) => typeof fact === "string")) {
        throw new Error("The shared Amie memory file must contain a string array named facts.");
      }
      return { facts: parsed.facts };
    } catch (error) {
      throw new Error(
        `Could not read Amie's shared memory file at ${memoryFile}: ${
          error instanceof Error ? error.message : "invalid JSON"
        }`,
      );
    }
  }

  function save(memory: AmieMemory): void {
    mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${memoryFile}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(memory, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryFile, memoryFile);
  }

  return {
    addFacts(facts: string[]): void {
      const memory = load();
      const normalized = facts
        .map((fact) => fact.trim().replace(/\s+/g, " "))
        .filter((fact) => fact.length >= 4 && fact.length <= 240);

      for (const fact of normalized) {
        if (!memory.facts.some((saved) => saved.toLowerCase() === fact.toLowerCase())) {
          memory.facts.push(fact);
        }
      }

      memory.facts = memory.facts.slice(-100);
      save(memory);
    },

    getFacts(): string[] {
      return load().facts;
    },
  };
}

export const amieMemory = createAmieMemoryStore();
