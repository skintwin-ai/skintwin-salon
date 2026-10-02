import { recordInvoiceSettlement } from "../../chain_stage.mjs"
import { isLocalPaystackRail, localPaystackTerminal } from "./integrations/paystack-rail.js"

function invoiceBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}")
  return req.body || {}
}

export default async function pushToTerminal(req, res) {
  const body = invoiceBody(req)
  const settled = recordInvoiceSettlement(body)
  if (!settled.ok) {
    return res.status(400).send({ status: false, message: settled.error })
  }

  if (isLocalPaystackRail()) {
    return res.status(200).send(localPaystackTerminal(body))
  }

  const fetch = (await import("node-fetch")).default
  const url = `${process.env.GATSBY_BASE_API}/terminal/${process.env.GATSBY_TERMINAL_ID}/event`
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.GATSBY_AUTH_KEY}`
  }

  const {id, offline_reference} = body

  const data = { 
    type: "invoice",
    action: "process",
    data: {
      id: id,
      reference: offline_reference
    }
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    })
      .then(response => response.json())
      .then(data => res.status(200).send(data))
      .catch(error => res.status(500).send(error))
  } catch (error) {
    res.status(500).send(error)
  }
}