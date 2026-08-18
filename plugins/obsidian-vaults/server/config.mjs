import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const CONFIG_DIRECTORY = "obsidian-vaults";
const CONFIG_FILENAME = "config.json";

export function defaultConfigPath(env = process.env) {
  if (typeof env.OBSIDIAN_VAULT_CONFIG === "string" && env.OBSIDIAN_VAULT_CONFIG.trim() !== "") {
    return resolve(env.OBSIDIAN_VAULT_CONFIG.trim());
  }

  const base =
    typeof env.XDG_CONFIG_HOME === "string" && env.XDG_CONFIG_HOME.trim() !== ""
      ? resolve(env.XDG_CONFIG_HOME.trim())
      : process.platform === "win32" && typeof env.APPDATA === "string" && env.APPDATA.trim() !== ""
        ? resolve(env.APPDATA.trim())
        : join(homedir(), ".config");

  return join(base, CONFIG_DIRECTORY, CONFIG_FILENAME);
}

export async function loadUserConfig(options = {}) {
  const env = options.env ?? process.env;
  const path = options.path ? resolve(options.path) : defaultConfigPath(env);

  try {
    const raw = await readFile(path, "utf8");
    return { path, config: validateUserConfig(JSON.parse(raw)) };
  } catch (error) {
    if (error?.code === "ENOENT") return { path, config: {} };
    if (error instanceof SyntaxError) {
      throw new Error(`Obsidian Vaults config is not valid JSON: ${path}`);
    }
    throw error;
  }
}

export async function saveUserConfig(config, options = {}) {
  const env = options.env ?? process.env;
  const path = options.path ? resolve(options.path) : defaultConfigPath(env);
  const normalized = validateUserConfig(config);
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.tmp`;

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
  return path;
}

export function validateUserConfig(value) {
  if (!isRecord(value)) throw new Error("Obsidian Vaults config must be a JSON object.");

  const config = {};
  if (value.token !== undefined) config.token = readString(value.token, "token");

  if (value.tokens !== undefined) {
    if (!isRecord(value.tokens)) throw new Error("Config property tokens must be an object.");
    config.tokens = Object.fromEntries(
      Object.entries(value.tokens).map(([key, token]) => [key, readString(token, `tokens.${key}`)]),
    );
  }

  if (value.ports !== undefined) {
    if (!Array.isArray(value.ports)) throw new Error("Config property ports must be an array.");
    config.ports = [...new Set(value.ports.map((port) => readPort(port, "ports")))].sort(
      (left, right) => left - right,
    );
  }

  if (value.portStart !== undefined) config.portStart = readPort(value.portStart, "portStart");
  if (value.portEnd !== undefined) config.portEnd = readPort(value.portEnd, "portEnd");
  if (value.discoveryTimeoutMs !== undefined) {
    config.discoveryTimeoutMs = readPositiveInteger(value.discoveryTimeoutMs, "discoveryTimeoutMs");
  }

  return config;
}

function readString(value, name) {
  if (typeof value !== "string") throw new Error(`Config property ${name} must be a string.`);
  return value;
}

function readPort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Config property ${name} contains an invalid TCP port: ${value}.`);
  }
  return port;
}

function readPositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Config property ${name} must be a positive integer.`);
  }
  return number;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
