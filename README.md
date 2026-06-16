# Vanguard‑Total
### When the fire alarm goes off, hotels have no intelligent system to tell
### guests which path is safe, which is blocked, and how to get out alive.
### Vanguard fixes that.

## The Problem
A fire erupts on the third floor of a busy hotel. The alarm sounds and 300 guests scramble, each clutching only a static paper map posted on a door. Staff receive the alarm but lack real‑time visibility of which corridors are compromised, and they cannot guide mobility‑impaired guests away from stairwells that are now dangerous. The result is chaotic evacuation, delayed rescue, and unnecessary risk.

## What We Built

Vanguard receives emergency packets from any client device, stores them in Firestore, and immediately forwards the payload to the Java edge server. This guarantees that every alert has a globally unique identifier and a TTL so duplicate or stale alerts are automatically ignored.

The edge server classifies the alert with a local Gemini model (fallback to a cloud Gemini 2.5 call) and enriches the packet with a severity label. By persisting the enriched packet, staff can see the nature of the hazard without manual interpretation.

A hazard‑aware Dijkstra engine runs in the Java service. When an alert arrives the engine marks the corresponding graph node as blocked or weighted, then recomputes the cheapest safe path in milliseconds. The algorithm respects mobility profiles, automatically excluding stairwells for wheelchair‑bound guests.

The React dashboard subscribes to the Firestore alerts collection via a realtime onSnapshot listener. On every change it clears the previous hazard set, applies the new hazards to a client‑side copy of the graph, and calls the pathfinder to obtain a fresh heading and next waypoint, which are displayed instantly.

The UI visualises the hotel floorplan, highlights hazardous corridors in red, and shows the computed heading as a rotating arrow. A toggle lets staff simulate fire, smoke, or congestion alerts; the UI writes the simulated alert to Firestore and posts it to the Java endpoint, demonstrating end‑to‑end latency.

An SSE endpoint streams new alerts to any connected dashboard, ensuring that every staff console stays synchronized without polling.

## Architecture
```
Guest Phone → Edge Server (Java 21) → [Gemini 2.5 Flash ☁️ / Gemma 2B 🔴] → Staff Dashboard
                     ↑
               CCTV Node (YOLOv8)
```
Server‑Sent Events keep every client in sync in real time. No polling, no delay.

## The Engineering Decisions That Matter
Using Dijkstra with dynamic node invalidation lets the graph reflect evolving hazards without rebuilding the adjacency structure. The alternative—pre‑computing static routes—would require full recomputation for every incident, adding unacceptable latency in an emergency.

A dual‑AI pipeline (cloud Gemini for rich language classification, local Gemma for fast fallback) provides both accuracy and resilience. Relying solely on a remote model would make the system vulnerable to network outages; the local model guarantees deterministic response times even when connectivity is degraded.

Accessibility routing is baked directly into the graph by tagging stairwell nodes and applying a mobility flag during path expansion. An overlay approach would treat accessibility as a post‑process filter, risking routes that appear viable but violate the guest’s constraints. Embedding it in the core algorithm ensures every computed path is fully compliant.

## API Reference
POST /api/alerts – Accepts an EmergencyPacketDto, stores it, triggers SMS, updates hazards, and broadcasts via SSE.
GET /api/alerts/active – Returns all alerts whose status is not RESOLVED.
GET /api/alerts/latest?userId=… – Returns the most recent alert for the specified user.
POST /api/alerts/{id}/acknowledge – Marks the alert as ACKNOWLEDGED and recomputes hazards.
POST /api/alerts/{id}/resolve – Marks the alert as RESOLVED, clears its hazard weight, and recomputes the graph.
POST /api/alerts/{id}/escalate – Sets status to ESCALATED, optionally logs a silent or audible responder, and refreshes hazards.
GET /api/alerts/path?roomId=…&hazardId=…&vulnerability=… – Clears hazards, optionally marks an additional hazard, computes a safe heading and next waypoint for the given room, and returns heading, nextWaypoint, and reroute_ms.
POST /api/alerts/route – Body { currentNode, guestId, mobilityImpaired }. Returns a safe route list, heading, and estimated evacuation time, excluding stairwells when mobilityImpaired=true.
GET /api/alerts/stream?hotelId=… – Returns an SSE stream that pushes every new alert to the client.
POST /api/webrtc/signal/{targetId} – Stores a signalling payload for later delivery; used as a stub for future video assistance.

## Demo
A guest opens the mobile client and taps “SOS”. The client creates an EmergencyPacketDto with a unique ID and TTL, then calls sendAlert. The packet is written to Firestore and posted to the Java edge server, where it is classified, logged, and an SMS is dispatched.
The edge server marks the reported location on the hazard‑aware graph and broadcasts the new alert via SSE. All connected dashboards receive the event instantly; the React front‑end clears its previous hazard set, applies the new hazard, and invokes the client‑side pathfinder.
Staff press the “Fire” button on the dashboard to simulate a fire in the north hallway. The UI creates a simulated alert, writes it to Firestore, and posts it to the backend, which marks the hallway node as blocked with a huge weight. The pathfinder recomputes in sub‑millisecond time, and the heading badge updates to point toward the southern exit.
The wheelchair toggle is flipped; the pathfinder now excludes stairwell nodes, and the UI redraws the route in blue, showing a stair‑free evacuation path. The entire loop—guest SOS, backend processing, realtime UI update, and reroute—occurs without visible latency, demonstrating a complete, end‑to‑end emergency response cycle.

## Quick Start
```bash
# Clone the repository
git clone https://github.com/sreejeetaroy2005-svg/Vanguard-total.git
cd Vanguard-total

# Backend (Java 21, Maven wrapper)
./mvnw.cmd clean install
./mvnw.cmd spring-boot:run   # runs on http://localhost:8080

# Frontend (Node 20+, React)
cd frontend/web
npm install
npm run dev                  # runs on http://localhost:3000

# Optional: Motion‑detection prototype (Python)
cd ../../ml_component
python motion_detection.py   # runs locally, not integrated into the server
```

*Resilience. Inclusivity. Intelligence.*
