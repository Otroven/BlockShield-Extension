import { startDevStack } from "./start-dev-stack.mjs";

startDevStack({ reset: true }).catch((error) => {
  process.stderr.write(`[reset] ${error.message}\n`);
  process.exit(1);
});
