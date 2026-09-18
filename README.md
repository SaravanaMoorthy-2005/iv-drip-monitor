# TISSENSE

A responsive, nurse-centered IV monitoring **prototype**. Fictional data is always marked as simulated. This is an early-warning interface, not a diagnostic or treatment system and not a clinically validated medical device.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm run install:ci
npm run dev
```

Open http://localhost:5173. The first visit opens the demo dashboard. Settings → Sign out opens the nurse login; demonstration credentials are `NURSE001` / `tissense`. They are public demo credentials, not hospital authentication.

## What works

- Twelve fictional patients, automatic urgency sorting, search and ward/room/bed/assigned-nurse filters.
- Dynamic summary cards, priority banner, patient monitoring, seven sensor values, module and overall statuses.
- Exact centralized thresholds: bottle ≤15%, pressure >85%, air bubble true; moisture warning ≥50%, strain warning ≥50%; critical requires moisture ≥70% **and** strain ≥60%.
- Episode-based alert creation, deduplication, nursing acknowledgement with identity and time, sensor-driven resolution, notes, historical CSV export and a unified timeline.
- Ward bed tiles, five selectable interactive trend charts with threshold lines and time windows, device detail, hardware response representations and system flow.
- Handover records, nurse assignment for supervisor/admin demonstration roles, separate notification read state, optional configured reminder/escalation notifications.
- Ten demo scenarios, manual sliders, drop event generation and event-derived rates, network switches, automatic simulation start/stop and non-destructive reset.
- Light/dark themes, privacy mode, demo roles, inactivity logout, mobile navigation, accessible native/component controls, responsive phone/tablet/desktop layouts.

## Data architecture

### Completing an alert response

1. **Acknowledge** records that the nurse has seen the warning.
2. **Record action** documents the action, optional note, nurse and timestamp.
3. **Save action · await readings** places the episode under **Awaiting recovery**. Live sensor values are never changed by documentation.
4. Once valid current readings clear the condition, the episode automatically becomes **Resolved**, leaves active alerts and remains in history and the timeline. A recurring condition creates a new episode requiring a fresh response.

In demo mode, **Save action & simulate recovery** explicitly changes only the selected alert's relevant simulated sensor values. A combined IV-site recovery clears its related moisture and strain episodes together, with shared documentation. Other patient readings and unrelated warnings are preserved. This control is blocked for live, stale, offline or invalid sensor data. For connection faults, restore the connection in the demo studio or wait for valid live packets. General notes do not replace the structured action workflow.

Action records and lifecycle changes are saved immediately to the local demo archive. The alert center separates **Needs response**, **Awaiting recovery**, and **Resolved**, while sensor severity stays visible until actual recovery.

`lib/tissense/engine.ts` contains the normalized patient model, validation, immutable threshold configuration, derived statuses and alert reconciliation. `lib/tissense/store.tsx` holds separately managed current readings, alert episodes, time-series samples, notification state, nurse/device activity, preferences and handover.

`lib/tissense/providers.ts` defines `SensorDataProvider`, `SimulationDataProvider`, `NodeRedProvider`, `WebSocketProvider`, `RESTProvider`, and `MQTTBridgeProvider`. MQTT traffic must be bridged through Node-RED WebSocket transport. No raw MQTT/TCP connection is made by the browser.

The demo archive is **device-local**, saved to browser storage every five seconds. Samples retain up to 12 hours; saved activity, alerts and notifications retain the latest 3,000 entries per collection. Live patient data is memory-only, intentionally not written to browser storage. Deploying a hospital version requires an authenticated, durable server data store, access enforcement and a retention policy; demo role switches are not security boundaries. Hosted private Sites access supplies the platform sign-in boundary.

## Connect Node-RED

1. Copy `.env.example` to `.env` and configure `NEXT_PUBLIC_NODE_RED_WS_URL` or `NEXT_PUBLIC_NODE_RED_REST_URL`. These are browser-visible endpoint URLs, not secret credentials.
2. Restart/rebuild. Use WSS/HTTPS from a hosted HTTPS application and configure appropriate origin access on your gateway. Node-RED should authenticate its own endpoint in a production deployment.
3. In Settings apply the Administrator demonstration role, then switch the source to live monitoring. Source switching clears the visible monitoring collections so simulation cannot mix into live records.
4. Send one full normalized patient object, an array, or `{ "patients": [...] }`. REST is polled every three seconds and WebSocket reconnects after five seconds. Missing, invalid or unavailable values render as unavailable, never fabricated.

Example complete packet:

```json
{
  "patient": { "id": "P001", "name": "Example Patient", "bed": "01", "room": "201", "ward": "Ward A", "nurse": "Nurse Priya" },
  "esp32_1": { "connected": true, "bottle_level": 75, "drop_count": 146, "drop_rate": 22, "pressure": 35, "air_bubble": false, "last_received": "2026-09-14T15:30:00Z" },
  "esp32_2": { "connected": true, "moisture": 25, "strain": 20, "last_received": "2026-09-14T15:30:00Z" },
  "gateway": { "esp_now": true, "wifi": true, "node_red": true }
}
```

Replace example timestamps with the actual packet timestamps. A module is delayed after 15 seconds and unavailable after 60 seconds. These are technical freshness windows, not clinical escalation policy. Missing data cannot resolve an existing sensor warning. Invalid percentage readings render as `—`, including negative bottle readings; they are never clamped into falsely normal values. Battery and firmware are not invented.

## Prototype boundaries

All reminders and escalations are in-app demonstrations. They do not contact nurses, supervisors, SMS, push services, or hospital systems. Sound/vibration depend on browser and device support. Reminder/escalation intervals default to unset and must be explicitly configured. Acknowledgement does not turn off the represented hardware buzzer; actual output is not controlled by this UI. Chart gaps identify unavailable values; charts do not invent a preceding history.

The source is React functional components with TypeScript, organized CSS, Recharts and Lucide. It retains the Sites Vinext starter and accessible installed component primitives; application styling uses ordinary CSS. Hash navigation preserves the active in-memory monitoring state. Core views can also be loaded through `/dashboard`, `/patients`, `/patients/P001`, `/ward`, `/alerts`, `/history`, `/handover`, `/devices`, `/demo`, `/settings`, and `/login`.

## Verification

```sh
node --experimental-strip-types --test tests/engine.test.ts
npx tsc --noEmit
npm run build
```

Tests cover all specified threshold boundaries, ten scenarios, deduplication, acknowledgement retention, resolution/retriggering, invalid input, stale/connection states, drop counting and urgency sorting. The browser workflow additionally verifies notes, scenarios, notifications, history, charts, login, handover and responsive layouts.


### Care assistant and glass monitoring cards

Each active alert has a rule-based care suggestion with its triggering value, configured threshold and suggested checks. The AI-assist preview is deterministic; no AI model is connected and no patient data is sent to an external AI service. Local clinical protocols govern real care. Site-assessment guidance links to the CDC catheter recommendations.

In demo mode, **Apply demo recovery** atomically acknowledges the alert, records the simulated action, updates only affected readings and reconciles all linked episodes. **Record action** opens a prefilled form with **Complete action & recover demo** as its primary control. Documentation-only actions leave readings unchanged and show **Awaiting sensor recovery**; a combined critical-site assessment also covers its linked moisture/strain alerts. Live mode never changes telemetry through either action. Completed alert notifications are retained but marked read.

The supplied liquid-glass template is adapted in `components/ui/liquid-glass-card.tsx`, `liquid-glass-button.tsx` and `financial-score-cards.tsx`. Its semicircle gauges display measured values with threshold-based colors, accessible labels, unique gradient IDs and reduced-motion support. Zero remains a valid reading and missing data is shown as unavailable.
