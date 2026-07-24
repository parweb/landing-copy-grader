# Landing Copy Grader

**Does your landing page hero copy read as AI-generated?** Paste your headline, subheadline and CTA, get a **0–100 score** plus the exact lines to fix.

No LLM. No backend. No signup. One HTML file, ~19 KB, runs entirely in your browser — open it from `file://` on a plane if you want. Your text never leaves the page.

**[▶ Try the hosted version](https://1h-money-store.vercel.app/grader?utm_source=github&utm_medium=repo)** · or download [`grader.html`](grader.html) and double-click it.

![Screenshot of the grader scoring a hero 100/100 with per-dimension bars](docs/screenshot.png)

---

## Why deterministic instead of an LLM?

The obvious way to build a "does this sound AI-written?" tool is to ask an LLM. For this specific job, a fixed rule set is the better engineering choice:

| | Deterministic (this tool) | LLM call |
|---|---|---|
| **Same input → same score** | Always | No — non-deterministic, drifts across model versions |
| **Latency** | Instant, local | Network round-trip |
| **Cost / key** | Free, no API key | Per-call cost, key management |
| **Privacy** | Text never leaves the browser | Text sent to a third party |
| **Explainable** | You can read the exact rule that fired | Opaque; may hallucinate its reasoning |
| **Offline** | Yes | No |

There's an irony worth stating plainly: asking one language model whether copy "sounds like a language model" is circular. The tells that make copy read as generated — hype verbs, zero specifics, filler nouns, weak CTAs — are **surface, countable patterns**. You don't need a 100B-parameter model to count them; you need a good list and a scoring rubric. That's what this is.

### Honest limitations

This is a **linter for copy, not a ground-truth AI detector.** It scores *stylistic tells*, not authorship. Human copywriters write hype too, and a careful LLM can score 100. Treat the number as a fast heuristic — "here are the generic patterns in your text" — not a verdict on who or what wrote it. It's English-only and tuned for short hero copy (headline / subhead / CTA), not long-form.

## The heuristics

Five weighted dimensions sum to 100. Every rule is a plain function over the three input strings — read the whole thing in [`grader.html`](grader.html) (the scoring lives in one `grade()` function, ~40 lines).

**1. Anti-hype — 25 pts.** Starts at 25, subtracts penalties for the top "generated" tells:
- hype words (`revolutionize`, `unlock`, `seamless`, `leverage`, `supercharge`, `cutting-edge`, `game-changer`, … ~40 terms) — **−7 each**
- exclamation marks — **−5 each**
- emoji in the copy — **−4 each**
- ALL-CAPS words — **−4 each**

**2. Specificity — 25 pts.** Any digit anywhere → 25. No number → 8, with a partial rescue (+9) if there's a proof-shaped word (`%`, `x`, `hours`, `days`, `minutes`, `no`, `zero`). One concrete figure is the single fastest believability lift.

**3. Clarity — 25 pts.** Starts at 25, **−6 per filler word** (`solutions`, `platform`, `powerful`, `amazing`, `experience`, `journey`, `ecosystem`, `all-in-one`, … ~27 terms). These add length, not meaning.

**4. Headline shape — 13 pts.** Rewards a repeatable length. 3–10 words → 13; 11–12 → 9; >12 → 5; <3 → 7; empty → 0.

**5. CTA — 12 pts.** A specific action → 12. A generic CTA (`submit`, `learn more`, `get started`, `sign up`, `click here`, … ~14 terms) → 4. Empty → 0.

Word matching is whole-word and case-insensitive (regex-bounded, so `learn` inside `learned` doesn't false-positive). Then a verdict band: **≥80** reads human & sharp · **60–79** decent · **40–59** somewhat generic · **<40** reads AI-generated. You get up to six targeted fixes, each naming the exact count it found.

## Worked examples

Reproducible — run them yourself:

| Copy | Score | Verdict |
|---|---:|---|
| *"Revolutionize your workflow with our seamless, cutting-edge platform / Unlock powerful solutions that transform your business / Learn more"* | **32** | This reads AI-generated. |
| *"Cut invoice time from 3 days to 20 minutes / Turn your spreadsheet into a client-ready invoice, no template hunting. / Start your first invoice"* | **100** | Reads human & sharp. |

The first triggers: cut the hype words, add a number, delete filler, rewrite the CTA.

## Use it

- **Hosted:** <https://1h-money-store.vercel.app/grader>
- **Local:** download [`grader.html`](grader.html) and open it — no build, no dependencies, no network calls. The only external requests are two optional Google Fonts; block them and it falls back to system serif/mono.
- **Embed / fork:** it's one self-contained file. Swap the word lists or weights at the top of the `<script>` to fit your own voice guidelines.

## License

MIT — see [LICENSE](LICENSE). Fork it, ship it, rip out the parts you don't like.

---

*Built by the [1h Money Store](https://1h-money-store.vercel.app/?utm_source=github&utm_medium=repo). The hosted grader is a free tool; the store sells copy prompt packs and a landing-page template. No obligation — the grader stands on its own.*
