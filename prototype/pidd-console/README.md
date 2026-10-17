# PIDD Console — interactive prototype

A thin end-to-end slice of PIDD that runs entirely in the browser: synthetic banking telemetry → five-model detection ensemble → multi-agent ReAct investigation → tiered safety gate → remediation → feedback-driven threshold recalibration.

## Run it

Open `index.html` in any modern browser. No build, no server, no dependencies beyond Google Fonts.

- **Standalone** (opened from disk or any web server): agents run in **Scripted** mode — pre-written reasoning that calls the console's real tools against live simulated state.
- **Inside the Claude viewer** (published as a Claude artifact with the `sample` capability): **Claude agents** mode runs a genuine ReAct loop on the viewer's Claude account, calling the same page tools. Falls back to scripted mode on any failure.

## What it demonstrates

| PIDD concept | Prototype implementation | Spec |
|---|---|---|
| Six observability domains | Infrastructure (node memory), Application (NetBanking p95), Database (Core DB tablespace), Network (DC–DR packet loss), Security (auth failures), Business (UPI success rate) — diurnal baselines + noise | TS-02 |
| Five-model ensemble & score fusion | EWMA z-score, CUSUM drift, seasonal residual, isolation forest (level × slope), trend forecaster with time-to-SLO-breach; weighted fusion vs per-domain θ | TS-05 |
| Behavioural baselining | Learned time-of-day profile; robust σ from MAD of residuals | TS-06 |
| Decision & incident creation | Incident opens when ensemble ≥ θ for 2 consecutive minutes; records lead time to projected breach; later anomalies attach as correlated signals | TS-07, TS-08 |
| Specialist agents / multi-agent ReAct | Triage, Correlation & RCA, Change Intelligence, Remediation Planner, Safety & Compliance, Communications; tools: `get_domain_metrics`, `get_recent_changes`, `get_topology`, `search_runbooks` | TS-14, TS-15 |
| Tiered safety classification | Deterministic policy outside the model: T0/T1 auto-execute, T2 human approval, T3 manual only; P1 elevates T1 → T2; unknown actions blocked | TS-16 |
| Autonomous threshold recalibration | Operator TP/FP verdict reweights contributing detectors and adjusts the domain θ, with an audit history | TS-11 |
| Regulatory context | Compliance agent assesses RBI, NPCI and CERT-In (6-hour) obligations | TS-10 |

## Fault scenarios

| Scenario | Primary signal | Effective fix |
|---|---|---|
| UPI switch latency creep | App p95 rising, then UPI success | `rollback_deploy` (T2) |
| Core DB tablespace fill | Tablespace trending to exhaustion | `expand_volume` (T1) / `purge_archive_logs` (T2) |
| NetBanking memory leak | Node memory, then latency | `restart_pod` (T1) / `rollback_deploy` (T2) |
| DC–DR link degradation | Packet loss | `reroute_link` (T2) |
| Credential-stuffing burst | Auth failures | `block_ip_range` / `throttle_traffic` (T2) |
| Festive traffic surge | Step in latency + memory (benign) | `scale_out` (T1) — use to demo a false-positive verdict |

## Limits

- Detectors are lightweight stand-ins for the production models in TS-05, sized to run in a browser.
- All telemetry, change records, topology and runbooks are synthetic.
- Remediation actions only change the simulation.
