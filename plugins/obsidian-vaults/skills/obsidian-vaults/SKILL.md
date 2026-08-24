---
name: obsidian-vaults
description: Work with one or more local Obsidian vaults through Vault Toolkit. Use for note discovery and full-text search, links and graph navigation, tags/frontmatter/metadata, templates and Dataview, or focused and batch note updates.
---

# Obsidian Vaults

Use the `obsidian_vaults` MCP tools to work with Obsidian notes stored on this computer.

## Choose the vault

1. Call `list_vaults` when the user has not named a vault or when more than one vault may be open.
2. Use the exact `name`, `id`, or `port` returned by `list_vaults` as the `vault` argument.
3. If only one vault is open, the tools can select it automatically.
4. Never silently substitute a different vault when the requested vault is unavailable.
5. The expanded search, graph, rename, batch, template, and Dataview tools require Vault Toolkit 0.3.0 or newer. When `list_vaults` reports an older bridge version, tell the user to update Vault Toolkit in that vault before using those tools.

If no vault is found, tell the user to open Obsidian and enable the Vault Toolkit community plugin in that vault.
If a vault is listed but a note call reports that a bearer token is required, explain that the local Obsidian Vaults configuration must be synchronized from that vault's Vault Toolkit settings. Do not ask the user to paste the token into chat.

## Read and search

- Use `read_active_note` when the user refers to the note currently shown in Obsidian.
- Use `search_notes` for path or full-content text, tags, and frontmatter filters. Use `regex` only when pattern matching is useful, and set `case_sensitive` only when case matters.
- Use `list_notes` only when enumeration is genuinely needed; prefer a targeted search.
- Use `get_note_metadata` or `get_vault_metadata` when content is unnecessary.

## Navigate links and data

- Use `get_backlinks` or `get_outgoing_links` for one-hop relationships around a note.
- Use `get_graph_neighbors` only when the user needs both directions or traversal beyond one hop; keep `depth` as small as the task permits.
- Use `query_dataview` for a requested DQL query or when Dataview is the clearest way to produce a structured cross-note result. If Vault Toolkit reports that Dataview is unavailable, explain that the Dataview community plugin must be installed and enabled in that vault.

## Write safely

- Keep every write within the vault the user selected.
- Use `patch_note` for a focused edit whenever an exact unique passage is available.
- Use `append_to_note` for additive work.
- Use `update_frontmatter` for one metadata property at a time.
- Use `rename_note` for a move or rename so Obsidian can update wikilinks across the vault.
- Use `create_from_template` when the user names an existing template or asks to create a note from one. Pass custom placeholder values through `variables`.
- Use `batch_write` for related multi-note creates or full-content updates that should succeed or roll back together. Before including an existing note in a batch update, read it and preserve unrelated content unless the user supplied the complete replacement.
- Use `update_note` only when the user clearly wants the whole note replaced.
- Before a broad replacement, read the current note and preserve unrelated content.
- Do not create a second note when `create_note` reports that the path already exists; read it and ask or choose a focused update consistent with the request.

## Privacy

The MCP client connects to Vault Toolkit only over `127.0.0.1`. In ChatGPT, a Secure MCP Tunnel may carry MCP requests between OpenAI and this local client without exposing an inbound port. Note content is handled through the active ChatGPT/Codex conversation. Do not claim that an Obsidian account or Obsidian Sync is required.
