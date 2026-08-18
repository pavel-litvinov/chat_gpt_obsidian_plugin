#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadUserConfig, saveUserConfig } from "../server/config.mjs";

const args = parseArguments(process.argv.slice(2));

if (args.help) {
  process.stdout.write(
    "Usage: node scripts/configure.mjs --vault NAME --from-obsidian /path/to/vault/.obsidian/plugins/vault-toolkit/data.json [--config PATH]\n",
  );
  process.exit(0);
}

if (!args.vault || !args.fromObsidian) {
  throw new Error("Both --vault and --from-obsidian are required. Use --help for an example.");
}

const sourcePath = resolve(args.fromObsidian);
const settings = JSON.parse(await readFile(sourcePath, "utf8"));
if (typeof settings.bearerToken !== "string" || settings.bearerToken.trim() === "") {
  throw new Error(`No bearer token is configured in ${sourcePath}.`);
}

const configPath = args.config ? resolve(args.config) : undefined;
const { config } = await loadUserConfig({ path: configPath });
const nextConfig = {
  ...config,
  tokens: { ...(config.tokens ?? {}), [args.vault]: settings.bearerToken },
};

if (settings.preferredPort !== undefined) {
  const port = Number(settings.preferredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Vault Toolkit has an invalid preferredPort: ${settings.preferredPort}.`);
  }
  nextConfig.ports = [...new Set([...(config.ports ?? []), port])].sort(
    (left, right) => left - right,
  );
}

const savedPath = await saveUserConfig(nextConfig, { path: configPath });
process.stdout.write(
  `Configured bearer-token access for vault "${args.vault}" in ${savedPath}. The token was not printed.\n`,
);

function parseArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") parsed.help = true;
    else if (value === "--vault") parsed.vault = requireValue(values, ++index, value);
    else if (value === "--from-obsidian") {
      parsed.fromObsidian = requireValue(values, ++index, value);
    } else if (value === "--config") parsed.config = requireValue(values, ++index, value);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function requireValue(values, index, flag) {
  const value = values[index];
  if (typeof value !== "string" || value === "") throw new Error(`${flag} requires a value.`);
  return value;
}
