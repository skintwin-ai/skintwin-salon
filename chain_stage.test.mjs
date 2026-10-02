import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appointmentCancellationCommands, deliveriesAddedByUpdate, deliveriesForAppointment, invoiceSettlementCommands, loadChainLocate, recordAppointmentCancellation, recordDeliveries, recordInvoiceSettlement, recordReplenishment, salonSupplyChainResponse } from "./chain_stage.mjs";
import { handleSalonApi } from "./src/api/local-salon-rail.js";
import createInvoice from "./src/api/create_invoice.js";
import pushToTerminal from "./src/api/push_to_terminal.js";
import { getAppointment } from "./src/api/_store.js";
import { invoiceLineItem, terminalInvoicePayload } from "./src/utils/invoice-payload.mjs";
import { buildInvoicePayload } from "./src/utils/booking.js";

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

test("a delivery and invoice named by camel ids name that sale", () => {
  const commands = deliveriesForAppointment("apt-1", [
    { name: "Signature Facial" },
    {
      delivery: {
        skuId: "sku-cleanser",
        sku_id: "sku-other",
        batchId: "batch-cleanser",
        batch_id: "batch-other",
        source: "plant",
        destination: "cape-town",
        milligrams: 2000,
      },
    },
    {
      delivery: {
        skuId: "  ",
        sku_id: " sku-serum ",
        batchId: "  ",
        batch_id: " batch-serum ",
        source: "plant",
        destination: "johannesburg",
        milligrams: 1000,
      },
    },
  ]);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].args.sku_id, "sku-cleanser");
  assert.equal(commands[0].args.batch_id, "batch-cleanser");
  assert.equal(commands[1].args.sku_id, "sku-serum");
  assert.equal(commands[1].args.batch_id, "batch-serum");
  const settled = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    currency: "NGN",
    settlementId: "pay-camel",
    settlement_id: "pay-snake",
    line_items: [
      { name: "Signature Facial", amount: 850000, quantity: 1 },
      { fulfillmentId: "order-1", fulfillment_id: "order-other", amount: 250000, quantity: 1 },
      { fulfillmentId: "  ", fulfillment_id: " order-2 ", amount: 100000, quantity: 1 },
    ],
  });
  assert.equal(settled.length, 2);
  assert.equal(settled[0].args.fulfillment_id, "order-1");
  assert.equal(settled[0].args.settlement_id, "pay-INV_LOCAL_1:0:order-1");
  assert.equal(settled[1].args.fulfillment_id, "order-2");
  const single = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    currency: "NGN",
    fulfillmentId: "  ",
    fulfillment_id: " order-1 ",
    settlementId: " pay-camel ",
    amount_cents: 250000,
    line_items: [{ name: "Signature Facial", amount: 850000, quantity: 1 }],
  });
  assert.equal(single.length, 1);
  assert.equal(single[0].args.fulfillment_id, "order-1");
  assert.equal(single[0].args.settlement_id, "pay-camel");
});

test("a delivery named by skuId moves that batch once", () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-camel-"));
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
        { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        { command: "fulfill", args: { fulfillment_id: "order-1", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  const delivery = {
    skuId: "  ",
    sku_id: "sku-cleanser",
    batchId: "  ",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "johannesburg",
    milligrams: 2000,
  };
  try {
    const moved = recordDeliveries("apt-camel", [{ name: "Signature Facial" }, { delivery }]);
    assert.equal(moved.ok, true, moved.error);
    assert.equal(moved.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("apt-camel:1"), true);
    assert.equal(recorded.includes('"sku_id": "sku-cleanser"'), true);
    const overdraw = recordDeliveries("apt-camel", [{ name: "Signature Facial" }, { delivery: { ...delivery, milligrams: 8000 } }]);
    assert.equal(overdraw.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const paid = recordInvoiceSettlement({
      id: "INV_CAMEL",
      currency: "NGN",
      fulfillmentId: "  ",
      fulfillment_id: "order-1",
      amount_cents: 250000,
    });
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.count, 1);
    const settled = readFileSync(ledger, "utf8");
    assert.equal(settled.includes("pay-INV_CAMEL:0:order-1"), true);
    const again = recordInvoiceSettlement({
      id: "INV_CAMEL_2",
      currency: "NGN",
      fulfillmentId: "order-1",
      amount_cents: 250000,
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), settled);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
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

test("checkout forwards a named fulfillment and leaves a service line unsettled", () => {
  const service = invoiceLineItem({ name: "Signature Facial", price: 8500, quantity: 1 });
  assert.equal(service.fulfillment_id, undefined);
  assert.equal(invoiceSettlementCommands(terminalInvoicePayload({
    id: "INV_LOCAL_1",
    line_items: [service],
  })).length, 0);
  const product = invoiceLineItem({
    name: "Gentle cleanser",
    price: 2500,
    quantity: 1,
    fulfillmentId: "order-1",
  });
  const commands = invoiceSettlementCommands(terminalInvoicePayload({
    id: "INV_LOCAL_1",
    offline_reference: "OFF_INV_LOCAL_1",
    currency: "NGN",
    line_items: [product],
  }));
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.fulfillment_id, "order-1");
  assert.equal(commands[0].args.amount_cents, 250000);
  assert.equal(commands[0].args.currency, "NGN");
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

test("the local rail records a named delivery when an appointment is created or updated", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-rail-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const client = { consentAccepted: true };
  const facial = { id: "srv-001", name: "Signature Facial" };
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const added = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "johannesburg",
    milligrams: 2000,
  };
  const booking = {
    date: "2026-10-02",
    startTime: "10:00",
    providerId: "prv-001",
    client,
  };
  try {
    const serviceOnly = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      services: [facial],
    });
    assert.equal(serviceOnly.status, 201);
    assert.equal(existsSync(ledger), false);

    const rejected = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-empty",
      services: [{ delivery }],
    });
    assert.equal(rejected.status, 400);
    assert.equal(existsSync(ledger), false);
    assert.equal(getAppointment("apt-empty"), null);

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

    const created = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-rail",
      services: [{ delivery }],
    });
    assert.equal(created.status, 201);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.split("apt-rail:0").length - 1, 1);
    assert.equal(recorded.includes("apt-rail:1"), false);

    const repeated = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-rail",
      services: [{ delivery }],
    });
    assert.equal(repeated.status, 201);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-rail",
      services: [{ delivery: { ...delivery, destination: "johannesburg" } }],
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    assert.equal(getAppointment("apt-rail").services[0].delivery.destination, "cape-town");

    const updated = await handleSalonApi("POST", "/api/appointments/update", {
      id: "apt-rail",
      services: [{ delivery }, { delivery: added }],
    });
    assert.equal(updated.status, 200);
    const afterUpdate = readFileSync(ledger, "utf8");
    assert.equal(afterUpdate.split("apt-rail:0").length - 1, 1);
    assert.equal(afterUpdate.split("apt-rail:1").length - 1, 1);

    const again = await handleSalonApi("POST", "/api/appointments/update", {
      id: "apt-rail",
      services: [{ delivery }, { delivery: added }],
    });
    assert.equal(again.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), afterUpdate);

    const changedUpdate = await handleSalonApi("POST", "/api/appointments/update", {
      id: "apt-rail",
      services: [{ delivery: { ...delivery, destination: "durban" } }, { delivery: added }],
    });
    assert.equal(changedUpdate.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), afterUpdate);
    assert.equal(getAppointment("apt-rail").services[0].delivery.destination, "cape-town");
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice named by a blank id settles the offline reference once", () => {
  const present = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    offline_reference: "OFF_INV_LOCAL_1",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(present[0].args.settlement_id, "pay-INV_LOCAL_1:0:order-1");
  const fallen = invoiceSettlementCommands({
    id: "  ",
    offline_reference: " OFF_INV_LOCAL_1 ",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(fallen[0].args.settlement_id, "pay-OFF_INV_LOCAL_1:0:order-1");
  assert.equal(fallen[0].args.fulfillment_id, "order-1");
  assert.throws(
    () => invoiceSettlementCommands({
      id: "  ",
      offline_reference: "  ",
      currency: "NGN",
      fulfillment_id: "order-1",
      amount_cents: 250000,
    }),
    /invoice id is required/,
  );
  const dir = mkdtempSync(join(tmpdir(), "salon-invoice-ref-"));
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
    const unnamed = recordInvoiceSettlement({
      id: "  ",
      offline_reference: "OFF_INV_LOCAL_1",
      currency: "NGN",
      line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }],
    });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    const before = readFileSync(ledger, "utf8");
    assert.equal(before.includes("OFF_INV_LOCAL_1"), false);
    const missing = recordInvoiceSettlement({
      id: "  ",
      offline_reference: "  ",
      currency: "NGN",
      fulfillment_id: "order-1",
      amount_cents: 250000,
    });
    assert.equal(missing.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), before);
    const paid = recordInvoiceSettlement({
      id: "  ",
      offline_reference: "OFF_INV_LOCAL_1",
      currency: "NGN",
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("pay-OFF_INV_LOCAL_1:0:order-1"), true);
    const again = recordInvoiceSettlement({
      id: "  ",
      offline_reference: "OFF_INV_LOCAL_1",
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

test("a paid invoice with a blank currency settles in NGN once", () => {
  const present = invoiceSettlementCommands({
    id: "INV_LOCAL_1",
    currency: " zar ",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(present[0].args.currency, "ZAR");
  const fallen = invoiceSettlementCommands({
    id: "INV_BLANK",
    currency: "  ",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(fallen[0].args.currency, "NGN");
  assert.equal(fallen[0].args.fulfillment_id, "order-1");
  assert.throws(
    () =>
      invoiceSettlementCommands({
        id: "INV_BAD",
        currency: "US",
        line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
      }),
    /currency must be a 3-letter code/,
  );
  const dir = mkdtempSync(join(tmpdir(), "salon-currency-"));
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
    const unnamed = recordInvoiceSettlement({
      id: "INV_SERVICE",
      currency: "  ",
      line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }],
    });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    const before = readFileSync(ledger, "utf8");
    assert.equal(before.includes("INV_SERVICE"), false);
    const rejected = recordInvoiceSettlement({
      id: "INV_BAD",
      currency: "US",
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(rejected.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), before);
    const paid = recordInvoiceSettlement({
      id: "INV_BLANK",
      currency: "  ",
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("pay-INV_BLANK:0:order-1"), true);
    assert.equal(recorded.includes('"NGN"'), true);
    const again = recordInvoiceSettlement({
      id: "INV_BLANK",
      currency: "  ",
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

test("a delivery named by a numeric string moves that batch once", () => {
  const commands = deliveriesForAppointment("apt-count", [
    { name: "Signature Facial" },
    {
      delivery: {
        skuId: "sku-cleanser",
        batchId: "batch-cleanser",
        source: "plant",
        destination: "cape-town",
        milligrams: " 2000 ",
      },
    },
  ]);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.milligrams, 2000);
  const dir = mkdtempSync(join(tmpdir(), "salon-count-text-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const delivery = {
    skuId: "sku-cleanser",
    batchId: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: "2000",
  };
  try {
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
    const seededText = readFileSync(ledger, "utf8");
    const absent = recordDeliveries("apt-count", [{ name: "Signature Facial" }]);
    assert.equal(absent.ok, true);
    assert.equal(absent.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const word = recordDeliveries("apt-count", [{ delivery: { ...delivery, milligrams: "lots" } }]);
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const moved = recordDeliveries("apt-count", [{ name: "Signature Facial" }, { delivery }]);
    assert.equal(moved.ok, true, moved.error);
    assert.equal(moved.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("apt-count:1"), true);
    assert.equal(recorded.includes('"milligrams": 2000'), true);
    const overdraw = recordDeliveries("apt-count", [{ delivery: { ...delivery, milligrams: "8000" } }]);
    assert.equal(overdraw.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice named by a numeric quantity settles that sale once", () => {
  const doubled = invoiceSettlementCommands({
    id: "INV_QTY",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: " 2 ", fulfillment_id: "order-1" }],
  });
  assert.equal(doubled[0].args.amount_cents, 500000);
  const blank = invoiceSettlementCommands({
    id: "INV_QTY",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: "  ", fulfillment_id: "order-1" }],
  });
  assert.equal(blank[0].args.amount_cents, 250000);
  assert.throws(
    () =>
      invoiceSettlementCommands({
        id: "INV_QTY",
        currency: "NGN",
        line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: "two", fulfillment_id: "order-1" }],
      }),
    /quantity must be a positive integer/,
  );
  const dir = mkdtempSync(join(tmpdir(), "salon-qty-text-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const invoice = {
    id: "INV_QTY",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: "2", fulfillment_id: "order-1" }],
  };
  try {
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
    const seededText = readFileSync(ledger, "utf8");
    const unnamed = recordInvoiceSettlement({
      id: "INV_SERVICE",
      currency: "NGN",
      line_items: [{ name: "Signature Facial", amount: 250000, quantity: "2" }],
    });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const word = recordInvoiceSettlement({
      ...invoice,
      line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: "two", fulfillment_id: "order-1" }],
    });
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const paid = recordInvoiceSettlement(invoice);
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("pay-INV_QTY:0:order-1"), true);
    assert.equal(recorded.includes('"amount_cents": 500000'), true);
    const again = recordInvoiceSettlement(invoice);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice named by a numeric amount settles that sale once", () => {
  const line = invoiceSettlementCommands({
    id: "INV_AMT",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: " 250000 ", quantity: 1, fulfillment_id: "order-1" }],
  });
  assert.equal(line[0].args.amount_cents, 250000);
  const stated = invoiceSettlementCommands({
    id: "INV_AMT",
    currency: "NGN",
    fulfillment_id: "order-1",
    amount: " 18500 ",
    line_items: [{ name: "Signature Facial", amount: 1, quantity: 1 }],
  });
  assert.equal(stated[0].args.amount_cents, 18500);
  assert.throws(
    () =>
      invoiceSettlementCommands({
        id: "INV_AMT",
        currency: "NGN",
        line_items: [{ name: "Gentle cleanser", amount: "lots", quantity: 1, fulfillment_id: "order-1" }],
      }),
    /amount must be a positive integer/,
  );
  assert.throws(
    () =>
      invoiceSettlementCommands({
        id: "INV_AMT",
        currency: "NGN",
        line_items: [{ name: "Gentle cleanser", amount: "185.00", quantity: 1, fulfillment_id: "order-1" }],
      }),
    /amount must be a positive integer/,
  );
  const dir = mkdtempSync(join(tmpdir(), "salon-amount-text-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const invoice = {
    id: "INV_AMT",
    currency: "NGN",
    line_items: [{ name: "Gentle cleanser", amount: "250000", quantity: 1, fulfillment_id: "order-1" }],
  };
  try {
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
    const seededText = readFileSync(ledger, "utf8");
    const unnamed = recordInvoiceSettlement({
      id: "INV_SERVICE",
      currency: "NGN",
      line_items: [{ name: "Signature Facial", amount: "250000", quantity: 1 }],
    });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const word = recordInvoiceSettlement({
      ...invoice,
      line_items: [{ name: "Gentle cleanser", amount: "lots", quantity: 1, fulfillment_id: "order-1" }],
    });
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const paid = recordInvoiceSettlement(invoice);
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("pay-INV_AMT:0:order-1"), true);
    assert.equal(recorded.includes('"amount_cents": 250000'), true);
    const again = recordInvoiceSettlement(invoice);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a transfer command named by a numeric string moves that batch once", () => {
  const preview = salonSupplyChainResponse("POST", "/api/supply-chain", {
    command: "transfer",
    args: {
      transfer_id: "xfer-text",
      sku_id: "sku-cleanser",
      batch_id: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: " 2000 ",
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.artifact.milligrams, 2000);
  const rejected = salonSupplyChainResponse("POST", "/api/supply-chain", {
    command: "transfer",
    args: {
      transfer_id: "xfer-word",
      sku_id: "sku-cleanser",
      batch_id: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: "lots",
    },
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.error, /milligrams must be a positive integer/);
  const dir = mkdtempSync(join(tmpdir(), "salon-transfer-count-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const move = {
    command: "transfer",
    args: {
      transfer_id: "xfer-text",
      sku_id: "sku-cleanser",
      batch_id: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: " 2000 ",
    },
  };
  try {
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
    const seededText = readFileSync(ledger, "utf8");
    const missing = salonSupplyChainResponse("POST", "/api/supply-chain", {
      command: "transfer",
      args: {
        transfer_id: "xfer-missing",
        sku_id: "sku-cleanser",
        batch_id: "batch-cleanser",
        source: "plant",
        destination: "cape-town",
      },
    });
    assert.equal(missing.status, 400);
    const word = salonSupplyChainResponse("POST", "/api/supply-chain", {
      command: "transfer",
      args: { ...move.args, transfer_id: "xfer-word", milligrams: "lots" },
    });
    assert.equal(word.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const moved = salonSupplyChainResponse("POST", "/api/supply-chain", move);
    assert.equal(moved.status, 200, moved.body.error);
    assert.equal(moved.body.artifact.milligrams, 2000);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "xfer-text"'), true);
    assert.equal(recorded.includes('"milligrams": 2000'), true);
    assert.equal(recorded.includes('"milligrams": "'), false);
    const overdraw = salonSupplyChainResponse("POST", "/api/supply-chain", {
      command: "transfer",
      args: { ...move.args, transfer_id: "xfer-over", milligrams: "8000" },
    });
    assert.equal(overdraw.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a platform sync records the delivery an appointment already names once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-sync-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const appointment = {
    id: "apt-sync",
    date: "2026-10-02",
    startTime: "10:00",
    client: { email: "adaeze.obi@example.com" },
    services: [{ id: "srv-001", name: "Signature Facial" }, { delivery }],
  };
  try {
    const facial = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-facial",
        services: [{ id: "srv-001", name: "Signature Facial" }],
      },
    });
    assert.equal(facial.status, 200);
    assert.equal(facial.body.data.persisted, true);
    assert.equal(existsSync(ledger), false);

    const rejected = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-sync",
        services: [{ delivery: { ...delivery, milligrams: "lots" } }],
      },
    });
    assert.equal(rejected.status, 400);
    assert.equal(existsSync(ledger), false);

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

    const synced = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment,
    });
    assert.equal(synced.status, 200);
    assert.equal(synced.body.data.persisted, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "apt-sync:1"'), true);
    assert.equal(recorded.includes('"milligrams": 2000'), true);

    const again = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment,
    });
    assert.equal(again.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        ...appointment,
        services: [
          { id: "srv-001", name: "Signature Facial" },
          { delivery: { ...delivery, destination: "johannesburg" } },
        ],
      },
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

function terminalResponse() {
  return {
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("pushing an invoice to the terminal records the sale it names once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-terminal-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  const previousKey = process.env.GATSBY_AUTH_KEY;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  process.env.GATSBY_AUTH_KEY = "placeholder";
  const invoice = {
    id: "INV_PUSH",
    currency: "NGN",
    fulfillment_id: "order-1",
    amount_cents: 250000,
  };
  try {
    const service = terminalResponse();
    await pushToTerminal(
      { body: { id: "INV_SERVICE", line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }] } },
      service,
    );
    assert.equal(service.statusCode, 200);
    assert.equal(service.payload.data.status, "success");
    assert.equal(existsSync(ledger), false);

    const rejected = terminalResponse();
    await pushToTerminal(
      { body: { id: "INV_BAD", fulfillment_id: "order-1", amount_cents: "lots" } },
      rejected,
    );
    assert.equal(rejected.statusCode, 400);
    assert.equal(existsSync(ledger), false);

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

    const paid = terminalResponse();
    await pushToTerminal({ body: invoice }, paid);
    assert.equal(paid.statusCode, 200);
    assert.equal(paid.payload.data.status, "success");
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"settlement_id": "pay-INV_PUSH:0:order-1"'), true);
    assert.equal(recorded.includes('"amount_cents": 250000'), true);

    const again = terminalResponse();
    await pushToTerminal({ body: invoice }, again);
    assert.equal(again.statusCode, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = terminalResponse();
    await pushToTerminal({ body: { ...invoice, amount_cents: 100 } }, changed);
    assert.equal(changed.statusCode, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
    if (previousKey === undefined) delete process.env.GATSBY_AUTH_KEY;
    else process.env.GATSBY_AUTH_KEY = previousKey;
  }
});

test("creating an invoice records the delivery it already names once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-invoice-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  const previousKey = process.env.GATSBY_AUTH_KEY;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  process.env.GATSBY_AUTH_KEY = "placeholder";
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const invoice = {
    appointment_id: "apt-inv",
    customer: "adaeze.obi@example.com",
    currency: "NGN",
    deliveries: [delivery],
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1 }],
  };
  try {
    const service = terminalResponse();
    await createInvoice(
      { body: { customer: "adaeze.obi@example.com", line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }] } },
      service,
    );
    assert.equal(service.statusCode, 200);
    assert.equal(service.payload.data.status, "pending");
    assert.equal(existsSync(ledger), false);

    const rejected = terminalResponse();
    await createInvoice(
      { body: { appointment_id: "apt-inv", deliveries: [{ ...delivery, milligrams: "lots" }] } },
      rejected,
    );
    assert.equal(rejected.statusCode, 400);
    assert.equal(existsSync(ledger), false);

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

    const created = terminalResponse();
    await createInvoice({ body: invoice }, created);
    assert.equal(created.statusCode, 200);
    assert.equal(created.payload.data.status, "pending");
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "apt-inv:0"'), true);
    assert.equal(recorded.includes('"milligrams": 2000'), true);
    assert.equal(recorded.includes('"command": "settle"'), false);

    const again = terminalResponse();
    await createInvoice({ body: invoice }, again);
    assert.equal(again.statusCode, 200);
    assert.equal(again.payload.data.status, "pending");
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = terminalResponse();
    await createInvoice(
      { body: { ...invoice, deliveries: [{ ...delivery, destination: "johannesburg" }] } },
      changed,
    );
    assert.equal(changed.statusCode, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
    if (previousKey === undefined) delete process.env.GATSBY_AUTH_KEY;
    else process.env.GATSBY_AUTH_KEY = previousKey;
  }
});

test("the local invoice rail records the delivery it already names once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-rail-invoice-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  const previousKey = process.env.GATSBY_AUTH_KEY;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  process.env.GATSBY_AUTH_KEY = "placeholder";
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const invoice = {
    appointment_id: "apt-inv",
    customer: "adaeze.obi@example.com",
    currency: "NGN",
    deliveries: [delivery],
    line_items: [{ name: "Gentle cleanser", amount: 250000, quantity: 1 }],
  };
  try {
    const service = await handleSalonApi("POST", "/api/create_invoice", {
      customer: "adaeze.obi@example.com",
      line_items: [{ name: "Signature Facial", amount: 250000, quantity: 1 }],
    });
    assert.equal(service.status, 200);
    assert.equal(service.body.data.status, "pending");
    assert.equal(existsSync(ledger), false);

    const rejected = await handleSalonApi("POST", "/api/create_invoice", {
      appointment_id: "apt-inv",
      deliveries: [{ ...delivery, milligrams: "lots" }],
    });
    assert.equal(rejected.status, 400);
    assert.equal(existsSync(ledger), false);

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

    const created = await handleSalonApi("POST", "/api/create_invoice", invoice);
    assert.equal(created.status, 200);
    assert.equal(created.body.data.status, "pending");
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "apt-inv:0"'), true);
    assert.equal(recorded.includes('"milligrams": 2000'), true);
    assert.equal(recorded.includes('"command": "settle"'), false);

    const again = await handleSalonApi("POST", "/api/create_invoice", invoice);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.status, "pending");
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = await handleSalonApi("POST", "/api/create_invoice", {
      ...invoice,
      deliveries: [{ ...delivery, destination: "johannesburg" }],
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const camel = await handleSalonApi("POST", "/api/create_invoice", {
      appointmentId: "apt-camel",
      deliveries: [delivery],
    });
    assert.equal(camel.status, 200);
    const moved = readFileSync(ledger, "utf8");
    assert.equal(moved.includes('"transfer_id": "apt-camel:0"'), true);
    const repeated = await handleSalonApi("POST", "/api/create_invoice", {
      appointmentId: "apt-camel",
      deliveries: [delivery],
    });
    assert.equal(repeated.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), moved);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
    if (previousKey === undefined) delete process.env.GATSBY_AUTH_KEY;
    else process.env.GATSBY_AUTH_KEY = previousKey;
  }
});

test("a checkout invoice records the delivery a service already names once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-checkout-delivery-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  const previousKey = process.env.GATSBY_AUTH_KEY;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  process.env.GATSBY_AUTH_KEY = "placeholder";
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const services = [
    { name: "Signature Facial", price: 8500, quantity: 1 },
    { name: "Gentle cleanser", price: 2500, quantity: 1, delivery },
  ];
  try {
    const unnamed = buildInvoicePayload({
      client: { email: "adaeze.obi@example.com" },
      services: [{ name: "Signature Facial", price: 8500, quantity: 1 }],
      appointment: { id: "apt-checkout", date: "2026-09-23", startTime: "10:00" },
    });
    assert.equal(unnamed.services, undefined);
    assert.equal(unnamed.appointment_id, "apt-checkout");
    const skipped = terminalResponse();
    await createInvoice({ body: unnamed }, skipped);
    assert.equal(skipped.statusCode, 200);
    assert.equal(existsSync(ledger), false);

    const blank = buildInvoicePayload({
      client: { email: "adaeze.obi@example.com" },
      services,
      appointment: { id: "  ", date: "2026-09-23", startTime: "10:00" },
    });
    assert.equal(blank.appointment_id, undefined);
    const rejected = terminalResponse();
    await createInvoice(
      { body: buildInvoicePayload({
        client: { email: "adaeze.obi@example.com" },
        services: [{ name: "Signature Facial", price: 8500 }, { name: "Gentle cleanser", price: 2500, delivery: { ...delivery, milligrams: "lots" } }],
        appointment: { id: "apt-checkout" },
      }) },
      rejected,
    );
    assert.equal(rejected.statusCode, 400);
    assert.equal(existsSync(ledger), false);

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

    const invoice = buildInvoicePayload({
      client: { firstName: "Adaeze", lastName: "Obi", email: "adaeze.obi@example.com" },
      services,
      appointment: { id: "apt-checkout", date: "2026-09-23", startTime: "10:00" },
    });
    const created = terminalResponse();
    await createInvoice({ body: invoice }, created);
    assert.equal(created.statusCode, 200);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "apt-checkout:1"'), true);
    assert.equal(recorded.includes('"transfer_id": "apt-checkout:0"'), false);
    assert.equal(recorded.includes('"milligrams": 2000'), true);

    const again = terminalResponse();
    await createInvoice({ body: invoice }, again);
    assert.equal(again.statusCode, 200);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const railed = await handleSalonApi("POST", "/api/create_invoice", invoice);
    assert.equal(railed.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const changed = terminalResponse();
    await createInvoice(
      { body: buildInvoicePayload({
        client: { email: "adaeze.obi@example.com" },
        services: [
          { name: "Signature Facial", price: 8500 },
          { name: "Gentle cleanser", price: 2500, delivery: { ...delivery, destination: "johannesburg" } },
        ],
        appointment: { id: "apt-checkout" },
      }) },
      changed,
    );
    assert.equal(changed.statusCode, 400);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    assert.equal(readFileSync(ledger, "utf8").includes("johannesburg"), false);

    const fallen = await handleSalonApi("POST", "/api/create_invoice", blank);
    assert.equal(fallen.status, 200);
    const moved = readFileSync(ledger, "utf8");
    assert.equal(moved.includes('"transfer_id": "invoice:1"'), true);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
    if (previousKey === undefined) delete process.env.GATSBY_AUTH_KEY;
    else process.env.GATSBY_AUTH_KEY = previousKey;
  }
});

test("cancelling an appointment sends that delivery back once", async () => {
  const absent = mkdtempSync(join(tmpdir(), "salon-cancel-absent-"));
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = join(absent, "supply-chain.jsonl");
  try {
    assert.deepEqual(appointmentCancellationCommands(9), []);
    assert.equal(recordAppointmentCancellation(" ").ok, false);
    assert.equal(recordAppointmentCancellation("apt-9").count, 0);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }

  const dir = mkdtempSync(join(tmpdir(), "salon-cancel-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  try {
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
          { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 1000 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const moved = recordDeliveries("apt-9", [{ name: "Signature Facial" }, { delivery }]);
    assert.equal(moved.ok, true, moved.error);
    const commands = appointmentCancellationCommands("apt-9");
    assert.equal(commands.length, 1);
    assert.equal(commands[0].args.transfer_id, "return:apt-9:1");
    assert.equal(commands[0].args.source, "cape-town");
    assert.equal(commands[0].args.destination, "plant");
    assert.equal(commands[0].args.milligrams, 2000);
    const cancelled = await handleSalonApi("POST", "/api/appointments/cancel", { id: "apt-9" });
    assert.equal(cancelled.status, 200);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes('"transfer_id": "return:apt-9:1"'), true);
    assert.equal(recorded.includes('"transfer_id": "return:xfer-cape-town"'), false);
    const again = await handleSalonApi("POST", "/api/appointments/cancel", { id: "apt-9" });
    assert.equal(again.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), recorded);

    const updated = recordDeliveries("apt-10", [{ delivery }]);
    assert.equal(updated.ok, true, updated.error);
    const status = await handleSalonApi("PUT", "/api/appointments/update", { id: "apt-10", status: "cancelled" });
    assert.equal(status.status, 200);
    const returned = readFileSync(ledger, "utf8");
    assert.equal(returned.includes('"transfer_id": "return:apt-10:0"'), true);
    const repeated = await handleSalonApi("PUT", "/api/appointments/update", { id: "apt-10", status: "cancelled" });
    assert.equal(repeated.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), returned);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }

  const conflictDir = mkdtempSync(join(tmpdir(), "salon-cancel-conflict-"));
  const conflictLedger = join(conflictDir, "supply-chain.jsonl");
  process.env.SKINTWIN_CHAIN_LEDGER = conflictLedger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
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
          { command: "transfer", args: { transfer_id: "apt-9:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "return:apt-9:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "cape-town", destination: "plant", milligrams: 1000 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const before = readFileSync(conflictLedger, "utf8");
    assert.throws(() => appointmentCancellationCommands("apt-9"), /id already exists/);
    const rejected = await handleSalonApi("POST", "/api/appointments/cancel", { id: "apt-9" });
    assert.equal(rejected.status, 400);
    assert.equal(readFileSync(conflictLedger, "utf8"), before);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a cancelled appointment sync returns the delivery it already recorded once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-sync-cancel-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  try {
    const early = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-early",
        status: "cancelled",
        services: [{ name: "Signature Facial" }, { delivery }],
      },
    });
    assert.equal(early.status, 400);
    assert.equal(existsSync(ledger), false);

    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 12000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 12000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 12000]] } },
          { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 1000 } },
          { command: "transfer", args: { transfer_id: "apt-omit:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "apt-named:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "apt-treat:0", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "apt-conflict:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "return:apt-conflict:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "cape-town", destination: "plant", milligrams: 500 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

    const omitted = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: { id: "apt-omit", status: "cancelled", services: [{ name: "Signature Facial" }] },
    });
    assert.equal(omitted.status, 200);
    const returned = readFileSync(ledger, "utf8");
    assert.equal(returned.includes('"transfer_id": "return:apt-omit:1"'), true);
    assert.equal(returned.includes('"source": "cape-town"'), true);
    assert.equal(returned.includes('"destination": "plant"'), true);
    assert.equal(returned.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const again = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: { id: "apt-omit", status: "cancelled" },
    });
    assert.equal(again.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), returned);

    const absent = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: { id: "apt-19", status: "cancelled", services: [{ name: "Signature Facial" }] },
    });
    assert.equal(absent.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), returned);

    const named = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-named",
        status: "cancelled",
        services: [{ name: "Signature Facial" }, { delivery }],
      },
    });
    assert.equal(named.status, 200);
    const namedText = readFileSync(ledger, "utf8");
    assert.equal(namedText.includes('"transfer_id": "return:apt-named:1"'), true);
    assert.equal(namedText.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const changed = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-named",
        status: "cancelled",
        services: [{ name: "Signature Facial" }, { delivery: { ...delivery, milligrams: 1000 } }],
      },
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), namedText);

    const treatment = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "log_treatment",
      treatment: { appointmentId: "apt-treat", status: "cancelled", services: [{ name: "Signature Facial" }] },
    });
    assert.equal(treatment.status, 200);
    const treated = readFileSync(ledger, "utf8");
    assert.equal(treated.includes('"transfer_id": "return:apt-treat:0"'), true);
    assert.equal(treated.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const conflict = await handleSalonApi("POST", "/api/integrations/skintwin", {
      action: "sync_appointment",
      appointment: {
        id: "apt-conflict",
        status: "cancelled",
        services: [{ name: "Signature Facial" }, { delivery }],
      },
    });
    assert.equal(conflict.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), treated);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("creating a cancelled appointment returns the delivery it already recorded once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-create-cancel-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const client = { consentAccepted: true };
  const facial = { id: "srv-001", name: "Signature Facial" };
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  const booking = {
    date: "2026-10-02",
    startTime: "10:00",
    providerId: "prv-001",
    client,
    status: "cancelled",
  };
  try {
    const early = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-early",
      services: [facial, { delivery }],
    });
    assert.equal(early.status, 400);
    assert.equal(existsSync(ledger), false);
    assert.equal(getAppointment("apt-early"), null);

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
          { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 1000 } },
          { command: "transfer", args: { transfer_id: "apt-omit:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "apt-named:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

    const omitted = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-omit",
      services: [facial],
    });
    assert.equal(omitted.status, 201);
    assert.equal(omitted.body.data.status, "cancelled");
    const returned = readFileSync(ledger, "utf8");
    assert.equal(returned.includes('"transfer_id": "return:apt-omit:1"'), true);
    assert.equal(returned.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const again = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-omit",
      services: [facial],
    });
    assert.equal(again.status, 201);
    assert.equal(readFileSync(ledger, "utf8"), returned);

    const absent = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-19",
      services: [facial],
    });
    assert.equal(absent.status, 201);
    assert.equal(readFileSync(ledger, "utf8"), returned);

    const named = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-named",
      services: [facial, { delivery }],
    });
    assert.equal(named.status, 201);
    const namedText = readFileSync(ledger, "utf8");
    assert.equal(namedText.includes('"transfer_id": "return:apt-named:1"'), true);
    assert.equal(namedText.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const changed = await handleSalonApi("POST", "/api/appointments/create", {
      ...booking,
      id: "apt-named",
      services: [facial, { delivery: { ...delivery, milligrams: 1000 } }],
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), namedText);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("updating an appointment to cancelled returns the delivery it names", async () => {
  const dir = mkdtempSync(join(tmpdir(), "salon-update-cancel-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const facial = { id: "srv-001", name: "Signature Facial" };
  const delivery = {
    sku_id: "sku-cleanser",
    batch_id: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  };
  try {
    const early = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-early",
      status: "cancelled",
      services: [facial, { delivery }],
    });
    assert.equal(early.status, 400);
    assert.equal(existsSync(ledger), false);
    assert.equal(getAppointment("apt-early"), null);

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
          { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 1000 } },
          { command: "transfer", args: { transfer_id: "apt-omit:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "transfer", args: { transfer_id: "apt-named:1", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);

    const omitted = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-omit",
      status: "cancelled",
      services: [facial],
    });
    assert.equal(omitted.status, 200);
    assert.equal(omitted.body.data.status, "cancelled");
    const returned = readFileSync(ledger, "utf8");
    assert.equal(returned.includes('"transfer_id": "return:apt-omit:1"'), true);
    assert.equal(returned.includes('"transfer_id": "return:xfer-cape-town"'), false);

    const absent = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-19",
      status: "cancelled",
      services: [facial],
    });
    assert.equal(absent.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), returned);

    const named = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-named",
      status: "cancelled",
      services: [facial, { delivery }],
    });
    assert.equal(named.status, 200);
    assert.equal(named.body.data.status, "cancelled");
    const namedText = readFileSync(ledger, "utf8");
    const namedReturn = namedText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .find((record) => record.args?.transfer_id === "return:apt-named:1");
    assert.equal(namedReturn.args.milligrams, 2000);
    assert.equal(namedReturn.args.source, "cape-town");
    assert.equal(namedReturn.args.destination, "plant");
    assert.equal(namedText.includes('"transfer_id": "return:xfer-cape-town"'), false);
    assert.equal(getAppointment("apt-named").services[1].delivery.milligrams, 2000);

    const repeated = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-named",
      status: "cancelled",
      services: [facial, { delivery }],
    });
    assert.equal(repeated.status, 200);
    assert.equal(readFileSync(ledger, "utf8"), namedText);

    const changed = await handleSalonApi("PUT", "/api/appointments/update", {
      id: "apt-named",
      status: "cancelled",
      services: [facial, { delivery: { ...delivery, milligrams: 1000 } }],
    });
    assert.equal(changed.status, 400);
    assert.equal(readFileSync(ledger, "utf8"), namedText);
    assert.equal(getAppointment("apt-named").services[1].delivery.milligrams, 2000);
    assert.equal(getAppointment("apt-named").status, "cancelled");
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});
