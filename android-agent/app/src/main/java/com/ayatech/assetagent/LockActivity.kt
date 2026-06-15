package com.ayatech.assetagent

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL

// Launcher gate. Checks the admin lock state for this device and either opens
// the config screen (unlocked) or shows a "locked" message the employee can't
// get past. The check hits the server on launch so an admin unlock takes effect
// within seconds; if the network is unavailable it falls back to the last
// cached state. Monitoring keeps running in the background regardless.
class LockActivity : AppCompatActivity() {

    private lateinit var status: TextView
    private lateinit var retry: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Not set up yet (fresh install) — go straight to setup, no lock.
        if (!Prefs.isConfigured(this)) {
            openConfig()
            return
        }

        setContentView(R.layout.activity_lock)
        status = findViewById(R.id.lockStatus)
        retry = findViewById(R.id.retryButton)
        retry.setOnClickListener { checkState() }
        checkState()
    }

    override fun onResume() {
        super.onResume()
        // Re-check when the user returns to the lock screen (e.g. after the
        // admin unlocks from the dashboard).
        if (Prefs.isConfigured(this)) checkState()
    }

    private fun checkState() {
        status.text = getString(R.string.lock_checking)
        retry.visibility = Button.GONE
        Thread {
            val fetched = fetchLocked()
            runOnUiThread {
                if (isFinishing) return@runOnUiThread
                if (fetched != null) Prefs.setLocked(this, fetched)
                val locked = fetched ?: Prefs.isLocked(this)
                if (locked) {
                    status.text = getString(R.string.lock_locked_msg)
                    retry.visibility = Button.VISIBLE
                } else {
                    openConfig()
                }
            }
        }.start()
    }

    // Returns the current lock state, or null if it couldn't be reached.
    private fun fetchLocked(): Boolean? {
        val prefs = Prefs.get(this)
        val server = prefs.getString(Prefs.KEY_SERVER, null)?.trimEnd('/') ?: return null
        val token = prefs.getString(Prefs.KEY_TOKEN, null) ?: return null
        return try {
            val conn = URL("$server/api/agent-state?token=$token")
                .openConnection() as HttpURLConnection
            conn.connectTimeout = 5_000
            conn.readTimeout = 5_000
            val code = conn.responseCode
            val body = if (code in 200..299) {
                conn.inputStream.bufferedReader().use { it.readText() }
            } else {
                ""
            }
            conn.disconnect()
            if (body.isBlank()) null
            else org.json.JSONObject(body).optBoolean("locked", Prefs.isLocked(this))
        } catch (_: Exception) {
            null
        }
    }

    private fun openConfig() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_UNLOCKED, true),
        )
        finish()
    }
}
