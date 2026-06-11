package com.ayatech.assetagent

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
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
        json.put("agent_version", "android-1.0.0")
        json.put("hostname", deviceName(ctx))

        battery(ctx, json)
        storage(json)
        ram(ctx, json)
        json.put("uptime_minutes", (SystemClock.elapsedRealtime() / 60000L).toInt())
        idle(ctx, json)

        val loc = bestLocation(ctx)
        if (loc != null) {
            json.put("lat", loc.latitude)
            json.put("lng", loc.longitude)
            json.put("loc_accuracy_m", loc.accuracy.roundToInt())
            json.put("loc_source", "gps")
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

    private fun hasLocationPermission(ctx: Context): Boolean =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    // Fresh network-provider fix when possible (10 s budget), otherwise the
    // most recent last-known fix from any provider. Without permission this
    // returns null and the server falls back to IP-based city location.
    private suspend fun bestLocation(ctx: Context): Location? {
        if (!hasLocationPermission(ctx)) return null
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val provider = when {
                runCatching { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }
                    .getOrDefault(false) -> LocationManager.NETWORK_PROVIDER
                runCatching { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) }
                    .getOrDefault(false) -> LocationManager.GPS_PROVIDER
                else -> null
            }
            if (provider != null) {
                val fresh = withTimeoutOrNull(10_000) {
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
