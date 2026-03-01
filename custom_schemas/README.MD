# GSCIX Custom STIX Schemas

This directory contains the custom STIX 2.1 Domain Objects (SDOs) that form the core of the **Geo-Strategic Cyber Intelligence (GSCI)** framework. These schemas extend standard STIX to allow for the modeling of geopolitical intent, strategic objectives, and multi-domain hybrid pressure.

## 🏛 Framework Overview

The GSCIX architecture follows a hierarchical flow of intelligence:
`Geo-Strategic Actor` → `Strategic Objective` → `Hybrid Campaign` → `Influence Vector` → `Strategic Impact` (evaluated via `Strategic Assessment`).

---

## 🎭 1. Geo-Strategic Actor (`x-geo-strategic-actor`)

Represents a state or non-state entity with the capacity to project power and pursue geopolitical goals.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Unique name of the actor. | e.g., "Federación Rusa", "People's Republic of China" |
| `strategic_alignment` | enum | Yes | The geopolitical block or ideology. | `NATO`, `BRICS`, `EU`, `Non-Aligned`, `Other` |
| `geopolitical_doctrine` | string | No | High-level strategy governing actions. | e.g., "Gerasimov Doctrine", "Unrestricted Warfare" |
| `revisionist_index` | number | No | Score (0-10) of intent to change the status quo. | 0 = Status Quo, 10 = High Revisionist |
| `strategic_ambiguity_score` | number | No | Conflict between public discourse and military capacity. | 0 = Transparent, 10 = Highly Ambiguous |
| `doctrine_type` | enum | No | Declared strategy. | `Stability-Oriented`, `status-quo`, `revisionist`, `expansionist` |
| `technological_modernization_rate` | number | No | Speed of military/tech advancement. | 0.0 to 10.0 |
| `first_seen` | timestamp | No | When the actor/doctrine first emerged. | ISO 8601 |
| `last_seen` | timestamp | No | Last observed activity of the actor. | ISO 8601 |

**Key Relations (Framework Internal):**
- `pursues` → `x-strategic-objective`.
- `executes` → `x-hybrid-campaign`.
- `generates` → `x-strategic-impact`.

**Key Relations (Cyber-STIX Linkage):**
- `controls` → `Threat-Actor-Group`, `Threat-Actor-Individual`.
- `sponsors` → `Threat-Actor-Group`, `Intrusion-Set`.

---

## 🎯 2. Strategic Objective (`x-strategic-objective`)

Defines the specific geopolitical goal an actor aims to achieve.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Short name of the objective. | e.g., "Electoral Interference" |
| `objective_type` | enum | Yes | Dimension of the objective. | `political`, `military`, `economic`, `societal` |
| `priority_level` | enum | No | Importance of the objective. | `low`, `medium`, `high`, `critical` |
| `time_horizon` | enum | No | Estimated duration to achieve. | `short-term` to `decadal` (10-30 years) |
| `civil_military_fusion` | boolean | No | Integrates civilian tech for military power. | true = Dual-use |
| `first_seen` | timestamp | No | When this objective was first identified. | ISO 8601 |
| `last_seen` | timestamp | No | When this objective was last active/valid. | ISO 8601 |

---

## 🌪 3. Hybrid Campaign (`x-hybrid-campaign`)

A "strategic container" that groups various operations (cyber, info, economic) under a single narrative.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Identifier for the campaign. | e.g., "Operation Steal-the-Vote" |
| `phase` | enum | Yes | Current state of the campaign. | `pre-conflict`, `escalation`, `sustained-pressure` |
| `velocity` | enum | No | Speed of implementation. | `fast-spike` vs `slow-drift` (infrastructural) |
| `nature` | list | No | Domains of the campaign. | `kinetic`, `cyber`, `infrastructural`, `cognitive`, `technological` |
| `escalation_risk_score` | number | No | Proxy for kinetic transition. | 0.0 to 10.0 |
| `first_seen` | timestamp | No | When the campaign's first operation was seen. | ISO 8601 |
| `last_seen` | timestamp | No | Last observed campaign operation. | ISO 8601 |

**Key Relations:**
- `integrates` → `x-influence-vector`, `Intrusion-Set`, `Attack-Pattern`.

---

## 📣 4. Influence Vector (`x-influence-vector`)

Models information operations and cognitive warfare narratives.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Name of the information operation. | e.g., "Narrative Energy-Crisis" |
| `narrative` | string | Yes | The core message being projected. | e.g., "Sanctions hurt the West more than Russia" |
| `channel` | string | No | Medium of dissemination. | e.g., "Telegram", "State Media", "Botnets" |
| `target_audience` | string | No | Group or population being influenced. | e.g., "EU Civil Society" |

---

## 📈 5. Strategic Impact (`x-strategic-impact`)

Evaluates the real-world consequences of campaigns on the target.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Name of the impact event. | e.g., "Baltic Instability" |
| `description` | string | No | Details of the observed effect. | |
| `political_destabilization_index` | number | No | Impact on institutional trust. | 0-10 |
| `economic_disruption_index` | number | No | Impact on markets/supply chains. | 0-10 |
| `alliance_fragmentation_score` | number | No | Impact on international coalitions. | 0-10 |
| `deterrence_signal_strength` | number | No | Impact on adversary's perceived cost. | 0-10 |
| `deterrence_signal_strength` | number | No | Impact on adversary's perceived cost. | 0-10 |
| `confidence_score` | number | Yes | Analyst confidence in this assessment. | 0-100% |
| `first_seen` | timestamp | No | When this effect was first achieved. | ISO 8601 |
| `last_seen` | timestamp | No | When this effect was last validated. | ISO 8601 |

---

## 🧠 6. Strategic Assessment (`x-strategic-assessment`)

Dynamic metrics generated by the GSCIX engine (or AI analysis) to forecast risk.

| Property | Type | Mandatory | Description | Values / Context |
| :--- | :--- | :---: | :--- | :--- |
| `name` | string | Yes | Name of the assessment. | e.g., "Threat Audit 2026" |
| `description` | string | No | Analyst notes or AI reasoning. | |
| `hybrid_pressure_index` | number | No | Aggregated "heat" from all campaigns. | HPI (0-10) |
| `escalation_probability_score` | number | No | Probability of escalation. | 0.0 to 1.0 (EPS) |
| `strategic_signaling_score` | number | No | Intent behind the activity. | 0-10 |
| `cyber_geopolitical_coupling_index` | number | No | Degree of correlation between cyber and diplomacy. | High coupling = Cyber is used as a signal. |
| `narrative_penetration_score` | number | No | Reach/impact of influence vectors. | 0-10 |
| `doctrine_capacity_divergence_score` | number | No | Conflict between doctrine and MODERNIZATION. | Audit metric (0-10) |
| `first_seen` | timestamp | No | Start of the assessment period. | ISO 8601 |
| `last_seen` | timestamp | No | End of the assessment period. | ISO 8601 |

**Key Relations:**
- `evaluates` → `x-geo-strategic-actor`, `x-hybrid-campaign`, `x-strategic-impact`.

---

## ✅ STIX 2.1 Compliance

GSCIX complies with the STIX 2.1 standard through the **Extension Definition** mechanism (Section 7.3). 

### Extension Registration
All custom semantics (`x-` objects and additional relationships) are formalized in the file:
[gscix-extension-definition.json](./gscix-extension-definition.json)

This file acts as the "manifesto" that allows other STIX-compliant systems to understand that:
1. The entities `x-geo-strategic-actor`, etc., are legitimate **SDOs (STIX Domain Objects)** within this namespace.
2. The relationships `pursues`, `executes`, etc., are valid **SROs (STIX Relationship Objects)** that extend the standard vocabulary.

> [!TIP]
> When sharing intelligence produced by GSCIX, ensure that you include the `extensions` field in each object pointing to the ID of our `extension-definition`.

---

## 🔗 Cyber-Strategic Linkage (OpenCTI Integration)

One of GSCIX's core capabilities is the "Cyber-Strategic Linkage," which allows connecting geo-strategic reasoning with technical evidence tracked in OpenCTI.

### Instrumentalization of APTs
Within the GSCI framework, **Geo-Strategic Actors** do not act directly in cyberspace but rather instrumentalize technical capabilities through two key relationships:

1.  **`controls` (Direct Control):** Used when a state actor has direct command over a cyber unit (e.g., The GRU controls "Unit 26165").
2.  **`sponsors` (Sponsorship):** Used for actors operating under the protection or funding of a state but maintaining operational autonomy (e.g., A state sponsors a cybercrime group for destabilization campaigns).

### The Strategic Attribution Flow
By linking an `x-geo-strategic-actor` with an OpenCTI `Intrusion-Set`:
- The analyst can see which **Strategic Objectives** (`x-strategic-objective`) are motivating the technical campaigns.
- GSCIX can calculate the **Cyber-Geopolitical Coupling Index** (`cyber_geopolitical_coupling_index`), which indicates if detected APT activity is a signal of a larger strategic escalation.

---

## 🏛 Grand Strategy Analytics: PRC Case Study

The GSCIX model has been refined to avoid "recency bias" by including grand strategy variables:

### 1. "Slow-Drift" Infrastructure Detection
While most intelligence models focus on the *fast-spike* (a ransomware or DDoS attack), GSCIX allows modeling **`slow-drift`** campaigns. This captures the construction of critical infrastructures (physical or digital) that do not present an immediate threat but alter the balance of power on **decadal** horizons.

### 2. Strategic Ambiguity Weighting (Divergence)
Many state actors (e.g., PRC in its 14th Five-Year Plan) use a discourse of stability while executing an operational military expansion. The **`doctrine_capacity_divergence_score`** variable allows the system to alert on risks even when the declared `doctrine_type` is `Stability-Oriented`, provided that the `technological_modernization_rate` suggests accelerated rearmament. This breaks the rigidity of binary "Revisionist vs Status Quo" labeling.

### 3. Civil-Military Fusion (`civil_military_fusion`)
This flag allows the analyst to mark objectives that appear purely economic or academic (e.g., research in semiconductors or 6G networks) but form an integral part of the long-term military power base.

---

## 📊 GSCIX Relationship Matrix (GSCI Model)

This table summarizes how entities connect to each other to form the intelligence graph.

| Source | Relationship | Target | Functional Purpose |
| :--- | :---: | :--- | :--- |
| `x-geo-strategic-actor` | `pursues` | `x-strategic-objective` | Links the actor with their political/military goals. |
| `x-geo-strategic-actor` | `executes` | `x-hybrid-campaign` | Defines the actor's active campaign. |
| `x-geo-strategic-actor` | `generates` | `x-strategic-impact` | Measures the actor's direct effect on the board. |
| `x-geo-strategic-actor` | `controls` | `Threat-Actor` | Direct technical attribution (Military unit). |
| `x-geo-strategic-actor` | `sponsors` | `Intrusion-Set` | Attribution by sponsorship (Proxies/Cybercrime). |
| `x-hybrid-campaign` | `integrates` | `x-influence-vector` | Adds the info-ops dimension to the campaign. |
| `x-hybrid-campaign` | `integrates` | `Intrusion-Set` | Adds the cyber dimension to the hybrid campaign. |
| `x-hybrid-campaign` | `targets` | `Identity` / `Location` | Defines the geographic or social target. |
| `x-influence-vector` | `targets` | `Identity` / `Sector` | Defines the narrative's target audience. |
| `x-strategic-assessment` | `evaluates` | `x-geo-strategic-actor` | Global risk assessment of the actor. |
| `x-strategic-assessment` | `evaluates` | `x-hybrid-campaign` | Assessment of campaign progress/danger. |
| `x-strategic-assessment` | `evaluates` | `x-strategic-impact` | Validation of reported effects. |

---

## 📦 7. Grouping Structure: STIX 2.1 Bundle

For interoperability and massive ingestion, GSCIX uses the STIX 2.1 `bundle` object. A bundle allows grouping domain objects (SDOs) and their relationships (SROs) into a single atomic container.

### GSCIX Bundle Example (Optimized)
This example shows how to group a national actor, their objectives, and the technical instrumentalization relationship in strict compliance with STIX 2.1.

```json
{
  "type": "bundle",
  "id": "bundle--23b8a10e-8947-414b-876a-7d499edec5b8",
  "spec_version": "2.1",
  "objects": [
    {
      "type": "x-geo-strategic-actor",
      "spec_version": "2.1",
      "id": "x-geo-strategic-actor--69cb80ad-659a-4844-b0cd-2854824a14c6",
      "name": "People's Republic of China (PRC)",
      "extensions": {
        "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8": {
          "strategic_alignment": "Revisionist",
          "revisionist_index": 9.2,
          "doctrine_capacity_divergence_score": 8.5
        }
      }
    },
    {
      "type": "x-strategic-objective",
      "spec_version": "2.1",
      "id": "x-strategic-objective--53b8aa36-b03d-49bf-8c8d-09aa399fdbfa",
      "name": "Technological Standards Sovereignty",
      "description": "Global leadership in 6G and sovereign network protocols.",
      "extensions": {
        "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8": {
          "priority_level": "high",
          "time_horizon": "decadal"
        }
      }
    },
    {
      "type": "relationship",
      "spec_version": "2.1",
      "id": "relationship--4dd1dd73-c3d2-4ca4-a787-beaa0243fba4",
      "source_ref": "x-geo-strategic-actor--69cb80ad-659a-4844-b0cd-2854824a14c6",
      "target_ref": "x-strategic-objective--53b8aa36-b03d-49bf-8c8d-09aa399fdbfa",
      "relationship_type": "pursues"
    }
  ]
}
```

> [!NOTE]
> GSCIX prefers the use of **UUIDv4** in object IDs to ensure the global uniqueness of the intelligence graph.
