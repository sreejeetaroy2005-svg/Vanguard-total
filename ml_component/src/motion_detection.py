import cv2
import numpy as np
import requests
import time
from flask import Flask, Response
from ultralytics import YOLO

import os

app = Flask(__name__)

# 1. INITIALIZE AI MODELS
model = YOLO('yolov8n.pt') 

# 2. CONFIGURATION PARAMETERS
THREAT_LABELS = ['knife', 'scissors', 'baseball bat', 'cell phone'] 
CROWD_LIMIT = 5         
RUSH_THRESHOLD = 40000   
FIGHT_INTENSITY = 55     
HOTEL_ID = "GLOBAL" 
# USE ENVIRONMENT VARIABLE FOR CLOUD BACKEND
BACKEND_URL = os.getenv("VANGUARD_BACKEND_URL", "http://localhost:8080/api/alerts")

# 3. GLOBAL STATE
last_alert_time = 0
ALERT_COOLDOWN = 10 

@app.after_request
def add_header(response):
    # CRITICAL: This bypasses the ngrok "browser warning" page that breaks the Dashboard video feed
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
        "message": f"{message}",
        "contextType": context_type
    }
    
    print(f"📡 SENDING VANGUARD ALERT: {message}")
    try:
        requests.post(BACKEND_URL, json=payload, timeout=2)
    except Exception as e:
        print("⚠️ Failed to reach GDC Server:", e)

def gen_frames():
    cap = cv2.VideoCapture(0)
    prev_gray = None
    fight_counter = 0

    print("🛡️ Vanguard CCTV Active: Streaming to Dashboard on port 5000")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # --- PHASE 1: AI OBJECT DETECTION ---
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

        # --- PHASE 2: MOVEMENT & BEHAVIOR ANALYSIS ---
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        movement_score = 0
        fight_detected_this_frame = False

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            movement_score = cv2.countNonZero(thresh)
            
            # FIGHT LOGIC: Overlap + Intensity
            if len(person_boxes) >= 2:
                for i in range(len(person_boxes)):
                    for j in range(i + 1, len(person_boxes)):
                        b1, b2 = person_boxes[i], person_boxes[j]
                        # Check logic
                        if not (b1[2] < b2[0] or b1[0] > b2[2] or b1[3] < b2[1] or b1[1] > b2[3]):
                            roi = thresh[max(b1[1], b2[1]):min(b1[3], b2[3]), 
                                         max(b1[0], b2[0]):min(b1[2], b2[2])]
                            if roi.size > 0 and np.mean(roi) > FIGHT_INTENSITY:
                                fight_detected_this_frame = True

        # --- PHASE 3: PERSISTENCE & ALERTS ---
        if fight_detected_this_frame:
            fight_counter += 1
        else:
            fight_counter = max(0, fight_counter - 1)

        num_people = len(person_boxes)
        
        # Fight Alert
        if fight_counter > 10:
            cv2.putText(frame, "⚠️ FIGHT DETECTED", (50, 150), 2, 1, (0,0,255), 3)
            send_vanguard_alert("AI THREAT: Physical Altercation", "THREAT", "INTRUDER")

        # Stampede/Crowd Logic
        if num_people > CROWD_LIMIT and movement_score > RUSH_THRESHOLD:
            cv2.putText(frame, "🚨 STAMPEDE RISK", (50, 50), 2, 1, (0,0,255), 3)
            send_vanguard_alert("AI THREAT: Stampede/Crowd Density Violation", "THREAT", "FIRE")
        elif num_people > CROWD_LIMIT:
            cv2.putText(frame, "🟡 HIGH DENSITY", (50, 50), 2, 1, (0,165,255), 2)

        # Weapon Alerts
        for label, coords in threats_found:
            cv2.rectangle(frame, (coords[0], coords[1]), (coords[2], coords[3]), (0, 0, 255), 3)
            cv2.putText(frame, f"CRITICAL: {label.upper()}", (coords[0], coords[1]-10), 2, 0.8, (0,0,255), 2)
            send_vanguard_alert(f"AI THREAT: Weapon Detected ({label})", "THREAT", "INTRUDER")

        prev_gray = gray

        # ENCODE TO JPEG FOR WEB STREAM
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        # YIELD TO FLASK HTTP
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()

@app.route('/video_feed')
def video_feed():
    # Native endpoint for the React Dashboard to ingest the live AI camera feed
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    print("Vanguard ML Intelligence Edge Node Initializing...")
    # Run the server on localhost:5000 so React can connect
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)