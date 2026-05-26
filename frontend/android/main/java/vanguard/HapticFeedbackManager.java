package vanguard;

import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

/**
 * HapticFeedbackManager drives the physical Accessibility Layer for Vanguard.
 * It uses the Android hardware Vibrator to signal critical states to visually/audibly impaired guests.
 */
public class HapticFeedbackManager {

    private static final String TAG = "HapticFeedbackManager";
    private final Vibrator vibrator;

    // EVACUATE: 3 Long Pulses
    private static final long[] PATTERN_EVACUATE = {0, 1000, 500, 1000, 500, 1000};
    
    // SHELTER: Rapid Short Pulses
    private static final long[] PATTERN_SHELTER = {0, 150, 100, 150, 100, 150, 100, 150, 100, 150};

    // ON_COURSE: Slow Rhythmic Heartbeat (Reassurance for Visually Impaired)
    private static final long[] PATTERN_ON_COURSE = {0, 100, 1000, 100, 1000};

    // HAZARD_ALERT: Harsh Jagged Vibration (Danger Proximity)
    private static final long[] PATTERN_HAZARD = {0, 500, 50, 500, 50, 500, 50};

    public HapticFeedbackManager(Vibrator vibrator) {
        this.vibrator = vibrator;
    }

    /**
     * Executes absolute evacuation haptic patterns overriding any current queues.
     */
    public void triggerEvacuateHaptics() {
        if (vibrator != null && vibrator.hasVibrator()) {
            Log.i(TAG, "Triggering EVACUATE haptic pattern: 3 Long Pulses");
            // API 26+: Use VibrationEffect
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                VibrationEffect effect = VibrationEffect.createWaveform(PATTERN_EVACUATE, -1);
                vibrator.vibrate(effect);
            } else {
                // Legacy support
                vibrator.vibrate(PATTERN_EVACUATE, -1);
            }
        }
    }

    /**
     * Executes shelter-in-place haptic patterns.
     */
    public void triggerShelterHaptics() {
        if (vibrator != null && vibrator.hasVibrator()) {
            Log.i(TAG, "Triggering SHELTER haptic pattern: Rapid Short Pulses");
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                VibrationEffect effect = VibrationEffect.createWaveform(PATTERN_SHELTER, -1);
                vibrator.vibrate(effect);
            } else {
                vibrator.vibrate(PATTERN_SHELTER, -1);
            }
        }
    }

    /**
     * Rhythmic reassurance pulse used for eyes-free navigation.
     */
    public void triggerOnCourseHaptics() {
        if (vibrator != null && vibrator.hasVibrator()) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                vibration(PATTERN_ON_COURSE);
            }
        }
    }

    /**
     * Urgent jagged vibration triggered when approaching a danger zone.
     */
    public void triggerHazardHaptics() {
        if (vibrator != null && vibrator.hasVibrator()) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                vibration(PATTERN_HAZARD);
            }
        }
    }

    private void vibration(long[] pattern) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            VibrationEffect effect = VibrationEffect.createWaveform(pattern, -1);
            vibrator.vibrate(effect);
        }
    }

    public void cancel() {
        if (vibrator != null) {
            vibrator.cancel();
        }
    }
}
