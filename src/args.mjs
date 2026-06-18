export function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      options[toKey(arg.slice(2, eq))] = arg.slice(eq + 1);
      continue;
    }

    const name = arg.slice(2);
    if (name === 'dry-run' || name === 'help') {
      options[toKey(name)] = true;
      continue;
    }

    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[toKey(name)] = value;
    i += 1;
  }

  return options;
}

function toKey(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function printHelp() {
  console.log(`patreon-exporter

Usage:
  patreon-exporter export --out ./patreon-export
  patreon-exporter convert --in ./patreon-export --out ./content/blog

Commands:
  export   Export creator posts from Patreon API v2 to JSON
  convert  Convert exported JSON posts to Markdown

Common options:
  --help   Show this help

Export options:
  --out <dir>             Output directory for JSON files
  --token <token>         Patreon token, defaults to PATREON_TOKEN
  --campaign-id <id>      Skip campaign discovery
  --page-size <number>    Patreon page size, default 50
  --user-agent <value>    User-Agent header

Convert options:
  --in <dir>              Directory containing exported JSON files
  --out <dir>             Markdown output directory
  --format <astro|plain>  Output format, default astro
  --assets-dir <path>     Markdown image path, default ./assets
  --draft <true|false>    Astro draft value, default true
  --dry-run               Preview writes without touching files`);
}
