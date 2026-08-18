# Obsidian Vaults for ChatGPT and Codex

Use ChatGPT or Codex with every Obsidian vault currently open on your computer. The plugin discovers local Vault Toolkit bridges, asks which vault to use when several are open, and exposes focused tools for notes and metadata.

## What it can do

- Discover all open Obsidian vaults, including `Games`, `research_results`, and other vaults.
- Read the active note or any note by path.
- Search and list notes.
- Inspect vault metadata, tags, and frontmatter.
- Create, append, patch, or replace notes.
- Set or remove individual frontmatter properties.

All bridge traffic stays on `127.0.0.1`. No Obsidian account or Obsidian Sync subscription is required.

## Prerequisite: the Obsidian-side plugin

Install and enable [Vault Toolkit](https://github.com/pavel-litvinov/obsidian_chat_gpt_plugin) in every vault that ChatGPT should access. Open those vaults in Obsidian and leave their local MCP bridges enabled.

By default, this plugin discovers bridges on ports `8766` through `8786`, matching Vault Toolkit's port selection behavior.

## Install from this GitHub marketplace

Using the Codex CLI:

```sh
codex plugin marketplace add pavel-litvinov/chat_gpt_obsidian_plugin
codex plugin add obsidian-vaults@pavel-litvinov
```

Then start a new ChatGPT/Codex desktop task so the plugin and its tools are loaded.

For local development, add the checked-out repository instead:

```sh
codex plugin marketplace add /absolute/path/to/chat_gpt_obsidian_plugin
codex plugin add obsidian-vaults@pavel-litvinov
```

Example prompts:

- “Show my open Obsidian vaults.”
- “Read the active note in Games.”
- “Find notes tagged `#idea` in research_results.”
- “Add a `status: planned` frontmatter property to Games/Backlog.md.”

## ChatGPT web limitation

This repository is a local desktop plugin because the Obsidian bridge intentionally listens only on your computer. ChatGPT in a web browser cannot directly connect to `127.0.0.1`. A future public web app would need a separately hosted HTTPS MCP service and an explicit secure connection back to the computer running Obsidian.

## Configuration

The defaults require no configuration. Advanced users may pass these environment variables to the MCP server:

| Variable | Purpose |
| --- | --- |
| `OBSIDIAN_VAULT_PORTS` | Comma-separated list of exact bridge ports. |
| `OBSIDIAN_VAULT_PORT_START` / `OBSIDIAN_VAULT_PORT_END` | Override the discovery range. |
| `OBSIDIAN_VAULT_TOKEN` | One bearer token shared by the open vaults. |
| `OBSIDIAN_VAULT_TOKENS` | JSON map keyed by vault name, id, or port for per-vault tokens. |
| `OBSIDIAN_VAULT_DISCOVERY_TIMEOUT_MS` | Timeout for each local health check; default is 400 ms. |

## Development

The MCP server uses only Node.js built-ins and needs Node.js 18 or newer.

```sh
cd plugins/obsidian-vaults
npm run check
```

## Privacy and permissions

The plugin can enumerate, read, and write notes only in vaults where Vault Toolkit is installed and running. Vault Toolkit may be protected with a bearer token. The client makes no external network request: it probes and calls only loopback addresses (`127.0.0.1`).

## License

MIT
