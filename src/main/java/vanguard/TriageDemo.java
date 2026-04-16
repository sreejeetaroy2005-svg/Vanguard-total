package vanguard;

public class TriageDemo {
    public static void main(String[] args) throws InterruptedException {
        CrisisTriage triage = new CrisisTriage();

        System.out.println("--- Vanguard Emergency Triage Demo ---");

        // 1. Send low priority packet
        CrisisTriage.EmergencyPacket powerOutage = new CrisisTriage.EmergencyPacket(
                CrisisTriage.Priority.POWER_OUTAGE, "Sector 4 grid failure", 5000, 5);
        triage.processAlert(powerOutage);

        // 2. Send high priority packet
        CrisisTriage.EmergencyPacket fire = new CrisisTriage.EmergencyPacket(
                CrisisTriage.Priority.FIRE, "Building 7 level 2 fire", 5000, 5);
        triage.processAlert(fire);

        // 3. Duplicate packet demonstration
        System.out.println("\nTesting Deduplication:");
        triage.processAlert(fire); // Should be ignored as duplicate

        // 4. Earthquake override
        System.out.println("\nTesting Earthquake Override:");
        CrisisTriage.EmergencyPacket earthquake = new CrisisTriage.EmergencyPacket(
                CrisisTriage.Priority.EARTHQUAKE, "Magnitude 7.1 detected", 5000, 5);
        triage.processAlert(earthquake);

        System.out.println("\nCurrent Active Alert: " + triage.getCurrentActiveAlert().getPriority() +
                " - " + triage.getCurrentActiveAlert().getPayload());

        // 5. Short TTL expiration demonstration
        System.out.println("\nTesting TTL Expiration:");
        CrisisTriage triage2 = new CrisisTriage();
        CrisisTriage.EmergencyPacket shortLivedSmoke = new CrisisTriage.EmergencyPacket(
                CrisisTriage.Priority.SMOKE, "Brief smoke detector blip", 100, 5); // 100ms TTL, 5 Hops
        triage2.processAlert(shortLivedSmoke);
        
        System.out.println("Sleeping for 150ms...");
        Thread.sleep(150);
        
        CrisisTriage.EmergencyPacket active = triage2.getCurrentActiveAlert();
        if (active == null) {
            System.out.println("Success! Alert expired as expected due to TTL.");
        } else {
            System.out.println("Failure! Alert is still active.");
        }
    }
}
