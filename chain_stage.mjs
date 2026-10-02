#!/usr/bin/env node
// Salon distribution commands for the local salon API and the hub ledger.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let chainLocate;

function recordedHub(directory, fileName) {
  const domain = join(directory, "domain");
  const script = join(domain, fileName);
  const registryPath = join(domain, "org-ecosystem.json");
  if (!existsSync(registryPath) || !existsSync(join(domain, "supply-chain.json")) || !existsSync(script)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    if (data?.hub?.name !== basename(directory)) return null;
  } catch {
    return null;
  }
  return script;
}

export function loadChainLocate() {
  if (chainLocate !== undefined) return chainLocate;
  const require = createRequire(import.meta.url);
  let script = null;
  if (process.env.SKINTWIN_HUB_ROOT) {
    script = recordedHub(process.env.SKINTWIN_HUB_ROOT, "locate.cjs");
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  while (script === null && dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) {
      try {
        for (const name of readdirSync(dirname(dir))) {
          script = recordedHub(join(dirname(dir), name), "locate.cjs");
          if (script) break;
        }
      } catch {
        script = null;
      }
      break;
    }
    dir = dirname(dir);
  }
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
  if (services && typeof services === "object" && !Array.isArray(services) && services.replenish === true) {
    return recordReplenishment(appointmentId);
  }
  let commands;
  try {
    commands = deliveriesForAppointment(appointmentId, services);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const committed = locate.commitCommands(commands);
  return committed.ok ? { ok: true, count: commands.length } : committed;
}

function named(value) {
  return typeof value === "string" ? value.trim() : "";
}

function minorUnits(value, label) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    if (Number.isInteger(cents) && cents >= 1) return cents;
  }
  throw new Error(`${label} must be a positive integer`);
}

function lineMinorUnits(line, index) {
  const unit = minorUnits(line?.amount_cents ?? line?.amount, `line ${index} amount`);
  const quantity = line?.quantity == null ? 1 : line.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer");
  }
  return unit * quantity;
}

export function invoiceSettlementCommands(invoice) {
  if (!invoice || typeof invoice !== "object") throw new Error("invoice is required");
  const lines = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const groups = new Map();
  lines.forEach((line, index) => {
    const fulfillmentId = named(line?.fulfillment_id);
    if (!fulfillmentId) return;
    groups.set(fulfillmentId, (groups.get(fulfillmentId) || 0) + lineMinorUnits(line, index));
  });
  if (groups.size === 0) {
    const fulfillmentId = named(invoice.fulfillment_id);
    if (!fulfillmentId) return [];
    const stated = invoice.amount_cents ?? invoice.amount;
    const cents =
      stated == null
        ? lines.reduce((sum, line, index) => sum + lineMinorUnits(line, index), 0)
        : minorUnits(stated, "amount_cents");
    if (!Number.isInteger(cents) || cents < 1) throw new Error("amount_cents must be a positive integer");
    groups.set(fulfillmentId, cents);
  }
  const currency = text(invoice.currency || "NGN", "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code");
  const invoiceId = text(invoice.id || invoice.offline_reference, "invoice id");
  const explicit = named(invoice.settlement_id);
  return [...groups.entries()].map(([fulfillmentId, amountCents], index) => ({
    command: "settle",
    args: {
      settlement_id:
        groups.size === 1 && explicit ? explicit : `pay-${invoiceId}:${index}:${fulfillmentId}`,
      fulfillment_id: fulfillmentId,
      amount_cents: amountCents,
      currency,
    },
  }));
}

export function recordInvoiceSettlement(invoice) {
  let commands;
  try {
    commands = invoiceSettlementCommands(invoice);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const committed = locate.commitCommands(commands);
  return committed.ok ? { ok: true, count: commands.length } : committed;
}

export function recordReplenishment(shipmentId) {
  let shipment;
  try {
    shipment = text(shipmentId, "shipment id");
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const hub = locate.hubRoot();
  const child = spawnSync("python3", ["-m", "domain.metagraph", "--replenish", shipment], {
    cwd: hub,
    encoding: "utf8",
  });
  let commands;
  try {
    commands = JSON.parse(child.stdout || "null");
  } catch {
    commands = null;
  }
  if (child.status !== 0 || !Array.isArray(commands)) {
    const message = commands && commands.error ? commands.error : child.stderr || "replenishment rejected";
    return { ok: false, error: message };
  }
  try {
    commands.forEach((command) => transfer(command.args || {}));
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  const committed = locate.commitCommands(commands);
  return committed.ok ? { ok: true, count: commands.length } : committed;
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
  if (body?.command === "replenish") {
    const result = recordReplenishment(body.args?.shipment_id);
    return { status: result.ok ? 200 : 400, body: result };
  }
  const result = handleStage(body);
  return { status: result.ok ? 200 : 400, body: result };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
