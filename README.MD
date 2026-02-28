Here is a professional, high-impact GitHub description for your project, designed to attract both developers and intelligence analysts.

---

# GSCIX: Geo-Strategic Cyber Intelligence Extension

**GSCIX** is an advanced intelligence orchestration platform designed to bridge the gap between high-level geopolitical shifts and tactical cyber operations. By implementing the **GSCI Framework**, this application acts as the "Strategic Brain" that correlates global geostrategic indicators with technical threat actor activity tracked in platforms like **OpenCTI**.

## 🎯 Project Purpose

Traditional Cyber Threat Intelligence (CTI) often focuses on the *how* (malware, infrastructure) and the *who* (APTs). **GSCIX** focuses on the **"Why"** and the **"When"**. It allows analysts to predict surges in cyber activity by monitoring geopolitical "heat maps," diplomatic tensions, and doctrinal shifts.

## 🚀 Key Features

* **Strategic-to-Tactical Mapping:** Maintains a segregated, state-of-the-art Elasticsearch-backed graph that links **Geo-Strategic Actors** to technical **Intrusion Sets** and **Threat Actors** via the OpenCTI v7 API.
* **Hybrid Campaign Tracking:** Groups multi-domain operations (Cyber, Information Ops, Economic Pressure) into unified strategic containers.
* **Dynamic Scoring Engine:** Calculates real-time indices including:
* **HPI (Hybrid Pressure Index):** Measuring cumulative pressure on a target.
* **EPS (Escalation Probability Score):** Forecasting imminent cyber-attacks based on diplomatic or military signals.


* **STIX 2.1 Native:** Built from the ground up to respect STIX standards, ensuring interoperability even for custom geostrategic objects.
* **Enterprise Architecture:** Powered by **Java 21 / Spring Boot** and **Elasticsearch 8.x** for high-performance intelligence processing.

## 🛠 Tech Stack

* **Language:** Java 21 (Spring Boot) / Node.js
* **Data Store:** Elasticsearch 8.x
* **Integration:** GraphQL (OpenCTI v7)
* **Data Standard:** STIX 2.1

## 🏛 The GSCI Framework

GSCIX is the first implementation of the **Geostrategic Cyber Intelligence (GSCI)** model, which replaces the linear actor-victim flow with a multi-layered influence model that instrumentalizes technical capabilities:

> **State Actor** (`x-geo-strategic-actor`) → **Strategic Objective** → **Hybrid Campaign** → **Cyber Instrument** (APT / OpenCTI) → **Strategic Effect**

Para más detalles sobre las entidades utilizadas, consulta la [documentación detallada de esquemas personalizados](custom_schemas/README.MD).

---

*Disclaimer: GSCIX is designed for sovereign intelligence analysis and geostrategic research.*

## 🏛 Arquitectura del Sistema

GSCIX utiliza una arquitectura desacoplada diseñada para procesar inteligencia geoestratégica con alto rendimiento y escalabilidad.

### Diagrama de Arquitectura
```mermaid
graph TD
    subgraph "Analista / Usuario"
        UI[Frontend (Dashboard)]
    end

    subgraph "Orquestación de Inteligencia (GSCIX Backend)"
        API[PostgreSQL Ingest / Context API]
        DIS[Discovery Service (OpenCTI)]
        TEM[Temporal Tracking Engine]
    end

    subgraph "Persistencia y Fuentes"
        ES[(Elasticsearch 8.x)]
        OCTI[OpenCTI v7 API]
    end

    UI --> API
    API --> ES
    API --> TEM
    API --> DIS
    DIS <--> OCTI
    ES --- E1[gscix_entities]
    ES --- E2[gscix_relations]
```

### Componentes Clave
1.  **GSCIX Backend (Java 21/Spring Boot):** El núcleo del sistema que maneja la lógica de negocio, el mapeo de STIX y la integración de índices de riesgo (HPI/EPS).
2.  **Elasticsearch 8.x:** Motor de búsqueda y grafo de alta velocidad para almacenar entidades geoestratégicas personalizadas y sus relaciones dinámicas.
3.  **OpenCTI Integration:** Capa de descubrimiento automático que vincula actores abstractos con grupos técnicos (APT) mediante la API GraphQL de OpenCTI.
4.  **Temporal Engine:** Módulo encargado de gestionar campos `first_seen` y `last_seen` para mitigar el sesgo de inmediatez.

## 🌐 Integración de Frontend

GSCIX está diseñado para ser consumido por un dashboard analítico moderno. La estrategia de integración recomendada es:

### Stack Tecnológico Sugerido
- **Framework:** React 18+ o Vite para una interfaz reactiva.
- **Gestión de Estado:** TanStack Query (React Query) para sincronización eficiente con la API.
- **Visualización de Datos:**
    - **D3.js / Cytoscape:** Para el grafo de influencia geoestratégica.
    - **Recharts:** Para visualizar tendencias de riesgo (HPI y EPS).
- **Estilo:** Vanilla CSS o Shadcn/UI para una estética premium de "Centro de Comando".

### Interacción con la API
El frontend consume datos principalmente de los endpoints:
- `POST /api/v1/geopolitical/ingest`: Para el procesamiento de nuevas piezas de inteligencia.
- `GET /api/v1/search` (En desarrollo): Para la exploración del grafo estratégico.

---

## 🧪 Guía de Pruebas Técnicas y Operaciones

Sigue esta guía para validar las capacidades del sistema GSCIX, desde la ingesta manual hasta la integración con NotebookLM.

### 1. Ingesta desde NotebookLM (Carga Masiva)
Simula la recepción de un análisis destilado por la IA. Este proceso crea el actor, sus objetivos, la campaña y los indicadores de impacto automáticamente.

```bash
curl -X POST http://localhost:8081/api/v1/geopolitical/ingest \
     -H "Content-Type: application/json" \
     -d @custom_schemas_tests/federacion_rusa.json
```

### 2. Alta Manual de Entidades (Contrato de Datos)
Para registrar un actor o grupo específico con metadatos simplificados:

```bash
curl -X POST http://localhost:8081/api/v1/geopolitical/ingest \
     -H "Content-Type: application/json" \
     -d '{
       "actor_name": "APT28",
       "strategic_alignment": "Revisionist",
       "geopolitical_context": "Unidad 26165 del GRU.",
       "revisionist_index": 9.5
     }'
```

### 3. Recuperación de Entidades e Inteligencia
Consulta el "cerebro estratégico" (Elasticsearch) para ver los datos procesados y normalizados.

*   **Listar todas las entidades GSCIX:**
    ```bash
    curl -s http://localhost:9200/gscix_entities/_search?pretty
    ```

*   **Buscar un actor específico y sus atributos GSCI:**
    ```bash
    curl -s 'http://localhost:9200/gscix_entities/_search?q=name:APT28&pretty'
    ```

### 4. Sincronización con OpenCTI (Threat Actors)
GSCIX descubre automáticamente relaciones con la base técnica de OpenCTI.

*   **Verificar vinculación:** Al realizar una ingesta, revisa el campo `opencti_matches` en la respuesta JSON. Si el actor existe en OpenCTI, GSCIX creará un puntero automático.
*   **Recuperar relaciones técnicas:**
    ```bash
    curl -s http://localhost:9200/gscix_relations/_search?pretty
    ```

### 5. Actualización y Evolución de Datos
Para actualizar el estado de un actor (ej. cambio en su índice de riesgo), realiza una nueva ingesta con el mismo nombre de actor:

```bash
curl -X POST http://localhost:8081/api/v1/geopolitical/ingest \
     -H "Content-Type: application/json" \
     -d '{
       "actor_name": "Federación Rusa",
       "revisionist_index": 9.8,
       "geopolitical_context": "Escalada detectada en el sector Báltico."
     }'
```
*Nota: El sistema detectará la identidad y actualizará los indicadores de impacto y riesgo en Elasticsearch.*