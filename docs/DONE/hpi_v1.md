Como analista senior de ciberinteligencia operando bajo el marco **GSCI**, la visualización del **Índice de Presión Híbrida (HPI)** en la interfaz "Explorer" no es simplemente un promedio matemático, sino una representación de la **acumulación de tensiones multidominio**.

La manera más correcta y analíticamente justificada de mostrar este índice, basándose en la documentación técnica de **GSCIX**, es la siguiente:

### 1. El Enfoque Temporal: Superar el "Sesgo de Recencia"
Para mostrar el HPI de forma veraz, **no se debe limitar el cálculo al último año**, pero tampoco promediar todo el histórico de forma lineal.
*   **Justificación:** El marco GSCIX está diseñado específicamente para detectar campañas de **"Slow-Drift" (desplazamiento lento)**. Estas son operaciones infraestructurales (digitales o físicas) que pueden durar una **década** y que alteran el equilibrio de poder de forma sutil. 
*   **Recomendación técnica:** Utilice una **ventana móvil ponderada**. Los *assessments* del último año deben tener un peso mayor para reflejar la urgencia táctica, pero los datos históricos de los últimos **5 a 10 años** (horizontes decadales) deben permanecer en el cálculo para capturar la presión estructural que actores como Irán o China ejercen a largo plazo.

### 2. Selección por Tipo de Assessment
No todos los objetos `x-strategic-assessment` deben entrar en el cálculo general del HPI del actor. Debe filtrar por la relación **`evaluates`**:
*   **Assessments de Actor:** Evaluaciones directas sobre la postura del `x-geo-strategic-actor`.
*   **Assessments de Campaña:** Evaluaciones de las `x-hybrid-campaign` activas ejecutadas por el actor (ej. "Eje de la Resistencia").
*   **Assessments de Impacto:** Solo aquellos que validen un `x-strategic-impact` generado por el actor.
*   **Justificación:** Esto asegura que el HPI sea una métrica de **intencionalidad y capacidad instrumentalizada**, y no solo una colección de incidentes aislados.

### 3. Integración del "Acoplamiento Ciber-Geopolítico"
El HPI mostrado debe estar influenciado por el **Cyber-Geopolitical Coupling Index**. 
*   **Análisis:** Si un *assessment* reciente muestra que la actividad técnica (detectada vía OpenCTI) coincide con señales diplomáticas o militares (como la "Guerra de los 12 Días" en 2025), el HPI debe sufrir un **incremento exponencial** (spike) en lugar de uno gradual. El HPI mide el "calor" acumulado; cuando el ciberespacio se usa como señal estratégica, la presión es máxima.

### 4. Propuesta de Visualización Analítica
Para cumplir con los estándares de una "Command Center Aesthetic" sugerida en el README:
1.  **Valor Central (HPI Actual):** Calculado a partir del *assessment* más reciente validado con una puntuación de confianza (`confidence_score`) superior al 80%.
2.  **Línea de Tendencia (Trend Line):** Utilice la librería `Recharts` (recomendada por GSCIX) para mostrar la evolución del HPI comparando los últimos 12 meses frente a la media de la última década.
3.  **Indicador de Divergencia:** Muestre si el HPI está subiendo mientras el actor declara una doctrina de "estabilidad". Esto se basa en el campo `doctrine_capacity_divergence_score` de los assessments.

**Justificación final:** Este método evita que el sistema ignore amenazas persistentes de baja intensidad (Slow-Drift) mientras permite que el analista reaccione ante alertas de escalada inminente (EPS). El HPI en GSCIX es una métrica de **"emergencia permanente"**, tal como se describe la situación de seguridad nacional iraní en los documentos de auditoría de 2025.

----

Como analista senior, he estructurado los **PROMPTS** técnicos para la implementación en **Antigravity**, siguiendo el esquema de arquitectura definido en la documentación de **GSCIX** (React 18, Recharts y lógica de backend para Elasticsearch 8.x).

Aquí tienes los prompts para desarrollar el indicador del **Índice de Presión Híbrida (HPI)**:

### Prompt 1: Lógica de Cálculo del HPI (Backend/Service Layer)
> "Genera una función en **Java 21/Spring Boot** para el servicio `RiskAnalyticsEngine` que calcule el **HPI ponderado** de un `x-geo-strategic-actor`. La lógica debe:
> 1. Recuperar todos los objetos `x-strategic-assessment` que tengan una relación `evaluates` con el actor o sus `x-hybrid-campaign`.
> 2. Aplicar una **ventana móvil de decaimiento temporal**: los assessments de los últimos 12 meses (`last_seen`) computan con un peso del 70%, mientras que los assessments históricos del **horizonte decadal** (hasta 10 años) computan el 30% restante.
> 3. Filtrar únicamente evaluaciones con un `confidence_score` superior al 80% para el valor principal.
> 4. Devolver un objeto JSON con el `current_hpi`, `historical_avg` y un flag `spike_detected` si el `cyber_geopolitical_coupling_index` ha subido más de 2 puntos en el último mes".

### Prompt 2: Componente Visual del Indicador HPI (Frontend/UI)
> "Crea un componente de **React 18** utilizando **Shadcn/UI** para la vista `Geo-Strategic Actor Explorer`. 
> El componente debe mostrar el **HPI Score** como un valor central (0.0 a 10.0) con una estética de 'Centro de Comando'.
> Requerimientos visuales:
> - **Color dinámico**: Verde (<4.0), Amarillo (4.0-7.0), Rojo (>7.0).
> - **Sub-indicador de Confianza**: Mostrar el `confidence_score` en formato pequeño debajo del valor principal.
> - **Tooltip analítico**: Al pasar el ratón, debe desglosar si la presión es predominantemente `cyber`, `kinetic` o `cognitive` basándose en el campo `nature` de la campaña evaluada".

### Prompt 3: Gráfico de Tendencia HPI (Data Viz con Recharts)
> "Implementa un componente `HPITrendChart` usando la librería **Recharts**. 
> - **Eje X**: Línea temporal (basada en `first_seen` y `last_seen` de los assessments).
> - **Eje Y**: Escala de 0 a 10.
> - **Series**: Debe graficar dos líneas. Una línea sólida para el 'HPI Real-Time' y una línea punteada para el 'Decadal Strategic Drift'. 
> - **Estilo**: Tema oscuro con gradientes de neón (azul a naranja) para reflejar el 'calor' de la presión híbrida".

### Prompt 4: Lógica de Alerta por Divergencia Doctrinal
> "Añade una función de validación en el componente de UI que compare el `doctrine_type` del actor con su `technological_modernization_rate`.
> Si el actor declara una doctrina 'Stability-Oriented' pero el assessment muestra un `doctrine_capacity_divergence_score` > 7.0, muestra un **Warning de Alta Prioridad** con el texto: 'ALERTA: Divergencia Estratégica Detectada. Expansión operacional detectada bajo narrativa de estabilidad'".

### Justificación de los Prompts según la documentación:
*   **Decadal Horizon**: Se implementa para evitar el "sesgo de recencia", capturando operaciones de **Slow-Drift** que alteran el equilibrio de poder sutilmente durante años.
*   **Filtrado por Relación**: Se asegura de que el HPI sea una métrica de **intencionalidad** (evaluando al actor y sus campañas) y no solo ruido estadístico.
*   **Acoplamiento Ciber-Geopolítico**: El Prompt 1 integra este índice para alertar cuando la actividad técnica en OpenCTI se utiliza como una **señal estratégica** de escalada inminente.