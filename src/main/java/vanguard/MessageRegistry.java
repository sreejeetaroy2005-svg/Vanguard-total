package vanguard;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * MessageRegistry provides Trionic-style message propagation tracking across the P2P Mesh.
 * It strictly filters messages based on a Hop-Count TTL and explicit ID De-duplication.
 */
public class MessageRegistry {
    
    // Prevent infinite memory growth by limiting the registry to the last 5000 seen packets
    private static final int MAX_REGISTRY_SIZE = 5000;
    
    // LRU Cache mechanism for seen IDs tracking
    private final Set<String> seenMessageIds = Collections.newSetFromMap(
        new LinkedHashMap<String, Boolean>(MAX_REGISTRY_SIZE, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                return size() > MAX_REGISTRY_SIZE;
            }
        }
    );

    /**
     * Trionic Propagation Gatekeeper.
     * Checks if a packet should be propagated and decrements its TTL.
     * 
     * @param packet The incoming packet structure over the mesh network
     * @return true if the packet represents a valid, unseen forward-able jump; false if dropped.
     */
    public synchronized boolean evaluateAndRegister(CrisisTriage.EmergencyPacket packet) {
        if (packet == null) {
            return false;
        }

        String id = packet.getUniqueId();

        // 1. Deduplication loop prevention check
        if (seenMessageIds.contains(id)) {
            System.out.println("[MessageRegistry] DROPPED: Duplicate packet ID detected - " + id);
            return false;
        }

        // 2. TTL Hop Constraint Check
        if (packet.getTtlHops() <= 0) {
            System.out.println("[MessageRegistry] DROPPED: TTL exhausted (0 hops remaining) for packet - " + id);
            // Even if TTL is 0, we still register it to prevent straggler packet loop back
            seenMessageIds.add(id);
            return false;
        }

        // Action: Register it as genuinely seen
        seenMessageIds.add(id);
        
        // Action: Decrement TTL immediately so the next broadcast has 1 fewer hop
        packet.decrementTtlHops();
        
        System.out.println("[MessageRegistry] APPROVED: Packet " + id + " accepted. TTL remaining for next hop: " + packet.getTtlHops());
        return true;
    }
    
    public synchronized boolean isRegistered(String uniqueId) {
        return seenMessageIds.contains(uniqueId);
    }
    
    public synchronized void clearRegistry() {
        seenMessageIds.clear();
    }
}
