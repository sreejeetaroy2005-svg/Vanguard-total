package vanguard.gdc.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vanguard.gdc.model.EmergencyPacketDto;
import vanguard.EvacuationPathfinder;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
public class AlertController {
    
    private final EvacuationPathfinder pathfinder = new EvacuationPathfinder();
    private final Map<String, EmergencyPacketDto> activeAlerts = new ConcurrentHashMap<>();
    private final Map<String, List<SseEmitter>> hotelEmitters = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<String> receiveAlert(@RequestBody EmergencyPacketDto packet) {
        if (packet == null || packet.getUniqueId() == null) return ResponseEntity.badRequest().body("Invalid packet.");
        packet.addHop("VANGUARD_CENTRAL_GDC");
        activeAlerts.put(packet.getUniqueId(), packet);
        
        String hId = packet.getHotelId();
        if (hId == null) hId = "GLOBAL";
        broadcastToHotel(hId, packet);
        return ResponseEntity.ok("Alert Synchronized.");
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
        if (activeAlerts.containsKey(id)) activeAlerts.get(id).setStatus("ACKNOWLEDGED");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Void> resolveAlert(@PathVariable String id) {
        if (activeAlerts.containsKey(id)) activeAlerts.get(id).setStatus("RESOLVED");
        return ResponseEntity.ok().build();
    }

    @GetMapping("/path")
    public ResponseEntity<Map<String, Object>> getSafePathHeading(
            @RequestParam String roomId, 
            @RequestParam(required = false) String hazardId,
            @RequestParam(required = false) String vulnerability) {
        if (hazardId != null && !hazardId.isBlank()) pathfinder.markHazard(hazardId);
        List<EvacuationPathfinder.Node> path = pathfinder.findSafePath(roomId, vulnerability);
        Map<String, Object> response = new HashMap<>();
        if (path.size() >= 2) {
            EvacuationPathfinder.Node from = path.get(0);
            EvacuationPathfinder.Node to = path.get(1);
            float heading = (float) Math.toDegrees(Math.atan2(to.y - from.y, to.x - from.x));
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
