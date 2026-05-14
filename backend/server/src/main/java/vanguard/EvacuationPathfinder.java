package vanguard;


import java.util.*;

/**
 * EvacuationPathfinder implements a Hazard-Aware Dijkstra algorithm specifically 
 * for Hospitality settings. It maps the hotel's interior nodes (Rooms, Hallways, Exits)
 * and dynamically reroutes guests away from active hazards (Fire, Smoke, etc.).
 */
public class EvacuationPathfinder {

    private static final String TAG = "EvacuationPathfinder";

    // Represents a physical location in the hotel
    public static class Node {
        public final String id;
        public final String label;
        public final float x; // Relative floor coordinates
        public final float y;
        public boolean isBlocked = false;

        public Node(String id, String label, float x, float y) {
            this.id = id;
            this.label = label;
            this.x = x;
            this.y = y;
        }
    }

    private final Map<String, Node> nodes = new HashMap<>();
    private final Map<String, List<Node>> adjList = new HashMap<>();

    public EvacuationPathfinder() {
        initHotelGraph();
    }

    /**
     * Initializes a sample hotel floor layout.
     * In production, this would be loaded from a JSON configuration.
     */
    private void initHotelGraph() {
        // Define Nodes
        addNode(new Node("R301", "Room 301", 10, 10));
        addNode(new Node("R302", "Room 302", 20, 10));
        addNode(new Node("H_NORTH", "North Hallway", 15, 15));
        addNode(new Node("H_SOUTH", "South Hallway", 15, 5));
        addNode(new Node("STAIRS_A", "Emergency Stairs A", 5, 15));
        addNode(new Node("STAIRS_B", "Emergency Stairs B", 25, 5));
        addNode(new Node("EXIT_MAIN", "Main Lobby Exit", 15, 0));

        // Define Connections (Edges)
        link("R301", "H_NORTH");
        link("R301", "H_SOUTH"); // New: Emergency Balcony/Maintenance link for Rerouting
        link("R302", "H_NORTH");
        link("H_NORTH", "STAIRS_A");
        link("H_NORTH", "H_SOUTH");
        link("H_SOUTH", "STAIRS_B");
        link("H_SOUTH", "EXIT_MAIN");
    }

    private void addNode(Node node) {
        nodes.put(node.id, node);
        adjList.put(node.id, new ArrayList<>());
    }

    private void link(String id1, String id2) {
        adjList.get(id1).add(nodes.get(id2));
        adjList.get(id2).add(nodes.get(id1));
    }

    /**
     * Marks a hotel area as unsafe.
     * @param areaId The ID of the node (e.g. "H_NORTH") where a hazard was detected.
     */
    public void markHazard(String areaId) {
        Node node = nodes.get(areaId);
        if (node != null) {
            System.out.println("[PATH] !! HAZARD DETECTED IN AREA: " + node.label + " !! Blocking route.");
            node.isBlocked = true;
        }
    }

    public void clearHazards() {
        for (Node n : nodes.values()) n.isBlocked = false;
    }

    /**
     * Calculates the shortest SAFE path to the nearest Exit.
     * 
     * @param startNodeId The guest's current room/location ID.
     * @param vulnerability Profile of the guest (e.g. "WHEELCHAIR") for route optimization.
     * @return List of Nodes representing the safe path, or empty list if trapped.
     */
    public List<Node> findSafePath(String startNodeId, String vulnerability) {
        if (!nodes.containsKey(startNodeId)) return Collections.emptyList();

        Map<Node, Node> parentMap = new HashMap<>();
        Map<Node, Float> distances = new HashMap<>();
        PriorityQueue<Node> pq = new PriorityQueue<>(Comparator.comparing(n -> distances.get(n)));

        for (Node n : nodes.values()) {
            distances.put(n, Float.MAX_VALUE);
        }

        Node start = nodes.get(startNodeId);
        distances.put(start, 0f);
        pq.add(start);

        Node nearestExit = null;
        boolean isMobilityImpaired = vulnerability != null && 
            (vulnerability.equalsIgnoreCase("WHEELCHAIR") || vulnerability.equalsIgnoreCase("MOBILITY"));

        while (!pq.isEmpty()) {
            Node current = pq.poll();

            // Check if we reached an Exit (Inclusivity check: Prefer Main Exits over Stairs for wheelchairs)
            if (current.id.contains("EXIT") || (current.id.contains("STAIRS") && !isMobilityImpaired)) {
                nearestExit = current;
                break;
            }

            for (Node neighbor : adjList.get(current.id)) {
                if (neighbor.isBlocked) continue; // DIJKSTRA HAZARD AWARENESS

                // ACCESSIBILITY SHIELD: Block stairs for mobility impaired guests
                if (isMobilityImpaired && neighbor.id.contains("STAIRS")) continue;

                float newDist = distances.get(current) + calculateDistance(current, neighbor);
                if (newDist < distances.get(neighbor)) {
                    distances.put(neighbor, newDist);
                    parentMap.put(neighbor, current);
                    pq.add(neighbor);
                }
            }
        }

        // Reconstruct path
        List<Node> path = new ArrayList<>();
        if (nearestExit != null) {
            Node curr = nearestExit;
            while (curr != null) {
                path.add(0, curr);
                curr = parentMap.get(curr);
            }
        }

        return path;
    }

    private float calculateDistance(Node a, Node b) {
        return (float) Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }

    /**
     * Calculates the Estimated Time to Evacuate in Seconds.
     */
    public int getEstimatedTime(List<Node> path, String vulnerability) {
        if (path == null || path.size() < 2) return 0;
        
        float totalDistance = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            totalDistance += calculateDistance(path.get(i), path.get(i + 1));
        }

        float speed = 1.4f; // Default walking speed (m/s)
        if (vulnerability != null && (vulnerability.equalsIgnoreCase("WHEELCHAIR") || vulnerability.equalsIgnoreCase("MOBILITY"))) {
            speed = 0.6f; // Slower speed for mobility impaired
        }

        // Return seconds + 10% safety buffer
        return (int) ((totalDistance / speed) * 1.1);
    }
    
    public Node getNode(String id) {
        return nodes.get(id);
    }
}
