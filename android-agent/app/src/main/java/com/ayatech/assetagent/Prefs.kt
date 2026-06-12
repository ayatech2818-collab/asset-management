package com.ayatech.assetagent

import android.content.Context
import android.content.SharedPreferences

object Prefs {
    const val KEY_SERVER = "server"
    const val KEY_TOKEN = "token"
    const val KEY_LAST_RESULT = "last_result"
    const val KEY_LAST_ACTIVE_MS = "last_active_ms"
    const val KEY_USAGE_SINCE = "usage_since_ms"

    fun get(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences("agent_prefs", Context.MODE_PRIVATE)
}
