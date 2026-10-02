import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordDeliveries, salonSupplyChainResponse } from "./chain_stage.mjs";

test("salon api accepts a stock transfer", () => {
  const result = salonSupplyChainResponse("POST", "/api/supply-chain", {
    command: "transfer",
    args: {
      transfer_id: "xfer-1",
      sku_id: "sku-serum-c",
      batch_id: "batch-1",
      source: "plant",
      destination: "cape-town",
      milligrams: 500,
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.artifact.destination, "cape-town");
});

test("a service appointment does not move stock", () => {
  const result = recordDeliveries("apt-1", [{ id: "srv-001", name: "Signature Facial" }]);
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});

test("a delivery without a batch is not an appointment", () => {
  const result = recordDeliveries("apt-1", [{ delivery: { sku_id: "sku-serum-c" } }]);
  assert.equal(result.ok, false);
});

test("a delivery against an empty ledger is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-chain-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = "/agent/repos/skintwin-ecosystem-design";
  try {
    const result = recordDeliveries("apt-1", [
      {
        delivery: {
          sku_id: "sku-serum-c",
          batch_id: "batch-1",
          source: "plant",
          destination: "cape-town",
          milligrams: 500,
        },
      },
    ]);
    assert.equal(result.ok, false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("salon api rejects a transfer to the same location", () => {
  const result = salonSupplyChainResponse("POST", "/api/supply-chain", {
    command: "transfer",
    args: {
      transfer_id: "xfer-1",
      sku_id: "sku-serum-c",
      batch_id: "batch-1",
      source: "plant",
      destination: "plant",
      milligrams: 500,
    },
  });
  assert.equal(result.status, 400);
});
