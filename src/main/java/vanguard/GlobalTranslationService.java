package vanguard;

import android.util.Log;
import com.google.ai.client.generativeai.GenerativeModel;
import com.google.ai.client.generativeai.java.GenerativeModelFutures;
import com.google.ai.client.generativeai.type.Content;
import com.google.ai.client.generativeai.type.GenerateContentResponse;
import com.google.common.util.concurrent.ListenableFuture;

/**
 * GlobalTranslationService using GenerativeModelFutures.
 */
public class GlobalTranslationService {

    private static final String TAG = "GlobalTranslation";
    private static final String MODEL_NAME = "gemini-1.5-flash";

    private final String targetLanguageCode;
    private final String apiKey;

    public GlobalTranslationService(String targetLanguageCode) {
        this.targetLanguageCode = targetLanguageCode;
        String key = System.getenv("GOOGLE_API_KEY");
        this.apiKey = (key != null && !key.isEmpty()) ? key : "DEMO_KEY";
    }

    public String localizeAlert(String rawAlert) {
        if (targetLanguageCode.equalsIgnoreCase("en") || targetLanguageCode.startsWith("en-")) {
            return rawAlert;
        }

        try {
            GenerativeModel gm = new GenerativeModel(MODEL_NAME, apiKey);
            GenerativeModelFutures model = GenerativeModelFutures.from(gm);

            Content content = new Content.Builder()
                .addText("Translate to " + targetLanguageCode + ": " + rawAlert)
                .build();

            ListenableFuture<GenerateContentResponse> future = model.generateContent(content);
            GenerateContentResponse response = future.get();
            return response.getText().trim();
        } catch (Exception e) {
            Log.e(TAG, "Translation failed: " + e.getMessage());
            return rawAlert;
        }
    }

    public void translateAndSpeak(String rawAlert, GeminiVoiceAssistant assistant) {
        String localized = localizeAlert(rawAlert);
        assistant.speakInstruction(localized);
    }
}
