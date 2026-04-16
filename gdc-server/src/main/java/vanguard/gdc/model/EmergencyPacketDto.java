package vanguard.gdc.model;

public class EmergencyPacketDto {
    private String uniqueId;
    private String priority;
    private String payload;
    private long timeToLive;
    private long timestamp;
    private int ttlHops;

    public String getUniqueId() { return uniqueId; }
    public void setUniqueId(String uniqueId) { this.uniqueId = uniqueId; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }

    public long getTimeToLive() { return timeToLive; }
    public void setTimeToLive(long timeToLive) { this.timeToLive = timeToLive; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public int getTtlHops() { return ttlHops; }
    public void setTtlHops(int ttlHops) { this.ttlHops = ttlHops; }
    
    public boolean isExpired() {
        return (System.currentTimeMillis() - timestamp) > timeToLive;
    }
}
