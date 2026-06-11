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

        val payload = Telemetry.collect(applicationContext, token)
        val stamp = SimpleDateFormat("d MMM HH:mm", Locale.getDefault()).format(Date())

        return withContext(Dispatchers.IO) {
            try {
                val conn = URL("$server/api/ingest").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.doOutput = true
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                conn.disconnect()

                if (code in 200..299) {
                    prefs.edit().putString(Prefs.KEY_LAST_RESULT, "Sent OK · $stamp").apply()
                    Result.success()
                } else {
                    prefs.edit().putString(Prefs.KEY_LAST_RESULT, "Server said HTTP $code · $stamp").apply()
                    // 401 = bad/rotated token: retrying won't help until re-enrolled.
                    if (code == 401) Result.failure() else Result.retry()
                }
            } catch (e: Exception) {
                prefs.edit()
                    .putString(Prefs.KEY_LAST_RESULT, "Failed: ${e.message ?: "network error"} · $stamp")
                    .apply()
                Result.retry()
            }
        }
    }

    companion object {
        const val WORK_NAME = "heartbeat"
    }
}
