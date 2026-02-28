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

GSCIX cumple con el estándar STIX 2.1 mediante el mecanismo de **Extension Definition** (Sección 7.3). 

### Registro de la Extensión
Toda la semántica personalizada (objetos `x-` y relaciones adicionales) está formalizada en el archivo:
[gscix-extension-definition.json](./gscix-extension-definition.json)

Este archivo actúa como el "manifiesto" que permite a otros sistemas STIX-compliant entender que:
1. Las entidades `x-geo-strategic-actor`, etc., son **SDOs (STIX Domain Objects)** legítimos dentro de este namespace.
2. Las relaciones `pursues`, `executes`, etc., son **SROs (STIX Relationship Objects)** válidos que extienden el vocabulario estándar.

> [!TIP]
> Al compartir inteligencia producida por GSCIX, asegúrate de incluir el campo `extensions` en cada objeto apuntando al ID de nuestra `extension-definition`.

---

## 🔗 Cyber-Strategic Linkage (OpenCTI Integration)

Una de las capacidades principales de GSCIX es el "Enlace Cyber-Estratégico", que permite conectar el razonamiento geopolítico con la evidencia técnica tracked en OpenCTI.

### Instrumentalización de APTs
Dentro del framework GSCI, los **Geo-Strategic Actors** no actúan directamente en el ciberespacio, sino que instrumentalizan capacidades técnicas mediante dos relaciones clave:

1.  **`controls` (Control Directo):** Se utiliza cuando un actor estatal tiene mando directo sobre una unidad cibernética (ej. El GRU controla a la "Unidad 26165").
2.  **`sponsors` (Patrocinio):** Se utiliza para actores que operan bajo el amparo o financiamiento de un estado, pero mantienen autonomía operativa (ej. Un estado patrocina a un grupo de cibercrimen para campañas de desestabilización).

### El Flujo de Atribución Estratégica
Al vincular un `x-geo-strategic-actor` con un `Intrusion-Set` de OpenCTI:
- El analista puede ver qué **Objetivos Estratégicos** (`x-strategic-objective`) están motivando las campañas técnicas.
- GSCIX puede calcular el **Índice de Acoplamiento Cyber-Geopolítico** (`cyber_geopolitical_coupling_index`), que indica si la actividad APT detectada es una señal de una escalada estratégica mayor.

---

## 🏛 Analítica de Gran Estrategia: RPC Case Study

El modelo GSCIX ha sido refinado para evitar el "sesgo de inmediatez" mediante la inclusión de variables de gran estrategia:

### 1. Detección de Infraestructura "Lenta" (`slow-drift`)
Mientras que la mayoría de los modelos de inteligencia se centran en el *fast-spike* (un ataque de ransomware o DDoS), GSCIX permite modelar campañas de **`slow-drift`**. Esto captura la construcción de infraestructuras críticas (físicas o digitales) que no presentan una amenaza inmediata pero alteran el equilibrio de poder en horizontes **decadales**.

### 2. Ponderación de Ambigüedad Estratégica (Divergencia)
Muchos actores estatales (ej. RPC en el 14.º Plan Quinquenal) utilizan un discurso de estabilidad mientras ejecutan una expansión militar operativa. La variable **`doctrine_capacity_divergence_score`** permite al sistema alertar sobre riesgos incluso cuando la `doctrine_type` declarada es `Stability-Oriented`, siempre que el `technological_modernization_rate` sugiera un rearme acelerado. Esto rompe la rigidez del etiquetado binario "Revisionista vs Estatus Quo".

### 3. Fusión Civil-Militar (`civil_military_fusion`)
Esta flag permite al analista marcar objetivos que parecen puramente económicos o académicos (ej. investigación en semiconductores o redes 6G) pero que forman parte integral de la base de poder militar a largo plazo.

---

## 📊 Matriz de Relaciones GSCIX (GSCI Model)

Esta tabla resume cómo se conectan las entidades entre sí para formar el grafo de inteligencia.

| Origen (Source) | Relación (Relationship) | Destino (Target) | Propósito Funcional |
| :--- | :---: | :--- | :--- |
| `x-geo-strategic-actor` | `pursues` | `x-strategic-objective` | Vincula al actor con sus metas políticas/militares. |
| `x-geo-strategic-actor` | `executes` | `x-hybrid-campaign` | Define la campaña activa del actor. |
| `x-geo-strategic-actor` | `generates` | `x-strategic-impact` | Mide el efecto directo del actor en el tablero. |
| `x-geo-strategic-actor` | `controls` | `Threat-Actor` | Atribución técnica directa (Unidad militar). |
| `x-geo-strategic-actor` | `sponsors` | `Intrusion-Set` | Atribución por patrocinio (Proxies/Cibercrimen). |
| `x-hybrid-campaign` | `integrates` | `x-influence-vector` | Añade la dimensión de info-ops a la campaña. |
| `x-hybrid-campaign` | `integrates` | `Intrusion-Set` | Añade la dimensión cyber a la campaña híbrida. |
| `x-hybrid-campaign` | `targets` | `Identity` / `Location` | Define el objetivo geográfico o social. |
| `x-influence-vector` | `targets` | `Identity` / `Sector` | Define la audiencia objetivo de la narrativa. |
| `x-strategic-assessment` | `evaluates` | `x-geo-strategic-actor` | Evaluación global de riesgo del actor. |
| `x-strategic-assessment` | `evaluates` | `x-hybrid-campaign` | Evaluación del progreso/peligro de la campaña. |
| `x-strategic-assessment` | `evaluates` | `x-strategic-impact` | Validación de los efectos reportados. |
