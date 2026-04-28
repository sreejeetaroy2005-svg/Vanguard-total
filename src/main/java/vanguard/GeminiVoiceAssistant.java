package vanguard;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.google.ai.client.generativeai.GenerativeModel;
import com.google.ai.client.generativeai.java.GenerativeModelFutures;
import com.google.ai.client.generativeai.java.ChatFutures;
import com.google.ai.client.generativeai.type.Content;
import com.google.ai.client.generativeai.type.GenerateContentResponse;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * GeminiVoiceAssistant using GenerativeModelFutures for Java compatibility.
 */
public class GeminiVoiceAssistant implements TextToSpeech.OnInitListener {

    private static final String TAG = "GeminiVoiceAssistant";
    private static final String MODEL_NAME = "gemini-1.5-flash";

    private final TextToSpeech tts;
    private volatile boolean ttsReady = false;

    private final SpeechRecognizer speechRecognizer;
    private final Intent recognizerIntent;

    private GenerativeModelFutures model;
    private ChatFutures chatSession;

    private final ExecutorService aiExecutor = Executors.newSingleThreadExecutor();

    public interface ResponseCallback {
        void onResponse(String spokenText);
        void onError(String errorMessage);
    }

    public GeminiVoiceAssistant(Context context) {
        tts = new TextToSpeech(context, this);
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

        initGeminiSession();
    }

    private void initGeminiSession() {
        String apiKey = System.getenv("GOOGLE_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) apiKey = "DEMO_KEY";

        try {
            GenerativeModel gm = new GenerativeModel(MODEL_NAME, apiKey);
            model = GenerativeModelFutures.from(gm);
            chatSession = model.startChat();
            Log.i(TAG, "Gemini session initialized (Futures API).");
        } catch (Exception e) {
            Log.e(TAG, "Failed to init Gemini: " + e.getMessage());
        }
    }

    public void injectEmergencyContext(CrisisTriage.EmergencyPacket packet) {
        if (packet == null || chatSession == null) return;
        String briefing = "EMERGENCY UPDATE: " + packet.getPriority().name() + " - " + packet.getPayload();
        askGemini(briefing, null);
    }

    public void speakInstruction(String localizedText) {
        if (!ttsReady) return;
        tts.speak(localizedText, TextToSpeech.QUEUE_FLUSH, null, "vanguard-alert");
    }

    public void listenAndRespond(ResponseCallback callback) {
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    askGemini(matches.get(0), callback);
                }
            }
            @Override public void onError(int error) { if (callback != null) callback.onError("Error: " + error); }
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });
        speechRecognizer.startListening(recognizerIntent);
    }

    public void askGemini(String query, ResponseCallback callback) {
        aiExecutor.submit(() -> {
            try {
                if (chatSession == null) return;
                Content content = new Content.Builder().addText(query).build();
                ListenableFuture<GenerateContentResponse> future = chatSession.sendMessage(content);
                GenerateContentResponse response = future.get();
                String reply = response.getText();
                speakInstruction(reply);
                if (callback != null) callback.onResponse(reply);
            } catch (Exception e) {
                Log.e(TAG, "Gemini Error: " + e.getMessage());
                if (callback != null) callback.onError(e.getMessage());
            }
        });
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true;
            tts.setLanguage(Locale.getDefault());
        }
    }

    public void shutdown() {
        aiExecutor.shutdownNow();
        speechRecognizer.destroy();
        if (tts != null) tts.shutdown();
    }
}
