#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(pluginRoot, "server", "index.mjs");
const mcpCommand = `${shellQuote(process.execPath)} ${shellQuote(serverPath)}`;
const [action, ...values] = process.argv.slice(2);

if (action === "command") {
  process.stdout.write(`${mcpCommand}\n`);
  process.exit(0);
}

if (!["init", "doctor", "run", "connect", "status"].includes(action)) {
  throw new Error(
    "Usage: node scripts/tunnel.mjs command | init --tunnel-id tunnel_... [--api-key-ref env:NAME|file:/path] | connect --tunnel-id tunnel_... [--api-key-ref env:NAME|file:/path] | doctor | run | status",
  );
}

const tunnelClient = process.env.TUNNEL_CLIENT_BIN || "tunnel-client";
const profile = process.env.OBSIDIAN_VAULT_TUNNEL_PROFILE || "obsidian-vaults";
let clientArguments;

if (action === "init") {
  const tunnelId = optionValue(values, "--tunnel-id");
  if (!tunnelId?.startsWith("tunnel_")) throw new Error("init requires --tunnel-id tunnel_...");
  const apiKeyReference = readApiKeyReference(values);
  clientArguments = [
    "init",
    "--sample",
    "sample_mcp_stdio_local",
    "--profile",
    profile,
    "--tunnel-id",
    tunnelId,
    "--mcp-command",
    mcpCommand,
    "--control-plane-api-key-ref",
    apiKeyReference,
  ];
} else if (action === "connect") {
  const tunnelId = optionValue(values, "--tunnel-id");
  if (!tunnelId?.startsWith("tunnel_")) {
    throw new Error("connect requires --tunnel-id tunnel_...");
  }
  clientArguments = [
    "runtimes",
    "connect",
    "--alias",
    profile,
    "--profile",
    profile,
    "--tunnel-id",
    tunnelId,
    "--runtime-api-key",
    readApiKeyReference(values),
    "--mcp-command",
    mcpCommand,
    "--json",
  ];
} else if (action === "doctor") {
  clientArguments = ["doctor", "--profile", profile, "--explain"];
} else if (action === "status") {
  clientArguments = ["runtimes", "status", profile, "--json"];
} else {
  clientArguments = ["run", "--profile", profile];
}

const result = spawnSync(tunnelClient, clientArguments, { stdio: "inherit", env: process.env });
if (result.error) {
  if (result.error.code === "ENOENT") {
    throw new Error(
      "tunnel-client was not found. Download the latest release from https://github.com/openai/tunnel-client/releases/latest or set TUNNEL_CLIENT_BIN.",
    );
  }
  throw result.error;
}
process.exit(result.status ?? 1);

function optionValue(values, name) {
  const index = values.indexOf(name);
  return index === -1 ? undefined : values[index + 1];
}

function readApiKeyReference(values) {
  const reference =
    optionValue(values, "--api-key-ref") ||
    process.env.OBSIDIAN_VAULT_TUNNEL_API_KEY_REF ||
    "env:CONTROL_PLANE_API_KEY";
  if (!/^(env:[A-Za-z_][A-Za-z0-9_]*|file:\/[^\0]+)$/.test(reference)) {
    throw new Error("API key reference must use env:VARIABLE or file:/absolute/path");
  }
  return reference;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}
