import cv2
import numpy as np
import requests
import time
from flask import Flask, Response, send_file
from ultralytics import YOLO
import os
import threading
from emergency_dispatch import dispatch as emergency_dispatch, SNAPSHOT_PATH

app = Flask(__name__)

# 1. INITIALIZE AI MODELS
model = YOLO('yolov8n.pt') 

# 2. CONFIGURATION PARAMETERS
THREAT_LABELS = ['knife', 'scissors', 'baseball bat', 'cell phone'] 
CROWD_LIMIT = 2         
RUSH_THRESHOLD = 8000   
FIGHT_INTENSITY = 25     
HOTEL_ID = "GLOBAL" 
# Dynamically detect backend URL (support local dev server fallback)
backend_url_target = "http://localhost:8080/api/alerts"
try:
    # Check parent directories for .env config
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")),
        os.path.abspath(os.path.join(os.getcwd(), ".env")),
    ]
    for env_path in possible_paths:
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.strip().split("=", 1)
                        if k.strip() == "VANGUARD_BACKEND_URL":
                            val = v.strip().strip('"').strip("'")
                            backend_url_target = f"{val}/api/alerts"
                            break
            break
except Exception as e:
    print("⚠️ Failed parsing local .env config:", e)

# Always prefer the locally-parsed .env value over any stale OS env var
# (OS env var may still point to the old Render production URL)
BACKEND_URL = backend_url_target
print(f"📡 CCTV Targeted Backend Endpoint: {BACKEND_URL}")

# 3. GLOBAL STATE
last_alert_time = 0
ALERT_COOLDOWN = 5 
latest_frame = None
lock = threading.Lock()

@app.after_request
def add_header(response):
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

def send_vanguard_alert(message, context_type, priority):
    global last_alert_time
    now = time.time()
    if now - last_alert_time < ALERT_COOLDOWN:
        return 
    last_alert_time = now
    
    payload = {
        "uniqueId": f"CCTV-{int(now * 1000)}",
        "timestamp": int(now * 1000),
        "timeToLive": 120000,
        "status": "PENDING",
        "priority": priority,
        "userId": "CCTV-NODE-01",
        "hotelId": HOTEL_ID,
        "message": message,
        "contextType": context_type,
        "roomNumber": "R301",
        "floor": "3"
    }
    
    print(f"📡 SENDING VANGUARD ALERT: {message}")
    try:
        requests.post(BACKEND_URL, json=payload, timeout=2)
    except Exception as e:
        print("⚠️ Failed to reach GDC Server:", e)

def ai_detection_loop():
    global latest_frame
    # Trying index 1 in case index 0 is locked by another app
    cap = cv2.VideoCapture(1)
    if not cap.isOpened():
        cap = cv2.VideoCapture(0)
    prev_gray = None
    fight_counter = 0

    print("🛡️ Vanguard Intelligence: Always-On Detection Active")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # --- AI DETECTION ---
        results = model(frame, conf=0.4, verbose=False)
        person_boxes = []
        threats_found = []
        
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                coords = box.xyxy[0].cpu().numpy().astype(int)

                if label == 'person':
                    person_boxes.append(coords)
                    cv2.rectangle(frame, (coords[0], coords[1]), (coords[2], coords[3]), (0, 255, 0), 1)
                
                if label in THREAT_LABELS:
                    threats_found.append((label, coords))

        # --- BEHAVIOR ANALYSIS ---
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        movement_score = 0
        fight_detected = False

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            movement_score = cv2.countNonZero(thresh)
            
            if len(person_boxes) >= 2:
                for i in range(len(person_boxes)):
                    for j in range(i + 1, len(person_boxes)):
                        b1, b2 = person_boxes[i], person_boxes[j]
                        if not (b1[2] < b2[0] or b1[0] > b2[2] or b1[3] < b2[1] or b1[1] > b2[3]):
                            roi = thresh[max(b1[1], b2[1]):min(b1[3], b2[3]), max(b1[0], b2[0]):min(b1[2], b2[2])]
                            if roi.size > 0 and np.mean(roi) > FIGHT_INTENSITY:
                                fight_detected = True

        if fight_detected: fight_counter += 1
        else: fight_counter = max(0, fight_counter - 1)

        for label, coords in threats_found:
            cv2.rectangle(frame, (coords[0], coords[1]), (coords[2], coords[3]), (0, 0, 255), 3)
            send_vanguard_alert(f"AI THREAT: Weapon Detected ({label})", "THREAT", "CRITICAL")
            # Fire LLM-powered emergency dispatch with snapshot
            alert_payload = {
                "message": f"AI THREAT: Weapon Detected ({label})",
                "priority": "CRITICAL",
                "roomNumber": "R301",
                "floor": "3",
                "hotelId": HOTEL_ID,
            }
            emergency_dispatch(alert_payload, frame=frame, guest_count=len(person_boxes))

        if fight_counter > 10:
            cv2.putText(frame, "⚠️ FIGHT DETECTED", (50, 150), 2, 1, (0,0,255), 3)
            send_vanguard_alert("AI THREAT: Physical Altercation", "THREAT", "CRITICAL")
            emergency_dispatch({
                "message": "AI THREAT: Physical Altercation Detected",
                "priority": "CRITICAL",
                "roomNumber": "R301",
                "floor": "3",
                "hotelId": HOTEL_ID,
            }, frame=frame, guest_count=len(person_boxes))

        if len(person_boxes) > CROWD_LIMIT and movement_score > RUSH_THRESHOLD:
            cv2.putText(frame, "🚨 STAMPEDE RISK", (50, 50), 2, 1, (0,0,255), 3)
            send_vanguard_alert("AI THREAT: Stampede Detected", "THREAT", "CRITICAL")
            emergency_dispatch({
                "message": f"AI THREAT: Stampede Risk — {len(person_boxes)} people detected",
                "priority": "CRITICAL",
                "roomNumber": "Lobby",
                "floor": "1",
                "hotelId": HOTEL_ID,
            }, frame=frame, guest_count=len(person_boxes))

        prev_gray = gray
        with lock:
            latest_frame = frame.copy()

    cap.release()

def gen_frames():
    while True:
        with lock:
            if latest_frame is None:
                continue
            ret, buffer = cv2.imencode('.jpg', latest_frame)
            frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04) # ~25 FPS

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/snapshot')
def snapshot():
    """Serve the latest threat snapshot — used by Twilio to attach image in WhatsApp."""
    if os.path.exists(SNAPSHOT_PATH):
        return send_file(SNAPSHOT_PATH, mimetype='image/jpeg')
    # Return a 1x1 blank if no snapshot yet
    return Response(b'', status=404)

if __name__ == '__main__':
    # Start AI in a background thread
    threading.Thread(target=ai_detection_loop, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)