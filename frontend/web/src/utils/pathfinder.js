class Node {
    constructor(id, label, x, y) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.isBlocked = false;
        this.hazardWeight = 0.0;
        this.dangerType = "CLEAR";
    }
}

class EvacuationPathfinder {
    constructor() {
        this.nodes = new Map();
        this.adjList = new Map();
        this.initHotelGraph();
    }

    initHotelGraph() {
        // Define Nodes
        this.addNode(new Node("R301", "Room 301", 10, 10));
        this.addNode(new Node("R302", "Room 302", 20, 10));
        this.addNode(new Node("H_NORTH", "North Hallway", 15, 15));
        this.addNode(new Node("H_SOUTH", "South Hallway", 15, 5));
        this.addNode(new Node("STAIRS_A", "Emergency Stairs A", 5, 15));
        this.addNode(new Node("STAIRS_B", "Emergency Stairs B", 25, 5));
        this.addNode(new Node("EXIT_MAIN", "Main Lobby Exit", 15, 0));

        // Define Connections
        this.link("R301", "H_NORTH");
        this.link("R301", "H_SOUTH"); // New: Emergency Balcony/Maintenance link for Rerouting
        this.link("R302", "H_NORTH");
        this.link("H_NORTH", "STAIRS_A");
        this.link("H_NORTH", "H_SOUTH");
        this.link("H_SOUTH", "STAIRS_B");
        this.link("H_SOUTH", "EXIT_MAIN");
    }

    addNode(node) {
        this.nodes.set(node.id, node);
        this.adjList.set(node.id, []);
    }

    link(id1, id2) {
        this.adjList.get(id1).push(this.nodes.get(id2));
        this.adjList.get(id2).push(this.nodes.get(id1));
    }

    markHazard(areaId, dangerType = "FIRE") {
        const node = this.nodes.get(areaId);
        if (node) {
            node.dangerType = dangerType ? dangerType.toUpperCase() : "CLEAR";
            
            let weight = 0.0;
            let blocked = false;
            
            switch (node.dangerType) {
                case "LIGHT_SMOKE":
                    weight = 10.0;
                    break;
                case "CONGESTION":
                case "CROWD_PANIC":
                    weight = 15.0;
                    break;
                case "HEAVY_SMOKE":
                    weight = 50.0;
                    break;
                case "GAS_LEAK":
                    weight = 100.0;
                    break;
                case "FLOODING":
                    weight = 200.0;
                    break;
                case "STRUCTURAL_DAMAGE":
                case "FIRE":
                default:
                    weight = 99999.0;
                    blocked = true;
                    break;
            }
            
            node.hazardWeight = weight;
            node.isBlocked = blocked;
            console.log(`[PATH] !! HAZARD DETECTED: ${node.label} (${node.dangerType}) !! Weight: +${weight}${blocked ? " (BLOCKED)" : ""}`);
        }
    }

    clearHazards() {
        for (const node of this.nodes.values()) {
            node.isBlocked = false;
            node.hazardWeight = 0.0;
            node.dangerType = "CLEAR";
        }
    }

    findSafePath(startNodeId, vulnerability = null) {
        if (!this.nodes.has(startNodeId)) return [];

        const parentMap = new Map();
        const distances = new Map();
        const pq = [];

        for (const node of this.nodes.values()) {
            distances.set(node, Infinity);
        }

        const start = this.nodes.get(startNodeId);
        distances.set(start, 0);
        pq.push(start);

        let nearestExit = null;
        let isMobilityImpaired = vulnerability && 
            (vulnerability.toUpperCase() === "WHEELCHAIR" || vulnerability.toUpperCase() === "MOBILITY");

        while (pq.length > 0) {
            pq.sort((a, b) => distances.get(a) - distances.get(b));
            const current = pq.shift();

            if (current.id.includes("EXIT") || (current.id.includes("STAIRS") && !isMobilityImpaired)) {
                nearestExit = current;
                break;
            }

            const neighbors = this.adjList.get(current.id);
            for (const neighbor of neighbors) {
                if (neighbor.isBlocked) continue;

                if (isMobilityImpaired && neighbor.id.includes("STAIRS")) continue;

                const newDist = distances.get(current) + this.calculateDistance(current, neighbor) + neighbor.hazardWeight;
                if (newDist < distances.get(neighbor)) {
                    distances.set(neighbor, newDist);
                    parentMap.set(neighbor, current);
                    if (!pq.includes(neighbor)) pq.push(neighbor);
                }
            }
        }

        const path = [];
        if (nearestExit !== null) {
            let curr = nearestExit;
            while (curr != null) {
                path.unshift(curr);
                curr = parentMap.get(curr);
            }
        }

        return path;
    }

    calculateDistance(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }
}

export const pathfinder = new EvacuationPathfinder();
