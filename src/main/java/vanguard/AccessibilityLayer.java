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

        // 4. Mission - Immersive Guide (AR vs Map)
        if (isResponder) {
            // Responders see 3D full floor heatmap
            mapManager.renderLiveHeatmap(Collections.singletonList(crisisAlert));
        } else {
            // Guests see AR arrows guiding them to the nearest exit
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
