#!/usr/bin/env node
// Salon distribution commands for the local salon API and the hub ledger.

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let chainLocate;

export function loadChainLocate() {
  if (chainLocate !== undefined) return chainLocate;
  const require = createRequire(import.meta.url);
  const candidates = [];
  if (process.env.SKINTWIN_HUB_ROOT) {
    candidates.push(join(process.env.SKINTWIN_HUB_ROOT, "domain", "locate.cjs"));
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) {
      candidates.push(join(dirname(dir), "skintwin-ecosystem-design", "domain", "locate.cjs"));
      break;
    }
    dir = dirname(dir);
  }
  const script = candidates.find((path) => existsSync(path));
  chainLocate = script ? require(script) : null;
  return chainLocate;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function positive(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

export function transfer(args) {
  const source = text(args.source, "source");
  const destination = text(args.destination, "destination");
  if (source === destination) throw new Error("transfer source and destination must differ");
  return {
    transfer_id: text(args.transfer_id, "transfer_id"),
    sku_id: text(args.sku_id, "sku_id"),
    batch_id: text(args.batch_id, "batch_id"),
    source,
    destination,
    milligrams: positive(args.milligrams, "milligrams"),
  };
}

export function deliveriesForAppointment(appointmentId, services) {
  const id = text(appointmentId, "appointment id");
  if (!Array.isArray(services)) throw new Error("services are required");
  const commands = [];
  services.forEach((service, index) => {
    const delivery = service?.delivery;
    if (!delivery) return;
    const args = {
      transfer_id: `${id}:${index}`,
      sku_id: delivery.sku_id,
      batch_id: delivery.batch_id,
      source: delivery.source,
      destination: delivery.destination,
      milligrams: delivery.milligrams,
    };
    transfer(args);
    commands.push({ command: "transfer", args });
  });
  return commands;
}

export function useSharedLedger() {
  const locate = loadChainLocate();
  if (!locate) return false;
  return Boolean(locate.bindLedger());
}

export function recordDeliveries(appointmentId, services) {
  let commands;
  try {
    commands = deliveriesForAppointment(appointmentId, services);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  for (const command of commands) {
    const accepted = handleStage(command);
    if (!accepted.ok) return accepted;
  }
  return { ok: true, count: commands.length };
}

export function handleStage(request) {
  if (request?.command !== "transfer") {
    return { ok: false, error: `unknown command ${request?.command}` };
  }
  try {
    return commitStage(request, { ok: true, artifact: transfer(request.args || {}) });
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function commitStage(request, result) {
  if (!result.ok || process.env.SKINTWIN_CHAIN_SKIP_DISPATCH === "1") return result;
  const ledger = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!ledger) return result;
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const committed = locate.commitCommand(request);
  return committed.ok ? result : committed;
}

export function salonSupplyChainResponse(method, pathname, body) {
  if (pathname !== "/api/supply-chain" || method !== "POST") return null;
  const result = handleStage(body);
  return { status: result.ok ? 200 : 400, body: result };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
