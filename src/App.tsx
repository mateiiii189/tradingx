// TradeChart — Single-file React app (TSX) transpiled in-browser by Babel Standalone.
// Uses globals: React, ReactDOM, LightweightCharts.
const { useEffect, useMemo, useRef, useState } = React;

type Candle = { time: number, open: number, high: number, low: number, close: number, volume: number };
type Position = { id: string, symbol: string, side: 'LONG' | 'SHORT', qty: number, entry: number, ts: number };
type Order = { id: string, symbol: string, side: 'BUY' | 'SELL', qty: number, price: number, ts: number };

// ---- Utilities ----
const LS = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; }
  },
  set<T>(k: string, v: T) { localStorage.setItem(k, JSON.stringify(v)); }
};

const TF: Record<string, string> = {
  '1s': '1s', '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'
};

const TF_TO_BINANCE: Record<string, string> = TF; // same mapping

function fmt(n: number, d = 2) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n);
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ---- Data: Binance REST (no key) ----
async function fetchKlines(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Data fetch failed');
  const arr = await res.json();
  return arr.map((k: any[]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ---- Indicators ----
function SMA(data: Candle[], len: number) {
  const out: { time: number, value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= len) sum -= data[i - len].close;
    if (i >= len - 1) out.push({ time: data[i].time, value: sum / len });
  }
  return out;
}
function EMA(data: Candle[], len: number) {
  const out: { time: number, value: number }[] = [];
  const k = 2 / (len + 1);
  let ema = data[0]?.close ?? 0;
  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    out.push({ time: data[i].time, value: ema });
  }
  return out.slice(len - 1);
}
function RSI(data: Candle[], len = 14) {
  const out: { time: number, value: number }[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= len; i++) {
    const ch = data[i].close - data[i - 1].close;
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  let rs = gains / (losses || 1e-9);
  out.push({ time: data[len].time, value: 100 - (100 / (1 + rs)) });
  for (let i = len + 1; i < data.length; i++) {
    const ch = data[i].close - data[i - 1].close;
    const gain = Math.max(ch, 0), loss = Math.max(-ch, 0);
    gains = (gains * (len - 1) + gain) / len;
    losses = (losses * (len - 1) + loss) / len;
    rs = gains / (losses || 1e-9);
    out.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
  }
  return out;
}

// ---- Chart component ----
function ChartPane({ symbol, tf, data, overlays, theme }:{ symbol:string, tf:string, data: Candle[], overlays: { sma?: number, ema?: number }, theme: 'light'|'dark' }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const volRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const volChartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || !volRef.current || !rsiRef.current) return;
    const opts = {
      layout: { background: { color: theme === 'dark' ? '#09090b' : '#ffffff' }, textColor: theme === 'dark' ? '#e4e4e7' : '#0a0a0a' },
      grid: { horzLines: { color: theme === 'dark' ? '#27272a' : '#e4e4e7' }, vertLines: { color: theme === 'dark' ? '#27272a' : '#e4e4e7' } },
      rightPriceScale: { borderColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8' },
      timeScale: { borderColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8' }
    };
    const chart = LightweightCharts.createChart(ref.current!, { height: 420, ...opts });
    const volChart = LightweightCharts.createChart(volRef.current!, { height: 120, ...opts });
    const rsiChart = LightweightCharts.createChart(rsiRef.current!, { height: 140, ...opts });

    chartRef.current = chart;
    volChartRef.current = volChart;
    rsiChartRef.current = rsiChart;

    const candle = chart.addCandlestickSeries();
    candleSeriesRef.current = candle;

    const vol = volChart.addHistogramSeries({ priceFormat: { type: 'volume' } });
    volSeriesRef.current = vol;

    const sma = chart.addLineSeries({ color: theme === 'dark' ? '#5eead4' : '#0ea5e9', lineWidth: 2 });
    const ema = chart.addLineSeries({ color: theme === 'dark' ? '#93c5fd' : '#22c55e', lineWidth: 2 });
    smaSeriesRef.current = sma;
    emaSeriesRef.current = ema;

    const rsi = rsiChart.addLineSeries({ lineWidth: 2 });
    rsiSeriesRef.current = rsi;

    const resizer = () => {
      const w = ref.current!.clientWidth;
      chart.applyOptions({ width: w });
      volChart.applyOptions({ width: w });
      rsiChart.applyOptions({ width: w });
    };
    window.addEventListener('resize', resizer);
    resizer();

    return () => {
      window.removeEventListener('resize', resizer);
      chart.remove();
      volChart.remove();
      rsiChart.remove();
    };
  }, [theme]);

  const shouldFit = useRef(true);
  useEffect(() => { shouldFit.current = true; }, [symbol, tf]);

  useEffect(() => {
    if (!data.length || !candleSeriesRef.current) return;
    candleSeriesRef.current.setData(data.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
    volSeriesRef.current?.setData(data.map(d => ({ time: d.time, value: d.volume, color: d.close >= d.open ? '#10b981' : '#ef4444' })));
    // overlays
    if (overlays.sma) smaSeriesRef.current?.setData(SMA(data, overlays.sma).map(d => ({ time: d.time, value: d.value })));
    if (overlays.ema) emaSeriesRef.current?.setData(EMA(data, overlays.ema).map(d => ({ time: d.time, value: d.value })));
    rsiSeriesRef.current?.setData(RSI(data, 14).map(d => ({ time: d.time, value: d.value })));
    if (shouldFit.current) {
      chartRef.current?.timeScale().fitContent();
      shouldFit.current = false;
    }
  }, [data, overlays]);

  return (
    <div className="w-full">
      <div ref={ref} className="w-full card"></div>
      <div className="h-2"></div>
      <div ref={volRef} className="w-full card"></div>
      <div className="h-2"></div>
      <div ref={rsiRef} className="w-full card"></div>
    </div>
  );
}

// ---- Main App ----
function App() {
  const [symbol, setSymbol] = useState(LS.get('tc.symbol', 'BTCUSDT'));
  const [tf, setTf] = useState(LS.get('tc.tf', '1h'));
  const [theme, setTheme] = useState<'light'|'dark'>(LS.get('tc.theme', 'dark'));
  const [data, setData] = useState<Candle[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [err, setErr] = useState<string| null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(LS.get('tc.watch', ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT']));
  const [orders, setOrders] = useState<Order[]>(LS.get('tc.orders', []));
  const [positions, setPositions] = useState<Position[]>(LS.get('tc.pos', []));
  const [qty, setQty] = useState<number>(LS.get('tc.qty', 0.001));

  // persist
  useEffect(() => { LS.set('tc.symbol', symbol); }, [symbol]);
  useEffect(() => { LS.set('tc.tf', tf); }, [tf]);
  useEffect(() => { LS.set('tc.theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  useEffect(() => { LS.set('tc.watch', watchlist); }, [watchlist]);
  useEffect(() => { LS.set('tc.orders', orders); }, [orders]);
  useEffect(() => { LS.set('tc.pos', positions); }, [positions]);
  useEffect(() => { LS.set('tc.qty', qty); }, [qty]);

  // fetch data
  async function load() {
    setLoading(true); setErr(null);
    try {
      const d = await fetchKlines(symbol, TF_TO_BINANCE[tf], 600);
      setData(d);
    } catch(e:any) { setErr(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [symbol, tf]);
  // refresh every second
  useEffect(() => {
    const id = setInterval(() => load(), 1000);
    return () => clearInterval(id);
  }, [symbol, tf]);

  const last = data.at(-1)?.close ?? 0;

  // paper trading logic (naive)
  function place(side: 'BUY'|'SELL') {
    if (!qty || qty <= 0) return alert('Enter quantity > 0');
    const price = last;
    const ts = Date.now();
    const id = uid();
    const order: Order = { id, symbol, side, qty, price, ts };
    setOrders(o => [order, ...o]);

    if (side === 'BUY') {
      setPositions(ps => [...ps, { id, symbol, side: 'LONG', qty, entry: price, ts }]);
    } else {
      setPositions(ps => {
        const idx = ps.findIndex(p => p.symbol === symbol && p.side === 'LONG');
        if (idx >= 0) {
          const p = ps[idx];
          const remain = p.qty - qty;
          if (remain > 1e-12) {
            const updated = [...ps];
            updated[idx] = { ...p, qty: remain };
            return updated;
          } else {
            const updated = [...ps];
            updated.splice(idx, 1);
            return updated;
          }
        }
        // allow short
        return [...ps, { id, symbol, side: 'SHORT', qty, entry: price, ts }];
      });
    }
  }

  function pnlOf(p: Position) {
    const dir = p.side === 'LONG' ? 1 : -1;
    return (last - p.entry) * p.qty * dir;
  }
  const totalPnL = positions.reduce((a, p) => a + pnlOf(p), 0);

  function addToWatch(sym: string) {
    sym = sym.toUpperCase().replace(/\s+/g,'');
    if (!sym.endsWith('USDT')) sym += 'USDT';
    if (!watchlist.includes(sym)) setWatchlist(w => [sym, ...w]);
  }
  function removeFromWatch(sym: string) {
    setWatchlist(w => w.filter(s => s !== sym));
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-2xl font-bold">📈 TradeChart</div>
          <div className="hidden md:flex items-center gap-2">
            <input className="input w-48" placeholder="Symbol (e.g. BTCUSDT)" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
            <select className="select" value={tf} onChange={e => setTf(e.target.value)}>
              {Object.keys(TF).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <button className="btn" onClick={() => load()}>{isLoading ? 'Loading…' : 'Refresh'}</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '🌙' : '☀️'}</button>
            <a className="btn" href="https://binance.com" target="_blank" rel="noreferrer">Data: Binance</a>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto w-full grow px-4 py-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left rail: Watchlist */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Watchlist</h2>
              <button className="btn" onClick={() => setWatchlist([])}>Clear</button>
            </div>
            <div className="flex gap-2 mb-2">
              <input className="input" placeholder="Add symbol (e.g. DOGEUSDT)" onKeyDown={e => {
                if (e.key === 'Enter') { addToWatch((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value=''; }
              }} />
              <button className="btn" onClick={() => {
                const input = prompt('Symbol (e.g. ARBUSDT)');
                if (input) addToWatch(input);
              }}>Add</button>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {watchlist.map(s => (
                <li key={s} className={"py-2 flex items-center justify-between " + (s===symbol ? "font-semibold" : "")}>
                  <button className="text-left" onClick={() => setSymbol(s)}>{s}</button>
                  <button className="text-red-500 hover:underline" onClick={() => removeFromWatch(s)}>remove</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Orders */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Order Ticket (Paper)</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="label">Symbol</div>
                <input className="input" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
              </div>
              <div>
                <div className="label">Qty</div>
                <input type="number" step="any" className="input" value={qty} onChange={e => setQty(parseFloat(e.target.value))} />
              </div>
            </div>
            <div className="label mb-2">Last: <span className="font-mono">{fmt(last, 6)}</span></div>
            <div className="flex gap-2">
              <button className="btn-primary grow" onClick={() => place('BUY')}>Buy</button>
              <button className="btn grow" onClick={() => place('SELL')}>Sell</button>
            </div>
          </div>

          {/* Positions */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Positions</h2>
              <div className={"font-semibold " + (totalPnL>=0 ? "text-emerald-500" : "text-red-500")}>{totalPnL>=0?'+':''}{fmt(totalPnL, 4)}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-zinc-500">
                <tr><th className="text-left">Symbol</th><th className="text-right">Side</th><th className="text-right">Qty</th><th className="text-right">Entry</th><th className="text-right">PnL</th><th></th></tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td>{p.symbol}</td>
                    <td className="text-right">{p.side}</td>
                    <td className="text-right">{fmt(p.qty, 6)}</td>
                    <td className="text-right">{fmt(p.entry, 6)}</td>
                    <td className={"text-right " + (pnlOf(p)>=0 ? "text-emerald-500" : "text-red-500")}>{pnlOf(p)>=0?'+':''}{fmt(pnlOf(p), 4)}</td>
                    <td className="text-right">
                      <button className="btn" onClick={() => {
                        // close at market
                        const side = p.side === 'LONG' ? 'SELL' : 'BUY';
                        setOrders(o => [{ id: uid(), symbol: p.symbol, side, qty: p.qty, price: last, ts: Date.now() }, ...o]);
                        setPositions(ps => ps.filter(x => x.id !== p.id));
                      }}>Close</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Orders history */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Orders</h2>
              <button className="btn" onClick={() => setOrders([])}>Clear</button>
            </div>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {orders.map(o => (
                <li key={o.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-2">
                  <div className="flex justify-between text-sm">
                    <div>{o.side} {o.qty} {o.symbol}</div>
                    <div className="font-mono">{fmt(o.price, 6)}</div>
                  </div>
                  <div className="text-xs text-zinc-500">{new Date(o.ts).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main chart */}
        <section className="lg:col-span-3 space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold mr-2">{symbol} · {tf}</h2>
              <div className="flex items-center gap-2">
                <button className={"btn " + (tf==='1s'?'ring-2 ring-blue-500':'')} onClick={() => setTf('1s')}>1s</button>
                <button className={"btn " + (tf==='1m'?'ring-2 ring-blue-500':'')} onClick={() => setTf('1m')}>1m</button>
                <button className={"btn " + (tf==='5m'?'ring-2 ring-blue-500':'')} onClick={() => setTf('5m')}>5m</button>
                <button className={"btn " + (tf==='15m'?'ring-2 ring-blue-500':'')} onClick={() => setTf('15m')}>15m</button>
                <button className={"btn " + (tf==='1h'?'ring-2 ring-blue-500':'')} onClick={() => setTf('1h')}>1h</button>
                <button className={"btn " + (tf==='4h'?'ring-2 ring-blue-500':'')} onClick={() => setTf('4h')}>4h</button>
                <button className={"btn " + (tf==='1d'?'ring-2 ring-blue-500':'')} onClick={() => setTf('1d')}>1d</button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {isLoading && <span className="text-sm text-zinc-500">Loading…</span>}
                {err && <span className="text-sm text-red-500">{String(err)}</span>}
              </div>
            </div>
            <ChartPane symbol={symbol} tf={tf} data={data} overlays={{ sma: 20, ema: 50 }} theme={theme} />
          </div>

          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Prices are for informational purposes only. This is a demo; not investment advice.
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-3 text-center text-sm text-zinc-500">
        TradeChart © {new Date().getFullYear()} — Built with React, Tailwind, and Lightweight Charts.
      </footer>
    </div>
  );
}

// Boot
const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl!);
root.render(React.createElement(App));
