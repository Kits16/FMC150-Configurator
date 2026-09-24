package com.fmc150configurator.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.nio.charset.StandardCharsets

/**
 * React Native bridge exposing a CDC-ACM serial port to JavaScript.
 *
 * Events:
 * - `UsbSerialData`   { data: string }                 bytes received from the device
 * - `UsbSerialStatus` { connected: boolean, reason?: string }
 */
class UsbSerialModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

  private val usbManager = ctx.getSystemService(Context.USB_SERVICE) as UsbManager
  private var port: CdcAcmPort? = null
  private var openDeviceName: String? = null
  private val pendingPermissions = mutableMapOf<String, Promise>()

  private val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          val device = intent.usbDevice()
          when (intent.action) {
            ACTION_USB_PERMISSION -> {
              val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
              device?.let { pendingPermissions.remove(it.deviceName)?.resolve(granted) }
            }
            UsbManager.ACTION_USB_DEVICE_DETACHED -> {
              if (device != null && device.deviceName == openDeviceName) {
                closePort("Device detached")
              }
            }
          }
        }
      }

  init {
    val filter =
        IntentFilter().apply {
          addAction(ACTION_USB_PERMISSION)
          addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      ctx.registerReceiver(receiver, filter)
    }
  }

  override fun getName() = NAME

  override fun invalidate() {
    closePort(null)
    try {
      ctx.unregisterReceiver(receiver)
    } catch (_: Exception) {}
    super.invalidate()
  }

  @ReactMethod
  fun listDevices(promise: Promise) {
    val result = Arguments.createArray()
    for (device in usbManager.deviceList.values) {
      val ports = CdcAcmPort.findPorts(device)
      val map = Arguments.createMap()
      map.putString("deviceName", device.deviceName)
      map.putInt("vendorId", device.vendorId)
      map.putInt("productId", device.productId)
      map.putInt("portCount", ports.size)
      val hasPermission = usbManager.hasPermission(device)
      map.putBoolean("hasPermission", hasPermission)
      if (hasPermission) {
        map.putString("manufacturer", device.manufacturerName)
        map.putString("product", device.productName)
      }
      result.pushMap(map)
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun requestPermission(deviceName: String, promise: Promise) {
    val device = findDevice(deviceName) ?: return promise.reject("E_NO_DEVICE", "Device not found")
    if (usbManager.hasPermission(device)) return promise.resolve(true)
    pendingPermissions.remove(deviceName)?.resolve(false)
    pendingPermissions[deviceName] = promise
    val intent = Intent(ACTION_USB_PERMISSION).setPackage(ctx.packageName)
    val pending = PendingIntent.getBroadcast(ctx, 0, intent, PendingIntent.FLAG_MUTABLE)
    usbManager.requestPermission(device, pending)
  }

  @ReactMethod
  fun open(deviceName: String, portIndex: Int, baudRate: Int, promise: Promise) {
    val device = findDevice(deviceName) ?: return promise.reject("E_NO_DEVICE", "Device not found")
    if (!usbManager.hasPermission(device)) {
      return promise.reject("E_PERMISSION", "No permission for USB device")
    }
    closePort(null)
    try {
      val p = CdcAcmPort(device, portIndex)
      p.open(usbManager, baudRate)
      p.startReading(
          onData = { bytes ->
            val map = Arguments.createMap()
            map.putString("data", String(bytes, StandardCharsets.ISO_8859_1))
            ctx.emitDeviceEvent(EVENT_DATA, map)
          },
          onError = { e -> closePort(e.message ?: "Read error") },
      )
      port = p
      openDeviceName = deviceName
      emitStatus(true, null)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_OPEN", e.message, e)
    }
  }

  @ReactMethod
  fun write(text: String, promise: Promise) {
    val p = port ?: return promise.reject("E_NOT_OPEN", "Port not open")
    try {
      promise.resolve(p.write(text.toByteArray(StandardCharsets.ISO_8859_1)))
    } catch (e: Exception) {
      promise.reject("E_WRITE", e.message, e)
    }
  }

  @ReactMethod
  fun close(promise: Promise) {
    closePort("Closed by user")
    promise.resolve(null)
  }

  // Required by NativeEventEmitter
  @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

  @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {}

  @Synchronized
  private fun closePort(reason: String?) {
    val p = port ?: return
    port = null
    openDeviceName = null
    try {
      p.close()
    } catch (_: Exception) {}
    emitStatus(false, reason)
  }

  private fun emitStatus(connected: Boolean, reason: String?) {
    val map: WritableMap = Arguments.createMap()
    map.putBoolean("connected", connected)
    reason?.let { map.putString("reason", it) }
    ctx.emitDeviceEvent(EVENT_STATUS, map)
  }

  private fun findDevice(deviceName: String): UsbDevice? = usbManager.deviceList[deviceName]

  @Suppress("DEPRECATION")
  private fun Intent.usbDevice(): UsbDevice? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
      } else {
        getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }

  companion object {
    const val NAME = "UsbSerial"
    private const val ACTION_USB_PERMISSION = "com.fmc150configurator.USB_PERMISSION"
    private const val EVENT_DATA = "UsbSerialData"
    private const val EVENT_STATUS = "UsbSerialStatus"
  }
}
