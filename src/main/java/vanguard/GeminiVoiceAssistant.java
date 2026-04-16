package vanguard;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import java.util.Locale;

/**
 * GeminiVoiceAssistant acts as the vocal interaction layer for the Vanguard system,
 * specifically targeting elderly and visually impaired guests using Android's native TTS engines.
 */
public class GeminiVoiceAssistant implements TextToSpeech.OnInitListener {

    private static final String TAG = "GeminiVoiceAssistant";
    private TextToSpeech tts;
    private boolean isReady = false;

    public GeminiVoiceAssistant(Context context) {
        tts = new TextToSpeech(context, this);
        Log.i(TAG, "Initializing Gemini Voice Audio Subsystem...");
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            isReady = true;
            // Configure default language dynamically based on context/locale
            tts.setLanguage(Locale.getDefault());
            Log.i(TAG, "Gemini Voice TTS Engine Ready.");
        } else {
            Log.e(TAG, "Gemini Voice TTS Engine Failed to Initialize.");
        }
    }

    /**
     * Speaks the localized instruction out loud.
     */
    public void speakInstruction(String localizedText) {
        if (!isReady) {
            Log.w(TAG, "TTS not ready yet - buffering phrase: " + localizedText);
            return;
        }

        Log.i(TAG, "[VOICE] Gemini Announcing: \"" + localizedText + "\"");
        // Use QUEUE_FLUSH so it interrupts any current speech for maximum urgency
        tts.speak(localizedText, TextToSpeech.QUEUE_FLUSH, null, "vanguard-alert");
    }

    public void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
