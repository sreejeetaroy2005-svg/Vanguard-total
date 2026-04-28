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
     * @return List of Nodes representing the safe path, or empty list if trapped.
     */
    public List<Node> findSafePath(String startNodeId) {
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

        while (!pq.isEmpty()) {
            Node current = pq.poll();

            // Check if we reached an Exit
            if (current.id.contains("EXIT") || current.id.contains("STAIRS")) {
                nearestExit = current;
                break;
            }

            for (Node neighbor : adjList.get(current.id)) {
                if (neighbor.isBlocked) continue; // DIJKSTRA HAZARD AWARENESS

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
    
    public Node getNode(String id) {
        return nodes.get(id);
    }
}
