package com.ayatech.assetagent

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var serverInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var statusText: TextView

    // Foreground location first; "Allow all the time" is asked as a second
    // step because Android requires the two requests to be separate.
    private val backgroundLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    private val locationLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val granted = result[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                result[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            if (granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        serverInput = findViewById(R.id.serverInput)
        tokenInput = findViewById(R.id.tokenInput)
        statusText = findViewById(R.id.statusText)

        val prefs = Prefs.get(this)
        serverInput.setText(prefs.getString(Prefs.KEY_SERVER, ""))
        tokenInput.setText(prefs.getString(Prefs.KEY_TOKEN, ""))

        findViewById<Button>(R.id.saveButton).setOnClickListener { saveAndStart() }
        findViewById<Button>(R.id.sendNowButton).setOnClickListener { sendNow() }
        findViewById<Button>(R.id.batteryButton).setOnClickListener { requestBatteryExemption() }
        findViewById<Button>(R.id.usageButton).setOnClickListener { requestUsageAccess() }
    }

    private fun requestUsageAccess() {
        if (Telemetry.hasUsageAccess(this)) {
            Toast.makeText(this, "Usage tracking already allowed", Toast.LENGTH_SHORT).show()
            return
        }
        // System list of apps; the user taps Asset Agent and enables access.
        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        Toast.makeText(this, "Find \"Asset Agent\" and allow usage access", Toast.LENGTH_LONG).show()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        val last = Prefs.get(this).getString(Prefs.KEY_LAST_RESULT, null)
        if (last != null) {
            statusText.text = "Last heartbeat: $last\nReporting every 15 minutes while online."
        }
    }

    private fun saveAndStart() {
        val raw = serverInput.text.toString().trim()
        val token = tokenInput.text.toString().trim()

        // Normalize to scheme + host (people paste e.g. https://app.example.com/login).
        val server = try {
            val u = java.net.URL(raw)
            if (u.protocol != "http" && u.protocol != "https") "" else "${u.protocol}://${u.authority}"
        } catch (_: Exception) {
            ""
        }
        if (server.isBlank()) {
            Toast.makeText(this, "Server URL must start with http(s)://", Toast.LENGTH_LONG).show()
            return
        }
        serverInput.setText(server)
        if (token.length < 16) {
            Toast.makeText(this, "Paste the device token from the dashboard", Toast.LENGTH_LONG).show()
            return
        }

        Prefs.get(this).edit()
            .putString(Prefs.KEY_SERVER, server)
            .putString(Prefs.KEY_TOKEN, token)
            .apply()

        locationLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )

        val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            HeartbeatWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )

        sendNow()
        Toast.makeText(this, "Monitoring started", Toast.LENGTH_SHORT).show()
    }

    private fun sendNow() {
        val prefs = Prefs.get(this)
        if (prefs.getString(Prefs.KEY_SERVER, null).isNullOrBlank() ||
            prefs.getString(Prefs.KEY_TOKEN, null).isNullOrBlank()
        ) {
            Toast.makeText(this, "Save the server and token first", Toast.LENGTH_SHORT).show()
            return
        }
        statusText.text = "Sending heartbeat…"
        val test = OneTimeWorkRequestBuilder<HeartbeatWorker>().build()
        val wm = WorkManager.getInstance(this)
        wm.enqueue(test)
        // Refresh on every state change so failures + retries are visible,
        // not just clean finishes.
        wm.getWorkInfoByIdLiveData(test.id).observe(this) { info ->
            when (info?.state) {
                WorkInfo.State.RUNNING -> statusText.text = "Sending heartbeat…"
                WorkInfo.State.BLOCKED, null -> {}
                else -> refreshStatus()
            }
        }
    }

    private fun requestBatteryExemption() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            Toast.makeText(this, "Already allowed to run in background", Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(
            Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName"),
            ),
        )
    }
}
