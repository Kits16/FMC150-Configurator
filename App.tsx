import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors } from './src/components/ui';
import { ConfigScreen } from './src/screens/ConfigScreen';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StatusScreen } from './src/screens/StatusScreen';
import { TerminalScreen } from './src/screens/TerminalScreen';
import { AppProvider, useApp } from './src/state/AppContext';

const TABS = [
  { key: 'connect', title: 'Connect', Screen: ConnectScreen },
  { key: 'status', title: 'Status', Screen: StatusScreen },
  { key: 'config', title: 'Config', Screen: ConfigScreen },
  { key: 'terminal', title: 'Terminal', Screen: TerminalScreen },
  { key: 'settings', title: 'Settings', Screen: SettingsScreen },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function Shell() {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const [tab, setTab] = useState<TabKey>('connect');
  const Screen = TABS.find(t => t.key === tab)!.Screen;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FMC150 Configurator</Text>
        <Text style={styles.headerStatus} numberOfLines={1}>
          {session ? `● ${session.transport.label}` : '○ Not connected'}
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.body} behavior="height">
        <Screen />
      </KeyboardAvoidingView>
      <View style={[styles.tabs, { paddingBottom: insets.bottom }]}>
        {TABS.map(t => {
          const selected = t.key === tab;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(t.key)}
              style={styles.tab}
            >
              <Text
                style={[styles.tabText, selected && styles.tabTextSelected]}
              >
                {t.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  header: { paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerStatus: { color: '#d6e6f7', fontSize: 12, marginTop: 2 },
  body: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  tabTextSelected: { color: colors.primary, fontWeight: '700' },
});
