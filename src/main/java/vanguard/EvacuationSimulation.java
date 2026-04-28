package vanguard;

import java.util.List;

/**
 * EvacuationSimulation demonstrates the Vanguard Hazard-Aware Pathfinder.
 * It simulates a guest trying to evacuate and shows how the system 
 * reroutes them when a hallway becomes dangerous.
 */
public class EvacuationSimulation {

    public static void main(String[] args) {
        EvacuationPathfinder pathfinder = new EvacuationPathfinder();
        String guestLocation = "R301";

        System.out.println("=== VANGUARD HOSPITALITY SIMULATION ===");
        System.out.println("Status: Normal Operation");
        System.out.println("Guest is in: " + guestLocation);

        // 1. Calculate normal shortest path
        System.out.println("\n[SCENARIO 1] Normal Evacuation:");
        printPath(pathfinder.findSafePath(guestLocation));

        // 2. Simulate Hazard (Fire in the South Hallway)
        System.out.println("\n[SCENARIO 2] !! FIRE DETECTED IN SOUTH HALLWAY !!");
        pathfinder.markHazard("H_SOUTH");

        // 3. Recalculate Safe Path
        System.out.println("Recalculating safest route...");
        List<EvacuationPathfinder.Node> safePath = pathfinder.findSafePath(guestLocation);

        if (safePath.isEmpty()) {
            System.err.println("CRITICAL: ALL EXITS BLOCKED. Suggesting Shelter-in-Place.");
        } else {
            System.out.println("RE-ROUTING SUCCESSFUL:");
            printPath(safePath);
        }

        System.out.println("\nSimulation Complete.");
    }

    private static void printPath(List<EvacuationPathfinder.Node> path) {
        if (path.isEmpty()) {
            System.out.println("Path: [BLOCKED]");
            return;
        }

        StringBuilder sb = new StringBuilder("Path: ");
        for (int i = 0; i < path.size(); i++) {
            sb.append(path.get(i).label);
            if (i < path.size() - 1) sb.append(" -> ");
        }
        System.out.println(sb.toString());
    }
}
