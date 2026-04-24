'use strict';
/**
 * BTC Polymarket 15-MINUTE Momentum Bot
 * =======================================
 * Strategy : Entry $0.65 | TP $0.75 | SL $0.40
 * Logic    : Momentum breakout — enters when price reaches entry level.
 * Mode     : Runs in DRY-RUN by default (no real orders).
 *            Pass --live flag to execute real trades.
 *
 * How it works:
 *   1. Discovers the current 15-minute BTC market on Polymarket.
 *   2. Watches for YES or NO price to reach $0.65 (momentum confirmation).
 *   3. Enters the trade and monitors for TP ($0.75) or SL ($0.40).
 *   4. If neither triggers, exits 60 seconds before market close.
 *   5. Saves all trade history to trades_15m.json for dashboard display.
 */

require('dotenv').config();
const { ClobClient, SignatureType, Side } = require('@polymarket/clob-client');
const { ethers } = require('ethers');
const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

// ─── STRATEGY SETTINGS (customise these) ──────────────────────────────────────
const BUY_PRICE      = 0.65;   // Entry price
const SELL_PRICE     = 0.75;   // Take-profit price
const STOP_LOSS      = 0.40;   // Stop-loss price
const ORDER_SIZE_USD = 5.00;   // Dollar amount per trade
const POLL_MS        = 500;    // Price-check interval (ms)
const DRY_RUN        = !process.argv.includes('--live');

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
const GAMMA_HOST = 'https://gamma-api.polymarket.com';
const CLOB_HOST  = 'https://clob.polymarket.com';

// ─── VIRTUAL PORTFOLIO ────────────────────────────────────────────────────────
const STARTING_BALANCE = 15.00;
const TRADES_FILE      = path.join(__dirname, 'trades_15m.json');

function loadStats() {
    if (fs.existsSync(TRADES_FILE)) {
        try { return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')); } catch (_) {}
    }
    return { balance: STARTING_BALANCE, equity: STARTING_BALANCE, trades: [], lastTradedSlug: null, activeTrade: null };
}

function saveStats(stats) {
    fs.writeFileSync(TRADES_FILE, JSON.stringify(stats, null, 2));
}

let VS = loadStats();

// ─── LOGGING ──────────────────────────────────────────────────────────────────
const LOG = path.join(__dirname, 'bot_15m.log');

function log(level, msg) {
    const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${ts}] [${level.padEnd(5)}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG, line + '\n');
}

const info   = m => log('INFO',  m);
const warn   = m => log('WARN',  m);
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const nowSec = ()  => Math.floor(Date.now() / 1000);

// ─── POLYMARKET CLIENT ────────────────────────────────────────────────────────
let _client = null;

function getClient() {
    if (_client) return _client;
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const wallet   = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY, provider);
    _client = new ClobClient(
        CLOB_HOST, 137, wallet,
        { key: process.env.POLY_API_KEY, secret: process.env.POLY_API_SECRET, passphrase: process.env.POLY_API_PASSPHRASE },
        SignatureType.POLY_PROXY, process.env.PROXY_WALLET_ADDRESS
    );
    return _client;
}

// ─── MARKET DISCOVERY ─────────────────────────────────────────────────────────
function getSlug(ts) {
    const startOf15m = Math.floor(ts / 900) * 900;
    return `btc-updown-15m-${startOf15m}`;
}

async function fetchPrices(yesTokenId, noTokenId) {
    try {
        const [yesRes, noRes] = await Promise.all([
            axios.get(`${CLOB_HOST}/midpoint?token_id=${yesTokenId}`, { timeout: 3000 }),
            axios.get(`${CLOB_HOST}/midpoint?token_id=${noTokenId}`,  { timeout: 3000 }),
        ]);
        return { yesPrice: parseFloat(yesRes.data.mid), noPrice: parseFloat(noRes.data.mid) };
    } catch (e) {
        return null;
    }
}

// ─── TRADE RECORDING ──────────────────────────────────────────────────────────
function recordTrade({ slug, side, entry, exit, pnl, type, entryTime, exitTime }) {
    VS.balance += pnl;
    VS.equity   = VS.balance;
    VS.activeTrade = null;
    VS.trades.push({
        id: `15M-${Date.now()}`, market: slug, side, entry, exit,
        size: ORDER_SIZE_USD,
        shares: (ORDER_SIZE_USD / entry).toFixed(2),
        pnl: pnl.toFixed(4),
        entryTime, exitTime,
        timestamp: new Date().toISOString(),
        type: pnl > 0 ? 'WIN' : 'LOSS'
    });
    saveStats(VS);
    info(`TRADE CLOSED: ${type} | PnL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(4)}`);
}

// ─── TRADE MONITORING ─────────────────────────────────────────────────────────
async function monitorTrade(market, tradeState) {
    const { slug, yesTokenId, noTokenId, endTs } = market;
    const { side, tokenId, entryTime } = tradeState;
    const isYes = side.startsWith('YES');

    info(`MONITORING: ${slug} | ${side} | Entry $${BUY_PRICE}`);

    while (true) {
        const now = nowSec();

        // Timer exit: close position 60 seconds before market end
        if (now >= endTs - 60) {
            const prices = await fetchPrices(yesTokenId, noTokenId);
            const current = isYes ? (prices?.yesPrice || 0) : (prices?.noPrice || 0);
            const pnl = (current - BUY_PRICE) * (ORDER_SIZE_USD / BUY_PRICE);
            recordTrade({ slug, side, entry: BUY_PRICE, exit: current, pnl, type: 'TIMER', entryTime, exitTime: new Date().toISOString() });
            return;
        }

        const prices = await fetchPrices(yesTokenId, noTokenId);
        if (prices) {
            const current = isYes ? prices.yesPrice : prices.noPrice;

            // Take-profit hit
            if (current >= SELL_PRICE) {
                const pnl = (SELL_PRICE - BUY_PRICE) * (ORDER_SIZE_USD / BUY_PRICE);
                recordTrade({ slug, side, entry: BUY_PRICE, exit: SELL_PRICE, pnl, type: 'WIN', entryTime, exitTime: new Date().toISOString() });
                return;
            }

            // Stop-loss hit
            if (current <= STOP_LOSS) {
                const pnl = (STOP_LOSS - BUY_PRICE) * (ORDER_SIZE_USD / BUY_PRICE);
                if (!DRY_RUN) {
                    try {
                        const bal = await getClient().getTokenBalance(tokenId);
                        if (parseFloat(bal) > 0) {
                            const signed = await getClient().createOrder({ tokenID: tokenId, price: 0.01, side: Side.SELL, size: parseFloat(bal) });
                            await getClient().postOrder(signed, 'GTC');
                        }
                    } catch (e) { warn(`SL liquidation error: ${e.message}`); }
                }
                recordTrade({ slug, side, entry: BUY_PRICE, exit: STOP_LOSS, pnl, type: 'LOSS', entryTime, exitTime: new Date().toISOString() });
                return;
            }
        }
        await sleep(POLL_MS);
    }
}

// ─── TRADE CYCLE ──────────────────────────────────────────────────────────────
async function runCycle(market) {
    const { slug, yesTokenId, noTokenId, endTs } = market;
    info(`CYCLE: ${slug} | Watching for $${BUY_PRICE} momentum breakout...`);

    let filledSide = null;
    while (!filledSide) {
        if (nowSec() >= endTs - 300) return; // Stop looking 5 min before end

        const prices = await fetchPrices(yesTokenId, noTokenId);
        if (prices) {
            if (prices.yesPrice >= BUY_PRICE && prices.yesPrice <= BUY_PRICE + 0.05) {
                filledSide = 'YES (UP)';
            } else if (prices.noPrice >= BUY_PRICE && prices.noPrice <= BUY_PRICE + 0.05) {
                filledSide = 'NO (DOWN)';
            }
        }
        if (!filledSide) await sleep(POLL_MS);
    }

    info(`ENTRY: ${filledSide} at $${BUY_PRICE}`);

    const isYes   = filledSide.startsWith('YES');
    const tokenId = isYes ? yesTokenId : noTokenId;
    const tradeState = { side: filledSide, tokenId, entryTime: new Date().toISOString() };

    // Save active trade for crash recovery
    VS.activeTrade = { market, tradeState };
    saveStats(VS);

    // Place sell order on Polymarket (live mode only)
    if (!DRY_RUN) {
        try {
            const shares = parseFloat((ORDER_SIZE_USD / BUY_PRICE).toFixed(4));
            const signed = await getClient().createOrder({ tokenID: tokenId, price: SELL_PRICE, side: Side.SELL, size: shares });
            await getClient().postOrder(signed, 'GTC');
        } catch (e) { warn(`Order placement error: ${e.message}`); }
    }

    await monitorTrade(market, tradeState);
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
async function main() {
    info(`BTC 15-MINUTE MOMENTUM started | DRY_RUN=${DRY_RUN}`);

    // Auto-recovery: resume any trade that was active before a crash
    if (VS.activeTrade) {
        info('AUTO-RECOVERY: Resuming active trade from disk...');
        await monitorTrade(VS.activeTrade.market, VS.activeTrade.tradeState);
    }

    let lastTradedSlug = VS.lastTradedSlug || null;

    while (true) {
        try {
            const now  = nowSec();
            const slug = getSlug(now);

            if (slug === lastTradedSlug) { await sleep(15000); continue; }

            const res = await axios.get(`${GAMMA_HOST}/markets?slug=${slug}`, { timeout: 4000 });
            if (res.data && res.data.length) {
                const mkt   = res.data[0];
                const endTs = Math.floor(new Date(mkt.endDate).getTime() / 1000);

                if (mkt.closed || (endTs - now) < 180) {
                    lastTradedSlug = slug;
                    continue;
                }

                const raw    = mkt.clobTokenIds;
                const tokens = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');

                await runCycle({ slug: mkt.slug, yesTokenId: tokens[0], noTokenId: tokens[1], endTs });
                lastTradedSlug     = slug;
                VS.lastTradedSlug  = slug;
                saveStats(VS);
            }
        } catch (e) {
            warn(`Main loop error: ${e.message}`);
            await sleep(10000);
        }
    }
}

main();
