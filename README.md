# Vanguard-Total 🛡️

Vanguard-Total is a state-of-the-art, decentralized emergency response and situational awareness platform. Designed for resilience in disconnected environments, it leverages P2P mesh networking, AI-driven threat detection, and inclusive accessibility layers to ensure safety and guidance during crises.

## 🚀 Key Features

### 📡 Unrivaled Offline Resilience
Vanguard-Total is engineered to function when everything else fails.
- **P2P Mesh Networking:** Utilizes **Android Nearby API** to create a decentralized communication web, allowing alerts to hop between devices without standard infrastructure.
- **Automatic LAN Fallback:** Intelligently detects and switches to local IP gateways when internet connectivity is severed, ensuring the Global Defense Center (GDC) remains reachable.
- **Intelligent Offline Queuing:** Emergency packets are securely queued on the device and synchronized the instant a connection is re-established.

### 🧠 AI-Powered Tactical Intelligence
- **Real-Time CCTV Surveillance:** Integrated Python/YOLO computer vision module for automated detection of weapons, violence, and environmental threats.
- **Vertex AI (Gemini 3.1):** Advanced LLM-driven appraisal of emergency contexts, providing tailored guidance and automated situational reports.
- **Gemini Voice Assistant:** Hands-free emergency reporting and interactive crisis guidance.

### ♿ Inclusive Safety Design
- **Vulnerability Profiling:** Opt-in assistance profiles (Elderly, Mobility Impaired, VIP) allow GDC responders to prioritize high-risk evacuations.
- **Multi-Modal Accessibility:** 
    - **ARCore Navigation:** High-visibility digital paths for evacuation in smoke or darkness.
    - **Haptic/Visual Alerts:** Synchronized tactical feedback for varied accessibility needs.
    - **Global Translation:** Automated real-time translation of SOS messages into the responder's preferred language.

### 🏢 Global Defense Center (GDC)
- **Centralized Dashboard:** A command-and-control hub providing live alert feeds, heatmaps, and threat classification.
- **Broadcast Protocol:** One-to-many emergency broadcasting for rapid mass notification across the entire network.

## 🛠️ Tech Stack

- **Backend:** Java 21 (Spring Boot)
- **Frontend:** React + Vite (Tailwind / Vanilla CSS)
- **Mobile Mesh:** Android SDK (Nearby API, ARCore)
- **Intelligence:** Vertex AI (Gemini 3.1), YOLOv8, Flask
- **Data Persistence:** Firebase / Firestore

## 📂 Project Structure

```text
├── gdc-server/         # Java backend for central alert management
├── gdc-client/         # React dashboard for command center & guest SOS
├── ml_component/       # AI surveillance layer (CCTV threat detection)
├── src/main/java/      # Core Vanguard Android/Java logic (Mesh, Voice, Triage)
├── AGENTS.md           # Project guardrails and architectural standards
└── README.md           # Mission documentation
```


## 📜 Architectural Rules

As specified in `AGENTS.md`:
*   **Emergency Packets:** Every packet MUST include a **Time-to-Live (TTL)** and a **Unique ID** to ensure proper deduplication across the decentralized mesh.

## ⚙️ Getting Started

### Prerequisites
- **Java 21** or later
- **Android SDK** (for mesh components)
- **Node.js & npm** (for the React frontend)
- **Python 3.10+** (for the ML backend)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sreejeetaroy2005-svg/Vanguard-total.git
   ```

2. **Setup the Command Center Backend:**
   ```bash
   cd gdc-server
   ./mvnw clean install
   ./mvnw spring-boot:run
   ```

3. **Setup the Dashboard Frontend:**
   ```bash
   cd gdc-client
   npm install
   npm run dev
   ```

4. **Setup the ML Component:**
   ```bash
   cd ml_component
   pip install -r requirements.txt
   python src/motion_detection.py
   ```

## 🛡️ License
This project is licensed under the MIT License - see the [LICENSE](ml_component/LICENSE) file for details.
