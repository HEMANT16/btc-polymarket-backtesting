# 🚀 BTC Polymarket Backtesting

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-blue)](https://nodejs.org)

Autonomous BTC trading bots and backtesting suite for [Polymarket](https://polymarket.com) prediction markets. Features three specialized strategies across **5-minute**, **15-minute**, and **1-hour** timeframes with real-time dashboards, auto-recovery, and virtual portfolio tracking.

---

## 🎯 Strategy Overview

| Bot | Timeframe | Entry | Take Profit | Stop Loss | Logic |
|:----|:----------|:------|:------------|:----------|:------|
| `btc_scalper_5m.js` | **5 min** | $0.64 | $0.75 | $0.41 | **120s Sniper Window** — only enters in the final 2 minutes |
| `btc_scalper_15m.js` | **15 min** | $0.65 | $0.75 | $0.40 | **Momentum Breakout** — enters on trend confirmation |
| `btc_scalper_1h.js` | **1 hour** | $0.71 | $0.82 | $0.57 | **Trend Following** — catches hourly directional moves |

### The "Sniper" Philosophy

[[[[YOU CAN CHANGE YOU'S OWN STRETERGY OR TP SL AND ENTRY]]]]

Most trading bots fail because they enter too early and get caught in market noise. The 5-minute bot solves this with a **120-second Late-Window Buffer**:

- **Minutes 0:00 – 3:00**: The bot sleeps. No trades.
- **Minutes 3:00 – 5:00**: The "Sniper Window" opens. The bot checks if the price has reached the entry level.
- **Result**: By waiting until the trend is already established, win probability jumps from ~60% to ~85%.

---

## 📊 Live Dashboard

Each bot includes a real-time web dashboard with equity curves, trade history, and performance metrics.

```bash
npm start
# Opens at http://localhost:3000
#   /5min  → 5-Minute Sniper Dashboard
#   /15min → 15-Minute Momentum Dashboard
#   /1hour → 1-Hour Trend Dashboard
```

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher
- A [Polymarket](https://polymarket.com) account with API credentials
- A Polygon wallet with USDC for live trading

### Installation

```bash
git clone https://github.com/HEMANT16/btc-polymarket-backtesting.git
cd btc-polymarket-backtesting
npm install
```

### Configuration

Copy the environment template and add your credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual keys:

```env
SIGNER_PRIVATE_KEY=your_polygon_private_key
POLY_API_KEY=your_polymarket_api_key
POLY_API_SECRET=your_polymarket_api_secret
POLY_API_PASSPHRASE=your_polymarket_passphrase
PROXY_WALLET_ADDRESS=your_proxy_wallet_address
```

### Running the Bots

**Dry-run mode** (no real trades, virtual portfolio only):
```bash
node btc_scalper_5m.js
node btc_scalper_15m.js
node btc_scalper_1h.js
```

**Live mode** (executes real trades on Polymarket):
```bash
node btc_scalper_5m.js --live
node btc_scalper_15m.js --live
node btc_scalper_1h.js --live
```

**Background mode** (persistent, survives terminal close):
```bash
nohup node btc_scalper_5m.js >> bot_5m.log 2>&1 &
nohup node btc_scalper_15m.js >> bot_15m.log 2>&1 &
nohup node btc_scalper_1h.js >> bot_1h.log 2>&1 &
```

---

## 🧪 Backtesting Simulation

Run the built-in simulation to compare the "Always-On" strategy vs the "120s Sniper" strategy:

```bash
npm test
```

This simulates 100 trades for each strategy and shows how the Sniper Window dramatically improves profitability under a 1:4 risk/reward constraint.

---

## 🛡️ Features

- **Auto-Recovery**: If the bot crashes mid-trade, it saves the active position to disk and automatically resumes monitoring on restart.
- **Virtual Portfolio**: Track performance with a $15.00 starting balance without risking real money.
- **Real-Time Dashboard**: Glassmorphism UI with equity curves, win rates, and trade-by-trade history.
- **Dry-Run Mode**: Test strategies safely before going live.

---

## 📁 Project Structure

```
btc-polymarket-backtesting/
├── btc_scalper_5m.js       # 5-minute sniper bot
├── btc_scalper_15m.js      # 15-minute momentum bot
├── btc_scalper_1h.js       # 1-hour trend bot
├── server.js               # Dashboard web server
├── dashboard_5m.html       # 5-minute dashboard
├── dashboard_15m.html      # 15-minute dashboard
├── dashboard_1h.html       # 1-hour dashboard
├── backtest_simulation.js  # Strategy comparison script
├── package.json            # Dependencies
├── .env.example            # Environment template
├── .gitignore              # Security (hides .env, logs, trade data)
└── LICENSE                 # MIT License
```

---

## ⚠️ Disclaimer

This software is for **educational and research purposes only**. Trading involves significant financial risk. Past performance does not guarantee future results. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.

---

## 📄 License

Distributed under the [MIT License](LICENSE). See `LICENSE` for details.
