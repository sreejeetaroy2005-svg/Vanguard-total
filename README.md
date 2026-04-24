# Vanguard-Total 🛡️

Vanguard-Total is a state-of-the-art, decentralized emergency response and situational awareness platform. Designed for resilience in disconnected environments, it leverages P2P mesh networking, AI-driven threat detection, and inclusive accessibility layers to ensure safety and guidance during crises.

## 🚀 Key Features

- **Decentralized Mesh Network:** Built with Android Nearby API to maintain connectivity and relay emergency alerts even without cellular or internet access.
- **AI-Powered Surveillance:** Integrates YOLO-based computer vision and Vertex AI (Gemini 3.1) for automated threat detection and anomaly classification.
- **Crisis Triage & Propagation:** Intelligent deduplication and TTL (Time-to-Live) based message propagation to prevent network flooding and ensure data freshness.
- **Inclusive Accessibility:** 
    - **ARCore Navigation:** Visual guidance in low-visibility or chaotic environments.
    - **Haptic Feedback:** Tactile alerts for users with visual impairments.
    - **Global Translation:** Real-time multilingual support via Vertex AI.
    - **Voice Assistance:** Interactive Gemini-powered voice guidance.
- **Centralized Command (GDC):** A "Global Defense Center" dashboard for real-time monitoring and command-and-control operations.

## 🛠️ Tech Stack

- **Core Logic:** Java 21
- **P2P Networking:** Android Nearby API
- **Artificial Intelligence:** Vertex AI (Gemini 3.1), Python / YOLO / Flask
- **Frontend:** React + Vite

## 📂 Project Structure

```text
├── gdc-server/         # Java Spring Boot backend for the Command Center
├── gdc-client/         # React dashboard for emergency monitoring
├── ml_component/       # Python-based ML surveillance (CCTV threat detection)
├── src/main/java/      # Core Vanguard logic (Nearby API, Triage, Accessibility)
├── AGENTS.md           # Project rules and architectural requirements
└── README.md           # This file
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
