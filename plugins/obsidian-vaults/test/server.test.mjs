import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { loadUserConfig, saveUserConfig } from "../server/config.mjs";
import { createMcpRouter, discoverVaults, selectVault, TOOL_DEFINITIONS } from "../server/lib.mjs";

const servers = [];
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise((resolve) => server.close(resolve)),
    ),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("discovers a local Obsidian vault and routes a read call", async () => {
  const mock = await startVault("Games");
  const env = { OBSIDIAN_VAULT_PORTS: String(mock.port) };
  const vaults = await discoverVaults({ env });
  assert.deepEqual(vaults.map(({ name, port }) => ({ name, port })), [
    { name: "Games", port: mock.port },
  ]);

  const route = createMcpRouter({ env });
  const response = await route({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "read_active_note", arguments: {} },
  });

  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.path, "Inbox.md");
  assert.equal(response.result.structuredContent._vault.name, "Games");
  assert.equal(mock.calls[0].params.name, "read_active_note");
});

test("requires an explicit vault when more than one is open", async () => {
  const games = await startVault("Games");
  const research = await startVault("research_results");
  const env = { OBSIDIAN_VAULT_PORTS: `${games.port},${research.port}` };
  const route = createMcpRouter({ env });

  const ambiguous = await route({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "list_notes", arguments: {} },
  });
  assert.equal(ambiguous.result.isError, true);
  assert.match(ambiguous.result.content[0].text, /Multiple Obsidian vaults are open/);

  const selected = await route({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_notes", arguments: { vault: "research_results" } },
  });
  assert.equal(selected.result.isError, false);
  assert.equal(selected.result.structuredContent._vault.name, "research_results");
  assert.equal(research.calls.length, 1);
  assert.equal(games.calls.length, 0);
});

test("lists vaults without forwarding a tool call", async () => {
  const mock = await startVault("Games");
  const route = createMcpRouter({
    env: { OBSIDIAN_VAULT_PORTS: String(mock.port) },
  });
  const response = await route({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "list_vaults", arguments: {} },
  });
  assert.deepEqual(response.result.structuredContent.vaults[0].name, "Games");
  assert.equal(response.result.structuredContent.vaults[0].version, "0.3.1");
  assert.equal(response.result.structuredContent.vaults[0].authentication, "bearer");
  assert.equal(mock.calls.length, 0);
});

test("configured ports augment the default discovery range", async () => {
  const probedPorts = [];
  const fetchImpl = async (url) => {
    const port = Number(new URL(url).port);
    probedPorts.push(port);
    if (port !== 8767 && port !== 9000) return { ok: false };
    const name = port === 8767 ? "Research" : "Archive";
    return {
      ok: true,
      json: async () => ({
        status: "ok",
        vault: { id: `${name}@${port}`, name },
        server: "vault-toolkit-bridge",
      }),
    };
  };

  const vaults = await discoverVaults({ config: { ports: [9000] }, fetchImpl });

  assert.deepEqual(vaults.map(({ name, port }) => ({ name, port })), [
    { name: "Research", port: 8767 },
    { name: "Archive", port: 9000 },
  ]);
  assert.deepEqual(probedPorts, [
    ...Array.from({ length: 21 }, (_, offset) => 8766 + offset),
    9000,
  ]);
});

test("advertises a vault selector on every forwarded tool", () => {
  const forwarded = TOOL_DEFINITIONS.filter((tool) => tool.name !== "list_vaults");
  assert.deepEqual(
    forwarded.map((tool) => tool.name),
    [
      "read_note",
      "read_active_note",
      "search_notes",
      "get_backlinks",
      "get_outgoing_links",
      "get_graph_neighbors",
      "list_notes",
      "get_note_metadata",
      "get_vault_metadata",
      "create_note",
      "update_note",
      "append_to_note",
      "patch_note",
      "update_frontmatter",
      "rename_note",
      "batch_write",
      "create_from_template",
      "query_dataview",
    ],
  );
  for (const tool of forwarded) {
    assert.equal(tool.inputSchema.properties.vault.type, "string");
  }
});

test("matches the expanded Vault Toolkit 0.3 tool schemas", () => {
  const search = TOOL_DEFINITIONS.find((tool) => tool.name === "search_notes");
  assert.equal(search.inputSchema.properties.regex.type, "string");
  assert.equal(search.inputSchema.properties.case_sensitive.type, "boolean");

  const graph = TOOL_DEFINITIONS.find((tool) => tool.name === "get_graph_neighbors");
  assert.equal(graph.inputSchema.properties.depth.maximum, 10);

  const batch = TOOL_DEFINITIONS.find((tool) => tool.name === "batch_write");
  assert.equal(batch.inputSchema.properties.operations.maxItems, 100);
  assert.deepEqual(batch.inputSchema.properties.operations.items.properties.type.enum, [
    "create",
    "update",
  ]);
});

test("forwards expanded tool arguments without the vault selector", async () => {
  const mock = await startVault("Games");
  const route = createMcpRouter({
    env: { OBSIDIAN_VAULT_PORTS: String(mock.port) },
  });
  const operations = [
    { type: "create", path: "Campaign/NPC.md", content: "# NPC" },
  ];

  const response = await route({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "batch_write",
      arguments: { vault: "Games", operations },
    },
  });

  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent._vault.name, "Games");
  assert.deepEqual(mock.calls[0].params, {
    name: "batch_write",
    arguments: { operations },
  });
});

test("selectVault accepts names, ids, and ports", () => {
  const vault = { id: "Games@8766", name: "Games", port: 8766 };
  assert.equal(selectVault([vault], "games"), vault);
  assert.equal(selectVault([vault], "Games@8766"), vault);
  assert.equal(selectVault([vault], "8766"), vault);
});

test("uses a bearer token from the local per-vault config", async () => {
  const mock = await startVault("Games", { token: "local-secret" });
  const route = createMcpRouter({
    env: { OBSIDIAN_VAULT_PORTS: String(mock.port) },
    config: { tokens: { Games: "local-secret" } },
  });
  const response = await route({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "list_notes", arguments: { vault: "Games" } },
  });

  assert.equal(response.result.isError, false);
  assert.equal(mock.calls.length, 1);
});

test("environment bearer tokens override the local config", async () => {
  const mock = await startVault("Games", { token: "environment-secret" });
  const route = createMcpRouter({
    env: {
      OBSIDIAN_VAULT_PORTS: String(mock.port),
      OBSIDIAN_VAULT_TOKENS: JSON.stringify({ Games: "environment-secret" }),
    },
    config: { tokens: { Games: "wrong-secret" } },
  });
  const response = await route({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "list_notes", arguments: { vault: "Games" } },
  });

  assert.equal(response.result.isError, false);
});

test("saves local configuration with owner-only permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "obsidian-vaults-test-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "nested", "config.json");

  await saveUserConfig(
    { tokens: { Games: "secret" }, ports: [8767, 8766, 8766] },
    { path },
  );
  const loaded = await loadUserConfig({ path });

  assert.deepEqual(loaded.config, {
    tokens: { Games: "secret" },
    ports: [8766, 8767],
  });
  if (process.platform !== "win32") {
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  }
});

async function startVault(name, options = {}) {
  const calls = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, {
        status: "ok",
        vault: { id: `${name}@test`, name },
        server: "vault-toolkit-bridge",
        version: options.version ?? "0.3.1",
        authentication: "bearer",
      });
      return;
    }
    if (request.method === "POST" && request.url === "/mcp") {
      if (
        typeof options.token === "string" &&
        request.headers.authorization !== `Bearer ${options.token}`
      ) {
        response.writeHead(401).end();
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const call = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      calls.push(call);
      writeJson(response, {
        jsonrpc: "2.0",
        id: call.id,
        result: {
          content: [{ type: "text", text: "mock result" }],
          structuredContent:
            call.params.name === "read_active_note"
              ? { path: "Inbox.md", content: "Hello" }
              : { notes: [] },
          isError: false,
        },
      });
      return;
    }
    response.writeHead(404).end();
  });
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, port: server.address().port, calls };
}

function writeJson(response, value) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}
