package vanguard.gdc.service;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import vanguard.gdc.model.EmergencyPacketDto;

import java.util.Base64;
import java.io.File;

@Service
public class SmsService {

    private final Dotenv dotenv;
    private final RestTemplate restTemplate;

    private final String twilioSid;
    private final String twilioAuthToken;
    private final String twilioPhone;
    private final String emergencyPhone;

    public SmsService() {
        // Try to find .env file
        String envDir = "./";
        if (new File("../../.env").exists()) {
            envDir = "../../";
        } else if (new File("../.env").exists()) {
            envDir = "../";
        }
        
        dotenv = Dotenv.configure().directory(envDir).ignoreIfMissing().load();
        this.restTemplate = new RestTemplate();

        this.twilioSid = dotenv.get("TWILIO_ACCOUNT_SID", System.getenv("TWILIO_ACCOUNT_SID"));
        this.twilioAuthToken = dotenv.get("TWILIO_AUTH_TOKEN", System.getenv("TWILIO_AUTH_TOKEN"));
        this.twilioPhone = dotenv.get("TWILIO_PHONE", System.getenv("TWILIO_PHONE"));
        this.emergencyPhone = dotenv.get("EMERGENCY_PHONE", System.getenv("EMERGENCY_PHONE"));
    }

    public void sendEmergencySms(EmergencyPacketDto packet) {
        if (twilioSid == null || twilioAuthToken == null || twilioPhone == null || emergencyPhone == null) {
            System.err.println("[SMS SERVICE] Missing Twilio credentials or Emergency phone number in .env file.");
            return;
        }

        String room = (packet.getRoomNumber() != null && !packet.getRoomNumber().isBlank()) ? packet.getRoomNumber() : "UNKNOWN";
        String msg = (packet.getMessage() != null && !packet.getMessage().isBlank()) ? packet.getMessage() : "Panic button pressed. Immediate assistance required.";
        String priority = packet.getPriority() != null ? packet.getPriority() : "CRITICAL";
        String aiAnalysis = packet.getAiThreatSeverity() != null ? packet.getAiThreatSeverity() : "N/A";

        try {
            String url = "https://api.twilio.com/2010-04-01/Accounts/" + twilioSid + "/Messages.json";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            String auth = twilioSid + ":" + twilioAuthToken;
            byte[] encodedAuth = Base64.getEncoder().encode(auth.getBytes());
            String authHeader = "Basic " + new String(encodedAuth);
            headers.set("Authorization", authHeader);

            String body = String.format("🚨 VANGUARD %s ALERT 🚨\nRoom: %s\nDetails: %s\nAI Analysis: %s", 
                                        priority, room, msg, aiAnalysis);

            MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
            map.add("To", emergencyPhone);
            map.add("From", twilioPhone);
            map.add("Body", body);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(map, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            System.out.println("[SMS SERVICE] Emergency SMS sent successfully: " + response.getStatusCode());
        } catch (Exception e) {
            System.err.println("[SMS SERVICE] Failed to send SMS: " + e.getMessage());
        }
    }
}
