import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Button, Card, colors, Muted, Row } from '../components/ui';
import { useApp } from '../state/AppContext';

const STATUS_COMMANDS = [
  { cmd: 'getver', title: 'Version (getver)' },
  { cmd: 'getinfo', title: 'Runtime info (getinfo)' },
  { cmd: 'getstatus', title: 'Modem status (getstatus)' },
  { cmd: 'getgps', title: 'GNSS (getgps)' },
];

export function StatusScreen() {
  const { session } = useApp();
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (!session) {
    return <NotConnected />;
  }

  const run = async (cmd: string) => {
    setBusy(cmd);
    try {
      const text = await session.command(cmd);
      setResults(r => ({ ...r, [cmd]: text.trim() }));
    } catch (e) {
      setResults(r => ({ ...r, [cmd]: `⚠ ${(e as Error).message}` }));
    } finally {
      setBusy(null);
    }
  };

  const refreshAll = async () => {
    for (const c of STATUS_COMMANDS) {
      await run(c.cmd);
    }
  };

  const confirmReset = () =>
    Alert.alert(
      'Restart device?',
      'Sends "cpureset". The connection will drop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: () => run('cpureset'),
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row>
          <Button
            title="Refresh all"
            busy={busy !== null}
            onPress={refreshAll}
          />
          <Button
            title="Restart device"
            variant="danger"
            onPress={confirmReset}
          />
        </Row>
      </Card>
      {STATUS_COMMANDS.map(c => (
        <Card
          key={c.cmd}
          title={c.title}
          right={
            <Button
              title="Read"
              small
              variant="secondary"
              busy={busy === c.cmd}
              disabled={busy !== null}
              onPress={() => run(c.cmd)}
            />
          }
        >
          {results[c.cmd] ? (
            <Text
              selectable
              style={{ fontFamily: 'monospace', color: colors.mono }}
            >
              {results[c.cmd]}
            </Text>
          ) : (
            <Muted>Not read yet</Muted>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

export function NotConnected() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card title="Not connected">
        <Muted>Connect to a device on the Connect tab first.</Muted>
      </Card>
    </ScrollView>
  );
}
