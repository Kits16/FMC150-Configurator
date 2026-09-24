# FMC150 Configurator (Android)

A React Native Android app for configuring the Teltonika **FMC150** from a phone,
modelled on the Windows Teltonika Configurator. Minimum Android version: 12 (API 31).

> Status: proof of concept. USB OTG works through the device's text command
> interface. Bluetooth is next.

## How it talks to the tracker

The Windows Configurator uses a closed binary protocol, so this app uses the
documented FMx **text commands** instead (the same ones that work over SMS/GPRS):

| Purpose | Command |
| --- | --- |
| Read parameters | `getparam 2001` |
| Write parameters | `setparam 2001:internet;2004:my.server.com;2005:5027` |
| Status | `getver`, `getinfo`, `getstatus`, `getgps` |
| Restart | `cpureset` |

The FMC150 connects over USB OTG. It shows up as a standard CDC-ACM virtual COM
port, which a small native Kotlin driver handles
(`android/app/src/main/java/com/fmc150configurator/usb`).

If the device doesn't answer, open **Settings → Command format** and try another
preset (plain, `login password cmd`, or a `.` prefix). You can also experiment in
the **Terminal** tab.

## Features

- **Connect:** lists USB devices, asks for USB permission and opens the serial
  port. There's also a **demo device** for trying the app without hardware.
- **Status:** `getver` / `getinfo` / `getstatus` / `getgps`, and a restart button.
- **Config:** these sections:
  - GPRS & server
  - System (sleep mode, ignition)
  - Data acquisition (on stop / moving)
  - SMS & authorized numbers
  - Bluetooth

  It reads everything, highlights edited values, validates them, writes only the
  changes and reads them back to verify. **Any parameter by ID** reads or writes
  settings that aren't in the list.
- **Terminal:** a raw command console with the live device output.
- **Settings:** command template, line ending, SMS login and password, baud rate
  and timeouts.

Parameters marked **unverified** in the UI haven't yet been checked against an
FMC150 configuration export. Their IDs are defined in `src/params/schema.ts`.

## Project layout

```
App.tsx                      tab shell
src/transport/               Transport interface, USB (native bridge), demo device
src/protocol/commands.ts     command formatting and response parsing
src/protocol/session.ts      serialised command/response handling
src/params/schema.ts         parameter definitions and validation
src/screens/                 Connect, Status, Config, Terminal, Settings
android/.../usb/             CDC-ACM USB host driver and React Native module
```

## Build

Each push runs GitHub Actions (`.github/workflows/android.yml`). It lints,
typechecks and tests, then builds a release APK with the JavaScript bundled in.
Download it from the run's **Artifacts** section (`fmc150-configurator-apk`).
The APK is signed with the debug key, so it can be sideloaded for testing but
not published.

To build locally you need Node 22, JDK 17 and the Android SDK:

```sh
npm ci
npm test
cd android && ./gradlew assembleRelease
```

## Using it

1. Install the APK and connect the FMC150 to the phone with a USB OTG adapter
   and a data cable. The tracker needs power.
2. **Connect** tab → Refresh → Connect → allow USB access.
3. **Status** → Refresh all, to confirm the device answers.
4. **Config** → Read all, edit values, then Write.
