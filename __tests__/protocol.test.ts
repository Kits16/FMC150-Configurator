import {
  buildSetParamCommands,
  DEFAULT_PROTOCOL_SETTINGS,
  formatCommand,
  parseParamResponse,
} from '../src/protocol/commands';
import { CommandSession, TimeoutError } from '../src/protocol/session';
import { createDemoTransport } from '../src/transport/demo';
import { Emitter, Transport } from '../src/transport/types';
import { findParam, validateValue } from '../src/params/schema';

describe('formatCommand', () => {
  it('applies template and line ending', () => {
    expect(formatCommand('getver', DEFAULT_PROTOCOL_SETTINGS)).toBe(
      'getver\r\n',
    );
    expect(
      formatCommand('getver', {
        ...DEFAULT_PROTOCOL_SETTINGS,
        template: '{login} {password} {cmd}',
        lineEnding: '',
      }),
    ).toBe('  getver');
  });
});

describe('parseParamResponse', () => {
  it('parses getparam replies', () => {
    expect(parseParamResponse('Param ID:2001 Value:internet\r\n')).toEqual({
      2001: 'internet',
    });
    expect(
      parseParamResponse('Param ID:2001 Value:my apn;Param ID:2002 Value:'),
    ).toEqual({ 2001: 'my apn', 2002: '' });
  });

  it('parses setparam replies', () => {
    expect(
      parseParamResponse('New value 2001:internet;2002:;2004:gps.example.com'),
    ).toEqual({ 2001: 'internet', 2002: '', 2004: 'gps.example.com' });
  });
});

describe('buildSetParamCommands', () => {
  it('splits long writes', () => {
    const cmds = buildSetParamCommands(
      { 2001: 'a'.repeat(30), 2002: 'b'.repeat(30), 2003: 'c'.repeat(30) },
      80,
    );
    expect(cmds).toEqual([
      `setparam 2001:${'a'.repeat(30)};2002:${'b'.repeat(30)}`,
      `setparam 2003:${'c'.repeat(30)}`,
    ]);
  });
});

describe('validateValue', () => {
  it('checks numeric ranges and separators', () => {
    const port = findParam(2005)!;
    expect(validateValue(port, '5027')).toBeNull();
    expect(validateValue(port, '70000')).toMatch(/Maximum/);
    expect(validateValue(findParam(2001)!, 'a;b')).toMatch(/;/);
  });
});

describe('CommandSession', () => {
  const settings = { ...DEFAULT_PROTOCOL_SETTINGS, idleMs: 20, timeoutMs: 500 };

  it('reads and writes parameters against the demo device', async () => {
    const session = new CommandSession(createDemoTransport(5), () => settings);
    expect(await session.readParams([2001, 2005])).toEqual({
      2001: 'internet',
      2005: '5027',
    });
    const confirmed = await session.writeParams({ 2001: 'm2m', 2004: 'x.io' });
    expect(confirmed).toEqual({ 2001: 'm2m', 2004: 'x.io' });
    expect(await session.readParams([2001])).toEqual({ 2001: 'm2m' });
    await session.dispose();
  });

  it('times out when the device is silent', async () => {
    const silent: Transport = {
      kind: 'demo',
      label: 'silent',
      write: async () => {},
      onData: l => new Emitter<string>().add(l),
      onClose: () => () => {},
      close: async () => {},
    };
    const session = new CommandSession(silent, () => ({
      ...settings,
      timeoutMs: 50,
    }));
    await expect(session.command('getver')).rejects.toBeInstanceOf(
      TimeoutError,
    );
    // Queue keeps working after a failure
    await expect(session.command('getver')).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});
