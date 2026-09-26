package com.vehr.app.device

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.AlarmManagerCompat
import androidx.core.app.NotificationManagerCompat
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

object Reminder {
    const val CHANNEL_ID = "checkout_reminder"
    const val NOTIFICATION_ID = 7001
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    private const val REQUEST_CODE = 7001

    fun schedule(context: Context, workDate: String, reminderTime: String, timezone: String, title: String, body: String): Boolean {
        val triggerAt = ZonedDateTime
            .of(LocalDate.parse(workDate), LocalTime.parse(reminderTime), ZoneId.of(timezone))
            .toInstant()
            .toEpochMilli()
        if (triggerAt <= System.currentTimeMillis()) return false
        val alarms = context.getSystemService(AlarmManager::class.java)
        AlarmManagerCompat.setAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent(context, title, body))
        return true
    }

    fun cancel(context: Context) {
        context.getSystemService(AlarmManager::class.java).cancel(pendingIntent(context, "", ""))
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    fun ensureChannel(context: Context, name: String) {
        val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    // Alarm identity ignores extras, so cancel() matches the scheduled intent.
    private fun pendingIntent(context: Context, title: String, body: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
