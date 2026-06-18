#!/usr/bin/env node

import { exportPosts } from '../src/export-posts.mjs';
import { convertExport } from '../src/convert-export.mjs';
import { parseArgs, printHelp } from '../src/args.mjs';

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const options = parseArgs(rest);

  if (command === 'export') {
    await exportPosts(options);
    return;
  }

  if (command === 'convert') {
    await convertExport(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
