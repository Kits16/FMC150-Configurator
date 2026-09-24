/**
 * FMC150 parameter definitions (practical subset).
 *
 * IDs come from the Teltonika FMB/FMC parameter list. Entries marked
 * `unverified` have not yet been checked against an FMC150 .cfg export and are
 * flagged in the UI. Verify them before relying on them in the field.
 */

export type ParamType = 'text' | 'password' | 'number' | 'enum';

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamDef {
  id: number;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  maxLength?: number;
  unit?: string;
  options?: ParamOption[];
  help?: string;
  unverified?: boolean;
}

export interface SectionDef {
  key: string;
  title: string;
  params: ParamDef[];
}

const seconds = (id: number, label: string, max = 2592000): ParamDef => ({
  id,
  label,
  type: 'number',
  min: 0,
  max,
  unit: 's',
});

export const SECTIONS: SectionDef[] = [
  {
    key: 'gprs',
    title: 'GPRS & Server',
    params: [
      { id: 2001, label: 'APN', type: 'text', maxLength: 32 },
      { id: 2002, label: 'APN username', type: 'text', maxLength: 30 },
      { id: 2003, label: 'APN password', type: 'password', maxLength: 30 },
      {
        id: 2004,
        label: 'Server domain',
        type: 'text',
        maxLength: 55,
        help: 'IP address or domain name of your server',
      },
      { id: 2005, label: 'Server port', type: 'number', min: 0, max: 65535 },
      {
        id: 2006,
        label: 'Server protocol',
        type: 'enum',
        options: [
          { value: '0', label: 'TCP' },
          { value: '1', label: 'UDP' },
        ],
      },
    ],
  },
  {
    key: 'system',
    title: 'System',
    params: [
      {
        id: 102,
        label: 'Sleep mode',
        type: 'enum',
        options: [
          { value: '0', label: 'Disabled' },
          { value: '1', label: 'GPS sleep' },
          { value: '2', label: 'Deep sleep' },
          { value: '3', label: 'Online deep sleep' },
          { value: '4', label: 'Ultra deep sleep' },
        ],
      },
      {
        id: 101,
        label: 'Ignition source (bitmask)',
        type: 'number',
        min: 0,
        max: 255,
        help: '1 = DIN1, 2 = Accelerometer, 4 = Power voltage, 8 = Engine RPM, add values to combine',
        unverified: true,
      },
      {
        id: 104,
        label: 'Ignition high voltage level',
        type: 'number',
        min: 0,
        max: 30000,
        unit: 'mV',
        unverified: true,
      },
      {
        id: 105,
        label: 'Ignition low voltage level',
        type: 'number',
        min: 0,
        max: 29999,
        unit: 'mV',
        unverified: true,
      },
    ],
  },
  {
    key: 'da-stop',
    title: 'Data Acquisition · Home · On Stop',
    params: [
      seconds(10000, 'Min period'),
      { ...seconds(10005, 'Send period'), unverified: true },
      {
        id: 10004,
        label: 'Min saved records',
        type: 'number',
        min: 1,
        max: 255,
        unverified: true,
      },
    ],
  },
  {
    key: 'da-moving',
    title: 'Data Acquisition · Home · Moving',
    params: [
      seconds(10050, 'Min period'),
      {
        id: 10051,
        label: 'Min distance',
        type: 'number',
        min: 0,
        max: 65535,
        unit: 'm',
      },
      {
        id: 10052,
        label: 'Min angle',
        type: 'number',
        min: 0,
        max: 180,
        unit: '°',
      },
      {
        id: 10056,
        label: 'Min speed delta',
        type: 'number',
        min: 0,
        max: 255,
        unit: 'km/h',
        unverified: true,
      },
      {
        id: 10054,
        label: 'Min saved records',
        type: 'number',
        min: 1,
        max: 255,
        unverified: true,
      },
      { ...seconds(10055, 'Send period'), unverified: true },
    ],
  },
  {
    key: 'sms',
    title: 'SMS / Call',
    params: [
      {
        id: 3003,
        label: 'SMS login',
        type: 'text',
        maxLength: 5,
        unverified: true,
      },
      {
        id: 3004,
        label: 'SMS password',
        type: 'password',
        maxLength: 5,
        unverified: true,
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: 4000 + i,
        label: `Authorized number ${i + 1}`,
        type: 'text' as const,
        maxLength: 16,
        unverified: true,
      })),
    ],
  },
  {
    key: 'bluetooth',
    title: 'Bluetooth',
    params: [
      {
        id: 800,
        label: 'Bluetooth',
        type: 'enum',
        options: [
          { value: '0', label: 'Disabled' },
          { value: '1', label: 'Enabled (hidden)' },
          { value: '2', label: 'Enabled (visible)' },
        ],
        unverified: true,
      },
      {
        id: 801,
        label: 'Local name',
        type: 'text',
        maxLength: 30,
        unverified: true,
      },
      {
        id: 802,
        label: 'Local PIN',
        type: 'password',
        maxLength: 4,
        unverified: true,
      },
      {
        id: 803,
        label: 'Security mode',
        type: 'enum',
        options: [
          { value: '0', label: 'PIN only' },
          { value: '1', label: 'PIN and MAC' },
          { value: '2', label: 'MAC only' },
          { value: '3', label: 'None' },
        ],
        unverified: true,
      },
    ],
  },
];

export const ALL_PARAMS: ParamDef[] = SECTIONS.flatMap(s => s.params);

export function findParam(id: number): ParamDef | undefined {
  return ALL_PARAMS.find(p => p.id === id);
}

/** Returns an error message, or null when the value is acceptable for the parameter. */
export function validateValue(def: ParamDef, value: string): string | null {
  if (/[;\r\n]/.test(value)) {
    return 'Must not contain ";" or line breaks';
  }
  if (def.type === 'number') {
    if (!/^-?\d+$/.test(value)) {
      return 'Must be a whole number';
    }
    const n = Number(value);
    if (def.min !== undefined && n < def.min) {
      return `Minimum is ${def.min}`;
    }
    if (def.max !== undefined && n > def.max) {
      return `Maximum is ${def.max}`;
    }
  }
  if (def.type === 'enum' && !def.options?.some(o => o.value === value)) {
    return 'Choose one of the options';
  }
  if (def.maxLength !== undefined && value.length > def.maxLength) {
    return `At most ${def.maxLength} characters`;
  }
  return null;
}
