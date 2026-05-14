package vanguard.gdc.model;

import java.util.ArrayList;
import java.util.List;

/**
 * TACTICAL DATA CARRIER: Represents a decentralized emergency alert packet.
 * Mandatory fields included for TTL, Deduplication, and Hop History.
 */
public class EmergencyPacketDto {
    private String uniqueId;
    private long timestamp;
    private long timeToLive;
    private String priority;
    private String status;
    private String userId;
    private String roomNumber;
    private String message;
    private String vulnerabilityProfile;
    private String hotelId;
    private List<String> hopHistory = new ArrayList<>();
    
    private String floor;
    private String emergencyType;
    private String hazardLevel;
    private String evacuationRoute;
    private String aiThreatSeverity;

    // Standard Getters and Setters for Spring JSON mapping
    public String getUniqueId() { return uniqueId; }
    public void setUniqueId(String uniqueId) { this.uniqueId = uniqueId; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public long getTimeToLive() { return timeToLive; }
    public void setTimeToLive(long timeToLive) { this.timeToLive = timeToLive; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getVulnerabilityProfile() { return vulnerabilityProfile; }
    public void setVulnerabilityProfile(String vulnerabilityProfile) { this.vulnerabilityProfile = vulnerabilityProfile; }

    public String getHotelId() { return hotelId; }
    public void setHotelId(String hotelId) { this.hotelId = hotelId; }

    public String getFloor() { return floor; }
    public void setFloor(String floor) { this.floor = floor; }

    public String getEmergencyType() { return emergencyType; }
    public void setEmergencyType(String emergencyType) { this.emergencyType = emergencyType; }

    public String getHazardLevel() { return hazardLevel; }
    public void setHazardLevel(String hazardLevel) { this.hazardLevel = hazardLevel; }

    public String getEvacuationRoute() { return evacuationRoute; }
    public void setEvacuationRoute(String evacuationRoute) { this.evacuationRoute = evacuationRoute; }

    public String getAiThreatSeverity() { return aiThreatSeverity; }
    public void setAiThreatSeverity(String aiThreatSeverity) { this.aiThreatSeverity = aiThreatSeverity; }

    public List<String> getHopHistory() { return hopHistory; }
    public void setHopHistory(List<String> hopHistory) { this.hopHistory = hopHistory; }

    public void addHop(String nodeId) {
        if (hopHistory == null) hopHistory = new ArrayList<>();
        hopHistory.add(nodeId);
    }

    public boolean isExpired() {
        return (System.currentTimeMillis() - timestamp) > timeToLive;
    }
}
