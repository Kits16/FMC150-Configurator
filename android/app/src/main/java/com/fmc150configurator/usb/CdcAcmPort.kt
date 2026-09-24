package com.fmc150configurator.usb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import java.io.IOException

/**
 * Minimal USB CDC-ACM (virtual COM port) driver built on the Android USB host API.
 *
 * Teltonika FMx devices enumerate as CDC-ACM, so no vendor specific driver is required.
 * A device can expose several data interfaces (ports); [portIndex] selects one of them.
 */
class CdcAcmPort(private val device: UsbDevice, private val portIndex: Int) {

  private var connection: UsbDeviceConnection? = null
  private var controlInterface: UsbInterface? = null
  private var dataInterface: UsbInterface? = null
  private var readEndpoint: UsbEndpoint? = null
  private var writeEndpoint: UsbEndpoint? = null

  @Volatile private var reading = false
  private var readThread: Thread? = null

  val isOpen: Boolean
    get() = connection != null

  fun open(manager: UsbManager, baudRate: Int) {
    val ports = findPorts(device)
    if (portIndex !in ports.indices) {
      throw IOException("Port $portIndex not found (device has ${ports.size} port(s))")
    }
    val port = ports[portIndex]
    val conn = manager.openDevice(device) ?: throw IOException("Could not open USB device")

    port.control?.let {
      if (!conn.claimInterface(it, true)) {
        conn.close()
        throw IOException("Could not claim control interface ${it.id}")
      }
    }
    if (!conn.claimInterface(port.data, true)) {
      conn.close()
      throw IOException("Could not claim data interface ${port.data.id}")
    }

    connection = conn
    controlInterface = port.control
    dataInterface = port.data
    readEndpoint = port.inEndpoint
    writeEndpoint = port.outEndpoint

    setLineCoding(baudRate)
    setControlLines(dtr = true, rts = true)
  }

  fun startReading(onData: (ByteArray) -> Unit, onError: (Exception) -> Unit) {
    val conn = connection ?: return
    val ep = readEndpoint ?: return
    reading = true
    readThread =
        Thread({
              val buffer = ByteArray(maxOf(ep.maxPacketSize, 64) * 4)
              while (reading) {
                val len = conn.bulkTransfer(ep, buffer, buffer.size, 200)
                // -1 means timeout (or a detached device, handled by the detach receiver)
                if (len > 0) onData(buffer.copyOf(len))
              }
            }, "CdcAcmReader")
            .apply {
              isDaemon = true
              setUncaughtExceptionHandler { _, e -> onError(Exception(e)) }
              start()
            }
  }

  @Synchronized
  fun write(data: ByteArray): Int {
    val conn = connection ?: throw IOException("Port not open")
    val ep = writeEndpoint ?: throw IOException("Port not open")
    var offset = 0
    val chunkSize = maxOf(ep.maxPacketSize, 64)
    while (offset < data.size) {
      val len = minOf(chunkSize, data.size - offset)
      val written = conn.bulkTransfer(ep, data, offset, len, 2000)
      if (written <= 0) throw IOException("USB write failed at offset $offset")
      offset += written
    }
    return offset
  }

  fun close() {
    reading = false
    readThread?.join(500)
    readThread = null
    connection?.let { conn ->
      try {
        setControlLines(dtr = false, rts = false)
      } catch (_: Exception) {}
      dataInterface?.let { conn.releaseInterface(it) }
      controlInterface?.let { conn.releaseInterface(it) }
      conn.close()
    }
    connection = null
  }

  private fun setLineCoding(baudRate: Int) {
    // 8 data bits, 1 stop bit, no parity
    val msg =
        byteArrayOf(
            (baudRate and 0xff).toByte(),
            (baudRate shr 8 and 0xff).toByte(),
            (baudRate shr 16 and 0xff).toByte(),
            (baudRate shr 24 and 0xff).toByte(),
            0,
            0,
            8,
        )
    controlTransfer(SET_LINE_CODING, 0, msg)
  }

  private fun setControlLines(dtr: Boolean, rts: Boolean) {
    val value = (if (dtr) 0x01 else 0) or (if (rts) 0x02 else 0)
    controlTransfer(SET_CONTROL_LINE_STATE, value, null)
  }

  private fun controlTransfer(request: Int, value: Int, buf: ByteArray?) {
    val conn = connection ?: return
    val iface = controlInterface?.id ?: dataInterface?.id ?: 0
    // Some devices reject class requests; that is not fatal for a virtual COM port.
    conn.controlTransfer(USB_RT_ACM, request, value, iface, buf, buf?.size ?: 0, 1000)
  }

  data class Port(
      val control: UsbInterface?,
      val data: UsbInterface,
      val inEndpoint: UsbEndpoint,
      val outEndpoint: UsbEndpoint,
  )

  companion object {
    private const val USB_RT_ACM = UsbConstants.USB_TYPE_CLASS or 0x01
    private const val SET_LINE_CODING = 0x20
    private const val SET_CONTROL_LINE_STATE = 0x22

    /** Returns every CDC data interface (with bulk IN + OUT endpoints) and its control interface. */
    fun findPorts(device: UsbDevice): List<Port> {
      val ports = mutableListOf<Port>()
      var lastControl: UsbInterface? = null
      for (i in 0 until device.interfaceCount) {
        val iface = device.getInterface(i)
        if (iface.interfaceClass == UsbConstants.USB_CLASS_COMM) {
          lastControl = iface
          continue
        }
        var inEp: UsbEndpoint? = null
        var outEp: UsbEndpoint? = null
        for (e in 0 until iface.endpointCount) {
          val ep = iface.getEndpoint(e)
          if (ep.type != UsbConstants.USB_ENDPOINT_XFER_BULK) continue
          if (ep.direction == UsbConstants.USB_DIR_IN) inEp = ep else outEp = ep
        }
        if (inEp != null && outEp != null &&
            (iface.interfaceClass == UsbConstants.USB_CLASS_CDC_DATA ||
                iface.interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC)) {
          ports.add(Port(lastControl, iface, inEp, outEp))
          lastControl = null
        }
      }
      return ports
    }
  }
}
