import cv2
import time
import numpy as np
from ultralytics import YOLO

# 1. Load the AI Model (yolov8n is fast and light for Mac)
model = YOLO('yolov8n.pt') 

# Define classes we consider a "Threat"
THREAT_CLASSES = ['cell phone', 'scissors', 'knife', 'baseball bat'] # Note: 'gun' is often categorized in specialized models, using 'scissors/bat' as test proxies here.

cap = cv2.VideoCapture(0)
prev_gray = None

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break

        # 2. RUN AI DETECTION
        results = model(frame, conf=0.5, verbose=False) # Only show high confidence
        
        threat_found = False
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                
                # Check if detected object is a weapon/threat
                if label in THREAT_CLASSES:
                    threat_found = True
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                    cv2.putText(frame, f"WARNING: {label.upper()}", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # 3. RUN AGGRESSIVE MOVEMENT DETECTION
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            movement_score = cv2.countNonZero(thresh)
            
            if movement_score > 40000: # Adjust this for "Intense" movement
                cv2.putText(frame, "INTENSE MOVEMENT / FIGHT", (50, 100), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 3)

        prev_gray = gray

        # 4. SIMULATE THERMAL ANALYSIS (Highlights intensity)
        thermal = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
        
        # Display the result
        cv2.imshow("Vanguard AI: Threat Intelligence", frame)
        cv2.imshow("Thermal Signature", thermal)

        if cv2.waitKey(1) == ord('q'):
            break

finally:
    cap.release()
    cv2.destroyAllWindows()