import { recordSyncedDelivery } from '../../chain_stage.mjs'
import { isLocalPaystackRail, localPaystackInvoice } from './integrations/paystack-rail.js'
import { jsonBody, parseRequestBody } from '../utils/http.js'
import { invoiceAppointmentId, invoiceServicesForLedger } from '../utils/invoice-payload.mjs'

export default async function createInvoice(req, res) {
  const payload = parseRequestBody(req)
  const services = invoiceServicesForLedger(payload)
  if (services.length > 0) {
    const delivered = recordSyncedDelivery(invoiceAppointmentId(payload), services)
    if (!delivered.ok) {
      return res.status(400).send({ status: false, message: delivered.error })
    }
  }

  if (isLocalPaystackRail()) {
    return res.status(200).send(localPaystackInvoice(payload))
  }

  const fetch = (await import('node-fetch')).default
  const url = `${process.env.GATSBY_BASE_API}/paymentrequest`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.GATSBY_AUTH_KEY}`,
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: headers,
      body: jsonBody(payload),
    })
      .then((response) => response.json())
      .then((data) => res.status(200).send(data))
      .catch((error) => res.status(500).send(error))
  } catch (error) {
    console.log('Error: ', error)
    res.status(500).send(error)
  }
}
