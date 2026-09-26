package com.vehr.app.device

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.vehr.app.BuildConfig
import com.vehr.app.specs.NativeVeDeviceSpec
import java.util.UUID

class VeDeviceModule(private val reactContext: ReactApplicationContext) : NativeVeDeviceSpec(reactContext) {
    private val prefs by lazy { PlainPrefs(reactContext) }
    private val secure by lazy { SecureStore(reactContext) }
    private val locator by lazy { Locator(reactContext) }

    override fun getName() = NAME

    override fun getDeviceInfo(promise: Promise) = respond(promise) {
        Arguments.createMap().apply {
            putString("deviceId", installationId())
            putString("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}".take(128))
            putString("appVersion", BuildConfig.VERSION_NAME)
            putString("apiUrl", BuildConfig.API_URL)
            putString("tileUrl", BuildConfig.TILE_URL)
            putInt("sdkInt", Build.VERSION.SDK_INT)
        }
    }

    override fun randomUuid(promise: Promise) = respond(promise) { UUID.randomUUID().toString() }

    override fun secureGet(key: String, promise: Promise) = respond(promise) { secure.get(key) }

    override fun secureSet(key: String, value: String, promise: Promise) = respond(promise) {
        secure.set(key, value)
        null
    }

    override fun secureDelete(key: String, promise: Promise) = respond(promise) {
        secure.remove(key)
        null
    }

    override fun prefGet(key: String, promise: Promise) = respond(promise) { prefs.get(key) }

    override fun prefSet(key: String, value: String, promise: Promise) = respond(promise) {
        prefs.set(key, value)
        null
    }

    override fun prefDelete(key: String, promise: Promise) = respond(promise) {
        prefs.remove(key)
        null
    }

    override fun isLocationEnabled(promise: Promise) = respond(promise) { locator.isEnabled() }

    override fun getCurrentPosition(timeoutMs: Double, targetAccuracyM: Double, promise: Promise) {
        locator.bestFix(timeoutMs.toLong(), targetAccuracyM.toFloat()) { location ->
            if (location == null) {
                promise.reject("NO_FIX", "No location fix")
            } else {
                promise.resolve(
                    Arguments.createMap().apply {
                        putDouble("lat", location.latitude)
                        putDouble("lng", location.longitude)
                        putDouble("accuracyM", location.accuracy.toDouble())
                        putBoolean("isMock", Locator.isMock(location))
                    },
                )
            }
        }
    }

    @Synchronized
    private fun installationId(): String =
        prefs.get(INSTALL_ID) ?: UUID.randomUUID().toString().also { prefs.set(INSTALL_ID, it) }

    private inline fun respond(promise: Promise, block: () -> Any?) {
        try {
            promise.resolve(block())
        } catch (e: Exception) {
            promise.reject("E_DEVICE", e.message, e)
        }
    }

    companion object {
        const val NAME = "NativeVeDevice"
        private const val INSTALL_ID = "__install_id"
    }
}
