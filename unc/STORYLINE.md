# UNC — storyline & animation overview

Hook: everyone has an *unc* — the one who's seen it all, knows where the money went,
and tells you straight what to worry about. That's the product. (~6 min, 15 slides)

## Act 1 — The chaos
| # | Slide | Animation | Say |
|---|---|---|---|
| 1 | Title | Teal dot pops, the unc wordmark draws itself, "Company incorporated." wipes in | "Every company has one person who just knows what's going on. We built that person." |
| 2 | The problem | Five tools fly in from every corner and keep drifting, never lining up | "Your company is talking — it's just spread across five tools." |

## Act 2 — Enter unc
| # | Slide | Animation | Say |
|---|---|---|---|
| 3 | What UNC is | The same tools line up, collapse into one teal dot, the dot becomes the divider; Connect / See / Act appear | "UNC pulls it into one picture." |
| 4 | Ask your unc anything | Question types itself, thinking dots, answer streams word by word, sources light up | "Ask it anything. It answers from your data and shows where it looked." |
| 5 | Operating picture | 8 tiles drop in a wave, numbers count up, two teal dots pulse | "Eight signals, one screen." |
| 6 | Priorities | Rows appear, then the biggest mover grows and the rest step back | "What matters gets more of your screen." |
| 7 | **Live product** | The real workspace runs in a browser frame. A cursor clicks Overview → Finance → Tickets, types a question to Agent UNC (real answer), then opens Subscription | "This isn't a mock-up. Here's the workspace." |

## Act 3 — Why you'd buy it
| # | Slide | Animation | Say |
|---|---|---|---|
| 8 | One invoice | Six vendor bills drop into a pile, collapse into a giant teal 1 | "Six bills. One invoice." |
| 9 | Connections | Cards blink "Connecting", then click to teal "Connected" one by one | "Plugs into what you already use." |
| 10 | **Supabase** | Five nodes (client → auth → agent-chat → Postgres → Claude/Grok) with a data packet running through them | "Row-level security per company. No keys in the browser." |
| 11 | Privacy | Slow fades only — trust doesn't need fireworks | "Your data stays yours." |
| 12 | Plans | €29 and €79 count up, Growth lights up, Enterprise joke lands last | (pause for the laugh) |
| 13 | **Stripe checkout** | Test checkout types card 4242…, Subscribe → "Subscription active"; flow steps light up, webhook event lands | "One click. Stripe handles the card, the webhook switches the plan on." |

## Close
| # | Slide | Animation |
|---|---|---|
| 14 | Brand system | "Calm. Precise. Confident." word by word, swatches slide in |
| 15 | Closing | "meet the unc." — the teal dot from slide 1 returns as the full stop. Click the headline (or the teal link) to open the product demo |

## Controls
→ / Space / click right side: next · ← / click left side: back · **R** replays the current slide's animation ·
**F** fullscreen · `#5` in the URL jumps to slide 5 · swipe on phones.

## Where it runs
- Deck: https://erosuniversity.github.io/unc/ (live slide loads the app from `product/`)
- Clickable product: https://erosuniversity.github.io/unc/product/
- Local: http://127.0.0.1:8734/workspace/ → Brand presentation
- `./build.sh` rebuilds `dist/unc` and syncs the deck copy into the workspace.
