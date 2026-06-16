package com.ayatech.assetagent

import android.Manifest
import android.app.admin.DevicePolicyManager
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

        // While the agent is locked, the config screen is reachable only
        // through the lock screen. Anything else (direct launch, recents)
        // re-gates so the live lock check runs first.
        if (Prefs.isConfigured(this) &&
            Prefs.isLocked(this) &&
            !intent.getBooleanExtra(EXTRA_UNLOCKED, false)
        ) {
            startActivity(Intent(this, LockActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        serverInput = findViewById(R.id.serverInput)
        tokenInput = findViewById(R.id.tokenInput)
        statusText = findViewById(R.id.statusText)

        val prefs = Prefs.get(this)
        // Pre-fill the production server URL so users only need to paste the
        // token; keep any previously saved URL if one exists.
        val savedServer = prefs.getString(Prefs.KEY_SERVER, "").orEmpty()
        serverInput.setText(if (savedServer.isBlank()) DEFAULT_SERVER else savedServer)
        tokenInput.setText(prefs.getString(Prefs.KEY_TOKEN, ""))

        findViewById<Button>(R.id.saveButton).setOnClickListener { saveAndStart() }
        findViewById<Button>(R.id.sendNowButton).setOnClickListener { sendNow() }
        findViewById<Button>(R.id.batteryButton).setOnClickListener { requestBatteryExemption() }
        findViewById<Button>(R.id.usageButton).setOnClickListener { requestUsageAccess() }
        findViewById<Button>(R.id.protectButton).setOnClickListener { toggleUninstallProtection() }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Leaving via Home/Recents ends this session, so the next entry goes
        // back through the lock screen and re-checks the current lock state.
        if (Prefs.isConfigured(this)) finish()
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
        refreshProtectButton()
    }

    private fun dpm() =
        getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager

    // Uninstall protection. Plain Device Admin can't actually block uninstall
    // (the user can deactivate it in Settings → Security and then remove the
    // app), so true blocking only works when this app is the device owner —
    // then setUninstallBlocked() greys out uninstall with no way around it.
    private fun toggleUninstallProtection() {
        val dpm = dpm()
        val admin = AgentDeviceAdminReceiver.component(this)
        when {
            dpm.isDeviceOwnerApp(packageName) -> {
                val nowBlocked = !dpm.isUninstallBlocked(admin, packageName)
                dpm.setUninstallBlocked(admin, packageName, nowBlocked)
                Toast.makeText(
                    this,
                    if (nowBlocked) R.string.protect_blocked else R.string.protect_unblocked,
                    Toast.LENGTH_SHORT,
                ).show()
            }
            dpm.isAdminActive(admin) -> {
                // Only a (weak) device admin — allow turning it off.
                dpm.removeActiveAdmin(admin)
                Toast.makeText(this, R.string.protect_disabled, Toast.LENGTH_SHORT).show()
            }
            else -> {
                // Enable the basic device-admin deterrent, and make clear that
                // full blocking needs device-owner provisioning (see README).
                startActivity(
                    Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                        .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
                        .putExtra(
                            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                            getString(R.string.protect_explanation),
                        ),
                )
                Toast.makeText(this, R.string.protect_needs_owner, Toast.LENGTH_LONG).show()
            }
        }
        refreshProtectButton()
    }

    private fun refreshProtectButton() {
        val dpm = dpm()
        val admin = AgentDeviceAdminReceiver.component(this)
        val owner = dpm.isDeviceOwnerApp(packageName)
        val adminActive = dpm.isAdminActive(admin)
        val blocked = owner && dpm.isUninstallBlocked(admin, packageName)

        val btn = findViewById<Button>(R.id.protectButton)
        val status = findViewById<TextView>(R.id.protectStatus)
        when {
            owner -> {
                btn.text =
                    getString(if (blocked) R.string.protect_off else R.string.protect_on)
                status.text = getString(
                    if (blocked) R.string.protect_status_blocked
                    else R.string.protect_status_owner_idle,
                )
            }
            adminActive -> {
                btn.text = getString(R.string.protect_off)
                status.text = getString(R.string.protect_status_admin_weak)
            }
            else -> {
                btn.text = getString(R.string.protect_on)
                status.text = getString(R.string.protect_status_none)
            }
        }
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

    companion object {
        // Set by LockActivity after a successful unlock (or for an unconfigured
        // fresh install); MainActivity refuses to open without it once locked.
        const val EXTRA_UNLOCKED = "unlocked"

        // Default (production) server, pre-filled on a fresh install.
        const val DEFAULT_SERVER = "https://asset-management-lovat-eight.vercel.app"
    }
}
