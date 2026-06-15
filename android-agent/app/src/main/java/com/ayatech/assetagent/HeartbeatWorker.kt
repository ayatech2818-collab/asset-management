package com.ayatech.assetagent

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// One heartbeat: collect telemetry and POST it to /api/ingest.
// Scheduled every 15 minutes by WorkManager (see MainActivity); WorkManager
// persists the schedule across reboots and respects Doze.
class HeartbeatWorker(ctx: Context, params: WorkerParameters) :
    CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val prefs = Prefs.get(applicationContext)
        val server = prefs.getString(Prefs.KEY_SERVER, null)?.trimEnd('/')
        val token = prefs.getString(Prefs.KEY_TOKEN, null)
        if (server.isNullOrBlank() || token.isNullOrBlank()) return Result.failure()

        val stamp = SimpleDateFormat("d MMM HH:mm", Locale.getDefault()).format(Date())

        // Any throw anywhere must end up as readable text in the status line.
        return try {
            val payload = Telemetry.collect(applicationContext, token)
            withContext(Dispatchers.IO) {
                val conn = URL("$server/api/ingest").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.doOutput = true
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val responseBody =
                    if (code in 200..299) {
                        conn.inputStream.bufferedReader().use { it.readText() }
                    } else {
                        ""
                    }
                conn.disconnect()

                when {
                    code in 200..299 -> {
                        cacheLockState(prefs, responseBody)
                        prefs.edit().putString(Prefs.KEY_LAST_RESULT, "Sent OK · $stamp").apply()
                        Result.success()
                    }
                    code in 300..399 -> {
                        prefs.edit().putString(
                            Prefs.KEY_LAST_RESULT,
                            "HTTP $code redirect — check the server URL (no /login etc.) · $stamp",
                        ).apply()
                        Result.retry()
                    }
                    code == 401 -> {
                        // Bad or rotated token: retrying won't help until re-enrolled.
                        prefs.edit().putString(
                            Prefs.KEY_LAST_RESULT,
                            "Token rejected (HTTP 401) — re-enroll the asset and paste the new token · $stamp",
                        ).apply()
                        Result.failure()
                    }
                    else -> {
                        prefs.edit().putString(Prefs.KEY_LAST_RESULT, "Server said HTTP $code · $stamp").apply()
                        Result.retry()
                    }
                }
            }
        } catch (t: Throwable) {
            prefs.edit()
                .putString(
                    Prefs.KEY_LAST_RESULT,
                    "Failed: ${t.javaClass.simpleName}: ${t.message ?: "no detail"} · $stamp",
                )
                .apply()
            Result.retry()
        }
    }

    // The server returns the current admin lock state on every heartbeat.
    // Caching it keeps the device's lock in sync even between app opens.
    private fun cacheLockState(
        prefs: android.content.SharedPreferences,
        body: String,
    ) {
        if (body.isBlank()) return
        try {
            val json = org.json.JSONObject(body)
            if (json.has("locked")) {
                prefs.edit()
                    .putBoolean(Prefs.KEY_AGENT_LOCKED, json.optBoolean("locked", false))
                    .apply()
            }
        } catch (_: Exception) {
            // Older server without this field — leave any cached state intact.
        }
    }

    companion object {
        const val WORK_NAME = "heartbeat"
    }
}
