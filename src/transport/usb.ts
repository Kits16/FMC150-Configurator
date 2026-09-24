import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { Emitter, Transport } from './types';

export interface UsbDeviceInfo {
  deviceName: string;
  vendorId: number;
  productId: number;
  portCount: number;
  hasPermission: boolean;
  manufacturer?: string | null;
  product?: string | null;
}

interface UsbSerialNative {
  listDevices(): Promise<UsbDeviceInfo[]>;
  requestPermission(deviceName: string): Promise<boolean>;
  open(deviceName: string, portIndex: number, baudRate: number): Promise<void>;
  write(text: string): Promise<number>;
  close(): Promise<void>;
}

const native: UsbSerialNative | undefined = NativeModules.UsbSerial;

export const usbSupported = Platform.OS === 'android' && native != null;

function requireNative(): UsbSerialNative {
  if (!native) {
    throw new Error('USB serial is only available on Android');
  }
  return native;
}

export function listUsbDevices(): Promise<UsbDeviceInfo[]> {
  return native ? native.listDevices() : Promise.resolve([]);
}

export function requestUsbPermission(deviceName: string): Promise<boolean> {
  return requireNative().requestPermission(deviceName);
}

export function describeUsbDevice(d: UsbDeviceInfo): string {
  const hex = (n: number) => n.toString(16).padStart(4, '0');
  const name = [d.manufacturer, d.product].filter(Boolean).join(' ');
  return `${name || 'USB device'} (${hex(d.vendorId)}:${hex(d.productId)})`;
}

export async function openUsbTransport(
  device: UsbDeviceInfo,
  portIndex: number,
  baudRate: number,
): Promise<Transport> {
  const usb = requireNative();
  const events = new NativeEventEmitter(NativeModules.UsbSerial);
  const data = new Emitter<string>();
  const closed = new Emitter<string | undefined>();
  let open = true;

  const subs = [
    events.addListener('UsbSerialData', e =>
      data.emit((e as unknown as { data: string }).data),
    ),
    events.addListener('UsbSerialStatus', e => {
      const status = e as unknown as { connected: boolean; reason?: string };
      if (!status.connected && open) {
        open = false;
        subs.forEach(s => s.remove());
        closed.emit(status.reason);
      }
    }),
  ];

  try {
    await usb.open(device.deviceName, portIndex, baudRate);
  } catch (e) {
    subs.forEach(s => s.remove());
    throw e;
  }

  return {
    kind: 'usb',
    label: `USB · ${describeUsbDevice(device)} · port ${portIndex + 1}`,
    write: async text => {
      await usb.write(text);
    },
    onData: l => data.add(l),
    onClose: l => closed.add(l),
    close: async () => {
      if (open) {
        await usb.close();
      }
    },
  };
}
