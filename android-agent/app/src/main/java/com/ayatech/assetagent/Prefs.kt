package com.ayatech.assetagent

import android.content.Context
import android.content.SharedPreferences

object Prefs {
    const val KEY_SERVER = "server"
    const val KEY_TOKEN = "token"
    const val KEY_LAST_RESULT = "last_result"
    const val KEY_LAST_ACTIVE_MS = "last_active_ms"
    const val KEY_USAGE_SINCE = "usage_since_ms"

    // Admin lock state, pushed from the server. true = the agent is locked and
    // the employee can't open or change it.
    const val KEY_AGENT_LOCKED = "agent_locked"

    fun get(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences("agent_prefs", Context.MODE_PRIVATE)

    // Configured = the server URL + token have been entered (initial setup done).
    fun isConfigured(ctx: Context): Boolean {
        val p = get(ctx)
        return !p.getString(KEY_SERVER, null).isNullOrBlank() &&
            !p.getString(KEY_TOKEN, null).isNullOrBlank()
    }

    fun isLocked(ctx: Context): Boolean =
        get(ctx).getBoolean(KEY_AGENT_LOCKED, false)

    fun setLocked(ctx: Context, locked: Boolean) {
        get(ctx).edit().putBoolean(KEY_AGENT_LOCKED, locked).apply()
    }
}
