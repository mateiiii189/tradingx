# TradeChart
A no-build, drag‑and‑run trading app (charts + paper trading) made with **TypeScript + JSX**, **Tailwind**, **React**, and **Lightweight Charts**—all via CDNs so you can just open with Live Server.

## How to run
1. Download and unzip the project.
2. Open `index.html` with a local server (e.g., VS Code Live Server extension).  
   > Opening as a plain file may block network requests on some browsers due to CORS.
3. Start trading (paper mode).

## Features
- Candlestick chart with volume and SMA/EMA overlays
- RSI panel
- Timeframes: 1m, 5m, 15m, 1h, 4h, 1d
- Symbols from Binance (e.g., `BTCUSDT`, `ETHUSDT`, `BNBUSDT`)
- Watchlist (persistent via localStorage)
- Paper trading: market buy/sell, positions & PnL
- Light/Dark mode toggle (persisted)

## Notes
- Market data fetched from Binance public API (no key required). Works for **crypto** symbols.
- This is a starter platform; extend as you like (alerts, drawings, more indicators, real accounts, etc.).
