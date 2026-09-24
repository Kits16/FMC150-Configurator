import React, { useRef, useState } from 'react';
import {
  ScrollView,
  ScrollViewInstance,
  Switch,
  Text,
  View,
} from 'react-native';
import { Button, colors, Input, Muted, Row } from '../components/ui';
import { formatCommand } from '../protocol/commands';
import { useApp } from '../state/AppContext';
import { NotConnected } from './StatusScreen';

const QUICK = [
  'getver',
  'getinfo',
  'getstatus',
  'getparam 2001',
  '.log:1',
  '.log:0',
];

export function TerminalScreen() {
  const { session, log, clearLog, settings } = useApp();
  const [text, setText] = useState('');
  const [raw, setRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  if (!session) {
    return <NotConnected />;
  }

  const send = async (cmd: string) => {
    if (!cmd) {
      return;
    }
    setError(null);
    try {
      // Raw mode sends exactly what was typed (plus line ending), bypassing the template.
      await session.sendRaw(
        raw ? cmd + settings.lineEnding : formatCommand(cmd, settings),
      );
      setText('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
        style={{ flex: 1, backgroundColor: colors.mono }}
        contentContainerStyle={{ padding: 10 }}
      >
        {log.length === 0 && (
          <Text style={{ color: '#8aa0b5' }}>Device output appears here.</Text>
        )}
        {log.map((entry, i) => (
          <Text
            key={i}
            selectable
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color:
                entry.dir === 'tx'
                  ? '#7cc4ff'
                  : entry.dir === 'info'
                  ? '#ffd27c'
                  : '#e6edf3',
            }}
          >
            {entry.dir === 'tx' ? '> ' : entry.dir === 'info' ? '# ' : ''}
            {entry.text.replace(/\r\n|\r/g, '\n').replace(/\n$/, '')}
          </Text>
        ))}
      </ScrollView>
      <View style={{ padding: 10, backgroundColor: colors.card, gap: 8 }}>
        <Row>
          {QUICK.map(q => (
            <Button
              key={q}
              title={q}
              small
              variant="secondary"
              onPress={() => send(q)}
            />
          ))}
        </Row>
        <Row>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Command, e.g. getparam 2004"
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            style={{ flex: 1 }}
          />
          <Button title="Send" onPress={() => send(text)} />
        </Row>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Switch
              value={raw}
              onValueChange={setRaw}
              accessibilityLabel="Raw mode"
            />
            <Muted>Raw (ignore command template)</Muted>
          </View>
          <Button title="Clear" small variant="secondary" onPress={clearLog} />
        </View>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </View>
    </View>
  );
}
