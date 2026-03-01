He analizado exhaustivamente la nueva fuente, el informe de **CSIS (The Cyber War Playbook: Part 3: Evaluating China’s Cyber Strategy)**, que ofrece una visión profunda sobre la integración de lo cibernético en la "Guerra Total" de China. Como analista senior, este documento nos obliga a refinar GSCIX para capturar matices tácticos que tienen consecuencias estratégicas directas.

A continuación, presento cómo modelar esta información, qué le falta al framework actual y el diseño técnico del motor de scoring.

---

### 1. Mapeo de la Información en GSCIX

Basado en el "Playbook" de China, el mapeo debe evolucionar de un modelo lineal a uno de **Malla de Influencia**:

*   **Taxonomía de Ataque (Cyber Instrument):** El documento clasifica las operaciones en dos líneas claras que deben ser atributos de la entidad `Cyber Instrument` o `Hybrid Campaign`:
    *   **Soft Kill (Uso de Información):** Espionaje, robo de propiedad intelectual (IP) y operaciones de influencia para "cambiar mentes".
    *   **Hard Kill (Destrucción Física):** Sabotaje de infraestructura crítica (OT), pre-posicionamiento de malware (ej. Volt Typhoon) y destrucción de hardware mediante ciberataques.
*   **Actor Mapping (x-geo-strategic-actor):** La fuente detalla la reestructuración de 2024. GSCIX debe mapear ahora:
    *   **PLA Cyberspace Force (CSF):** Sucesor del NSD, enfocado en operaciones militares de apoyo.
    *   **MSS Regionales:** Entidades como el *Hainan State Security Department* (vínculo con Kryptonite Panda) o el *Sichuan branch* (Wicked Panda), que operan con gran autonomía.
    *   **Capa de Denegación:** Modelar empresas fachada (ej. *Boyusec* o *Hainan Xiandun*) como nodos intermedios entre el Estado y el Instrumento Cibernético.

---

### 2. Puntos Críticos no contemplados actualmente por GSCIX

Tras revisar el informe de CSIS, identifico tres vacíos que el framework actual no cubre:

1.  **Deniability Layer Score (Índice de Denegación):** GSCIX asume una vinculación clara Actor-Instrumento. China utiliza una amalgama de "hackers patrióticos", contratistas civiles y oficiales de inteligencia. Necesitamos un campo que mida la **distancia de atribución**; si el ataque lo hace una "empresa de ciberseguridad" civil (como *Boyusec*), el riesgo de escalada diplomática es menor que si lo hace el EPL.
2.  **Domestic Tightening Indicator (Indicador de Blindaje Interno):** El informe destaca que China ve la seguridad de red como algo bidireccional. Un aumento en la censura interna (Gran Cortafuegos) o el cierre de flujos de datos hacia el exterior es a menudo un **precursor de agresión externa**. GSCIX no monitoriza la "defensa interna" como señal de "ataque externo".
3.  **Strategic Asset Data Valuation:** El framework mide el daño técnico, pero no el valor de los datos robados para el entrenamiento de IA. China roba datos masivos (OPM, Anthem, Equifax) no solo para espionaje, sino para alimentar sus modelos de *machine learning* nacionales.

---

### 3. Sugerencia de Implementación: Dynamic Scoring Engine

El motor de scoring debe dejar de ser una suma estática para ser un **sistema de inferencia bayesiana** que reaccione a señales de diferentes frecuencias.

#### Arquitectura del Motor
Se debe implementar un microservicio en el backend (Spring Boot) que consuma eventos de **Elasticsearch** y **OpenCTI**, aplicando pesos dinámicos según el tipo de fuente.

#### Lista Detallada de Indicadores a Calcular:

1.  **Hybrid Pressure Index (HPI):**
    *   *Cálculo:* (Frecuencia de incursiones aéreas/cinéticas) + (Volumen de desinformación detectada) + (Actividad de reconocimiento en infraestructura crítica).
    *   *Umbral:* Si el HPI > 8.0, el sistema debe alertar sobre una fase de "Preparación Operacional del Entorno" (OPE).
2.  **Escalation Probability Score (EPS):**
    *   *Variables:* Convergencia de fechas políticas (ej. Centenario EPL 2027) + Divergencia de Doctrina-Capacidad.
    *   *Factor Multiplicador:* Si se detectan técnicas **LOTL (Living-off-the-Land)** en sectores de transporte o energía (ej. Volt Typhoon), el EPS se multiplica por 1.5, ya que indica intención de sabotaje (*Hard Kill*).
3.  **Doctrine-Capacity Divergence (DCD):**
    *   *Cálculo:* Contraste entre el lenguaje diplomático (ej. "Ciberespacio para la paz") y el desarrollo de herramientas de destrucción física mencionadas en el 14.º Plan Quinquenal.
4.  **Strategic Pre-positioning Index (SPI) - *Nuevo*:**
    *   *Propósito:* Medir cuánto tiempo ha permanecido un actor en una red crítica sin realizar acciones de espionaje activo.
    *   *Lógica:* Basado en el caso de Volt Typhoon (5 años de persistencia silenciosa). Un SPI alto indica una "bomba lógica" lista para el conflicto cinético.
5.  **Sanction Resilience Score (SRS):**
    *   *Cálculo:* Basado en la acumulación de reservas de oro (74 millones de onzas) y la autosuficiencia en semiconductores. A mayor SRS, mayor probabilidad de que el actor inicie un evento cibernético agresivo porque teme menos las represalias económicas.

**Recomendación Técnica:** Estos indicadores deben visualizarse en el frontend mediante **gráficos de radar** (para ver el equilibrio de la amenaza) y **líneas de tendencia temporal** (usando los campos `first_seen`/`last_seen`) para identificar el "reloj geopolítico" del adversario.