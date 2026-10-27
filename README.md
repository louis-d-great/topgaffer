# TopGaffer

**The FPL assistant that remembers you.**

FPL shows your points. TopGaffer shows your decisions, and remembers them so you stop repeating mistakes.

Built for the [Tatum × Walrus "Total Recall" hackathon](https://tatum.io/hackathon/total-recall) (Track 1: Markets & Sports Prediction).

## The problem

Fantasy Premier League managers spend hours on stats sites and expert videos before every deadline. Every tool gives everyone the same projections, and none of them remember *you*: the hits that never paid off, the players you buy right after a big haul, the captain calls that keep costing you, or which experts' advice has actually worked.

## What TopGaffer does

- **Learns your season.** Enter an FPL team ID (no login, no wallet). TopGaffer reads every gameweek, captain, transfer and hit, and turns them into plain-language lessons: *"Your captain was the best option only 3 of 8 weeks."*
- **Deadline check.** Plan your captain and transfers on a live pitch. TopGaffer judges the plan against your own history and warns you before you repeat a mistake: *"You're taking a −4 again. Your last 5 hits returned −1 on average."*
- **Experts tracked by what they actually do.** Featured FPL creators are followed through their real FPL teams, so their records update themselves every gameweek. Each one has a full dashboard: points and rank against yours, every transfer and what happened next, captaincy, style and squad.
- **Ask TopGaffer.** An AI coach that answers from your data and your memories, and saves each conversation back to memory.
- **Locked plans.** Lock your plan before kickoff and its fingerprint is frozen on Sui, so nobody can say you changed it afterwards.

## How it uses Walrus, Tatum and Sui

| Piece | Role |
|---|---|
| **Walrus Memory** (mainnet) | Every gameweek review, lesson, locked plan and coach conversation is stored per manager. Lessons are re-written each gameweek, so memory shows how the picture of a manager changes. The deadline check and the coach recall memories by meaning before they answer. |
| **Tatum Sui gateway** (gRPC) | All Sui reads and writes go through Tatum. |
| **Sui** | Each locked plan creates a `Table { fingerprint → gameweek }` that is immediately frozen (immutable). The transaction time proves the plan existed before kickoff; the fingerprint (SHA-256 with a secret salt) keeps the picks hidden until revealed. The app pays the gas (about 0.004 SUI per lock), so managers never need a wallet. |

The memory loop: **decide → lock → gameweek plays → TopGaffer scores the decision → lesson saved to Walrus → next deadline, the warning changes.**

## Tech

Next.js 16 (App Router, TypeScript, Tailwind CSS 4) · `@mysten-incubation/memwal` · `@mysten/sui` with native gRPC to Tatum · public FPL API · Gemini (free tier) for the coach, with model fallback.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Open http://localhost:3000 and enter any FPL team ID.

### Environment variables

| Variable | Where to get it |
|---|---|
| `TATUM_API_KEY_MAINNET`, `TATUM_API_KEY_TESTNET` | [dashboard.tatum.io](https://dashboard.tatum.io) (free plan) |
| `MEMWAL_KEY`, `MEMWAL_ACCOUNT_ID` | [memory.walrus.xyz](https://memory.walrus.xyz) |
| `MEMWAL_SERVER_URL` | `https://relayer.memory.walrus.xyz` (mainnet) |
| `SUI_PRIVATE_KEY` | A **dedicated** wallet that pays for locks (`suiprivkey…`) |
| `SUI_NETWORK` | `testnet` (default) or `mainnet` |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) (free) |

## Notes

- FPL data comes from the public, undocumented FPL API and is only read server-side. Upcoming picks are hidden by FPL until each deadline, so expert records cover finished gameweeks.
- Club shirt images are loaded from FPL's image server for display; they are Premier League and club trademarks.
