import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliveriesAddedByUpdate, invoiceSettlementCommands, loadChainLocate, recordDeliveries, recordInvoiceSettlement, recordReplenishment, salonSupplyChainResponse } from "./chain_stage.mjs";

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
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
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
  }
});

test("an updated appointment moves only a delivery it did not already record", () => {
  const first = {
    delivery: {
      sku_id: "sku-cleanser",
      batch_id: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: 2000,
    },
  };
  const added = {
    delivery: {
      sku_id: "sku-cleanser",
      batch_id: "batch-cleanser",
      source: "plant",
      destination: "johannesburg",
      milligrams: 2000,
    },
  };
  const kept = deliveriesAddedByUpdate("apt-1", [first], [first, added]);
  assert.equal(kept[0].delivery, undefined);
  assert.equal(kept[1].delivery.destination, "johannesburg");
  assert.deepEqual(deliveriesAddedByUpdate("apt-1", [first, added], [first, added])[1].delivery, undefined);
  const dir = mkdtempSync(join(tmpdir(), "salon-update-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
    cwd: hub,
    input: JSON.stringify({
      commands: [
        { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
        { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
        { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 8000 } },
        { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 8000]] } },
        { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
        { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 8000]] } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  try {
    const created = recordDeliveries("apt-1", [first]);
    assert.equal(created.ok, true);
    assert.equal(created.count, 1);
    const updated = recordDeliveries("apt-1", deliveriesAddedByUpdate("apt-1", [first], [first, added]));
    assert.equal(updated.ok, true);
    assert.equal(updated.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("apt-1:0"), true);
    assert.equal(recorded.includes("apt-1:1"), true);
    assert.equal(recorded.split("apt-1:0").length - 1, 1);
    const again = recordDeliveries("apt-1", deliveriesAddedByUpdate("apt-1", [first, added], [first, added]));
    assert.equal(again.ok, true);
    assert.equal(again.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a repeated replenishment shipment does not move more stock", () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-replenish-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
    cwd: hub,
    input: JSON.stringify({
      commands: [
        { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
        { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
        { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
        { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
        { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
        { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
        { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        { command: "fulfill", args: { fulfillment_id: "order-1", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  try {
    const first = recordReplenishment("replenish-outlets");
    assert.equal(first.ok, true);
    assert.equal(first.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("replenish-outlets:0"), true);
    const again = recordReplenishment("replenish-outlets");
    assert.equal(again.ok, true);
    assert.equal(again.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a service invoice does not settle a fulfillment", () => {
  const commands = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }],
  });
  assert.equal(commands.length, 0);
  const skipped = recordInvoiceSettlement({
    id: "INV_LOCAL_1",
    line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }],
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
});

test("a paid invoice settles the fulfillment it names", () => {
  const commands = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.settlement_id, "pay-INV_LOCAL_1:0:order-1");
  assert.equal(commands[0].args.amount_cents, 250000);
  assert.equal(commands[0].args.currency, "NGN");
});

test("a paid invoice against an empty ledger writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-invoice-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const result = recordInvoiceSettlement({
      id: "INV_LOCAL_1",
      fulfillment_id: "order-1",
      amount_cents: 250000,
      currency: "NGN",
    });
    assert.equal(result.ok, false);
    assert.equal(existsSync(ledger), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a paid invoice appends one settlement for a recorded sale", () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-invoice-ok-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
    cwd: hub,
    input: JSON.stringify({
      commands: [
        { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
        { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
        { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
        { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
        { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
        { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
        { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        { command: "fulfill", args: { fulfillment_id: "order-1", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  try {
    const paid = recordInvoiceSettlement({
      id: "INV_LOCAL_1",
      currency: "NGN",
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("pay-INV_LOCAL_1:0:order-1"), true);
    const again = recordInvoiceSettlement({
      id: "INV_LOCAL_2",
      currency: "NGN",
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
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
