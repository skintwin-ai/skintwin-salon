#!/usr/bin/env node
// Salon location transfers for finished-goods distribution.

import { readFileSync } from "node:fs";

const request = JSON.parse(readFileSync(0, "utf8"));
const args = request.args || {};

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} is required`);
  return value.trim();
}

function positive(value, label) {
  if (!Number.isInteger(value) || value < 1) fail(`${label} must be a positive integer`);
  return value;
}

if (request.command !== "transfer") fail(`unknown command ${request.command}`);

const source = text(args.source, "source");
const destination = text(args.destination, "destination");
if (source === destination) fail("transfer source and destination must differ");

process.stdout.write(JSON.stringify({
  ok: true,
  artifact: {
    transfer_id: text(args.transfer_id, "transfer_id"),
    sku_id: text(args.sku_id, "sku_id"),
    batch_id: text(args.batch_id, "batch_id"),
    source,
    destination,
    milligrams: positive(args.milligrams, "milligrams"),
  },
}));
