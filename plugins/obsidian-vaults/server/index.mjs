#!/usr/bin/env node
import { createInterface } from "node:readline";
import { createMcpRouter, errorMessage, rpcError } from "./lib.mjs";

const route = createMcpRouter();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of input) {
  if (line.trim() === "") continue;

  let response;
  try {
    const request = JSON.parse(line);
    response = await route(request);
  } catch (error) {
    response = rpcError(null, -32700, `Parse error: ${errorMessage(error)}`);
  }

  if (response !== null) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
