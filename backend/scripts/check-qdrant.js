import { inspectQdrantCollection, initializeQdrantCollection } from "../src/services/qdrant.service.js";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--init")) {
  console.error("Usage: node scripts/check-qdrant.js [--init]");
  process.exitCode = 1;
} else {
  try {
    const result = args.includes("--init")
      ? await initializeQdrantCollection()
      : await inspectQdrantCollection();
    console.log(result.exists ? result : "Qdrant is reachable; configured collection is missing. Run npm run qdrant:init to create it.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
