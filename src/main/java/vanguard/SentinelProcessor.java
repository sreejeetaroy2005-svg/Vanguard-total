package vanguard;

import com.google.cloud.vertexai.VertexAI;
import com.google.cloud.vertexai.api.Content;
import com.google.cloud.vertexai.api.GenerateContentResponse;
import com.google.cloud.vertexai.generativeai.GenerativeModel;
import com.google.cloud.vertexai.generativeai.ContentMaker;
import com.google.cloud.vertexai.generativeai.ResponseHandler;
import java.io.IOException;

/**
 * SentinelProcessor connects to live stream metadata and uses Gemini 2.5 Flash
 * to classify anomalies such as Smoke, Weapons, Crowd-Panic, and Structural Vibration.
 */
public class SentinelProcessor {

    // Using Gemini 2.5 Flash - fast, cost-efficient, ideal for real-time stream analysis
    private static final String MODEL_NAME = "gemini-2.5-flash";

    // System prompt for anomaly classification
    public static final String SYSTEM_PROMPT = 
        "You are Sentinel, an advanced security classification AI. " +
        "Your objective is to monitor incoming live stream metadata and identify key anomalies. " +
        "You must classify the following specific Anomaly categories:\n" +
        "  1. Smoke: Identify rapid smoke generation, fires, or atmospheric obscurement.\n" +
        "  2. Weapons: Detect visibly carried firearms, blades, or other dangerous weapons.\n" +
        "  3. Crowd-Panic: Look for stampedes, sudden mass scattering, or chaotic movements.\n" +
        "  4. Structural Vibration: Note any warnings of building shaking, collapses, or stress.\n" +
        "  5. Earthquake: Detect seismic activity, shaking ground, or explicit earthquake warnings.\n\n" +
        "Return a structured JSON output with the following keys:\n" +
        "- anomaliesDetected (list of anomalies from the list above)\n" +
        "- confidenceScore (0.0 to 1.0)\n" +
        "- urgency (e.g., LOW, MEDIUM, CRITICAL)\n" +
        "- summary (brief description of the threat)";

    public static String processMetadata(String projectId, String location, String streamMetadata) throws IOException {
        // Initialize Vertex AI client
        try (VertexAI vertexAI = new VertexAI(projectId, location)) {
            
            // Build the Gemini GenerativeModel
            GenerativeModel model = new GenerativeModel(MODEL_NAME, vertexAI);
            
            // Prepare the system instruction and user prompt
            Content systemInstruction = ContentMaker.fromMultiModalData(SYSTEM_PROMPT);
            model.setSystemInstruction(systemInstruction);

            String prompt = "Analyze the following live metadata:\n" + streamMetadata;

            // Request content generation
            GenerateContentResponse response = model.generateContent(prompt);

            // Return the generated classification
            return ResponseHandler.getText(response);
        }
    }

    public static void main(String[] args) {
        // Expected environment variables or passed parameters
        String projectId = System.getenv("GOOGLE_CLOUD_PROJECT");
        String location = System.getenv("GOOGLE_CLOUD_LOCATION");
        
        if (projectId == null || location == null) {
            System.err.println("Set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables to run.");
            return;
        }

        // Example mock metadata stream representation
        String mockStreamMetadata = "{\"sensor_id\": \"cam_north_04\", \"object_detected\": \"firearm\", \"movement_pattern\": \"rapid trajectory\"}";
        
        try {
            System.out.println("Processing metadata...");
            String result = processMetadata(projectId, location, mockStreamMetadata);
            System.out.println("\n--- Analysis Result ---");
            System.out.println(result);

            System.out.println("\n--- Triage Integration ---");
            CrisisTriage triage = new CrisisTriage();
            String upperResult = result.toUpperCase();
            CrisisTriage.Priority priority = CrisisTriage.Priority.NONE;

            // Map Gemini Classification to corresponding Crisis Type
            if (upperResult.contains("EARTHQUAKE")) priority = CrisisTriage.Priority.EARTHQUAKE;
            else if (upperResult.contains("FIRE")) priority = CrisisTriage.Priority.FIRE;
            else if (upperResult.contains("CROWD-PANIC") || upperResult.contains("PANIC")) priority = CrisisTriage.Priority.CROWD_PANIC;
            else if (upperResult.contains("WEAPON") || upperResult.contains("FIREARM")) priority = CrisisTriage.Priority.WEAPONS;
            else if (upperResult.contains("STRUCTURAL VIBRATION")) priority = CrisisTriage.Priority.STRUCTURAL_VIBRATION;
            else if (upperResult.contains("SMOKE")) priority = CrisisTriage.Priority.SMOKE;

            if (priority != CrisisTriage.Priority.NONE) {
                // Requirement: Generate deduplicated Emergency Packet with TTL and Hops (e.g. 5)
                CrisisTriage.EmergencyPacket packet = new CrisisTriage.EmergencyPacket(
                        priority, "Detected " + priority.name() + " via Sentinel", 10000, 5);
                
                // In production, tightly coupled to NearbyMeshService to immediately broadcast:
                // nearbyMeshService.broadcastEmergency(packet); 
                triage.processAlert(packet); // Kept for local console testing
                System.out.println("Sentinel Simulator: Injected packet into Mesh Network for broadcast.");
            } else {
                System.out.println("No priority anomalies found to triage from the stream.");
            }
        } catch (IOException e) {
            System.err.println("Failed to connect to Vertex AI: " + e.getMessage());
        }
    }
}
