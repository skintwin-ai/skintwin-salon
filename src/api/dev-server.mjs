import http from 'node:http'
import { existsSync } from 'node:fs'
import { handleSalonApi } from './local-salon-rail.js'

const hub = process.env.SKINTWIN_HUB_ROOT
  || ['/agent/repos/skintwin-ecosystem-design', '/workspace/repos/skintwin-ecosystem-design']
    .find((candidate) => existsSync(`${candidate}/domain/ledger.py`))
if (hub) {
  process.env.SKINTWIN_HUB_ROOT ||= hub
  process.env.SKINTWIN_CHAIN_LEDGER ||= `${hub}/var/supply-chain.jsonl`
}

const port = Number(process.env.SALON_RAIL_PORT || 8000)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  let body = {}
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = {}
    }
  }
  const result = await handleSalonApi(req.method || 'GET', url.pathname, body)
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result.body))
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Salon local rail listening on http://localhost:${port}/`)
})
