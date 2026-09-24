import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Card, Chips, colors, Input, Label, Muted } from '../components/ui';
import {
  formatCommand,
  LineEnding,
  TEMPLATE_PRESETS,
} from '../protocol/commands';
import { AppSettings, useApp } from '../state/AppContext';

const LINE_ENDINGS: { value: string; label: string }[] = [
  { value: '\r\n', label: 'CR+LF' },
  { value: '\r', label: 'CR' },
  { value: '\n', label: 'LF' },
  { value: '', label: 'None' },
];

const BAUD_RATES = ['9600', '19200', '38400', '57600', '115200'];

export function SettingsScreen() {
  const { settings, updateSettings } = useApp();

  const numberField = (key: keyof AppSettings, label: string) => (
    <>
      <Label>{label}</Label>
      <Input
        keyboardType="number-pad"
        defaultValue={String(settings[key])}
        onChangeText={t => {
          const n = Number(t);
          if (/^\d+$/.test(t) && n > 0) {
            updateSettings({ [key]: n } as Partial<AppSettings>);
          }
        }}
      />
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card title="Command format">
        <Muted>
          How commands are wrapped before sending. If the device does not
          answer, try another preset or experiment in the Terminal tab.
        </Muted>
        <Label>Preset</Label>
        <Chips
          options={TEMPLATE_PRESETS.map(p => ({
            value: p.template,
            label: p.label,
          }))}
          value={settings.template}
          onChange={template => updateSettings({ template })}
        />
        <Label>
          Template ({'{cmd}'}, {'{login}'}, {'{password}'})
        </Label>
        <Input
          value={settings.template}
          onChangeText={template => updateSettings({ template })}
        />
        <Label>Line ending</Label>
        <Chips
          options={LINE_ENDINGS}
          value={settings.lineEnding}
          onChange={v => updateSettings({ lineEnding: v as LineEnding })}
        />
        <Label>SMS login</Label>
        <Input
          value={settings.login}
          onChangeText={login => updateSettings({ login })}
        />
        <Label>SMS password</Label>
        <Input
          value={settings.password}
          onChangeText={password => updateSettings({ password })}
          secureTextEntry
        />
        <Label>Preview</Label>
        <Text style={{ fontFamily: 'monospace', color: colors.mono }}>
          {JSON.stringify(formatCommand('getver', settings))}
        </Text>
      </Card>

      <Card title="USB">
        <Label>Baud rate (applies on next connect)</Label>
        <Chips
          options={BAUD_RATES.map(b => ({ value: b, label: b }))}
          value={String(settings.baudRate)}
          onChange={b => updateSettings({ baudRate: Number(b) })}
        />
      </Card>

      <Card title="Timing">
        {numberField('idleMs', 'Response complete after silence (ms)')}
        {numberField('timeoutMs', 'Response timeout (ms)')}
        {numberField('readBatchSize', 'Parameters per getparam')}
        {numberField('maxCommandLength', 'Max setparam command length')}
      </Card>
    </ScrollView>
  );
}
