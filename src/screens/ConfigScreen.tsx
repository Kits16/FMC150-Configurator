import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Button,
  Card,
  Chips,
  colors,
  Input,
  Muted,
  Row,
} from '../components/ui';
import { parseParamResponse } from '../protocol/commands';
import {
  ALL_PARAMS,
  findParam,
  ParamDef,
  SECTIONS,
  validateValue,
} from '../params/schema';
import { useApp } from '../state/AppContext';
import { NotConnected } from './StatusScreen';

export function ConfigScreen() {
  const { session, deviceValues, mergeDeviceValues } = useApp();
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({ gprs: true });
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  if (!session) {
    return <NotConnected />;
  }

  const busy = progress !== null;
  const dirtyIds = Object.keys(edits)
    .map(Number)
    .filter(id => edits[id] !== deviceValues[id]);
  const invalid = dirtyIds.filter(id => {
    const def = findParam(id);
    return def ? validateValue(def, edits[id]) !== null : false;
  });

  const read = async (params: ParamDef[]) => {
    setMessage(null);
    setProgress('Reading…');
    try {
      const ids = params.map(p => p.id);
      const values = await session.readParams(ids, (done, total) =>
        setProgress(`Reading ${done}/${total}…`),
      );
      mergeDeviceValues(values);
      const missing = ids.filter(id => !(id in values));
      setMessage(
        missing.length
          ? {
              ok: false,
              text: `No value returned for ${missing.join(
                ', ',
              )}. Check the command format in Settings.`,
            }
          : { ok: true, text: `Read ${ids.length} parameter(s).` },
      );
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setProgress(null);
    }
  };

  const write = async () => {
    setMessage(null);
    setProgress('Writing…');
    try {
      const values = Object.fromEntries(dirtyIds.map(id => [id, edits[id]]));
      const confirmed = await session.writeParams(values);
      // Read back to verify what the device actually stored.
      setProgress('Verifying…');
      const readBack = await session.readParams(dirtyIds);
      const stored = { ...confirmed, ...readBack };
      mergeDeviceValues(stored);
      const failed = dirtyIds.filter(id => stored[id] !== edits[id]);
      setEdits(prev => {
        const next = { ...prev };
        dirtyIds
          .filter(id => !failed.includes(id))
          .forEach(id => delete next[id]);
        return next;
      });
      setMessage(
        failed.length
          ? { ok: false, text: `Not confirmed by device: ${failed.join(', ')}` }
          : { ok: true, text: `Saved ${dirtyIds.length} parameter(s).` },
      );
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setProgress(null);
    }
  };

  const confirmWrite = () =>
    Alert.alert(
      'Write to device?',
      dirtyIds
        .map(id => `${findParam(id)?.label ?? id} (${id}) → ${edits[id]}`)
        .join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Write', onPress: write },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Row>
          <Button
            title="Read all"
            busy={busy}
            onPress={() => read(ALL_PARAMS)}
          />
          <Button
            title={`Write ${dirtyIds.length} change(s)`}
            disabled={busy || dirtyIds.length === 0 || invalid.length > 0}
            onPress={confirmWrite}
          />
          {dirtyIds.length > 0 && (
            <Button
              title="Discard"
              variant="secondary"
              disabled={busy}
              onPress={() => setEdits({})}
            />
          )}
        </Row>
        {progress && <Muted>{progress}</Muted>}
        {message && (
          <Text
            style={{
              marginTop: 8,
              color: message.ok ? colors.success : colors.danger,
            }}
          >
            {message.text}
          </Text>
        )}
      </Card>

      {SECTIONS.map(section => {
        const isOpen = !!open[section.key];
        return (
          <Card key={section.key}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              onPress={() => setOpen(o => ({ ...o, [section.key]: !isOpen }))}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: '600', color: colors.text }}
              >
                {isOpen ? '▾' : '▸'} {section.title}
              </Text>
              {isOpen && (
                <Button
                  title="Read"
                  small
                  variant="secondary"
                  disabled={busy}
                  onPress={() => read(section.params)}
                />
              )}
            </Pressable>
            {isOpen &&
              section.params.map(def => (
                <ParamRow
                  key={def.id}
                  def={def}
                  deviceValue={deviceValues[def.id]}
                  value={edits[def.id] ?? deviceValues[def.id] ?? ''}
                  onChange={v => setEdits(e => ({ ...e, [def.id]: v }))}
                />
              ))}
          </Card>
        );
      })}

      <CustomParam />
    </ScrollView>
  );
}

function ParamRow({
  def,
  deviceValue,
  value,
  onChange,
}: {
  def: ParamDef;
  deviceValue: string | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const modified =
    deviceValue !== undefined ? value !== deviceValue : value !== '';
  const error = modified ? validateValue(def, value) : null;
  return (
    <View
      style={{
        marginTop: 10,
        padding: 8,
        borderRadius: 8,
        backgroundColor: modified ? colors.modified : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: '500', flexShrink: 1 }}>
          {def.label}
          {def.unit ? ` (${def.unit})` : ''}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>#{def.id}</Text>
        {def.unverified && (
          <Text
            accessibilityLabel="Parameter ID not yet verified for FMC150"
            style={{ color: colors.warning, fontSize: 12 }}
          >
            unverified
          </Text>
        )}
      </View>
      {def.help && <Muted>{def.help}</Muted>}
      <View style={{ marginTop: 6 }}>
        {def.type === 'enum' && def.options ? (
          <Chips options={def.options} value={value} onChange={onChange} />
        ) : (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={deviceValue === undefined ? 'Not read' : '(empty)'}
            keyboardType={def.type === 'number' ? 'number-pad' : 'default'}
            maxLength={def.maxLength}
          />
        )}
      </View>
      {error && (
        <Text style={{ color: colors.danger, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}

/** Read or write any parameter ID, for settings not in the list above. */
function CustomParam() {
  const { session } = useApp();
  const [id, setId] = useState('');
  const [value, setValue] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  if (!session) {
    return null;
  }
  const valid = /^\d+$/.test(id);

  const run = async (cmd: string) => {
    setBusy(true);
    try {
      const response = await session.command(cmd);
      const parsed = parseParamResponse(response)[Number(id)];
      if (parsed !== undefined) {
        setValue(parsed);
      }
      setResult(response.trim());
    } catch (e) {
      setResult(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Any parameter by ID">
      <Row>
        <Input
          value={id}
          onChangeText={setId}
          placeholder="ID"
          keyboardType="number-pad"
          style={{ width: 90 }}
        />
        <Input
          value={value}
          onChangeText={setValue}
          placeholder="Value"
          style={{ flex: 1, minWidth: 120 }}
        />
      </Row>
      <View style={{ marginTop: 8 }}>
        <Row>
          <Button
            title="Read"
            small
            variant="secondary"
            disabled={!valid || busy}
            onPress={() => run(`getparam ${id}`)}
          />
          <Button
            title="Write"
            small
            disabled={!valid || busy || /[;\r\n]/.test(value)}
            onPress={() => run(`setparam ${id}:${value}`)}
          />
        </Row>
      </View>
      {!!result && (
        <Text
          selectable
          style={{ fontFamily: 'monospace', marginTop: 8, color: colors.mono }}
        >
          {result}
        </Text>
      )}
    </Card>
  );
}
