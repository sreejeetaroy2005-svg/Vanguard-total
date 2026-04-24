package vanguard.gdc.model;

import java.util.ArrayList;
import java.util.List;

/**
 * VANGUARD GDC - EMERGENCY DATA PROTOCOL
 * Objective: Eliminate siloed communication via a decentralized data bridge.
 */
public class EmergencyPacketDto {
    // Basic Packet Metadata
    private String uniqueId;
    private String priority;   // INTRUDER, FIRE, MEDICAL, SAFE
    private String payload;    // Descriptive message
    private String status;     // PENDING, DISPATCHED, RESOLVED
    private String roomNumber; // Room identification for Cluster/Lockdown logic

    // Dashboard UI Matchers
    private String userId;
    private String contextType;
    private String message;
    private String evidenceUrl;
    private Double latitude;
    private Double longitude;
    private String hotelId;
    
    // Vulnerability Profiling
    private String vulnerabilityProfile; // NONE, ELDERLY, MOBILITY, VISION, HEARING, VIP

    
    // Temporal Logic
    private long timestamp;    // Time of creation
    private long timeToLive;   // Duration in ms before packet expires
    
    // Mesh/Bridge Logic
    private int ttlHops;       // Max number of hops allowed
    private List<String> hopHistory = new ArrayList<>(); // Dynamic path of the signal

    // Default Constructor (Required for JSON Mapping)
    public EmergencyPacketDto() {}

    // --- Identification Getters & Setters ---
    public String getUniqueId() { return uniqueId; }
    public void setUniqueId(String uniqueId) { this.uniqueId = uniqueId; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    // --- Temporal Getters & Setters ---
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public long getTimeToLive() { return timeToLive; }
    public void setTimeToLive(long timeToLive) { this.timeToLive = timeToLive; }

    // --- Mesh Logic Getters & Setters ---
    public int getTtlHops() { return ttlHops; }
    public void setTtlHops(int ttlHops) { this.ttlHops = ttlHops; }

    public List<String> getHopHistory() { return hopHistory; }
    public void setHopHistory(List<String> hopHistory) { this.hopHistory = hopHistory; }

    // --- Dynamic Protocol Methods ---

    /**
     * DYNAMIC BRIDGE LOGIC
     * Records the node ID to prove the "Decentralized Bridge" objective.
     */
    public void addHop(String nodeName) {
        if (this.hopHistory == null) {
            this.hopHistory = new ArrayList<>();
        }
        this.hopHistory.add(nodeName);
    }

    /**
     * EXPIRY CHECK
     * Ensures responders only act on relevant, live data.
     */
    public boolean isExpired() {
        return (System.currentTimeMillis() - timestamp) > timeToLive;
    }

    // Dashboard Compatibility Getters/Setters
    public String getId() { return uniqueId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getContextType() { return contextType; }
    public void setContextType(String contextType) { this.contextType = contextType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getEvidenceUrl() { return evidenceUrl; }
    public void setEvidenceUrl(String evidenceUrl) { this.evidenceUrl = evidenceUrl; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getHotelId() { return hotelId; }
    public void setHotelId(String hotelId) { this.hotelId = hotelId; }

    public String getVulnerabilityProfile() { return vulnerabilityProfile; }
    public void setVulnerabilityProfile(String vulnerabilityProfile) { this.vulnerabilityProfile = vulnerabilityProfile; }
}