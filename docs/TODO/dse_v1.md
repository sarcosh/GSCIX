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