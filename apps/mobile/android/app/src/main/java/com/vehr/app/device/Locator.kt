package com.vehr.app.device

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.location.LocationListenerCompat
import androidx.core.location.LocationManagerCompat
import androidx.core.location.LocationRequestCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Collects fresh fixes for up to [timeoutMs] and reports the most accurate one.
 * Uses the fused provider when Play Services is usable, else plain LocationManager (spec §10.4).
 * All callbacks run on the main looper, so the state below is only touched from one thread.
 */
class Locator(private val context: Context) {
    private val locationManager = context.getSystemService(LocationManager::class.java)

    fun isEnabled(): Boolean = LocationManagerCompat.isLocationEnabled(locationManager)

    @SuppressLint("MissingPermission") // JS checks ACCESS_FINE_LOCATION before calling.
    fun bestFix(timeoutMs: Long, targetAccuracyM: Float, done: (Location?) -> Unit) {
        val main = Handler(Looper.getMainLooper())
        main.post {
            var best: Location? = null
            var finished = false
            var stop: () -> Unit = {}
            lateinit var timeout: Runnable

            fun finish() {
                if (finished) return
                finished = true
                main.removeCallbacks(timeout)
                stop()
                done(best)
            }

            fun offer(location: Location) {
                if (finished || !location.hasAccuracy()) return
                val current = best
                if (current == null || location.accuracy < current.accuracy) best = location
                if (location.accuracy <= targetAccuracyM) finish()
            }

            timeout = Runnable { finish() }
            try {
                stop = if (hasPlayServices()) startFused(timeoutMs, ::offer) else startPlatform(1000L, ::offer)
            } catch (e: SecurityException) {
                finished = true
                done(null)
                return@post
            }
            main.postDelayed(timeout, timeoutMs)
        }
    }

    /** The running watch's stop function. Only touched on the main thread. */
    private var activeWatch: (() -> Unit)? = null

    /** Streams fixes to [onFix] about every [intervalMs] until [stopWatch]. A new call replaces the running watch. */
    fun startWatch(intervalMs: Long, onFix: (Location) -> Unit) {
        Handler(Looper.getMainLooper()).post {
            activeWatch?.invoke()
            activeWatch = null
            try {
                activeWatch = if (hasPlayServices()) startFusedWatch(intervalMs, onFix) else startPlatform(intervalMs, onFix)
            } catch (e: SecurityException) {
                Log.w(TAG, "location watch refused", e)
            }
        }
    }

    fun stopWatch() {
        Handler(Looper.getMainLooper()).post {
            activeWatch?.invoke()
            activeWatch = null
        }
    }

    @SuppressLint("MissingPermission") // JS runs ensureLocationReady before watching.
    private fun startFusedWatch(intervalMs: Long, onFix: (Location) -> Unit): () -> Unit {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs)
            .setMaxUpdateAgeMillis(0L)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let(onFix)
            }
        }
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        return { client.removeLocationUpdates(callback) }
    }

    @SuppressLint("MissingPermission")
    private fun startFused(timeoutMs: Long, offer: (Location) -> Unit): () -> Unit {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .setMaxUpdateAgeMillis(0L) // never hand back a cached fix
            .setDurationMillis(timeoutMs)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach(offer)
            }
        }
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        return { client.removeLocationUpdates(callback) }
    }

    @SuppressLint("MissingPermission")
    private fun startPlatform(intervalMs: Long, offer: (Location) -> Unit): () -> Unit {
        val listener = LocationListenerCompat { offer(it) }
        val request = LocationRequestCompat.Builder(intervalMs)
            .setQuality(LocationRequestCompat.QUALITY_HIGH_ACCURACY)
            .build()
        val executor = ContextCompat.getMainExecutor(context)
        listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { locationManager.isProviderEnabled(it) }
            .forEach { LocationManagerCompat.requestLocationUpdates(locationManager, it, request, executor, listener) }
        return { LocationManagerCompat.removeUpdates(locationManager, listener) }
    }

    private fun hasPlayServices(): Boolean =
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

    companion object {
        private const val TAG = "VeLocator"

        @Suppress("DEPRECATION")
        fun isMock(location: Location): Boolean =
            if (Build.VERSION.SDK_INT >= 31) location.isMock else location.isFromMockProvider
    }
}
