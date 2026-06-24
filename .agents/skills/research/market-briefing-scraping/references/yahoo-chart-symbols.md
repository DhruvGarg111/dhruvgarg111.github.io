# Yahoo Finance chart endpoint symbols for market briefing

Observed working symbols via `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=2d`:

## FX / Crypto
- USD/INR: `USDINR=X`
- Bitcoin: `BTC-USD`

## Commodities (futures used as proxy)
- Gold (XAU/USD): `GC=F`
- Silver (XAG/USD): `SI=F`

## Mega-caps
- Apple: `AAPL`
- Microsoft: `MSFT`
- Nvidia: `NVDA`
- Alphabet (Class A): `GOOGL`
- Amazon: `AMZN`
- Meta: `META`
- Tesla: `TSLA`
- Saudi Aramco: `2222.SR`

Notes:
- XAUUSD=X and XAGUSD=X returned 404s in chart endpoint; use GC=F and SI=F as practical proxies.
- Use `meta.regularMarketPrice` and `meta.chartPreviousClose` for 1-day change calculation.
