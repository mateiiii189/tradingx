## TradeChart

Simple no-build React + Tailwind trading interface powered by Binance data and
Lightweight Charts.

### Development

```bash
npm install
npm run dev    # serves the front-end
npm run server # starts the auth API on http://localhost:3001
```

The auth API stores users in a local SQLite database (`data.db`).  It exposes
`/api/register` and `/api/login` for basic username/password authentication.
Tokens returned from these endpoints should be stored in `localStorage`.

