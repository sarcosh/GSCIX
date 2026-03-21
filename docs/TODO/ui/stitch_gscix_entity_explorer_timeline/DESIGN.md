# Design System Specification: The Intelligence Layer

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Cartographer"**
This design system moves beyond the standard dashboard "template" to create a bespoke, high-end Command Center. It balances the cold precision of cyber-intelligence with the warmth and clarity of high-end editorial design. 

To break the "standard UI" look, we utilize **Intentional Asymmetry**. Large, authoritative headlines in *Inter* are offset by hyper-precise metadata in *JetBrains Mono*. We avoid a rigid, boxy grid in favor of "floating" data clusters and layered surfaces that feel like a high-end physical glass console. This is not just a tool; it is a premium cognitive environment for geo-strategic decision-making.

---

## 2. Colors & Surface Architecture
The palette is rooted in a "High-CRI (Color Rendering Index)" light mode. We use Cyan not as a decorative element, but as a functional glow that represents active intelligence.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid `#000` or high-contrast borders for sectioning. Boundaries must be defined through:
1.  **Background Color Shifts:** Use `surface-container-low` (#f2f4f6) for the main work area sitting on a `surface` (#f7f9fb) base.
2.  **Tonal Transitions:** Define the sidebar from the canvas using `surface-container` (#eceef0) rather than a vertical line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
*   **Base Layer:** `surface` (#f7f9fb)
*   **Navigation/Sidebar:** `surface-container` (#eceef0)
*   **Content Cards:** `surface-container-lowest` (#ffffff)
*   **Active Modals/Popovers:** `surface-bright` (#f7f9fb) with a glass blur.

### The "Glass & Glow" Rule
To achieve the "Command Center" feel, use **Glassmorphism** for floating elements. Apply `backdrop-blur-md` with `surface-container-lowest` at 80% opacity. 
*   **Signature Glow:** For critical data points, use a `0px 0px 12px` glow using the `primary-container` (#06b6d4) at 30% opacity to signify "live" technical data.

---

## 3. Typography: Technical Authority
We pair the humanist clarity of **Inter** with the terminal-style precision of **JetBrains Mono**.

| Level | Token | Font | Size | Weight | Intent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Inter | 3.5rem | 700 | Major geo-strategic shifts. |
| **Headline** | `headline-md` | Inter | 1.75rem | 600 | Section headers. |
| **Data Point** | `title-sm` | JetBrains Mono | 1rem | 500 | Active IP addresses/coordinates. |
| **Body** | `body-md` | Inter | 0.875rem | 400 | Analytical reports. |
| **Metadata** | `label-sm` | JetBrains Mono | 0.6875rem | 400 | Timestamps and system logs. |

**Editorial Note:** Always use `uppercase` and `letter-spacing-widest` for `label-sm` when used in headers to evoke a "classified document" aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Depth in this system is organic, not artificial. We discard the heavy shadows of the 2010s for **Ambient Occlusion**.

*   **The Layering Principle:** To lift a card, do not add a border. Place a `surface-container-lowest` (#ffffff) object onto a `surface-container-low` (#f2f4f6) background. The contrast (though subtle) provides a cleaner, more premium separation.
*   **Ambient Shadows:** For floating menus, use a "Cyan-Tinted Shadow": `0 20px 25px -5px rgba(0, 104, 122, 0.04)`. This mimics light passing through a technical display.
*   **The Ghost Border:** If accessibility requires a stroke, use `outline-variant` (#bcc9cd) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Precision Primitives

### Buttons (The Action Triggers)
*   **Primary:** Background `primary-container` (#06b6d4), Text `on-primary-container` (#00424f). Use a subtle `0.5px` top-inner-glow to create a "tactile glass" effect.
*   **Secondary/Ghost:** No background. `primary` (#00687a) text. On hover, transition to `surface-container-high`.

### Inputs & Terminal Fields
*   **Technical Input:** Use `surface-container-highest` background with a `JetBrains Mono` font. 
*   **Focus State:** Instead of a thick border, use a `2px` outer glow of `primary-container` and change the background to `surface-container-lowest`.

### Cards & Intelligence Lists
*   **Rule:** Forbid divider lines between list items. Use **Vertical White Space** (spacing scale `4` or `5`) to separate items.
*   **Risk Alerts:** Use `tertiary-container` (#e79400) for "Warning" and `error-container` (#ffdad6) for "Critical." These should be the only high-saturation backgrounds on the page to immediately draw the eye.

### Navigation (The Collapsible Sidebar)
*   **Style:** Minimalist. Icons (Lucide) use `outline` color (#6d797d). Active state uses `primary` (#00687a) with a vertical 2px indicator bar on the far left.
*   **The Blur:** When collapsed, the sidebar should maintain a slight transparency over the main background to keep the "layers of glass" metaphor intact.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `JetBrains Mono` for any string of text that contains numbers (coordinates, timestamps, IDs).
*   **Do** allow elements to overlap slightly (e.g., a data tooltip overlapping a chart edge) to create a sense of depth.
*   **Do** use the `0.5` to `2.5` spacing tokens for tight data clusters to maintain a "technical" density.

### Don’t:
*   **Don’t** use pure black (#000000) for text. Use `on-surface` (#191c1e) to maintain a soft, premium feel.
*   **Don’t** use rounded corners larger than `xl` (0.75rem). The system should feel "engineered," not "bubbly."
*   **Don’t** use standard 1px borders to separate the header from the content. Use a `surface-container-low` background for the header instead.