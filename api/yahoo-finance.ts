import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { symbol } = req.query
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'symbol query param required' })
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Yahoo returned ${upstream.status}` })
    }
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=3600')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
}
