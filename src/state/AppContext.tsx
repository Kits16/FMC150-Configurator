import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_PROTOCOL_SETTINGS,
  ProtocolSettings,
} from '../protocol/commands';
import { CommandSession, LogEntry } from '../protocol/session';
import { Transport } from '../transport/types';

const MAX_LOG_ENTRIES = 400;

export interface AppSettings extends ProtocolSettings {
  baudRate: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_PROTOCOL_SETTINGS,
  baudRate: 115200,
};

interface AppState {
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): void;
  session: CommandSession | null;
  connect(transport: Transport): void;
  disconnect(): Promise<void>;
  lastDisconnectReason?: string;
  log: LogEntry[];
  clearLog(): void;
  /** Values last read from / confirmed by the device, by parameter ID. */
  deviceValues: Record<number, string>;
  mergeDeviceValues(values: Record<number, string>): void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [session, setSession] = useState<CommandSession | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [lastDisconnectReason, setReason] = useState<string>();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [deviceValues, setDeviceValues] = useState<Record<number, string>>({});

  const appendLog = useCallback((entry: LogEntry) => {
    setLog(prev => {
      const last = prev[prev.length - 1];
      // Merge consecutive received chunks so the terminal shows whole replies.
      if (
        last &&
        last.dir === 'rx' &&
        entry.dir === 'rx' &&
        last.text.length < 4000
      ) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + entry.text },
        ];
      }
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES
        ? next.slice(next.length - MAX_LOG_ENTRIES)
        : next;
    });
  }, []);

  const connect = useCallback(
    (transport: Transport) => {
      const s = new CommandSession(transport, () => settingsRef.current);
      s.log.add(appendLog);
      transport.onClose(reason => {
        setSession(current => (current === s ? null : current));
        setReason(reason);
        appendLog({
          dir: 'info',
          text: `Disconnected${reason ? `: ${reason}` : ''}`,
          time: Date.now(),
        });
      });
      setReason(undefined);
      setDeviceValues({});
      appendLog({
        dir: 'info',
        text: `Connected to ${transport.label}`,
        time: Date.now(),
      });
      setSession(s);
    },
    [appendLog],
  );

  const disconnect = useCallback(async () => {
    const s = session;
    setSession(null);
    await s?.dispose();
  }, [session]);

  useEffect(
    () => () => {
      sessionRef.current?.dispose();
    },
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      settings,
      updateSettings: patch => setSettings(prev => ({ ...prev, ...patch })),
      session,
      connect,
      disconnect,
      lastDisconnectReason,
      log,
      clearLog: () => setLog([]),
      deviceValues,
      mergeDeviceValues: values =>
        setDeviceValues(prev => ({ ...prev, ...values })),
    }),
    [
      settings,
      session,
      connect,
      disconnect,
      lastDisconnectReason,
      log,
      deviceValues,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
