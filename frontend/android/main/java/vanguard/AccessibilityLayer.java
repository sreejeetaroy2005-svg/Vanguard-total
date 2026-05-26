package vanguard;

import android.os.Vibrator;
import android.util.Log;
import android.content.Context;
import java.util.Collections;
import java.util.List;

/**
 * AccessibilityLayer orchestrates Vanguard's accessible navigation and translation suites.
 * It ties together Haptics, Translations, Voice, AR, and Maps to ensure inclusive crisis guidance.
 */
public class AccessibilityLayer {

    private static final String TAG = "AccessibilityLayer";

    private final HapticFeedbackManager haptics;
    private final GlobalTranslationService translator;
    private final GeminiVoiceAssistant voiceAssistant;
    private final ArNavigator arNavigator;
    private final ImmersiveMapManager mapManager;
    private final EvacuationPathfinder pathfinder;
    
    // User configuration
    private final String userLocale;
    private final String currentRoomId; // Tracking guest's starting location
    private final boolean isElderlyOrVisuallyImpaired;
    private final boolean isResponder;

    public AccessibilityLayer(Context context, Vibrator vibrator, String locale, String roomId, boolean isVisuallyImpaired, boolean responderMode) {
        this.haptics = new HapticFeedbackManager(vibrator);
        this.translator = new GlobalTranslationService(locale);
        this.voiceAssistant = new GeminiVoiceAssistant(context);
        this.arNavigator = new ArNavigator(context);
        this.mapManager = new ImmersiveMapManager(context);
        this.pathfinder = new EvacuationPathfinder();
        
        this.userLocale = locale;
        this.currentRoomId = roomId;
        this.isElderlyOrVisuallyImpaired = isVisuallyImpaired;
        this.isResponder = responderMode;
    }

    /**
     * Executes the comprehensive accessibility suite based on an incoming critical crisis.
     */
    public void engageSubsystems(CrisisTriage.EmergencyPacket crisisAlert) {
        if (crisisAlert == null) return;

        Log.i(TAG, "\n--- ENGAGING ACCESSIBILITY LAYER ---");

        // 1. Mission - Translation: localize raw English alert for the user's locale
        String rawInstruction = crisisAlert.getPayload();

        // 2. Mission - Haptics: tactile urgency signal
        if (crisisAlert.getPriority() == CrisisTriage.Priority.FIRE ||
            crisisAlert.getPriority() == CrisisTriage.Priority.EARTHQUAKE) {
            haptics.triggerEvacuateHaptics();
        } else if (crisisAlert.getPriority() == CrisisTriage.Priority.WEAPONS) {
            haptics.triggerShelterHaptics();
        }

        // 3. Mission - Gemini Voice Assistant
        //    a) Brief Gemini on the current emergency so follow-up questions are grounded
        voiceAssistant.injectEmergencyContext(crisisAlert);
        //    b) Translate and immediately speak the alert for elderly/visually impaired users
        if (isElderlyOrVisuallyImpaired) {
            translator.translateAndSpeak(rawInstruction, voiceAssistant);
        }

        // 4. Mission - Immersive Guide (Hazard-Aware Pathfinder)
        if (isResponder) {
            // Responders see 3D full floor heatmap
            mapManager.renderLiveHeatmap(Collections.singletonList(crisisAlert));
        } else {
            // Calculate safest shortest path avoiding active hazards
            List<EvacuationPathfinder.Node> safePath = pathfinder.findSafePath(currentRoomId);
            
            if (!safePath.isEmpty() && safePath.size() > 1) {
                // Point AR arrows towards the NEXT safe node in the sequence
                float heading = calculateHeading(safePath.get(0), safePath.get(1));
                arNavigator.projectGreenArrows(heading);
                
                // TACTILE GUIDANCE: Signal correctly identified safe path
                if (isElderlyOrVisuallyImpaired) {
                    haptics.triggerOnCourseHaptics();
                }
                
                Log.i(TAG, "[GUIDE] Routing Guest via " + safePath.get(1).label);
            } else {
                voiceAssistant.speakInstruction("No safe path found. Stay in place and wait for responders.");
            }
        }

        Log.i(TAG, "--- ACCESSIBILITY LAYER FULLY DEPLOYED ---\n");
    }

    /**
     * Calculates the navigational bearing (theta) between two interior hotel nodes.
     */
    private float calculateHeading(EvacuationPathfinder.Node from, EvacuationPathfinder.Node to) {
        return (float) Math.toDegrees(Math.atan2(to.y - from.y, to.x - from.x));
    }
    
    public void shutdown() {
        haptics.cancel();
        arNavigator.stopNavigation();
        voiceAssistant.shutdown();
    }
}
