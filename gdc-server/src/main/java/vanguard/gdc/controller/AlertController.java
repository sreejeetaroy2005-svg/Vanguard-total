package vanguard.gdc.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vanguard.gdc.model.EmergencyPacketDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*")
public class AlertController {

    private final Map<String, EmergencyPacketDto> activeAlerts = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<String> receiveAlert(@RequestBody EmergencyPacketDto packet) {
        if (packet == null || packet.getUniqueId() == null) {
            return ResponseEntity.badRequest().body("Invalid packet structure.");
        }

        if (activeAlerts.containsKey(packet.getUniqueId())) {
            System.out.println("GDC Registry: Ignored duplicate packet " + packet.getUniqueId());
            return ResponseEntity.ok("Duplicate ignored.");
        }

        if (packet.isExpired()) {
            System.out.println("GDC Registry: Ignored expired packet.");
            return ResponseEntity.ok("Expired packet ignored.");
        }

        activeAlerts.put(packet.getUniqueId(), packet);
        System.out.println("GDC Registry: Received critical alert: " + packet.getPriority() + " - " + packet.getPayload());
        return ResponseEntity.ok("Alert registered at GDC edge.");
    }

    @GetMapping("/active")
    public ResponseEntity<List<EmergencyPacketDto>> getActiveAlerts() {
        long now = System.currentTimeMillis();
        List<String> expiredKeys = new ArrayList<>();
        for (Map.Entry<String, EmergencyPacketDto> entry : activeAlerts.entrySet()) {
            if ((now - entry.getValue().getTimestamp()) > entry.getValue().getTimeToLive()) {
                expiredKeys.add(entry.getKey());
            }
        }
        expiredKeys.forEach(activeAlerts::remove);

        return ResponseEntity.ok(new ArrayList<>(activeAlerts.values()));
    }
}
