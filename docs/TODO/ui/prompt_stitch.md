
### Prompt para el Frontend de GSCIX

**Contexto del Proyecto:**
"Desarrolla un dashboard de Inteligencia Geoestratégica para la plataforma **GSCIX (Geo-Strategic Cyber Intelligence Extension)**. GSCIX actúa como un 'Cerebro Estratégico' que conecta la geopolítica de alto nivel con operaciones tácticas de ciberseguridad. El objetivo es visualizar el flujo de influencia: **Actor Estatal → Objetivo Estratégico → Campaña Híbrida → Instrumento Cibernético → Efecto Estratégico**."

**Estética y Estilo:**
*   **Aesthetic:** 'Command Center' premium, moderno y limpio.
*   **Tema:** Modo oscuro por defecto con acentos en azul cian (#00d1ff) para datos técnicos y ámbar/rojo para alertas de riesgo.
*   **Tipografía:** Inter o JetBrains Mono para una sensación técnica de precisión.
*   **Componentes:** Utiliza **Shadcn/UI** para las tarjetas y tablas, y **Lucide React** para la iconografía.

**Vistas Principales requeridas:**

1.  **Dashboard de Riesgo Dinámico:**
    *   Gráficos de radar y líneas de tendencia utilizando **Recharts** para mostrar la evolución del **EPS (Escalation Probability Score)** y el **HPI (Hybrid Pressure Index)**.
    *   Widgets con indicadores clave como el `revisionist_index` y el `doctrine_capacity_divergence_score`.

2.  **Grafo de Influencia Geo-Estratégica:**
    *   Una vista interactiva (usando D3.js o Cytoscape) que renderice el grafo de Elasticsearch donde se vean los **Geo-Strategic Actors** vinculados a sus **Intrusion Sets** de OpenCTI.

3.  **Explorador de Actores (Vista China):**
    *   Una tabla detallada que permita filtrar por alineamiento estratégico (ej. 'Revisionist').
    *   Incluir campos de la 'Temporal Engine': `first_seen` y `last_seen` para mitigar el sesgo de inmediatez.

4.  **Línea de Tiempo de Campañas Híbridas:**
    *   Visualización de campañas (ej. Volt Typhoon o 'Three Warfares') en un eje cronológico, destacando hitos geopolíticos frente a actividad de APTs.

5.  **Panel de Ingesta SRO:**
    *   Interfaz para el endpoint `POST /api/v1/geopolitical/ingest` que permita subir archivos JSON de NotebookLM o bundles de STIX 2.1.

**Funcionalidad Técnica:**
*   Usa **TanStack Query** para la sincronización con el backend de Spring Boot.
*   Sidebar colapsable para navegación entre: Actores, Objetivos, Campañas, Efectos y Búsqueda Global.
*   Barra de búsqueda global integrada con el motor de búsqueda de Elasticsearch.

---

### Por qué este diseño es estratégico:

*   **Enfoque en el "Por qué" y el "Cuándo":** A diferencia de los dashboards de CTI tradicionales, este diseño prioriza las tendencias y el scoring predictivo (EPS/HPI) sobre el simple listado de IOCs.
*   **Visualización de la Fusión Civil-Militar:** Al modelar el grafo de influencia, permites al analista ver cómo las empresas fachada de China (MSS) se conectan con objetivos militares del EPL.
*   **Gestión del Reloj Geopolítico:** La inclusión de la 'Temporal Engine' en la interfaz permite rastrear si China está en fase de "pre-posicionamiento" (como Volt Typhoon) o de "ejecución de efecto estratégico".