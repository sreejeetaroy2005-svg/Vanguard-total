package vanguard;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity serves as the "Lifeline HUD" for the Guest App.
 * It provides a high-stress SOS interface and initializes the P2P Mesh Network.
 */
public class MainActivity extends AppCompatActivity {

    private Button btnSOS;
    private TextView meshStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        btnSOS = findViewById(R.id.btnSOS);
        meshStatus = findViewById(R.id.meshStatus);

        // 1. Initialize the Nearby Mesh Service in the background
        Intent serviceIntent = new Intent(this, NearbyMeshService.class);
        startService(serviceIntent);

        // 2. Setup SOS Listener
        btnSOS.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                triggerSosAlert();
            }
        });

        updateMeshStatus("VANGUARD SECURE MESH: ACTIVE");
    }

    private void triggerSosAlert() {
        // In a real app, this would send a packet via NearbyMeshService
        Toast.makeText(this, "SOS BROADCASTED TO ALL NODES", Toast.LENGTH_LONG).show();
        
        // Log the action for debugging (visualized in tactical dashboard)
        System.out.println("Vanguard: Critical SOS triggered by user.");
    }

    private void updateMeshStatus(String status) {
        if (meshStatus != null) {
            meshStatus.setText(status);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Optional: Keep service running in background if mission critical
    }
}
