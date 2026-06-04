# Vanguard‑Total

**Real‑time emergency routing for hotels** – a full‑stack demo built with Java 21, Spring Boot, React, and Google Gemini 2.5 Flash.  The system ingests emergency alerts, updates a hazard‑aware Dijkstra graph, and instantly re‑routes guests on a tactical map.

---

## 🎯 Project Goal (Hackathon Pitch)
Provide a **live‑visual evacuation assistant** that:
- Receives alerts (fire, smoke, congestion, etc.) from IoT devices, CCTV AI, or manual SOS.
- Propagates them through Firestore for **instant UI updates**.
- Reroutes guests to the safest exit in **sub‑second latency**.
- Supports **wheelchair/mobility‑impaired routing**.
- Guarantees **deduplication** via unique `EmergencyPacketDto.uniqueId` and a **TTL** (`timeToLive`).
- Demonstrates a sleek dark UI with glass‑morphism and animated radar.

Perfect for a 5‑minute demo‑roll that showcases AI‑driven safety, real‑time sync, and robust backend architecture.

---

## ✨ Key Features Added
| Feature | Description |
|---|---|
| **Emergency Packet TTL & Unique ID** | Every `EmergencyPacketDto` now carries a `timeToLive` (ms) and a UUID for deduplication (see `model/EmergencyPacketDto.java`). |
| **Hazard‑Aware Graph** | `EvacuationPathfinder` marks corridors (`H_NORTH`, `H_SOUTH`, …) with weighted hazards; rooms (`R…`) are ignored for routing. |
| **Dynamic Firestore Subscription** | `Dashboard.jsx` clears previous hazards on each snapshot, computes `dangerType` from the `emergencyType` field (fallback to keyword parsing), and calls `pathfinder.markHazard`. |
| **Reroute Logic** | Shortest safe path is recomputed on every alert; heading and next‑waypoint are shown on the UI. |
| **Mobility‑Impaired Routing** | `GET /api/alerts/route` accepts `mobilityImpaired=true` and avoids stairs. |
| **Simulation UI** | Buttons to simulate fire, smoke, congestion, etc., automatically persisting to Firestore and invoking the Java REST endpoint. |
| **Dark / Glowing UI** | Tailwind + custom CSS give a glass‑morphism radar with red/rose accents (see `src/index.css`). |
| **SMS Alert** | Twilio integration (`SmsService`) sends an SMS on every new SOS. |
| **WebRTC Signaling Stub** | Minimal signaling endpoint for future video‑assist integration. |

---

## 🏗️ Architecture Overview
```
+-------------------+        +---------------------+        +-------------------+
|   Frontend (React) | <--> |   Firestore (Realtime) | <--> |   Backend (Spring) |
|   Dashboard.jsx    |      |   Alerts collection    |      |   AlertController |
|   HotelMap.jsx     |      |   TTL cleanup worker  |      |   EvacuationPathfinder |
+-------------------+        +---------------------+        +-------------------+
```
- **Frontend** subscribes to `alerts` collection, updates UI, and calls `/api/alerts/path` for heading.
- **Backend** stores alerts, runs deduplication, updates the pathfinder, and exposes `/api/alerts/route` for custom routing.
- **EmergencyPacketDto** holds the schema (uniqueId, ttl, emergencyType, etc.).
- **SMS** is triggered via `SmsService`. 

---

## 🚀 Getting Started
### Prerequisites
- **Java 21** + Maven wrapper (`.\mvnw.cmd`).
- **Node 20** (npm). 
- **Google Cloud Firestore** project (set `FIREBASE_CONFIG` env var) or use the local emulator.
- (Optional) **Twilio** credentials for SMS (`TWILIO_SID`, `TWILIO_TOKEN`).

### Backend
```bash
cd backend/server
./mvnw.cmd spring-boot:run   # starts on http://localhost:8080
```
The server will listen on port 8080. If the port is busy, kill the process (`netstat -ano | findstr :8080` then `taskkill /PID <pid> /F`).

### Frontend
```bash
cd frontend/web
npm install
npm run dev   # http://localhost:3000
```
Make sure the `.env.local` file contains:
```
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_PROJECT_ID=your-project
```

---

## 📡 API Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/alerts` | Accepts an `EmergencyPacketDto`; adds to Firestore, triggers SMS, updates graph. |
| `GET` | `/api/alerts/path?roomId=R301&hazardId=H_NORTH` | Returns heading, next waypoint & estimated time after recalculating safe path. |
| `POST` | `/api/alerts/route` | Body `{ currentNode, guestId, mobilityImpaired }` → safe route list + heading. |
| `GET` | `/api/alerts/active` | Returns all active (non‑resolved) alerts. |
| `POST` | `/api/alerts/{id}/resolve` | Mark alert resolved → hazards cleared. |
| `POST` | `/api/webrtc/signal/{targetId}` | Stub for future video‑assist signalling. |

---

## 🧪 Test Cases (Run with `npm test` or JUnit)
1. **TTL Expiry** – Insert an alert with `timeToLive=2000` ms, wait 3 s, verify it is removed from Firestore and the graph is cleared.
2. **Duplicate Detection** – Send two alerts with the same `uniqueId`; the second should be ignored (no extra hazard weight).
3. **Mobility‑Impaired Routing** – Request route with `mobilityImpaired=true` from `R301`; result must **avoid** `STAIRS_A`/`STAIRS_B`.
4. **Hazard Weighting** – Simulate `HEAVY_SMOKE` on `H_NORTH`; verify the heading changes to the south side and the weight printed in logs is `+50.0`.
5. **SMS Trigger** – Mock `SmsService` and verify `sendEmergencySms` is called once per new alert.
6. **WebSocket Broadcast** – Connect two SSE clients to `/stream?hotelId=GLOBAL`; when a new alert arrives both should receive the payload.

---

## 🖼️ UI Highlights
- **Radar** with animated heading arrow.
- **Toast notifications** for simulation actions.
- **Dark glass‑morphism** background (`bg-gradient-to-br from-gray-900 via-black to-gray-800`).
- **Responsive layout** – works on tablet and desktop.

*Screenshots are located in `docs/screenshots/` (add your own after the demo).* 

---

## 📦 Packaging for Hackathon
1. Run `./mvnw.cmd clean package` – produces `gdc-server.jar`.
2. Run `npm run build` – creates a static bundle in `frontend/web/build`.
3. Serve the static files with any HTTP server (`serve -s build`).
4. Deploy the jar to a cloud VM (e.g., Google Compute Engine) and point the client to the public IP.

---

## 🙋‍♀️ Contributing
- Fork → create a feature branch.
- Ensure `npm test` and `mvn test` pass.
- Follow the **code‑style** in existing files (4‑space indent, Javadoc for Java, ESLint‑configured for React).

---

## 📜 License
MIT – feel free to reuse for other safety‑critical demos.

---

*Happy hacking! 🚀*
