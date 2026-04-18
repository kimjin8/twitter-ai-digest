# Prompt: Curate a High-Signal Twitter Account List for an AI Intelligence Digest

## Context

I run an automated daily digest called "Twitter AI Intelligence Brief." It monitors Twitter/X accounts, fetches their tweets from the last 24 hours, and uses Gemini AI to synthesize the most important developments into an executive-level HTML email briefing.

**Audience:** Seed-to-Series-A software founders who are non-technical. They need to stay informed on AI developments that affect their decisions — hiring, vendor choice, build/buy, technical risk, and market timing.

**The digest covers three pillars:**
1. **Tools & Products** — New AI tools, product launches, platform updates, developer tooling, infrastructure shifts (e.g., Claude Code leak, MiniMax open-weights release, LiteLLM supply chain breach)
2. **Industry Intelligence** — Funding, M&A, market shifts, regulatory moves, competitive dynamics (e.g., OpenAI secondary market collapse, federal AI preemption, China AI policy)
3. **Research & Discoveries** — Papers, model capabilities/constraints, alignment findings, benchmarks (e.g., frontier model control deficits, new reasoning architectures, scaling law discoveries)

## The Problem

My current list of 100 accounts is producing poor signal-to-noise. In a typical 24-hour window:
- **78 accounts produce zero qualifying tweets** (they tweet weekly, not daily, or are inactive)
- **4 accounts produce 70% of all tweets**, and most of that is low-quality:
  - @Ronald_vanLoon: 28 tweets/day — almost entirely hashtag-spammed reshares of others' content ("Six-Legged Innovation: A Hexapod #Robotics #Innovation #Tech"). Zero original analysis.
  - @Scobleizer: 16 tweets/day — self-promotion, personal anecdotes, scattered takes
  - @GaryMarcus: 14 tweets/day — AI criticism/policy (higher quality, but also filler like "woohoo!!!")
  - @DataChaz: 12 tweets/day — mix of product news and memes

Meanwhile, the accounts that produce the most actionable insights (Karpathy, Chollet, Nathan Benaich, etc.) tweet 0-1 times/day and get buried.

## Current Account List (100 accounts)

```
lexfridman, sama, kaifulee, ID_AA_Carmack, AndrewYNg, karpathy, 2morrowknight, ylecun, Scobleizer, drfeifei, KirkDBorne, fchollet, rowancheung, antgrasso, demishassabis, Ronald_vanLoon, TamaraMcCleary, geoffreyhinton, goodfellow_ian, jeffdean, erikbryn, timnitgebru, oriolvinyalsml, ceobillionaire, soumithchintala, waitin4agi_, sallyeaves, bernardmarr, fabiomoioli, pascal_bornet, GaryMarcus, thatroblennon, randal_olson, Nicochan33, chrismessina, iainljbrown, HaroldSinnott, DataChaz, mrgreen, NandoDF, clairesilver12, katecrawford, drhassanrashidi, abhi1thakur, yoheinakajima, YuHelenYu, nigewillson, _karenhao, nathanlands, ingliguori, mrogati, oliverchristie, mfordfuture, nathanbenaich, terenceleungsf, alliekmiller, CatherineAdenle, bilawalsidhu, marcusborba, miketamir, grok_, vinod1975, svenphilipsen, bamitav, fogoros, CadeMetz, rodneyabrooks, wellingmax, marktabnet, etzioni, alexjc, genekogan, mjrobbins, localghost, bobgourley, andyjankowski, paulroetzer, SourabhSKatoch, bobviolino, terence_mills, johnchavens, debashis_dutta, davidwkenny, learnopencv, petitegeek, faustospain, wil_bielert, sarahburnett, marek_rosa, sudalairajkumar, hsryueli, Whats_AI, inma_martinez, pandeyajay7, kath0134, ibarkin, rschmelzer, jainkunal, DaphneKoller, mvollmer1
```

## Your Task

Build me a new curated list of **60-75 Twitter/X accounts** optimized for this digest. The list must:

### Selection Criteria

1. **Active tweeters.** The account must tweet at least 2-3 times per week about AI/tech. Accounts that tweet monthly or are largely inactive should be excluded — they waste API slots.

2. **Original thinkers, not aggregators.** Prioritize accounts that share original analysis, opinions, or insider knowledge. Exclude accounts whose primary behavior is resharing others' content with hashtag decoration (e.g., "Title by @someone #AI #ML #Innovation #Tech").

3. **Founder-actionable signal.** The account's tweets should regularly touch topics that affect a startup founder's decisions: new tools, pricing changes, model capabilities, funding shifts, regulatory moves, hiring market signals, build/buy trade-offs.

4. **Diverse coverage across all three pillars.** The list should not be 90% researchers or 90% VCs. Aim for roughly:
   - **~25-30 accounts** covering Tools & Products (AI engineers, developer advocates, product builders, infra people)
   - **~15-20 accounts** covering Industry Intelligence (VCs, analysts, journalists, executives)
   - **~15-20 accounts** covering Research & Discoveries (researchers, lab leads, alignment/safety people)
   - Some accounts will naturally span multiple pillars — that's fine.

5. **Mix of "marquee" and "practitioner" voices.** Include both high-profile leaders (Altman, Karpathy, Hassabis) who tweet rarely but with high impact, AND mid-tier practitioners/builders who tweet more frequently with hands-on insights. The marquee names provide authority; the practitioners provide daily coverage.

### What to Exclude

- **Hashtag aggregators** who reshare others' content with no original commentary
- **Corporate marketing accounts** (brand accounts, enterprise sales content)
- **Pure commentary/culture war accounts** with no technical or business substance
- **Accounts that tweet <1x/month** about AI (waste of API monitoring)
- **Accounts focused on hardware, physical robotics, IoT, or non-AI tech** unless they directly intersect with software/AI decisions

### Output Format

Return the list in this exact format:

```
## Pillar 1: Tools & Products
| Handle | Name | Why included |
|--------|------|-------------|
| @karpathy | Andrej Karpathy | Former Tesla AI lead, tweets detailed technical analysis of AI tools and models |
...

## Pillar 2: Industry Intelligence
| Handle | Name | Why included |
|--------|------|-------------|
...

## Pillar 3: Research & Discoveries
| Handle | Name | Why included |
|--------|------|-------------|
...

## Cross-Pillar
| Handle | Name | Why included |
|--------|------|-------------|
...
```

For each account, include a one-line justification explaining what signal they provide that's relevant to a startup founder.

After the tables, provide:
1. A **comma-separated list** of all handles (no @ prefix) ready to paste into a config file
2. A **"removed from current list" section** listing which current accounts were cut and a one-line reason why
3. A **coverage gap analysis** — are there any important topic areas (e.g., AI regulation, open-source models, AI security, specific geographies) that are underrepresented?
