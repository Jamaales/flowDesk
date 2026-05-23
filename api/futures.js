// api/futures.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol } = req.body || {};
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) throw new Error(`Yahoo error ${response.status}`);

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No data returned');

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ price, prevClose, change, changePct });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
