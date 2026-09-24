/**
 * Teltonika FMx text command helpers (the same commands used over SMS / GPRS:
 * getparam, setparam, getinfo, getver, getstatus, getgps, ...).
 */

export type LineEnding = '\r\n' | '\r' | '\n' | '';

export interface ProtocolSettings {
  /** Command template. {cmd}, {login} and {password} are substituted. */
  template: string;
  lineEnding: LineEnding;
  login: string;
  password: string;
  /** Wait this long without new data before a response is considered complete. */
  idleMs: number;
  /** Give up waiting for a response after this long. */
  timeoutMs: number;
  /** Max length of one setparam command (SMS commands are limited to ~160 chars). */
  maxCommandLength: number;
  /** How many IDs to request per getparam (1 is the most compatible). */
  readBatchSize: number;
}

export const TEMPLATE_PRESETS: { label: string; template: string }[] = [
  { label: 'Plain', template: '{cmd}' },
  {
    label: 'SMS style (login password cmd)',
    template: '{login} {password} {cmd}',
  },
  { label: 'Dot prefix', template: '.{cmd}' },
];

export const DEFAULT_PROTOCOL_SETTINGS: ProtocolSettings = {
  template: '{cmd}',
  lineEnding: '\r\n',
  login: '',
  password: '',
  idleMs: 400,
  timeoutMs: 5000,
  maxCommandLength: 150,
  readBatchSize: 1,
};

export function formatCommand(cmd: string, s: ProtocolSettings): string {
  const body = s.template
    .replace('{login}', s.login)
    .replace('{password}', s.password)
    .replace('{cmd}', cmd);
  return body + s.lineEnding;
}

export function buildGetParam(ids: number[]): string {
  return `getparam ${ids.join(';')}`;
}

/**
 * Splits values into as few `setparam id:value;id:value` commands as possible,
 * each no longer than maxLength.
 */
export function buildSetParamCommands(
  values: Record<number, string>,
  maxLength: number,
): string[] {
  const commands: string[] = [];
  let current: string[] = [];
  const render = (parts: string[]) => `setparam ${parts.join(';')}`;
  for (const [id, value] of Object.entries(values)) {
    const part = `${id}:${value}`;
    if (current.length && render([...current, part]).length > maxLength) {
      commands.push(render(current));
      current = [];
    }
    current.push(part);
  }
  if (current.length) {
    commands.push(render(current));
  }
  return commands;
}

/**
 * Extracts parameter values from a device response. Understands:
 *   "Param ID:2001 Value:internet"            (getparam)
 *   "New value 2001:internet;2002:;2004:x.lt" (setparam)
 *   "2001:internet;2002:user"                 (compact form)
 */
export function parseParamResponse(text: string): Record<number, string> {
  const result: Record<number, string> = {};

  const verbose =
    /Param ID:\s*(\d+)\s*Value:(.*?)(?=\s*;?\s*Param ID:|[\r\n]|$)/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = verbose.exec(text))) {
    result[Number(m[1])] = m[2].trim();
    found = true;
  }
  if (found) {
    return result;
  }

  const compactSource = text.includes('New value')
    ? text.slice(text.indexOf('New value') + 'New value'.length)
    : text;
  const compact = /(?:^|[\s;])(\d{2,6}):([^;\r\n]*)/g;
  while ((m = compact.exec(compactSource))) {
    result[Number(m[1])] = m[2].trim();
  }
  return result;
}

export function looksLikeError(text: string): boolean {
  return /(error|invalid|wrong|not found|unknown)/i.test(text);
}
