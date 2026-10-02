import assert from "node:assert/strict";
import test from "node:test";
import { salonSupplyChainResponse } from "./chain_stage.mjs";

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
