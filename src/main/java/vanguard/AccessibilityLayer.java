package vanguard;

import android.os.Vibrator;
import android.util.Log;
import android.content.Context;
import java.util.Collections;

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
    
    // User configuration flag representing phone's system locale and handicap setups
    private final String userLocale;
    private final boolean isElderlyOrVisuallyImpaired;
    private final boolean isResponder;

    public AccessibilityLayer(Context context, Vibrator vibrator, String locale, boolean isVisuallyImpaired, boolean responderMode) {
        this.haptics = new HapticFeedbackManager(vibrator);
        this.translator = new GlobalTranslationService(locale);
        this.voiceAssistant = new GeminiVoiceAssistant(context);
        this.arNavigator = new ArNavigator(context);
        this.mapManager = new ImmersiveMapManager(context);
        
        this.userLocale = locale;
        this.isElderlyOrVisuallyImpaired = isVisuallyImpaired;
        this.isResponder = responderMode;
    }

    /**
     * Executes the comprehensive accessibility suite based on an incoming critical crisis.
     */
    public void engageSubsystems(CrisisTriage.EmergencyPacket crisisAlert) {
        if (crisisAlert == null) return;
        
        Log.i(TAG, "\n--- ENGAGING ACCESSIBILITY LAYER ---");

        // 1. Mission - Accessibility Layer: Translation
        String rawInstruction = crisisAlert.getPayload();
        String localizedInstruction = translator.localizeAlert(rawInstruction);

        // 2. Mission - Accessibility Layer: Haptics
        if (crisisAlert.getPriority() == CrisisTriage.Priority.FIRE || 
            crisisAlert.getPriority() == CrisisTriage.Priority.EARTHQUAKE) {
            haptics.triggerEvacuateHaptics();
        } else if (crisisAlert.getPriority() == CrisisTriage.Priority.WEAPONS) {
            haptics.triggerShelterHaptics();
        }

        // 3. Mission - Accessibility Layer: Gemini Voice Assistant
        if (isElderlyOrVisuallyImpaired) {
            voiceAssistant.speakInstruction(localizedInstruction);
        }

        // 4. Mission - Immersive Guide (AR vs Map)
        if (isResponder) {
            // Responders see 3D full floor heatmap
            mapManager.renderLiveHeatmap(Collections.singletonList(crisisAlert));
        } else {
            // Guests see floor AR arrows guiding them safely out
            float headingToExit = calculateExitVector();
            arNavigator.projectGreenArrows(headingToExit);
        }
        
        Log.i(TAG, "--- ACCESSIBILITY LAYER FULLY DEPLOYED ---\n");
    }

    private float calculateExitVector() {
        return 90.0f; // Mock vector calculation
    }
    
    public void shutdown() {
        haptics.cancel();
        arNavigator.stopNavigation();
        voiceAssistant.shutdown();
    }
}
