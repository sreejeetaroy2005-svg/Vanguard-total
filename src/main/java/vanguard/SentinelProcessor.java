package vanguard;

import com.google.ai.client.generativeai.GenerativeModel;
import com.google.ai.client.generativeai.java.GenerativeModelFutures;
import com.google.ai.client.generativeai.type.Content;
import com.google.ai.client.generativeai.type.GenerateContentResponse;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.IOException;

/**
 * SentinelProcessor using GenerativeModelFutures.
 */
public class SentinelProcessor {

    private static final String MODEL_NAME = "gemini-1.5-flash";

    public static String processMetadata(String streamMetadata) throws IOException {
        String apiKey = System.getenv("GOOGLE_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) apiKey = "DEMO_KEY";

        GenerativeModel gm = new GenerativeModel(MODEL_NAME, apiKey);
        GenerativeModelFutures model = GenerativeModelFutures.from(gm);

        Content content = new Content.Builder()
            .addText("Classify this emergency metadata and return structured JSON:\n" + streamMetadata)
            .build();

        try {
            ListenableFuture<GenerateContentResponse> future = model.generateContent(content);
            GenerateContentResponse response = future.get();
            return response.getText();
        } catch (Exception e) {
            throw new IOException("Gemini call failed: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        try {
            System.out.println(processMetadata("{\"anomaly\": \"fire\"}"));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
