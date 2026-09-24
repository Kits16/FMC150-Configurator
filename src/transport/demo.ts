import { ALL_PARAMS } from '../params/schema';
import { Emitter, Transport } from './types';

/**
 * Simulated tracker for trying the app without hardware. Responses mimic the
 * FMx text command replies; the values are sample data, not a real device.
 */
export function createDemoTransport(delayMs = 60): Transport {
  const data = new Emitter<string>();
  const closed = new Emitter<string | undefined>();
  const params = new Map<number, string>(
    ALL_PARAMS.map(p => [
      p.id,
      p.options?.[0]?.value ?? (p.type === 'number' ? String(p.min ?? 0) : ''),
    ]),
  );
  params.set(2001, 'internet');
  params.set(2004, 'demo.example.com');
  params.set(2005, '5027');
  params.set(10000, '3600');
  params.set(10050, '60');
  const started = Date.now();

  const reply = (line: string): string => {
    const m =
      /(getparam|setparam|getinfo|getver|getstatus|getgps|cpureset)\b\s*(.*)$/.exec(
        line.trim(),
      );
    if (!m) {
      return 'Unknown command';
    }
    const [, cmd, arg] = m;
    switch (cmd) {
      case 'getparam':
        return arg
          .split(';')
          .map(id => `Param ID:${id} Value:${params.get(Number(id)) ?? ''}`)
          .join(';');
      case 'setparam': {
        const parts = arg.split(';').map(pair => {
          const i = pair.indexOf(':');
          const id = Number(pair.slice(0, i));
          params.set(id, pair.slice(i + 1));
          return `${id}:${pair.slice(i + 1)}`;
        });
        return `New value ${parts.join(';')}`;
      }
      case 'getver':
        return `Code Ver:03.28.07 Rev:4 Device IMEI:000000000000000 Device ID:000000 Modem APP Ver:DEMO Init: 2026-1-1 0:0 Uptime: ${Math.round(
          (Date.now() - started) / 1000,
        )} MAC:000000000000 SPEC:DEMO`;
      case 'getinfo':
        return 'RTC:2026/1/1 0:0 Init:2026/1/1 0:0 UpTime:12s PWR:PwrVoltage RST:0 GPS:1 SAT:0 TTFF:0 TTLF:0 NOGPS:0:0 SR:0 FG:0 FL:0 SMS:0 REC:0 MD:0 DB:0';
      case 'getstatus':
        return 'Data Link: 0 GPRS: 1 Phone: 0 SIM: 0 OP: 00000 Signal: 4 NewSMS: 0 Roaming: 0 SMSFull: 0 LAC: 0 Cell ID: 0 NetType: 1 FwUpd: -';
      case 'getgps':
        return 'GPS:1 Sat:7 Lat:54.6872 Long:25.2797 Alt:112 Speed:0 Dir:0 Date: 2026/1/1 Time: 0:0:0';
      case 'cpureset':
        return 'Reset in progress';
    }
    return '';
  };

  return {
    kind: 'demo',
    label: 'Demo device (simulated)',
    write: async text => {
      text
        .split(/\r\n|\r|\n/)
        .filter(l => l.trim())
        .forEach(line =>
          setTimeout(() => data.emit(reply(line) + '\r\n'), delayMs),
        );
    },
    onData: l => data.add(l),
    onClose: l => closed.add(l),
    close: async () => closed.emit('Closed by user'),
  };
}
