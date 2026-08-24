# Obsidian Vaults for ChatGPT and Codex

Use ChatGPT or Codex with every Obsidian vault currently open on your computer. The plugin discovers local Vault Toolkit bridges, asks which vault to use when several are open, and exposes the complete Vault Toolkit 0.3 MCP API.

## What it can do

- Discover all open Obsidian vaults, including `Games`, `research_results`, and other vaults.
- Read the active note or any note by path.
- Search paths and full note contents with text or regular expressions.
- Inspect vault metadata, tags, and frontmatter.
- Create, append, patch, or replace notes.
- Set or remove individual frontmatter properties.
- Follow backlinks and outgoing links, or explore a bounded note graph.
- Rename or move notes while Obsidian updates wikilinks.
- Create notes from templates and atomically write batches of notes.
- Run Dataview DQL queries when Dataview is installed in the selected vault.

The Obsidian bridge itself stays on `127.0.0.1`. No Obsidian account or Obsidian Sync subscription is required.

## Prerequisite: the Obsidian-side plugin

Install and enable [Vault Toolkit 0.3.0 or newer](https://github.com/pavel-litvinov/obsidian_chat_gpt_plugin) in every vault that ChatGPT should access. Open those vaults in Obsidian and leave their local MCP bridges enabled.

By default, this plugin discovers bridges on ports `8766` through `8786`, matching Vault Toolkit's port selection behavior.
`list_vaults` reports each bridge version so ChatGPT can identify vaults that still need the 0.3 update.

## Configure bearer-token access

Vault Toolkit can protect each vault with a different bearer token. Obsidian Vaults stores those tokens in a local owner-readable configuration file; it never adds them to this repository or prints them.

Run this once for each protected vault:

```sh
cd plugins/obsidian-vaults
npm run configure -- \
  --vault Games \
  --from-obsidian "/path/to/Games/.obsidian/plugins/vault-toolkit/data.json"
```

The default configuration path is `~/.config/obsidian-vaults/config.json` on macOS/Linux and the corresponding application-data directory on Windows. Set `OBSIDIAN_VAULT_CONFIG` to use another path. The configurator also records the vault's preferred bridge port.

## Use with Codex

Using the Codex CLI:

```sh
codex plugin marketplace add pavel-litvinov/chat_gpt_obsidian_plugin
codex plugin add obsidian-vaults@pavel-litvinov
```

Then start a new Codex task so the plugin and its tools are loaded.

For local development, add the checked-out repository instead:

```sh
codex plugin marketplace add /absolute/path/to/chat_gpt_obsidian_plugin
codex plugin add obsidian-vaults@pavel-litvinov
```

Example prompts:

- “Show my open Obsidian vaults.”
- “Read the active note in Games.”
- “Find notes containing `dragon` and tagged `#idea` in Games.”
- “Show backlinks and outgoing links for `Campaign/Dragon.md`.”
- “Create `Sessions/Next.md` from `Templates/Session.md`.”
- “Run the Dataview query `LIST FROM #quest` in Games.”
- “Add a `status: planned` frontmatter property to Games/Backlog.md.”

## Use with ChatGPT

ChatGPT cannot call a bundled local `.mcp.json` process directly. For a private local Obsidian bridge, use [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and register a developer-mode app:

1. Enable Developer mode in ChatGPT under Settings → Security and login.
2. Create an MCP tunnel in [OpenAI Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels), associate it with the ChatGPT workspace, and create a runtime API key.
3. Download the latest [`tunnel-client`](https://github.com/openai/tunnel-client/releases/latest), put it on `PATH`, and start a managed runtime from this plugin directory. Store the runtime key in a file readable only by your user; the file is outside the repository:

   ```sh
   mkdir -p ~/.config/tunnel-client
   chmod 700 ~/.config/tunnel-client
   # Save the runtime key to ~/.config/tunnel-client/obsidian-vaults.key, then:
   chmod 600 ~/.config/tunnel-client/obsidian-vaults.key
   npm run tunnel:connect -- \
     --tunnel-id tunnel_... \
     --api-key-ref file:$HOME/.config/tunnel-client/obsidian-vaults.key
   npm run tunnel:status
   npm run tunnel:doctor
   ```

   To run in the foreground instead, initialize and run a profile:

   ```sh
   export CONTROL_PLANE_API_KEY="sk-..."
   npm run tunnel:init -- --tunnel-id tunnel_...
   npm run tunnel:run
   ```

4. While the tunnel client is running, open [ChatGPT Plugins](https://chatgpt.com/admin/apps), create a developer-mode app, choose **Tunnel** as the connection, and select the tunnel.
5. This repository's `.app.json` references the private `Obsidian Vaults` developer app registered for the maintainer's ChatGPT workspace. When using a different ChatGPT workspace, create its developer app and replace the `plugin_asdk_app...` ID before reinstalling the plugin.

`npm run tunnel:command` prints the exact stdio command used by the tunnel profile. `OBSIDIAN_VAULT_TUNNEL_API_KEY_REF` can set the default `env:VARIABLE` or `file:/absolute/path` reference. The runtime API key belongs only in an owner-readable file, environment variable, or secure service manager—never in Git.

Secure Tunnel is intended for private access and developer testing. It does not make this local bridge eligible for universal public plugin submission; public submission requires a stable public HTTPS MCP endpoint. The GitHub marketplace can still distribute the plugin code to your other computers, but each computer must install Vault Toolkit, configure its local tokens, and run a tunnel client.

## Configuration

The local JSON configuration is recommended for bearer tokens. Environment variables override it:

Ports recorded by the configurator are added to the normal discovery range; they do not disable
discovery of other open vaults. Set `OBSIDIAN_VAULT_PORTS` only when discovery must be restricted
to an exact list of ports.

| Variable | Purpose |
| --- | --- |
| `OBSIDIAN_VAULT_PORTS` | Comma-separated list of exact bridge ports. |
| `OBSIDIAN_VAULT_PORT_START` / `OBSIDIAN_VAULT_PORT_END` | Override the discovery range. |
| `OBSIDIAN_VAULT_TOKEN` | One bearer token shared by the open vaults. |
| `OBSIDIAN_VAULT_TOKENS` | JSON map keyed by vault name, id, or port for per-vault tokens. |
| `OBSIDIAN_VAULT_DISCOVERY_TIMEOUT_MS` | Timeout for each local health check; default is 400 ms. |
| `OBSIDIAN_VAULT_CONFIG` | Override the local JSON configuration path. |

## Development

The MCP server uses only Node.js built-ins and needs Node.js 18 or newer.

```sh
cd plugins/obsidian-vaults
npm run check
```

## Privacy and permissions

The plugin can enumerate, read, and write notes only in vaults where Vault Toolkit is installed and running. Its MCP client probes and calls only loopback addresses (`127.0.0.1`). When ChatGPT uses Secure Tunnel, `tunnel-client` makes an outbound HTTPS connection to OpenAI and forwards MCP requests to the local client; no inbound port is opened.

## License

MIT
