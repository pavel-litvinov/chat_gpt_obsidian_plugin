import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import { createMcpRouter, discoverVaults, selectVault, TOOL_DEFINITIONS } from "../server/lib.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise((resolve) => server.close(resolve)),
    ),
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
  assert.equal(mock.calls.length, 0);
});

test("advertises a vault selector on every forwarded tool", () => {
  const forwarded = TOOL_DEFINITIONS.filter((tool) => tool.name !== "list_vaults");
  assert.equal(forwarded.length, 11);
  for (const tool of forwarded) {
    assert.equal(tool.inputSchema.properties.vault.type, "string");
  }
});

test("selectVault accepts names, ids, and ports", () => {
  const vault = { id: "Games@8766", name: "Games", port: 8766 };
  assert.equal(selectVault([vault], "games"), vault);
  assert.equal(selectVault([vault], "Games@8766"), vault);
  assert.equal(selectVault([vault], "8766"), vault);
});

async function startVault(name) {
  const calls = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, {
        status: "ok",
        vault: { id: `${name}@test`, name },
        server: "vault-toolkit-bridge",
      });
      return;
    }
    if (request.method === "POST" && request.url === "/mcp") {
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
