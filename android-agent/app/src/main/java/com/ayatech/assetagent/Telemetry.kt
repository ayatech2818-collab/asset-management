package com.ayatech.assetagent

import android.Manifest
import android.app.ActivityManager
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.math.roundToInt

// Collects one heartbeat snapshot. Mirrors the fields the Windows agent
// sends; /api/ingest treats every field except device_token as optional.
object Telemetry {

    suspend fun collect(ctx: Context, token: String): JSONObject {
        val json = JSONObject()
        json.put("device_token", token)
        json.put("agent_version", "android-1.1.0")
        json.put("hostname", deviceName(ctx))

        // Each collector is independent: a failing sensor must never stop the
        // heartbeat itself from going out.
        runCatching { battery(ctx, json) }
        runCatching { storage(json) }
        runCatching { ram(ctx, json) }
        runCatching { json.put("uptime_minutes", (SystemClock.elapsedRealtime() / 60000L).toInt()) }
        runCatching { idle(ctx, json) }
        runCatching { usageStats(ctx, json) }
        runCatching { deviceFacts(ctx, json) }
        runCatching {
            val loc = bestLocation(ctx)
            if (loc != null) {
                json.put("lat", loc.latitude)
                json.put("lng", loc.longitude)
                json.put("loc_accuracy_m", loc.accuracy.roundToInt())
                json.put("loc_source", "gps")
            }
        }
        return json
    }

    private fun deviceName(ctx: Context): String {
        val custom = try {
            Settings.Global.getString(ctx.contentResolver, "device_name")
        } catch (_: Exception) {
            null
        }
        val model = "${Build.MANUFACTURER} ${Build.MODEL}"
        return if (custom.isNullOrBlank()) model else "$custom ($model)"
    }

    private fun battery(ctx: Context, json: JSONObject) {
        // The sticky ACTION_BATTERY_CHANGED broadcast works without a receiver.
        val intent = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?: return
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level >= 0 && scale > 0) json.put("battery_pct", level * 100 / scale)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        json.put(
            "is_charging",
            status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL,
        )
    }

    private fun storage(json: JSONObject) {
        try {
            val stat = StatFs(android.os.Environment.getDataDirectory().path)
            val freeGb = stat.availableBytes / 1_000_000_000.0
            json.put("disk_free_gb", (freeGb * 10).roundToInt() / 10.0)
        } catch (_: Exception) {
        }
    }

    private fun ram(ctx: Context, json: JSONObject) {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        if (mi.totalMem > 0) {
            json.put("ram_pct", ((mi.totalMem - mi.availMem) * 100 / mi.totalMem).toInt())
        }
    }

    // Active/inactive approximation: if the screen is on now, the device is in
    // use (idle 0) and we remember the time. If it is off, idle = minutes since
    // we last saw it on. Granularity is the 15-minute heartbeat interval.
    private fun idle(ctx: Context, json: JSONObject) {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        val prefs = Prefs.get(ctx)
        val now = System.currentTimeMillis()
        if (pm.isInteractive) {
            prefs.edit().putLong(Prefs.KEY_LAST_ACTIVE_MS, now).apply()
            json.put("idle_minutes", 0)
        } else {
            val last = prefs.getLong(Prefs.KEY_LAST_ACTIVE_MS, 0L)
            if (last in 1..now) json.put("idle_minutes", ((now - last) / 60000L).toInt())
        }
    }

    fun hasUsageAccess(ctx: Context): Boolean {
        val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        @Suppress("DEPRECATION")
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // Exact usage since the previous heartbeat, from the system event log:
    // number of unlocks and real screen-on minutes. Requires the one-time
    // "Usage access" grant (Settings > Special app access); skipped without it.
    private fun usageStats(ctx: Context, json: JSONObject) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
        if (!hasUsageAccess(ctx)) return

        val prefs = Prefs.get(ctx)
        val now = System.currentTimeMillis()
        val since = prefs.getLong(Prefs.KEY_USAGE_SINCE, now - 15 * 60_000L)
            .coerceIn(now - 24 * 3_600_000L, now)

        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(since, now)
        var unlocks = 0
        var screenOnMs = 0L
        var lastOn = -1L
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            when (e.eventType) {
                UsageEvents.Event.KEYGUARD_HIDDEN -> unlocks++
                UsageEvents.Event.SCREEN_INTERACTIVE -> lastOn = e.timeStamp
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                    if (lastOn >= 0) {
                        screenOnMs += e.timeStamp - lastOn
                        lastOn = -1L
                    }
                }
            }
        }
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (lastOn >= 0) {
            screenOnMs += now - lastOn // screen still on
        } else if (screenOnMs == 0L && unlocks == 0 && pm.isInteractive) {
            screenOnMs = now - since // on for the whole window, no edge events
        }

        val windowMin = ((now - since) / 60_000L).toInt()
        json.put("unlock_count", unlocks)
        json.put("screen_on_minutes", ((screenOnMs / 60_000L).toInt()).coerceAtMost(windowMin))
        prefs.edit().putLong(Prefs.KEY_USAGE_SINCE, now).apply()
    }

    // Tier 1 inventory + security posture. Static or slow-changing; the
    // server stores the latest on the enrollment row.
    private fun deviceFacts(ctx: Context, json: JSONObject) {
        json.put("manufacturer", Build.MANUFACTURER)
        json.put("model", Build.MODEL)
        json.put("os_name", "Android")
        json.put("os_version", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")

        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        if (mi.totalMem > 0) {
            json.put("total_ram_gb", Math.round(mi.totalMem / 1e9 * 10) / 10.0)
        }
        runCatching {
            val stat = StatFs(android.os.Environment.getDataDirectory().path)
            json.put("total_disk_gb", Math.round(stat.totalBytes / 1e9 * 10) / 10.0)
        }

        // Storage encryption (default-on for modern Android).
        runCatching {
            val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE)
                as android.app.admin.DevicePolicyManager
            val st = dpm.storageEncryptionStatus
            json.put(
                "disk_encrypted",
                st == android.app.admin.DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE ||
                    st == android.app.admin.DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE_PER_USER,
            )
        }

        // Connected Wi-Fi SSID (needs location permission, which we hold).
        runCatching {
            if (hasLocationPermission(ctx)) {
                val wm = ctx.applicationContext
                    .getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
                @Suppress("DEPRECATION")
                val ssid = wm.connectionInfo?.ssid?.trim('"')
                if (!ssid.isNullOrBlank() && ssid != "<unknown ssid>") {
                    json.put("wifi_ssid", ssid)
                }
            }
        }
    }

    private fun hasLocationPermission(ctx: Context): Boolean =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    // Fresh fix from the best available provider — fused (Android 12+), then
    // network, then real GPS (longer budget; needs sky view) — otherwise the
    // most recent last-known fix from any provider. Without permission this
    // returns null and the server falls back to IP-based city location.
    private suspend fun bestLocation(ctx: Context): Location? {
        if (!hasLocationPermission(ctx)) return null
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val providers = buildList {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    add(LocationManager.FUSED_PROVIDER)
                }
                add(LocationManager.NETWORK_PROVIDER)
                add(LocationManager.GPS_PROVIDER)
            }.filter { p ->
                runCatching { lm.isProviderEnabled(p) }.getOrDefault(false)
            }

            for (provider in providers) {
                val budget = if (provider == LocationManager.GPS_PROVIDER) 25_000L else 10_000L
                val fresh = withTimeoutOrNull(budget) {
                    suspendCancellableCoroutine<Location?> { cont ->
                        try {
                            lm.getCurrentLocation(provider, null, ctx.mainExecutor) { loc ->
                                if (cont.isActive) cont.resume(loc)
                            }
                        } catch (_: Exception) {
                            if (cont.isActive) cont.resume(null)
                        }
                    }
                }
                if (fresh != null) return fresh
            }
        }

        return try {
            lm.allProviders
                .mapNotNull { p -> runCatching { lm.getLastKnownLocation(p) }.getOrNull() }
                .maxByOrNull { it.time }
        } catch (_: Exception) {
            null
        }
    }
}
