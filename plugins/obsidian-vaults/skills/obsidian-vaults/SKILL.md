---
name: obsidian-vaults
description: Work with one or more local Obsidian vaults through Vault Toolkit. Use when the user asks to discover vaults, read the active note, find or list notes, inspect tags/frontmatter/metadata, create notes, or make focused note updates.
---

# Obsidian Vaults

Use the `obsidian_vaults` MCP tools to work with Obsidian notes stored on this computer.

## Choose the vault

1. Call `list_vaults` when the user has not named a vault or when more than one vault may be open.
2. Use the exact `name`, `id`, or `port` returned by `list_vaults` as the `vault` argument.
3. If only one vault is open, the tools can select it automatically.
4. Never silently substitute a different vault when the requested vault is unavailable.

If no vault is found, tell the user to open Obsidian and enable the Vault Toolkit community plugin in that vault.

## Read and search

- Use `read_active_note` when the user refers to the note currently shown in Obsidian.
- Use `search_notes` for title/path fragments, tags, and frontmatter filters.
- Use `list_notes` only when enumeration is genuinely needed; prefer a targeted search.
- Use `get_note_metadata` or `get_vault_metadata` when content is unnecessary.

## Write safely

- Keep every write within the vault the user selected.
- Use `patch_note` for a focused edit whenever an exact unique passage is available.
- Use `append_to_note` for additive work.
- Use `update_frontmatter` for one metadata property at a time.
- Use `update_note` only when the user clearly wants the whole note replaced.
- Before a broad replacement, read the current note and preserve unrelated content.
- Do not create a second note when `create_note` reports that the path already exists; read it and ask or choose a focused update consistent with the request.

## Privacy

The MCP client connects only to `127.0.0.1`. Note content is handled through the local Obsidian bridge and the active ChatGPT/Codex conversation. Do not claim that an Obsidian account or Obsidian Sync is required.
