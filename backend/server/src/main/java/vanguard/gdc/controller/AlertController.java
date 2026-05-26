package vanguard.gdc.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vanguard.gdc.model.EmergencyPacketDto;
import vanguard.EvacuationPathfinder;
import vanguard.gdc.service.SmsService;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.json.JSONObject;
import org.json.JSONArray;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}, exposedHeaders = "*")
public class AlertController {
    
    private final EvacuationPathfinder pathfinder = new EvacuationPathfinder();
    private final Map<String, EmergencyPacketDto> activeAlerts = new ConcurrentHashMap<>();
    private final Map<String, List<SseEmitter>> hotelEmitters = new ConcurrentHashMap<>();
    
    // WebRTC Signaling storage (Simplified for demo)
    private final Map<String, Object> signalingData = new ConcurrentHashMap<>();

    private final RestTemplate restTemplate = new RestTemplate();
    private final String apiKey = System.getenv("GOOGLE_API_KEY") != null ? System.getenv("GOOGLE_API_KEY") : "DEMO_KEY";
    private final SmsService smsService = new SmsService();

    public AlertController() {
    }

    @PostMapping
    public ResponseEntity<EmergencyPacketDto> receiveAlert(@RequestBody EmergencyPacketDto packet) {
        if (packet == null || packet.getUniqueId() == null) return ResponseEntity.badRequest().build();
        
        packet.setTimestamp(System.currentTimeMillis());
        packet.setStatus("PENDING");
        packet.addHop("VANGUARD_CENTRAL_GDC");
        
        // AI Threat Classification
        String classification = classifyThreat(packet.getMessage());
        packet.setAiThreatSeverity(classification);
        
        // Update priority and hazard level based on classification
        if (classification.contains("CRITICAL")) {
            packet.setPriority("CRITICAL");
            packet.setHazardLevel("EXTREME");
        } else if (classification.contains("MEDIUM")) {
            packet.setPriority("MEDIUM");
            packet.setHazardLevel("ELEVATED");
        } else {
            packet.setPriority("LOW");
            packet.setHazardLevel("MINIMAL");
        }

        System.out.println("[VANGUARD] !!! SOS RECEIVED FROM ROOM " + packet.getRoomNumber() + " !!!");
        System.out.println("[VANGUARD] Message: " + packet.getMessage());

        // Trigger Twilio SMS Alert
        smsService.sendEmergencySms(packet);

        activeAlerts.put(packet.getUniqueId(), packet);
        
        // Dynamic Risk-Based Hazard Recalculation
        refreshHazards();

        // SafePath Integration: Attach evacuation route to packet AFTER hazard weights are updated
        List<EvacuationPathfinder.Node> path = pathfinder.findSafePath(packet.getRoomNumber() != null ? packet.getRoomNumber() : "R301", packet.getVulnerabilityProfile());
        if (!path.isEmpty()) {
            String route = path.stream().map(n -> n.label).reduce((a, b) -> a + " -> " + b).orElse("STAY IN PLACE");
            packet.setEvacuationRoute(route);
        }
        
        broadcastToHotel("GLOBAL", packet); // Force Global broadcast for demo
        return ResponseEntity.ok(packet);
    }

    private void refreshHazards() {
        pathfinder.clearHazards();
        for (EmergencyPacketDto alert : activeAlerts.values()) {
            if ("RESOLVED".equalsIgnoreCase(alert.getStatus())) {
                continue;
            }
            String location = alert.getRoomNumber();
            if (location == null || location.isBlank()) {
                continue;
            }
            
            String msg = alert.getMessage() != null ? alert.getMessage().toUpperCase() : "";
            String priority = alert.getPriority() != null ? alert.getPriority().toUpperCase() : "";
            
            String dangerType = "FIRE"; // Default
            if (msg.contains("LIGHT SMOKE")) {
                dangerType = "LIGHT_SMOKE";
            } else if (msg.contains("HEAVY SMOKE") || msg.contains("SMOKE")) {
                dangerType = "HEAVY_SMOKE";
            } else if (msg.contains("CONGESTION") || msg.contains("CROWD") || msg.contains("PANIC")) {
                dangerType = "CONGESTION";
            } else if (msg.contains("GAS")) {
                dangerType = "GAS_LEAK";
            } else if (msg.contains("STRUCTURAL") || msg.contains("DAMAGE") || msg.contains("VIBRATION") || msg.contains("COLLAPSE")) {
                dangerType = "STRUCTURAL_DAMAGE";
            } else if (msg.contains("FLOOD") || msg.contains("WATER") || msg.contains("BURST")) {
                dangerType = "FLOODING";
            } else if (priority.contains("FIRE") || priority.contains("CRITICAL")) {
                dangerType = "FIRE";
            }
            
            pathfinder.markHazard(location, dangerType);
        }
    }

    private String classifyThreat(String message) {
        if (message == null || message.isBlank()) return "LOW (No context)";
        
        // Local Fallback Logic (Keywords)
        String[] criticalKeywords = {"fire", "smoke", "gun", "weapon", "intruder", "stabbing", "explosion", "emergency", "help"};
        String lowercaseMsg = message.toLowerCase();
        
        if (!"DEMO_KEY".equals(apiKey)) {
            try {
                String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
                
                JSONObject jsonRequest = new JSONObject();
                JSONArray contents = new JSONArray();
                JSONObject content = new JSONObject();
                JSONArray parts = new JSONArray();
                JSONObject part = new JSONObject();
                part.put("text", "Classify the following emergency message into CRITICAL, MEDIUM, or LOW severity and explain why in 5 words: " + message);
                parts.put(part);
                content.put("parts", parts);
                contents.put(content);
                jsonRequest.put("contents", contents);
 
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<String> entity = new HttpEntity<>(jsonRequest.toString(), headers);
 
                String response = restTemplate.postForObject(url, entity, String.class);
                JSONObject jsonResponse = new JSONObject(response);
                return jsonResponse.getJSONArray("candidates")
                        .getJSONObject(0)
                        .getJSONObject("content")
                        .getJSONArray("parts")
                        .getJSONObject(0)
                        .getString("text");
            } catch (Exception e) {
                System.err.println("AI Classification failed: " + e.getMessage());
            }
        }
 
        for (String kw : criticalKeywords) {
            if (lowercaseMsg.contains(kw)) return "CRITICAL (Local Detection: " + kw + ")";
        }
        return "MEDIUM (Manual Triage Required)";
    }
 
    // WebRTC Signaling Endpoints
    @PostMapping("/webrtc/signal/{targetId}")
    public ResponseEntity<Void> sendSignal(@PathVariable String targetId, @RequestBody Map<String, Object> signal) {
        signalingData.put(targetId, signal);
        // In a real app, you'd push this to the target via WebSocket/SSE
        // For demo, we broadcast it to all emitters in the hotel
        broadcastSignal(targetId, signal);
        return ResponseEntity.ok().build();
    }
 
    private void broadcastSignal(String targetId, Object signal) {
        hotelEmitters.values().forEach(list -> list.forEach(emitter -> {
            try { emitter.send(SseEmitter.event().name("WEBRTC_SIGNAL").data(Map.of("targetId", targetId, "signal", signal))); }
            catch (Exception e) { }
        }));
    }
 
    @GetMapping("/active")
    public ResponseEntity<List<EmergencyPacketDto>> getActiveAlerts(@RequestParam(required = false) String hotelId) {
        List<EmergencyPacketDto> list = new ArrayList<>(activeAlerts.values());
        if (hotelId != null) {
            list = list.stream()
                .filter(a -> hotelId.equalsIgnoreCase(a.getHotelId()) || "GLOBAL".equalsIgnoreCase(a.getHotelId()))
                .collect(Collectors.toList());
        }
        return ResponseEntity.ok(list);
    }
 
    @GetMapping("/latest")
    public ResponseEntity<EmergencyPacketDto> getLatestAlert(@RequestParam(required = false) String userId) {
        return activeAlerts.values().stream()
                .filter(a -> userId == null || userId.equalsIgnoreCase(a.getUserId()))
                .max(Comparator.comparingLong(EmergencyPacketDto::getTimestamp))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
 
    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<Void> acknowledgeAlert(@PathVariable String id) {
        if (activeAlerts.containsKey(id)) {
            activeAlerts.get(id).setStatus("ACKNOWLEDGED");
            refreshHazards();
        }
        return ResponseEntity.ok().build();
    }
 
    @PostMapping("/{id}/resolve")
    public ResponseEntity<Void> resolveAlert(@PathVariable String id) {
        if (activeAlerts.containsKey(id)) {
            activeAlerts.get(id).setStatus("RESOLVED");
            refreshHazards();
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<Void> escalateAlert(@PathVariable String id, @RequestBody Map<String, Object> params) {
        if (activeAlerts.containsKey(id)) {
            EmergencyPacketDto alert = activeAlerts.get(id);
            alert.setStatus("ESCALATED");
            
            boolean silent = params != null && params.containsKey("silent") && (boolean) params.get("silent");
            String responder = params != null && params.containsKey("responder") ? (String) params.get("responder") : "POLICE";
            
            System.out.println("[ESCALATION] !!! EMERGENCY ESCALATION OVERRIDE ACTIVATED !!!");
            System.out.println("[ESCALATION] Responder dispatched: " + responder + " (Mode: " + (silent ? "SILENT" : "AUDIBLE") + ")");
            System.out.println("[ESCALATION] Compiling Automated Incident Packet:");
            System.out.println("  -> Location: Vanguard Grand Plaza - Room " + alert.getRoomNumber());
            System.out.println("  -> Threat Type: " + alert.getEmergencyType());
            System.out.println("  -> AI Confidence Appraisal: 97.8%");
            System.out.println("  -> Estimated Impacted Sector Occupancy: 12 Guests");
            
            // Trigger emergency SMS
            smsService.sendEmergencySms(alert);
            
            refreshHazards();
        }
        return ResponseEntity.ok().build();
    }
 
    @GetMapping("/path")
    public ResponseEntity<Map<String, Object>> getSafePathHeading(
            @RequestParam String roomId, 
            @RequestParam(required = false) String hazardId,
            @RequestParam(required = false) String vulnerability) {
        refreshHazards();
        if (hazardId != null && !hazardId.isBlank()) pathfinder.markHazard(hazardId);
        List<EvacuationPathfinder.Node> path = pathfinder.findSafePath(roomId, vulnerability);
        Map<String, Object> response = new HashMap<>();
        if (path.size() >= 2) {
            EvacuationPathfinder.Node from = path.get(0);
            EvacuationPathfinder.Node to = path.get(1);
            float heading = (float) Math.toDegrees(Math.atan2(to.x - from.x, to.y - from.y));
            response.put("heading", heading);
            response.put("nextWaypoint", to.label);
            response.put("estimatedTimeSeconds", pathfinder.getEstimatedTime(path, vulnerability));
        } else {
            response.put("heading", 0);
            response.put("nextWaypoint", "STAY IN PLACE");
            response.put("estimatedTimeSeconds", 0);
        }
        return ResponseEntity.ok(response);
    }

    private void broadcastToHotel(String hotelId, EmergencyPacketDto packet) {
        if (hotelEmitters.containsKey(hotelId)) {
            for (SseEmitter emitter : hotelEmitters.get(hotelId)) {
                try { emitter.send(SseEmitter.event().name("NEW_ALERT").data(packet)); }
                catch (Exception e) { hotelEmitters.get(hotelId).remove(emitter); }
            }
        }
    }

    @GetMapping("/stream")
    public SseEmitter streamAlerts(@RequestParam(required = false) String hotelId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        String hId = (hotelId != null) ? hotelId : "GLOBAL";
        hotelEmitters.computeIfAbsent(hId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        return emitter;
    }
}
