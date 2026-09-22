import fetch from 'node-fetch'
import { jsonBody, parseRequestBody } from '../utils/http'

export default async function createInvoice(req, res) {
  const url = `${process.env.GATSBY_BASE_API}/paymentrequest`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.GATSBY_AUTH_KEY}`,
  }

  const payload = parseRequestBody(req)

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
