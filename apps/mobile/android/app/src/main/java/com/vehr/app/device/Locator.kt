package com.vehr.app.device

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
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
                stop = if (hasPlayServices()) startFused(timeoutMs, ::offer) else startPlatform(::offer)
            } catch (e: SecurityException) {
                finished = true
                done(null)
                return@post
            }
            main.postDelayed(timeout, timeoutMs)
        }
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
    private fun startPlatform(offer: (Location) -> Unit): () -> Unit {
        val listener = LocationListenerCompat { offer(it) }
        val request = LocationRequestCompat.Builder(1000L)
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
        @Suppress("DEPRECATION")
        fun isMock(location: Location): Boolean =
            if (Build.VERSION.SDK_INT >= 31) location.isMock else location.isFromMockProvider
    }
}
