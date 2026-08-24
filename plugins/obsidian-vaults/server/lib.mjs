const MCP_PROTOCOL_VERSION = "2025-06-18";
const SERVER_VERSION = "0.3.0";
const DEFAULT_PORT_START = 8766;
const DEFAULT_PORT_END = 8786;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 400;

const readOnly = { readOnlyHint: true };
const additiveWrite = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
};
const safeUpdate = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

const vaultProperty = {
  type: "string",
  description:
    "Vault name, vault id, or local bridge port. Optional only when exactly one vault is open.",
};

function schema(properties = {}, required = []) {
  return {
    type: "object",
    properties: { vault: vaultProperty, ...properties },
    ...(required.length > 0 ? { required } : {}),
  };
}

export const TOOL_DEFINITIONS = [
  {
    name: "list_vaults",
    description:
      "Discover the Obsidian vaults currently exposing a local Vault Toolkit bridge, including bridge versions.",
    inputSchema: { type: "object", properties: {} },
    annotations: readOnly,
  },
  {
    name: "read_note",
    description: "Read a Markdown note and its Obsidian metadata from a selected vault.",
    inputSchema: schema(
      { path: { type: "string", description: "Vault-relative note path." } },
      ["path"],
    ),
    annotations: readOnly,
  },
  {
    name: "read_active_note",
    description: "Read the note currently active in a selected Obsidian vault window.",
    inputSchema: schema(),
    annotations: readOnly,
  },
  {
    name: "search_notes",
    description:
      "Search note paths and full Markdown content, with optional regex, tag, and frontmatter filters. Filters combine with AND; tags match any supplied tag.",
    inputSchema: schema({
      query: { type: "string", description: "Path or full-content text fragment." },
      regex: {
        type: "string",
        description: "Regular expression applied to path and content.",
      },
      case_sensitive: { type: "boolean", default: false },
      tag: { type: "string", description: "A single tag, with or without #." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Match any supplied tag.",
      },
      frontmatter: {
        type: "object",
        additionalProperties: true,
        description: "Exact frontmatter key/value filters.",
      },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    }),
    annotations: readOnly,
  },
  {
    name: "get_backlinks",
    description: "List Markdown notes containing resolved wikilinks to a note.",
    inputSchema: schema(
      { path: { type: "string", description: "Vault-relative note path." } },
      ["path"],
    ),
    annotations: readOnly,
  },
  {
    name: "get_outgoing_links",
    description: "List Markdown notes reached by resolved wikilinks from a note.",
    inputSchema: schema(
      { path: { type: "string", description: "Vault-relative note path." } },
      ["path"],
    ),
    annotations: readOnly,
  },
  {
    name: "get_graph_neighbors",
    description: "Traverse incoming and outgoing wikilinks up to a bounded depth.",
    inputSchema: schema(
      {
        path: { type: "string", description: "Vault-relative note path." },
        depth: { type: "integer", minimum: 1, maximum: 10, default: 1 },
      },
      ["path"],
    ),
    annotations: readOnly,
  },
  {
    name: "list_notes",
    description: "List Markdown notes in a selected vault, sorted by path.",
    inputSchema: schema({
      limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
    }),
    annotations: readOnly,
  },
  {
    name: "get_note_metadata",
    description: "Get a note's path, timestamps, tags, and frontmatter.",
    inputSchema: schema({ path: { type: "string" } }, ["path"]),
    annotations: readOnly,
  },
  {
    name: "get_vault_metadata",
    description: "Summarize note count, folder count, and tag usage for a selected vault.",
    inputSchema: schema(),
    annotations: readOnly,
  },
  {
    name: "create_note",
    description:
      "Create a Markdown note, parent folders, and optional frontmatter. Fails if the note exists.",
    inputSchema: schema(
      {
        path: {
          type: "string",
          description: "Vault-relative path; .md is added automatically.",
        },
        content: { type: "string", default: "" },
        frontmatter: { type: "object", additionalProperties: true },
      },
      ["path"],
    ),
    annotations: additiveWrite,
  },
  {
    name: "update_note",
    description:
      "Replace the entire content of an existing note. Prefer patch_note for focused edits.",
    inputSchema: schema(
      { path: { type: "string" }, content: { type: "string" } },
      ["path", "content"],
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
  },
  {
    name: "append_to_note",
    description: "Append Markdown text to an existing note.",
    inputSchema: schema(
      { path: { type: "string" }, content: { type: "string" } },
      ["path", "content"],
    ),
    annotations: additiveWrite,
  },
  {
    name: "patch_note",
    description:
      "Replace one exact, unique string in a note. Include surrounding context when necessary.",
    inputSchema: schema(
      {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      ["path", "old_text", "new_text"],
    ),
    annotations: safeUpdate,
  },
  {
    name: "update_frontmatter",
    description:
      "Set or remove one frontmatter property using Obsidian's atomic frontmatter API.",
    inputSchema: schema(
      {
        path: { type: "string" },
        key: { type: "string" },
        value: { description: "JSON-compatible value to set." },
        remove: {
          type: "boolean",
          default: false,
          description: "Remove the property instead of setting it.",
        },
      },
      ["path", "key"],
    ),
    annotations: safeUpdate,
  },
  {
    name: "rename_note",
    description: "Rename or move a note through Obsidian and update wikilinks across the vault.",
    inputSchema: schema(
      {
        old_path: { type: "string", description: "Existing vault-relative note path." },
        new_path: { type: "string", description: "New vault-relative note path." },
      },
      ["old_path", "new_path"],
    ),
    annotations: safeUpdate,
  },
  {
    name: "batch_write",
    description: "Atomically create or update up to 100 notes. Any failure rolls back the entire batch.",
    inputSchema: schema(
      {
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["create", "update"] },
              path: { type: "string" },
              content: { type: "string" },
              frontmatter: { type: "object", additionalProperties: true },
            },
            required: ["type", "path"],
            additionalProperties: false,
          },
        },
      },
      ["operations"],
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  },
  {
    name: "create_from_template",
    description: "Create a note from an Obsidian template using title, date, time, and custom variables.",
    inputSchema: schema(
      {
        template_path: { type: "string" },
        target_path: { type: "string" },
        variables: { type: "object", additionalProperties: true, default: {} },
      },
      ["template_path", "target_path"],
    ),
    annotations: additiveWrite,
  },
  {
    name: "query_dataview",
    description: "Execute a Dataview DQL query and return its result as JSON.",
    inputSchema: schema(
      { dql_query: { type: "string" } },
      ["dql_query"],
    ),
    annotations: readOnly,
  },
];

export function createMcpRouter(options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? {};
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let nextRequestId = 1;

  if (typeof fetchImpl !== "function") {
    throw new Error("Node.js 18 or newer is required because fetch is unavailable.");
  }

  return async function route(request) {
    if (!isRecord(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      return rpcError(request?.id ?? null, -32600, "Invalid JSON-RPC request.");
    }

    switch (request.method) {
      case "initialize":
        return rpcResult(request.id, {
          protocolVersion:
            request.params?.protocolVersion ?? MCP_PROTOCOL_VERSION,
          serverInfo: { name: "obsidian-vaults", version: SERVER_VERSION },
          capabilities: { tools: { listChanged: false } },
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return rpcResult(request.id, {});
      case "tools/list":
        return rpcResult(request.id, { tools: TOOL_DEFINITIONS });
      case "tools/call":
        return handleToolCall(request.id, request.params);
      default:
        return request.id === undefined
          ? null
          : rpcError(request.id, -32601, `Method not found: ${request.method}`);
    }
  };

  async function handleToolCall(id, params) {
    try {
      if (!isRecord(params) || typeof params.name !== "string") {
        throw new Error("tools/call requires a tool name.");
      }
      const args = isRecord(params.arguments) ? { ...params.arguments } : {};
      const vaults = await discoverVaults({ env, config, fetchImpl });

      if (params.name === "list_vaults") {
        return rpcResult(id, toolResult({ vaults }));
      }

      if (!TOOL_DEFINITIONS.some((tool) => tool.name === params.name)) {
        throw new Error(`Unknown tool: ${params.name}`);
      }

      const selector = typeof args.vault === "string" ? args.vault : undefined;
      delete args.vault;
      const vault = selectVault(vaults, selector);
      const response = await callVault(
        vault,
        {
          jsonrpc: "2.0",
          id: nextRequestId++,
          method: "tools/call",
          params: { name: params.name, arguments: args },
        },
        { env, config, fetchImpl },
      );

      if (isRecord(response.error)) {
        throw new Error(String(response.error.message ?? "The Obsidian bridge returned an error."));
      }

      const result = isRecord(response.result) ? response.result : {};
      const structured = isRecord(result.structuredContent)
        ? { ...result.structuredContent, _vault: publicVault(vault) }
        : { _vault: publicVault(vault) };

      return rpcResult(id, {
        ...result,
        structuredContent: structured,
      });
    } catch (error) {
      return rpcResult(id, toolError(errorMessage(error)));
    }
  }
}

export async function discoverVaults(options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? {};
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = parseInteger(
    env.OBSIDIAN_VAULT_DISCOVERY_TIMEOUT_MS ?? config.discoveryTimeoutMs,
    DEFAULT_DISCOVERY_TIMEOUT_MS,
    "OBSIDIAN_VAULT_DISCOVERY_TIMEOUT_MS",
  );
  const ports = readPorts(env, config);
  const discovered = await Promise.all(
    ports.map(async (port) => {
      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          `http://127.0.0.1:${port}/health`,
          { method: "GET" },
          timeoutMs,
        );
        if (!response.ok) return null;
        const health = await response.json();
        if (!isRecord(health) || health.status !== "ok" || !isRecord(health.vault)) {
          return null;
        }
        const name = health.vault.name;
        if (typeof name !== "string" || name.trim() === "") return null;
        return {
          id:
            typeof health.vault.id === "string" && health.vault.id.length > 0
              ? health.vault.id
              : `${name}@${port}`,
          name,
          port,
          server: typeof health.server === "string" ? health.server : "vault-toolkit",
          version: typeof health.version === "string" ? health.version : undefined,
          authentication:
            typeof health.authentication === "string"
              ? health.authentication
              : undefined,
        };
      } catch {
        return null;
      }
    }),
  );

  return discovered
    .filter((vault) => vault !== null)
    .sort((left, right) => left.port - right.port);
}

export function selectVault(vaults, selector) {
  if (vaults.length === 0) {
    throw new Error(
      "No Obsidian vault bridge was found. Open Obsidian and enable Vault Toolkit in the target vault.",
    );
  }

  if (typeof selector !== "string" || selector.trim() === "") {
    if (vaults.length === 1) return vaults[0];
    throw new Error(
      `Multiple Obsidian vaults are open (${vaults.map((vault) => vault.name).join(", ")}). Pass the vault name returned by list_vaults.`,
    );
  }

  const normalized = selector.trim().toLocaleLowerCase();
  const matches = vaults.filter(
    (vault) =>
      vault.name.toLocaleLowerCase() === normalized ||
      vault.id.toLocaleLowerCase() === normalized ||
      String(vault.port) === normalized,
  );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Vault selector "${selector}" matches more than one open vault. Use its id or port from list_vaults.`,
    );
  }
  throw new Error(
    `Vault "${selector}" is not open. Available vaults: ${vaults.map((vault) => `${vault.name} (${vault.port})`).join(", ")}.`,
  );
}

async function callVault(vault, payload, options) {
  const token = tokenForVault(vault, options.env, options.config);
  const headers = { "Content-Type": "application/json" };
  if (token !== "") headers.Authorization = `Bearer ${token}`;

  const response = await fetchWithTimeout(
    options.fetchImpl,
    `http://127.0.0.1:${vault.port}/mcp`,
    { method: "POST", headers, body: JSON.stringify(payload) },
    60_000,
  );
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        `Vault "${vault.name}" requires a bearer token. Run npm run configure -- --vault "${vault.name}" --from-obsidian /path/to/vault/.obsidian/plugins/vault-toolkit/data.json, or set OBSIDIAN_VAULT_TOKEN(S).`,
      );
    }
    throw new Error(`Vault "${vault.name}" returned HTTP ${response.status}.`);
  }
  return response.json();
}

function tokenForVault(vault, env, config) {
  const configuredTokens = isRecord(config.tokens) ? config.tokens : {};
  const environmentTokens = readEnvironmentTokens(env.OBSIDIAN_VAULT_TOKENS);
  const keys = [vault.id, vault.name, String(vault.port)];

  for (const tokens of [environmentTokens, configuredTokens]) {
    for (const key of keys) {
      if (typeof tokens[key] === "string") return tokens[key];
    }
  }

  return typeof env.OBSIDIAN_VAULT_TOKEN === "string"
    ? env.OBSIDIAN_VAULT_TOKEN
    : typeof config.token === "string"
      ? config.token
      : "";
}

function readEnvironmentTokens(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const tokens = JSON.parse(raw);
    if (!isRecord(tokens)) throw new Error();
    return tokens;
  } catch {
    throw new Error("OBSIDIAN_VAULT_TOKENS must be a JSON object.");
  }
}

function readPorts(env, config) {
  if (typeof env.OBSIDIAN_VAULT_PORTS === "string" && env.OBSIDIAN_VAULT_PORTS.trim() !== "") {
    const ports = [...new Set(env.OBSIDIAN_VAULT_PORTS.split(",").map((value) => parsePort(value.trim(), "OBSIDIAN_VAULT_PORTS")))];
    return ports.sort((left, right) => left - right);
  }

  const start = parsePort(
    env.OBSIDIAN_VAULT_PORT_START ?? config.portStart ?? String(DEFAULT_PORT_START),
    "OBSIDIAN_VAULT_PORT_START",
  );
  const end = parsePort(
    env.OBSIDIAN_VAULT_PORT_END ?? config.portEnd ?? String(DEFAULT_PORT_END),
    "OBSIDIAN_VAULT_PORT_END",
  );
  if (end < start) {
    throw new Error("OBSIDIAN_VAULT_PORT_END must be greater than or equal to the start port.");
  }
  if (end - start > 1000) {
    throw new Error("The Obsidian vault discovery range may contain at most 1001 ports.");
  }

  const range = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  const configuredPorts = Array.isArray(config.ports)
    ? config.ports.map((value) => parsePort(value, "config.ports"))
    : [];

  return [...new Set([...range, ...configuredPorts])].sort((left, right) => left - right);
}

function parsePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} contains an invalid TCP port: ${value}.`);
  }
  return port;
}

function parseInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return number;
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function toolResult(structuredContent) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: false,
  };
}

function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function publicVault(vault) {
  return {
    id: vault.id,
    name: vault.name,
    port: vault.port,
    server: vault.server,
    ...(vault.version === undefined ? {} : { version: vault.version }),
    ...(vault.authentication === undefined
      ? {}
      : { authentication: vault.authentication }),
  };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
