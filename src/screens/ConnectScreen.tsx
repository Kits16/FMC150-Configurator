import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, Chips, colors, Muted, Row } from '../components/ui';
import { useApp } from '../state/AppContext';
import { createDemoTransport } from '../transport/demo';
import {
  describeUsbDevice,
  listUsbDevices,
  openUsbTransport,
  requestUsbPermission,
  UsbDeviceInfo,
  usbSupported,
} from '../transport/usb';

export function ConnectScreen() {
  const { session, connect, disconnect, lastDisconnectReason, settings } =
    useApp();
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([]);
  const [ports, setPorts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDevices(await listUsbDevices());
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connectUsb = async (device: UsbDeviceInfo) => {
    setBusy(device.deviceName);
    setError(null);
    try {
      const granted = await requestUsbPermission(device.deviceName);
      if (!granted) {
        throw new Error('USB permission was denied');
      }
      const transport = await openUsbTransport(
        device,
        ports[device.deviceName] ?? 0,
        settings.baudRate,
      );
      connect(transport);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {session ? (
        <Card title="Connected">
          <Text style={{ color: colors.success, marginBottom: 12 }}>
            {session.transport.label}
          </Text>
          <Button title="Disconnect" variant="danger" onPress={disconnect} />
        </Card>
      ) : (
        lastDisconnectReason && (
          <Card>
            <Text style={{ color: colors.warning }}>
              Disconnected: {lastDisconnectReason}
            </Text>
          </Card>
        )
      )}

      <Card
        title="USB OTG"
        right={
          <Button title="Refresh" small variant="secondary" onPress={refresh} />
        }
      >
        {!usbSupported && (
          <Muted>USB serial is only available on Android.</Muted>
        )}
        {usbSupported && devices.length === 0 && (
          <Muted>
            No USB devices found. Connect the FMC150 with a USB OTG adapter and
            a data cable, then tap Refresh.
          </Muted>
        )}
        {devices.map(d => (
          <View
            key={d.deviceName}
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {describeUsbDevice(d)}
            </Text>
            <Muted>
              {d.deviceName} · {d.portCount} serial port(s)
            </Muted>
            {d.portCount > 1 && (
              <View style={{ marginTop: 8 }}>
                <Chips
                  options={Array.from({ length: d.portCount }, (_, i) => ({
                    value: String(i),
                    label: `Port ${i + 1}`,
                  }))}
                  value={String(ports[d.deviceName] ?? 0)}
                  onChange={v =>
                    setPorts(p => ({ ...p, [d.deviceName]: Number(v) }))
                  }
                />
              </View>
            )}
            <View style={{ marginTop: 8 }}>
              <Button
                title={
                  d.portCount ? 'Connect' : 'No serial port on this device'
                }
                disabled={!!session || d.portCount === 0}
                busy={busy === d.deviceName}
                onPress={() => connectUsb(d)}
              />
            </View>
          </View>
        ))}
        {error && (
          <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>
        )}
      </Card>

      <Card title="Bluetooth">
        <Muted>Coming next: Bluetooth SPP connection.</Muted>
      </Card>

      <Card title="Demo">
        <Muted>
          Try the app without hardware. A simulated tracker answers commands
          with sample data.
        </Muted>
        <View style={{ marginTop: 10 }}>
          <Row>
            <Button
              title="Connect demo device"
              variant="secondary"
              disabled={!!session}
              onPress={() => connect(createDemoTransport())}
            />
          </Row>
        </View>
      </Card>
    </ScrollView>
  );
}
