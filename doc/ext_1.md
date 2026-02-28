# GSCIX Development Plan: Bridging Geopolitics and Cyber Execution

## Executive Summary
This plan outlines the development of a Geo-Strategic Cyber Intelligence (GSCI) extension for OpenCTI. The goal is to correlate high-level geopolitical indicators with specific cyber capabilities (APTs, Hacktivists) to enable predictive analysis of cyber operations based on geostrategic shifts.

---

## Phase 1: Enhanced Data Modeling (The Bridge)
To maintain STIX 2.1 compatibility while mapping Russia's (State) relationship to the GRU (APT) or KillNet (Hacktivist), we will use a hierarchical SDO (Standard Data Object) approach.

### 1.1 Custom Objects (SDOs)
* **`x-geo-strategic-actor`**: The "State" entity (e.g., The Russian Federation).
    * *Strategic Attributes:* Doctrine (Grey Zone), Revisionist Index, Alliances.
* **`x-strategic-objective`**: The "Why" (e.g., "Disrupt 2026 European Elections").

### 1.2 Mapping the Cyber Capabilities (The "How")
We will use standard STIX objects to represent the "arms" of the State:
* **`Threat-Actor` (Individual/Group):** Used for specific units like "Unit 26165 (GRU)" or "Fancy Bear". 
    * *Custom Property:* `x_agency_affiliation` (Military Intelligence, FSB, etc.).
* **`Intrusion-Set`:** Used for the persistent set of TTPs and patterns associated with these actors.
* **`Grouping`:** To cluster "Hacktivist" collectives that act as proxies for the state.

### 1.3 Strategic-Technical Relationships
We will implement the following relationship types to link the layers:
1.  **`x-geo-strategic-actor` --[controls]--> `Threat-Actor`**: Links the State to its official intelligence units.
2.  **`x-geo-strategic-actor` --[sponsors]--> `Threat-Actor`**: Links the State to proxy hacktivists or "patriotic" hackers.
3.  **`Threat-Actor` --[uses]--> `Intrusion-Set`**: Connects the unit to their known cyber campaigns and toolsets.
4.  **`Threat-Actor` --[executes]--> `x-hybrid-campaign`**: Ties the technical execution back to the strategic mission.

---

## Phase 2: OpenCTI Platform Integration
OpenCTI's Graph database allows us to visualize this hierarchy (State -> Agency -> APT -> TTP).

* **Schema Extension:** Update the `entityTypeDefinition` in OpenCTI to allow the `x-geo-strategic-actor` to be a valid source for "controls" and "sponsors" relationships.
* **Knowledge Graph Visualization:** Develop a custom "Strategic View" in the UI that displays the "Geopolitical Tree," showing how a single geostrategic tension (e.g., NATO expansion) propagates down to increased activity from specific GRU-linked APTs.

---

## Phase 3: The Predictive Engine (Correlation Logic)
The application will monitor "Strategic Indicators" to forecast "Cyber Actions":

| Strategic Indicator (Trigger) | Linked Capability (Actor) | Predicted Cyber Action |
| :--- | :--- | :--- |
| Diplomatic Expulsion | GRU-linked APTs | Destructive Wipers / Leak Ops |
| Economic Sanctions | SVR-linked APTs | Long-term espionage / IP Theft |
| Military Exercise | State-sponsored Hacktivists | DDoS / Website Defacements |

**Inference Engine Logic:**
If `x-geo-strategic-actor` (Russia) has `Strategic-Objective` (Eurasian Hegemony) and is in an `Escalation` phase, the engine automatically increases the "Threat Level" for all `Threat-Actors` linked via the `controls` relationship.

---

## Phase 4: OSINT & SIGINT Ingestion Pipeline
* **Geopolitics:** Ingest UN voting records, G7/BRICS statements, and troop movements (OSINT).
* **Cyber:** Ingest technical telemetry (IOCs) via TAXII/MISP.
* **Correlation:** A Python-based worker in OpenCTI will look for "Temporal Proximity" between a geopolitical event and a spike in `Intrusion-Set` activity.

---

## Phase 5: Implementation Rules & Compliance
1.  **Strict STIX 2.1:** All custom attributes must use the `x_` prefix.
2.  **Attribution Confidence:** Every relationship between a State and a Hacktivist group must include a `confidence` score (e.g., 15% for "Possible Proxy", 85% for "Confirmed GRU Unit").
3.  **Versioning:** Strategic alignments change; use object versioning to track when an actor shifts from "Neutral" to "Adversary."

---

### Next Step
Would you like me to generate a **Python script for an OpenCTI Connector** that automatically creates these "State-to-APT" relationships when a new actor is ingested?