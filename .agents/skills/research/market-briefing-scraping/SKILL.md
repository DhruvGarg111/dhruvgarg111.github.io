---
name: market-briefing-scraping
description: Reusable workflow for compiling a short market briefing with prices and 1-day changes from public finance pages.
---

# Market briefing scraping

Use this skill when the task is to compile a concise market snapshot for FX, commodities, crypto, and a small list of equities using public quote pages.

## Goal
Collect:
- current price
- 1-day / last 24h percent change
- optional headlines only when a stock moves >3%

## Preferred data source order
1. Google Finance quote pages
2. Investing.com quote pages for commodities when Google Finance is incomplete
3. Markets Insider commodity pages as a secondary fallback

## Workflow
1. Try the browser tool first if it works.
2. If the browser daemon is unavailable or fails to start, use direct HTTP fetches in Python.
3. For Google Finance pages, extract:
   - current price from `data-last-price="..."` or `<div class="YMlKec fxKbKc">...</div>`
   - previous close from the `Previous close` field with the nearby `P6K39c` value when available
   - percent change as `((current - previous) / previous) * 100`
4. If Google Finance parsing is unreliable or incomplete, prefer Yahoo Finance chart JSON as a practical fallback:
   - endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=2d`
   - extract `meta.regularMarketPrice` and `meta.chartPreviousClose`
   - compute the same percent change formula
5. For commodities where Google Finance is missing or incomplete:
   - use Yahoo Finance futures symbols such as `GC=F` for gold and `SI=F` for silver (use these symbols directly in the chart endpoint)
   - if needed, Investing.com or Markets Insider HTML `priceSection` JSON blobs are backup options
6. For headlines when a stock crosses the threshold, Google News RSS is a good lightweight source:
   - query via `https://news.google.com/rss/search?q=...&hl=en-US&gl=US&ceid=US:en`
   - take 1–3 recent headlines and cite the source domain from the `<source>` tag (avoid attributing `news.google.com`)
7. Keep all output concise and plain text.

## Useful parsing patterns
### Google Finance
- Price:
  - `data-last-price="([^"]+)"`
  - fallback: `<div class="YMlKec fxKbKc">([^<]+)</div>`
- Previous close:
  - locate `Previous close` then read the nearby `<div class="P6K39c">...</div>`

### Investing.com
- Look for `priceSection: { ... }` in the HTML
- Parse JSON-like keys:
  - `currentValue`
  - `previousClose`

### Markets Insider
- Parse the embedded `priceSection` JSON block
- Same key names as above

## Instruments commonly requested
- USD/INR
- XAU/USD (Gold)
- XAG/USD (Silver)
- BTC/USD
- AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA
- Saudi Aramco: usually `2222:TADAWUL` on Google Finance
- Yahoo chart symbol reference: see `references/yahoo-chart-symbols.md`

## Threshold logic
- Flag stocks only if absolute 1-day move is greater than 3%
- If none qualify, explicitly say `None today.`

## Headlines rule
Only when a flagged stock exceeds the threshold:
- fetch 1–3 plausible headlines
- cite the source domain
- keep headlines short

## Output format
Match this structure closely:
- `📊 Market Briefing - YYYY-MM-DD`
- `💰 Currencies & Commodities`
- `🚀 Trillion-Dollar Stocks (>3% Move)`
- `📰 Key Headlines`
- `Briefing compiled at HH:MM IST.`

## Pitfalls
- Google Finance browser sessions can fail; fallback to direct HTTP is often more reliable.
- Some Google Finance quote pages omit an easily parsed previous-close field for certain assets; do not stop—use a fallback source.
- XAU/XAG may not parse cleanly from Google Finance; Investing.com is often better.
- Keep the result terse; do not add commentary if no stock crossed the threshold.
