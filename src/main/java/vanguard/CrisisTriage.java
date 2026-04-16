package vanguard;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * CrisisTriage implements a Priority Matrix to appropriately prioritize incoming emergency packets.
 * It strictly enforces deduplication and TTL rules for emergency packets.
 */
public class CrisisTriage {

    /**
     * Defines the Priority Matrix.
     * Higher priority value means higher urgency.
     * Earthquake > Fire > Power Outage.
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
     * as strictly required by Vanguard-Total project rules.
     */
    public static class EmergencyPacket {
        private final String uniqueId;
        private final long timeToLive; // TTL in milliseconds
        private final long timestamp;  // Creation time in milliseconds
        private final Priority priority;
        private final String payload;
        private int ttlHops; // Hop counter for propagation tracking

        public EmergencyPacket(Priority priority, String payload, long timeToLive, int ttlHops) {
            // Requirement: unique ID for deduplication
            this.uniqueId = UUID.randomUUID().toString();
            this.priority = priority;
            this.payload = payload;
            // Requirement: TTL Limits
            this.timeToLive = timeToLive;
            this.timestamp = System.currentTimeMillis();
            this.ttlHops = ttlHops;
        }

        // Internal constructor for deserialization
        private EmergencyPacket(String uniqueId, Priority priority, String payload, long timeToLive, long timestamp, int ttlHops) {
            this.uniqueId = uniqueId;
            this.priority = priority;
            this.payload = payload;
            this.timeToLive = timeToLive;
            this.timestamp = timestamp;
            this.ttlHops = ttlHops;
        }

        public String getUniqueId() {
            return uniqueId;
        }

        public long getTimeToLive() {
            return timeToLive;
        }

        public Priority getPriority() {
            return priority;
        }

        public String getPayload() {
            return payload;
        }

        public int getTtlHops() {
            return ttlHops;
        }

        public void decrementTtlHops() {
            if (this.ttlHops > 0) {
                this.ttlHops--;
            }
        }

        public boolean isExpired() {
            return (System.currentTimeMillis() - timestamp) > timeToLive;
        }

        public String toJson() {
            try {
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("uniqueId", uniqueId);
                obj.put("priority", priority.name());
                obj.put("payload", payload);
                obj.put("timeToLive", timeToLive);
                obj.put("timestamp", timestamp);
                obj.put("ttlHops", ttlHops);
                return obj.toString();
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }

        public static EmergencyPacket fromJson(String jsonString) {
            try {
                org.json.JSONObject obj = new org.json.JSONObject(jsonString);
                return new EmergencyPacket(
                        obj.getString("uniqueId"),
                        Priority.valueOf(obj.getString("priority")),
                        obj.getString("payload"),
                        obj.getLong("timeToLive"),
                        obj.getLong("timestamp"),
                        obj.getInt("ttlHops")
                );
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }
    }

    private EmergencyPacket currentActiveAlert;
    private final Set<String> processedPacketIds;

    public CrisisTriage() {
        this.currentActiveAlert = null;
        this.processedPacketIds = new HashSet<>();
    }

    /**
     * Process an incoming alert based on the Priority Matrix.
     * Overrides lower-level alerts if an 'Earthquake' signal is detected.
     */
    public synchronized void processAlert(EmergencyPacket incomingPacket) {
        if (incomingPacket == null) return;

        // Deduplication check
        if (processedPacketIds.contains(incomingPacket.getUniqueId())) {
            System.out.println("Duplicate packet ignored: " + incomingPacket.getUniqueId());
            return;
        }
        processedPacketIds.add(incomingPacket.getUniqueId());

        if (incomingPacket.isExpired()) {
            System.out.println("Expired packet discarded: " + incomingPacket.getPriority());
            return;
        }

        // Clean up current alert if expired
        if (currentActiveAlert != null && currentActiveAlert.isExpired()) {
            currentActiveAlert = null;
        }

        if (currentActiveAlert == null) {
            currentActiveAlert = incomingPacket;
            System.out.println("New alert established: " + incomingPacket.getPriority());
            return;
        }

        // Special rule for EARTHQUAKE overriding all lower-level alerts
        if (incomingPacket.getPriority() == Priority.EARTHQUAKE) {
            System.out.println("CRITICAL OVERRIDE: Earthquake detected! Overriding " + currentActiveAlert.getPriority());
            currentActiveAlert = incomingPacket;
            return;
        }

        // General priority comparison from Matrix
        if (incomingPacket.getPriority().getLevel() > currentActiveAlert.getPriority().getLevel()) {
            System.out.println("Higher priority alert detected. Overriding " + 
                               currentActiveAlert.getPriority() + " -> " + incomingPacket.getPriority());
            currentActiveAlert = incomingPacket;
        } else {
            System.out.println("Alert ignored. Current alert " + currentActiveAlert.getPriority() + 
                               " is higher or equal to " + incomingPacket.getPriority());
        }
    }

    /**
     * Gets the currently active unexpired alert.
     */
    public synchronized EmergencyPacket getCurrentActiveAlert() {
        if (currentActiveAlert != null && currentActiveAlert.isExpired()) {
            currentActiveAlert = null; // Clean up if expired
        }
        return currentActiveAlert;
    }

    /**
     * Clears the current active alert manually.
     */
    public synchronized void clearAlert() {
        currentActiveAlert = null;
    }
}
