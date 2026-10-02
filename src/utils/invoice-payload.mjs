function namedId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function fulfillmentIdOf(record) {
  if (!record || typeof record !== "object") return "";
  return namedId(record.fulfillment_id) || namedId(record.fulfillmentId);
}

export function invoiceLineItem(service = {}) {
  const line = {
    name: service.name,
    amount: service.price * 100,
    quantity: service.quantity || 1,
  };
  const fulfillmentId = fulfillmentIdOf(service);
  if (fulfillmentId) line.fulfillment_id = fulfillmentId;
  return line;
}

export function terminalInvoicePayload(invoice = {}) {
  const payload = {};
  if (invoice.id != null) payload.id = invoice.id;
  if (invoice.offline_reference != null) payload.offline_reference = invoice.offline_reference;
  if (invoice.currency) payload.currency = invoice.currency;
  const fulfillmentId = fulfillmentIdOf(invoice);
  if (fulfillmentId) payload.fulfillment_id = fulfillmentId;
  const settlementId = namedId(invoice.settlement_id) || namedId(invoice.settlementId);
  if (settlementId) payload.settlement_id = settlementId;
  if (invoice.amount_cents != null) payload.amount_cents = invoice.amount_cents;
  if (Array.isArray(invoice.line_items)) payload.line_items = invoice.line_items;
  return payload;
}
