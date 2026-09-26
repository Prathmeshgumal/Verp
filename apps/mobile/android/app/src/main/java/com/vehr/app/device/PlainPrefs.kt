package com.vehr.app.device

import android.content.Context

/** Small plain key/value store. commit() is synchronous so values are on disk before we return. */
class PlainPrefs(context: Context) {
    private val prefs = context.getSharedPreferences("vehr_prefs", Context.MODE_PRIVATE)

    fun get(key: String): String? = prefs.getString(key, null)

    fun set(key: String, value: String) {
        check(prefs.edit().putString(key, value).commit()) { "prefs write failed" }
    }

    fun remove(key: String) {
        prefs.edit().remove(key).commit()
    }
}
