# Vanguard – AI‑driven, hazard‑aware evacuation routing for hotels in real time

## The Problem
Hotels still rely on static evacuation maps and manual phone trees. When a fire or other hazard strikes, staff must locate the incident, assess accessibility, and reroute guests without up‑to‑date routing data. The result is delayed response, unsafe pathways for mobility‑impaired guests, and a fragmented view of emerging threats.

## What Vanguard Does
Vanguard ingests emergency packets that carry a TTL and a globally unique identifier, guaranteeing deduplication and timely expiration. The backend annotates each packet with AI‑derived severity, pushes it to Firestore, and updates a Dijkstra‑based graph that marks hazardous corridors in real time. The staff dashboard visualises the live graph, streams YOLOv8‑processed CCTV feeds, and offers an ergonomic control panel that can toggle wheelchair‑friendly routing on demand.

## Architecture
```
   Guest Phone → Edge Server (Java) → [Gemini 2.5 Flash / Gemma 2B] → Staff Dashboard
                       ↑
                 CCTV (YOLOv8)
```

## Key Technical Decisions
Using Dijkstra with dynamic node invalidation allows the graph to reflect evolving hazards without rebuilding the entire map; blocked nodes are simply marked and excluded from subsequent shortest‑path calculations. A dual‑AI approach—Gemini for cloud‑scale intent classification and a lightweight local Gemma model for fallback—ensures low latency even when network conditions degrade. Accessibility routing is baked into the graph topology, giving wheelchair‑compatible paths the same priority as any other route rather than treating them as an after‑thought overlay.

## Demo
A guest triggers an SOS alert from the mobile app; the backend creates an emergency packet and stores it in Firestore. Pressing the fire‑simulation button on the dashboard injects a FIRE hazard for the north hallway; the pathfinder instantly recalculates, and the displayed heading badge updates in under 10 ms. Enabling wheelchair mode swaps the highlighted path to the blue, stair‑free route that respects the guest’s mobility profile.

## Quick Start
```bash
# Clone repository
git clone https://github.com/sreejeetaroy2005-svg/Vanguard-total.git
cd Vanguard-total

# Backend (Java 21)
./mvnw.cmd clean install
./mvnw.cmd spring-boot:run

# Frontend (Node 20+)
npm install
npm run dev
```

Built for the Google Gemini Developer Challenge
