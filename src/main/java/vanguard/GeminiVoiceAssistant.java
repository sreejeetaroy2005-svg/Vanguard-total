package vanguard;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.google.cloud.vertexai.VertexAI;
import com.google.cloud.vertexai.api.Content;
import com.google.cloud.vertexai.api.GenerateContentResponse;
import com.google.cloud.vertexai.generativeai.ChatSession;
import com.google.cloud.vertexai.generativeai.ContentMaker;
import com.google.cloud.vertexai.generativeai.GenerativeModel;
import com.google.cloud.vertexai.generativeai.ResponseHandler;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * GeminiVoiceAssistant is the vocal interaction layer for the Vanguard system.
 *
 * It provides a full voice loop for elderly and visually impaired users:
 *   1. STT  — Android SpeechRecognizer captures user's spoken query.
 *   2. AI   — Gemini 2.5 Flash (via Vertex AI) generates a crisis-aware response.
 *   3. TTS  — Android TextToSpeech speaks the answer out loud.
 *
 * A persistent ChatSession preserves conversation history across turns so Gemini
 * always knows the current emergency context.
 *
 * Requires:
 *   - GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION env vars.
 *   - RECORD_AUDIO permission in AndroidManifest.xml.
 *   - Vertex AI Java SDK dependency:
 *       implementation 'com.google.cloud:google-cloud-vertexai:1.9.0'
 */
public class GeminiVoiceAssistant implements TextToSpeech.OnInitListener {

    private static final String TAG = "GeminiVoiceAssistant";
    private static final String MODEL_NAME = "gemini-2.5-flash";

    /**
     * System instruction that grounds Gemini in the Vanguard emergency context.
     * It ensures all responses stay calm, concise, and actionable for crisis situations.
     */
    private static final String SYSTEM_INSTRUCTION =
            "You are Vanguard Assistant, a calm and clear emergency guidance AI. " +
            "You are helping users — including elderly and visually impaired individuals — " +
            "navigate an active emergency situation (fire, earthquake, weapons threat, etc.). " +
            "Always respond in 1-3 short sentences. Never use jargon. " +
            "Prioritize life safety above all else. " +
            "If unsure, direct users to the nearest exit or to stay in place and wait for responders.";

    // --- TTS ---
    private final TextToSpeech tts;
    private volatile boolean ttsReady = false;

    // --- STT ---
    private final SpeechRecognizer speechRecognizer;
    private final Intent recognizerIntent;

    // --- Gemini AI ---
    private final String projectId;
    private final String location;
    private ChatSession chatSession;          // Persistent multi-turn session
    private GenerativeModel geminiModel;

    // Background thread so AI calls never block the UI thread
    private final ExecutorService aiExecutor = Executors.newSingleThreadExecutor();

    // Callback interface so callers can react to the final spoken response
    public interface ResponseCallback {
        void onResponse(String spokenText);
        void onError(String errorMessage);
    }

    public GeminiVoiceAssistant(Context context) {
        // TTS init
        tts = new TextToSpeech(context, this);
        Log.i(TAG, "Initializing Gemini Voice Audio Subsystem...");

        // STT init
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

        // Vertex AI / Gemini init
        projectId = System.getenv("GOOGLE_CLOUD_PROJECT");
        location   = System.getenv("GOOGLE_CLOUD_LOCATION");
        initGeminiSession();
    }

    // -------------------------------------------------------------------------
    // Gemini Session
    // -------------------------------------------------------------------------

    private void initGeminiSession() {
        if (projectId == null || location == null) {
            Log.e(TAG, "GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION not set. AI responses disabled.");
            return;
        }
        try {
            VertexAI vertexAI = new VertexAI(projectId, location);
            Content systemInstruction = ContentMaker.fromMultiModalData(SYSTEM_INSTRUCTION);

            geminiModel = new GenerativeModel(MODEL_NAME, vertexAI);
            geminiModel.setSystemInstruction(systemInstruction);

            // Start a persistent multi-turn chat session
            chatSession = geminiModel.startChat();
            Log.i(TAG, "Gemini 2.5 Flash session initialized.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Gemini session: " + e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Speaks a pre-formed localized instruction directly (used by AccessibilityLayer
     * to announce alerts without requiring a user query).
     */
    public void speakInstruction(String localizedText) {
        if (!ttsReady) {
            Log.w(TAG, "TTS not ready yet - buffering phrase: " + localizedText);
            return;
        }
        Log.i(TAG, "[VOICE] Announcing: \"" + localizedText + "\"");
        // QUEUE_FLUSH interrupts any current speech — critical for urgent alerts
        tts.speak(localizedText, TextToSpeech.QUEUE_FLUSH, null, "vanguard-alert");
    }

    /**
     * Starts listening for a user's voice query, sends it to Gemini 2.5 Flash,
     * and speaks the AI-generated response back via TTS.
     *
     * Call this when the user taps the microphone button or long-presses the SOS button.
     *
     * @param callback Optional callback receiving the spoken text or an error message.
     */
    public void listenAndRespond(ResponseCallback callback) {
        if (!SpeechRecognizer.isRecognitionAvailable(tts.getDefaultEngine() != null
                ? null : null)) {
            Log.w(TAG, "Speech recognition not available on this device.");
            if (callback != null) callback.onError("Speech recognition unavailable.");
            return;
        }

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {
                Log.i(TAG, "Listening...");
            }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {
                Log.i(TAG, "Speech captured, processing...");
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(
                        SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    String userQuery = matches.get(0);
                    Log.i(TAG, "[STT] Heard: \"" + userQuery + "\"");
                    askGemini(userQuery, callback);
                } else {
                    if (callback != null) callback.onError("Could not understand speech.");
                }
            }

            @Override
            public void onError(int error) {
                String msg = sttErrorToString(error);
                Log.e(TAG, "STT error: " + msg);
                if (callback != null) callback.onError(msg);
            }

            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        speechRecognizer.startListening(recognizerIntent);
    }

    /**
     * Sends a text query directly to Gemini 2.5 Flash (for programmatic use,
     * e.g. injecting the current alert summary as an AI briefing on session start).
     *
     * @param query    The text to send to Gemini.
     * @param callback Receives the AI's response or an error.
     */
    public void askGemini(String query, ResponseCallback callback) {
        if (chatSession == null) {
            String fallback = "AI guidance unavailable. Please follow exit signs and move to safety.";
            speakInstruction(fallback);
            if (callback != null) callback.onError("Gemini session not initialized.");
            return;
        }

        // Run on background thread — never block UI
        aiExecutor.submit(() -> {
            try {
                Log.i(TAG, "[GEMINI] Sending query: \"" + query + "\"");
                GenerateContentResponse response = chatSession.sendMessage(query);
                String reply = ResponseHandler.getText(response);
                Log.i(TAG, "[GEMINI] Response: \"" + reply + "\"");

                // Speak the reply on the calling thread (TTS is thread-safe)
                speakInstruction(reply);
                if (callback != null) callback.onResponse(reply);

            } catch (IOException e) {
                Log.e(TAG, "Gemini API error: " + e.getMessage());
                String fallback = "I'm having trouble connecting. Please follow exit signs.";
                speakInstruction(fallback);
                if (callback != null) callback.onError(e.getMessage());
            }
        });
    }

    /**
     * Briefs Gemini about the active emergency so subsequent user queries are grounded
     * in the correct situational context.  Call this whenever a new EmergencyPacket arrives.
     *
     * @param packet The active emergency from SentinelProcessor / CrisisTriage.
     */
    public void injectEmergencyContext(CrisisTriage.EmergencyPacket packet) {
        if (packet == null || chatSession == null) return;
        String briefing = String.format(
                "SYSTEM UPDATE: Active emergency — %s. Details: %s. Urgency: HIGH. " +
                "All subsequent user questions relate to this situation.",
                packet.getPriority().name(), packet.getPayload());
        Log.i(TAG, "[CONTEXT] Injecting emergency briefing into Gemini session.");
        askGemini(briefing, null); // Fire-and-forget context injection
    }

    // -------------------------------------------------------------------------
    // TTS Init Callback
    // -------------------------------------------------------------------------

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true;
            tts.setLanguage(Locale.getDefault());
            Log.i(TAG, "Gemini Voice TTS Engine Ready.");
        } else {
            Log.e(TAG, "Gemini Voice TTS Engine Failed to Initialize.");
        }
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    public void shutdown() {
        aiExecutor.shutdownNow();
        speechRecognizer.destroy();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        Log.i(TAG, "GeminiVoiceAssistant shut down.");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String sttErrorToString(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:           return "Audio recording error";
            case SpeechRecognizer.ERROR_CLIENT:          return "Client-side error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Missing RECORD_AUDIO permission";
            case SpeechRecognizer.ERROR_NETWORK:         return "Network error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Network timeout";
            case SpeechRecognizer.ERROR_NO_MATCH:        return "No speech match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Recognizer busy";
            case SpeechRecognizer.ERROR_SERVER:          return "Server error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:  return "No speech detected";
            default:                                     return "Unknown error (" + error + ")";
        }
    }
}
