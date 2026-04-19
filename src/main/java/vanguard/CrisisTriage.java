package vanguard;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * CrisisTriage implements a Priority Matrix to appropriately prioritize incoming emergency packets.
 * It strictly enforces deduplication and TTL rules for emergency packets.
 */
public class CrisisTriage {

    /**
     * Defines the Priority Matrix.
     * Higher priority value means higher urgency.
     */
    public enum Priority {
        NONE(0),
        POWER_OUTAGE(10),
        SMOKE(20),
        STRUCTURAL_VIBRATION(30),
        WEAPONS(40),
        CROWD_PANIC(50),
        FIRE(80),
        EARTHQUAKE(100);

        private final int level;

        Priority(int level) {
            this.level = level;
        }

        public int getLevel() {
            return level;
        }
    }

    /**
     * Emergency packet containing a TTL and unique ID for deduplication,
     * integrated with Tactical Intelligence fields for the Vanguard Dashboard.
     */
    public static class EmergencyPacket {
        private final String uniqueId;
        private final long timeToLive; // TTL in milliseconds
        private final long timestamp;  // Creation time in milliseconds
        private final Priority priority;
        private final String payload;
        private int ttlHops; // Hop counter for propagation tracking

        // --- TACTICAL EXTENSIONS ---
        private String status = "PENDING";       // PENDING, DISPATCHED
        private String roomNumber = "402";      // Location tracking
        private List<String> hopHistory = new ArrayList<>(); // Mesh path tracking

        public EmergencyPacket(Priority priority, String payload, long timeToLive, int ttlHops) {
            this.uniqueId = UUID.randomUUID().toString();
            this.priority = priority;
            this.payload = payload;
            this.timeToLive = timeToLive;
            this.timestamp = System.currentTimeMillis();
            this.ttlHops = ttlHops;
        }

        // Constructor for deserialization
        private EmergencyPacket(String uniqueId, Priority priority, String payload, long timeToLive, long timestamp, int ttlHops) {
            this.uniqueId = uniqueId;
            this.priority = priority;
            this.payload = payload;
            this.timeToLive = timeToLive;
            this.timestamp = timestamp;
            this.ttlHops = ttlHops;
        }

        // Getters and Setters
        public String getUniqueId() { return uniqueId; }
        public long getTimeToLive() { return timeToLive; }
        public Priority getPriority() { return priority; }
        public String getPayload() { return payload; }
        public int getTtlHops() { return ttlHops; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
        public List<String> getHopHistory() { return hopHistory; }

        public void decrementTtlHops() {
            if (this.ttlHops > 0) this.ttlHops--;
        }

        public boolean isExpired() {
            return (System.currentTimeMillis() - timestamp) > timeToLive;
        }

        public String toJson() {
            try {
                JSONObject obj = new JSONObject();
                obj.put("uniqueId", uniqueId);
                obj.put("priority", priority.name());
                obj.put("payload", payload);
                obj.put("timeToLive", timeToLive);
                obj.put("timestamp", timestamp);
                obj.put("ttlHops", ttlHops);
                obj.put("status", status);
                obj.put("roomNumber", roomNumber);
                obj.put("hopHistory", new JSONArray(hopHistory));
                return obj.toString();
            } catch (Exception e) {
                return null;
            }
        }

        public static EmergencyPacket fromJson(String jsonString) {
            try {
                JSONObject obj = new JSONObject(jsonString);
                EmergencyPacket packet = new EmergencyPacket(
                        obj.getString("uniqueId"),
                        Priority.valueOf(obj.getString("priority")),
                        obj.getString("payload"),
                        obj.getLong("timeToLive"),
                        obj.getLong("timestamp"),
                        obj.getInt("ttlHops")
                );
                if (obj.has("status")) packet.setStatus(obj.getString("status"));
                if (obj.has("roomNumber")) packet.setRoomNumber(obj.getString("roomNumber"));
                if (obj.has("hopHistory")) {
                    JSONArray hops = obj.getJSONArray("hopHistory");
                    for (int i = 0; i < hops.length(); i++) {
                        packet.getHopHistory().add(hops.getString(i));
                    }
                }
                return packet;
            } catch (Exception e) {
                return null;
            }
        }
    }

    private final List<EmergencyPacket> activeAlerts;
    private final Set<String> processedPacketIds;

    public CrisisTriage() {
        this.activeAlerts = new ArrayList<>();
        this.processedPacketIds = new HashSet<>();
    }

    /**
     * Process an incoming alert based on the Priority Matrix.
     * Manages deduplication, TTL, and sorting for the Dashboard.
     */
    public synchronized void processAlert(EmergencyPacket incomingPacket) {
        if (incomingPacket == null) return;

        // 1. Deduplication check
        if (processedPacketIds.contains(incomingPacket.getUniqueId())) {
            return;
        }
        processedPacketIds.add(incomingPacket.getUniqueId());

        // 2. TTL Expiry check
        if (incomingPacket.isExpired()) {
            return;
        }

        // 3. Add to Registry & Sort by Priority (High to Low)
        activeAlerts.add(incomingPacket);
        activeAlerts.sort((a, b) -> b.getPriority().getLevel() - a.getPriority().getLevel());
        
        System.out.println("Vanguard Alert Registered: " + incomingPacket.getPriority());
    }

    /**
     * Returns all currently active, unexpired alerts for the GDC Dashboard.
     */
    public synchronized List<EmergencyPacket> getActiveAlerts() {
        activeAlerts.removeIf(EmergencyPacket::isExpired);
        return new ArrayList<>(activeAlerts);
    }

    /**
     * Manually update the status of an alert (e.g., Dispatching help).
     */
    public synchronized void updateAlertStatus(String id, String newStatus) {
        activeAlerts.stream()
            .filter(a -> a.getUniqueId().equals(id))
            .findFirst()
            .ifPresent(a -> a.setStatus(newStatus));
    }

    public synchronized void clearAlerts() {
        activeAlerts.clear();
    }
}