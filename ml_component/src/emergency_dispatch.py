"""
Vanguard Emergency Dispatch Engine
===================================
When a threat is verified by CCTV, this module:
  1. Calls Gemini to generate a live, context-aware script
  2. Simultaneously dials emergency services AND the hotel manager via Twilio
  3. Sends a WhatsApp message with the captured threat frame to authorities

Requirements:
  pip install twilio google-generativeai python-dotenv
"""

import os
import threading
import time
import tempfile
import cv2
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env from project root (two levels up from ml_component/src/)
_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(_env_path)

# ─── Config ────────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID  = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN   = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE        = os.getenv("TWILIO_PHONE", "")          # Your Twilio number e.g. +15551234567
TWILIO_WHATSAPP     = os.getenv("TWILIO_WHATSAPP", "")       # Twilio WhatsApp sender e.g. +14155238886
EMERGENCY_PHONE     = os.getenv("EMERGENCY_PHONE", "")       # 911 or local emergency line
MANAGER_PHONE       = os.getenv("MANAGER_PHONE", "")         # Hotel manager mobile
WHATSAPP_AUTHORITY  = os.getenv("WHATSAPP_AUTHORITY", "")    # Authority WhatsApp number e.g. +91xxxxxxxxxx
NGROK_URL           = os.getenv("NGROK_URL", "")             # Public URL for Twilio to fetch the snapshot image
GOOGLE_API_KEY      = os.getenv("GOOGLE_API_KEY", "")

# ─── Gemini setup ──────────────────────────────────────────────────────────────
_gemini_ready = False
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
        _gemini_ready = True
    except Exception as e:
        print(f"⚠️  Gemini init failed: {e}")

# ─── Twilio setup ──────────────────────────────────────────────────────────────
_twilio_ready = False
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client as TwilioClient
        _twilio = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        _twilio_ready = True
    except ImportError:
        print("⚠️  twilio package not installed. Run: pip install twilio")
    except Exception as e:
        print(f"⚠️  Twilio init failed: {e}")

# ─── Snapshot path (written by motion_detection.py) ───────────────────────────
SNAPSHOT_PATH = os.path.join(os.path.dirname(__file__), "threat_snapshot.jpg")

# ─── Dedup guard (don't fire twice for the same incident) ─────────────────────
_last_dispatch_time = 0
DISPATCH_COOLDOWN = 60  # seconds between full dispatches


def _generate_script(alert: dict, guest_count: int) -> str:
    """Ask Gemini to produce a crisp, situational voice alert script."""
    if not _gemini_ready:
        # Fallback script if Gemini unavailable
        return (
            f"Emergency alert. {alert.get('priority','HIGH')} threat detected. "
            f"{alert.get('message','Unknown threat')} in room {alert.get('roomNumber','unknown')}. "
            f"Approximately {guest_count} guests in the area. Immediate response required."
        )

    prompt = f"""You are an AI emergency dispatcher for Vanguard Hotel Security.
A real threat has been detected by our CCTV AI system.

LIVE SYSTEM DATA:
- Threat type  : {alert.get('message', 'Unknown threat')}
- Room / Zone  : {alert.get('roomNumber', 'Unknown')} — Floor {alert.get('floor', 'Unknown')}
- Priority     : {alert.get('priority', 'HIGH')}
- Hotel ID     : {alert.get('hotelId', 'Unknown facility')}
- Guests nearby: {guest_count}
- Timestamp    : {time.strftime('%H:%M:%S')}

Write ONE urgent paragraph (2-3 sentences max) to be read aloud to emergency services.
Be specific, factual, and use the live data above. No greetings. Start directly with the threat.
Examples of good output:
  "Active shooter detected on the 2nd floor north wing, currently moving west. 14 guests are trapped in rooms 201-208. Immediate armed response required."
  "Fire detected in room 301, 3rd floor. Smoke spreading to adjacent corridor. 8 guests require evacuation assistance."
"""
    try:
        resp = _gemini_model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"⚠️  Gemini script generation failed: {e}")
        return (
            f"Critical threat detected. {alert.get('message')} in room "
            f"{alert.get('roomNumber')}. {guest_count} guests nearby. Immediate response required."
        )


def _place_voice_call(to_number: str, script: str, label: str):
    """Place a Twilio TTS voice call to a phone number."""
    if not _twilio_ready or not TWILIO_PHONE or not to_number:
        print(f"📞 [DEMO — no Twilio] Would call {label} ({to_number}): {script}")
        return
    try:
        # Escape XML special chars in script
        safe_script = script.replace('&', 'and').replace('<', '').replace('>', '')
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="Polly.Matthew" rate="90%">{safe_script}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Matthew" rate="90%">
    This is an automated emergency alert from Vanguard Security Systems. Please respond immediately.
  </Say>
</Response>"""
        call = _twilio.calls.create(twiml=twiml, to=to_number, from_=TWILIO_PHONE)
        print(f"📞 Voice call placed to {label} ({to_number}) — SID: {call.sid}")
    except Exception as e:
        print(f"⚠️  Voice call to {label} failed: {e}")


def _send_whatsapp(to_number: str, body: str):
    """Send a WhatsApp message, with threat snapshot if NGROK_URL is configured."""
    if not _twilio_ready or not TWILIO_WHATSAPP or not to_number:
        print(f"📱 [DEMO — no Twilio] Would WhatsApp {to_number}: {body[:80]}...")
        return
    try:
        params = {
            "body": body,
            "from_": f"whatsapp:{TWILIO_WHATSAPP}",
            "to":    f"whatsapp:{to_number}",
        }
        # Attach snapshot if we have a public URL
        if NGROK_URL and os.path.exists(SNAPSHOT_PATH):
            params["media_url"] = [f"{NGROK_URL}/snapshot"]
            print(f"📎 Attaching snapshot from {NGROK_URL}/snapshot")

        msg = _twilio.messages.create(**params)
        print(f"📱 WhatsApp sent to {to_number} — SID: {msg.sid}")
    except Exception as e:
        print(f"⚠️  WhatsApp to {to_number} failed: {e}")


def save_snapshot(frame) -> bool:
    """Save the current camera frame as the threat evidence image."""
    try:
        cv2.imwrite(SNAPSHOT_PATH, frame)
        print(f"📸 Threat snapshot saved → {SNAPSHOT_PATH}")
        return True
    except Exception as e:
        print(f"⚠️  Snapshot save failed: {e}")
        return False


def dispatch(alert: dict, frame=None, guest_count: int = 0):
    """
    Main entry point. Call this when a threat is confirmed.
    Runs in a background thread so it never blocks the detection loop.
    """
    global _last_dispatch_time
    now = time.time()
    if now - _last_dispatch_time < DISPATCH_COOLDOWN:
        print("🔁 Dispatch cooldown active — skipping duplicate dispatch")
        return
    _last_dispatch_time = now

    def _run():
        print("\n" + "═" * 55)
        print("🚨  VANGUARD EMERGENCY DISPATCH INITIATED")
        print("═" * 55)

        # 1. Save evidence snapshot
        if frame is not None:
            save_snapshot(frame)

        # 2. Generate LLM script
        script = _generate_script(alert, guest_count)
        print(f"\n📋 GEMINI SCRIPT:\n  {script}\n")

        # 3. Build WhatsApp message
        whatsapp_body = (
            f"🚨 *VANGUARD SECURITY ALERT* 🚨\n\n"
            f"*Priority:* {alert.get('priority','HIGH')}\n"
            f"*Threat:* {alert.get('message','Unknown')}\n"
            f"*Location:* Room {alert.get('roomNumber','?')} — Floor {alert.get('floor','?')}\n"
            f"*Hotel:* {alert.get('hotelId','Unknown')}\n"
            f"*Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            f"_{script}_\n\n"
            f"⚠️ IMMEDIATE RESPONSE REQUIRED"
        )

        # 4. Fire calls + WhatsApp simultaneously
        threads = []

        if EMERGENCY_PHONE:
            threads.append(threading.Thread(
                target=_place_voice_call,
                args=(EMERGENCY_PHONE, script, "Emergency Services"),
                daemon=True
            ))

        if MANAGER_PHONE:
            threads.append(threading.Thread(
                target=_place_voice_call,
                args=(MANAGER_PHONE, script, "Hotel Manager"),
                daemon=True
            ))

        if WHATSAPP_AUTHORITY:
            threads.append(threading.Thread(
                target=_send_whatsapp,
                args=(WHATSAPP_AUTHORITY, whatsapp_body),
                daemon=True
            ))

        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)

        print("✅  Emergency dispatch complete\n" + "═" * 55 + "\n")

    threading.Thread(target=_run, daemon=True).start()
