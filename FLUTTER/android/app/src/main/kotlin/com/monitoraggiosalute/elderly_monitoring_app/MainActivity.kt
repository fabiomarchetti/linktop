package com.monitoraggiosalute.elderly_monitoring_app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "app.channel.shared.data"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "makeCall" -> {
                    val number = call.argument<String>("number")
                    if (number != null) {
                        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number"))
                        startActivity(intent)
                        result.success(true)
                    } else {
                        result.error("INVALID_NUMBER", "Numero non fornito", null)
                    }
                }
                "openSettings" -> {
                    val intent = Intent(Settings.ACTION_SETTINGS)
                    startActivity(intent)
                    result.success(true)
                }
                "openBluetoothSettings" -> {
                    val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                    startActivity(intent)
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }
}
