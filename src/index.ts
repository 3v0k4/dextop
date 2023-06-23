import {
  app,
  Tray,
  Menu,
  nativeImage,
  BrowserWindow,
  ipcMain,
  MenuItemConstructorOptions,
  dialog,
  shell,
} from "electron";
const Positioner = require("electron-positioner");
const AutoLaunch = require("auto-launch");

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

require("update-electron-app")();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

export type Credentials = { email: string; password: string };
export type Event =
  | { _kind: "ok" }
  | { _kind: "wrong-credentials" }
  | { _kind: "error" };

type Entry = {
  timestamp: string;
  value: number | null;
  trend: string;
};

type Response<T = unknown> =
  | { _kind: "ok"; data: T }
  | { _kind: "error"; data: unknown }
  | { _kind: "wrong-credentials" }
  | { _kind: "fail" };

let tray: Tray;
let preferences: BrowserWindow;
let state: Credentials = { email: "", password: "" };
let loopId: ReturnType<typeof setInterval>;

app.dock.hide();

const autoLaunch = new AutoLaunch({
  name: "DexTop",
});

app.whenReady().then(() => {
  ipcMain.handle("start", start);

  tray = new Tray(nativeImage.createEmpty());

  const contextMenu = Menu.buildFromTemplate(menuTemplate());
  tray.setContextMenu(contextMenu);

  tray.setTitle("...");
  tray.setToolTip("DexTop");

  // Needed to make sure the positioner places it correctly
  setTimeout(() => showPreferences(), 500);

  autoLaunch.isEnabled().then((isEnabled: boolean) => {
    if (isEnabled) return;

    dialog
      .showMessageBox({
        title: "DexTop",
        message:
          "DexTop will launch at startup. You may need to accept a permissions prompt.",
      })
      .then(() => {
        autoLaunch.enable();
      });
  });
});

const menuTemplate = (
  label?: string
): Parameters<typeof Menu.buildFromTemplate>[0] => {
  const DEFAULT: MenuItemConstructorOptions[] = [
    { label: "Preferences", click: showPreferences },
    {
      label: "Contact",
      click: () => shell.openExternal("http://contact.dextop.odone.io"),
    },
    { type: "separator" },
    { role: "quit" },
  ];
  const withTimestamp: MenuItemConstructorOptions[] = label
    ? [{ label, enabled: false }, { type: "separator" }]
    : [];
  return [...withTimestamp, ...DEFAULT];
};

const showPreferences = () => {
  preferences = new BrowserWindow({
    icon: "src/images/icon.png",
    width: 350,
    height: 260,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      additionalArguments: [JSON.stringify(state)],
    },
  });

  preferences.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  if (state.email === "") {
    preferences.webContents
      .executeJavaScript("localStorage.getItem('email')")
      .then((email) => {
        if (!email) {
          return;
        }
        state = { ...state, email };
        preferences.webContents.send("retrievedCredentials", { email });
      });
  }

  const positioner = new Positioner(preferences);
  const { x, y } = positioner.calculate("trayCenter", tray.getBounds());
  preferences.setPosition(x, y);

  preferences.once("ready-to-show", () => {
    preferences.show();
  });

  preferences.on("close", hide);
};

const hide = (event?: Electron.Event) => {
  if (event) {
    event.preventDefault();
  }
  if (!preferences) {
    return;
  }
  preferences.removeListener("close", hide);
  preferences.hide();
};

const start = async (_: unknown, credentials: Credentials) => {
  if (loopId) {
    clearInterval(loopId);
  }
  const response = await start_(credentials);
  switch (response._kind) {
    case "ok":
      loopId = setInterval(() => start_(credentials), 1000 * 60);
      hide();
      preferences.webContents.send("startResponseReceived", response);
      preferences.webContents.executeJavaScript(
        `localStorage.setItem('email', '${credentials.email}')`
      );
      return;
    case "wrong-credentials":
      preferences.webContents.send("startResponseReceived", response);
      return;
    case "error":
      preferences.webContents.send("startResponseReceived", response);
      return;
  }
};

const start_ = async (credentials: Credentials): Promise<Event> => {
  const { email, password } = credentials;
  const glucose = await getGlucose(email, password);
  switch (glucose._kind) {
    case "ok":
      const contextMenuOk = Menu.buildFromTemplate(
        menuTemplate(`Last glucose at ${glucose.data.timestamp}`)
      );
      tray.setContextMenu(contextMenuOk);
      state = { ...state, ...credentials };
      // const RED_FG = '\033[31;1m';
      // const RED_BG = '\033[41;1m';
      tray.setTitle(`${glucose.data.value} ${trendToIcon(glucose.data.trend)}`);
      return { _kind: "ok" };
    case "no-glucose-in-5-minutes":
      const contextMenuNone = Menu.buildFromTemplate(
        menuTemplate(`No glucose in the last 5 minutes..`)
      );
      tray.setContextMenu(contextMenuNone);
      tray.setTitle(`...`);
      return { _kind: "ok" };
    case "wrong-credentials":
      const contextMenuNoneWrong = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenuNoneWrong);
      tray.setTitle(`...`);
      return { _kind: "wrong-credentials" };
    case "error":
      const contextMenuNoneError = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenuNoneError);
      tray.setTitle(`...`);
      return { _kind: "error" };
    case "fail":
      const contextMenuNoneFail = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenuNoneFail);
      tray.setTitle(`...`);
      return { _kind: "error" };
  }
};

const getGlucose = async (
  email: string,
  password: string
): Promise<Response<Entry> | { _kind: "no-glucose-in-5-minutes" }> => {
  const accountId = await getAccountId(email, password);
  if (accountId._kind !== "ok") return accountId;
  const sessionId = await getSessionId(accountId.data, password);
  if (!sessionId) return { _kind: "fail" };
  const [glucose] = await getEstimatedGlucoseValues(sessionId);
  return glucose
    ? { _kind: "ok", data: glucose }
    : { _kind: "no-glucose-in-5-minutes" };
};

const trendToIcon = (trend: string) => {
  switch (trend) {
    case "Flat":
      return "→";
    case "FortyFiveUp":
      return "↗";
    case "FortyFiveDown":
      return "↘";
    case "SingleUp":
      return "↑";
    case "SingleDown":
      return "↓";
    case "DoubleUp":
      return "⇈";
    case "DoubleDown":
      return "⇊";
    default:
      return trend;
  }
};

const DEXCOM_APPLICATION_ID = "d89443d2-327c-4a6f-89e5-496bbb0317db";

const getAccountId = async (
  accountName: string,
  password: string
): Promise<Response<string>> => {
  const body = {
    accountName,
    password,
    applicationId: DEXCOM_APPLICATION_ID,
  };
  const url =
    "https://shareous1.dexcom.com/ShareWebServices/Services/General/AuthenticatePublisherAccount";
  const response = await post(body, url);
  if (response._kind !== "ok") {
    return response;
  }
  return { _kind: "ok", data: response.data as string };
};

const getSessionId = async (
  accountId: string,
  password: string
): Promise<string | null> => {
  const body = {
    accountId,
    password,
    applicationId: DEXCOM_APPLICATION_ID,
  };
  const url =
    "https://shareous1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountById";
  const response = await post(body, url);
  switch (response._kind) {
    case "ok":
      return response.data as Promise<string | null>;
    case "error":
      return null;
    case "wrong-credentials":
      return null;
    case "fail":
      return null;
  }
};

const getEstimatedGlucoseValues = async (
  sessionId: string
): Promise<Entry[]> => {
  const body = {
    maxCount: 1,
    minutes: 6,
    sessionId,
  };
  const url =
    "https://shareous1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues";
  const response = await post(body, url);
  if (response._kind !== "ok") {
    return [];
  }
  // The API returns something like:
  // [{
  //   "WT":"Date(1649148591000)",
  //   "ST":"Date(1649148591000)",
  //   "DT":"Date(1649148591000+0200)",
  //   "Value":116,
  //   "Trend":"Flat"
  // }]
  const data = response.data as {
    Value: number;
    Trend: string;
    DT: string;
  }[];

  const notNull = <T>(x: T | null): x is T => x !== null;

  return data
    .map((entry) => {
      const timestamp = convertToLocalTime(entry.DT);
      if (!timestamp) return null;
      return {
        value: entry.Value,
        trend: entry.Trend,
        timestamp: timestamp,
      };
    })
    .filter(notNull);
};

const post = async (
  body: Record<PropertyKey, unknown>,
  url: string
): Promise<Response> => {
  try {
    const result = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await result.json();
    if (result.ok) {
      return { _kind: "ok", data: json };
    } else if ("Code" in json && json.Code == "AccountPasswordInvalid") {
      return { _kind: "wrong-credentials" };
    } else {
      return { _kind: "error", data: json };
    }
  } catch (error) {
    return { _kind: "fail" };
  }
};

const convertToLocalTime = (dt: string): string | null => {
  const [_1, epochWithTz] = dt.match(/Date\((.+)\)/) || [];
  if (!epochWithTz) return null;
  const [_, epoch, sign, offset] = epochWithTz.match(/(\d+)([-+])(\d+)/) || [];
  if (!epoch || !sign || !offset) return null;
  const date = new Date(parseInt(epoch, 10));
  const iso =
    date.toISOString().slice(0, -1) + (sign === "-" ? "+" : "-") + offset;
  const local = new Date(iso).toISOString().slice(0, -1) + `${sign}${offset}`;
  const [_2, timestamp] = local.match(/.+T(\d\d:\d\d):.+/) || [];
  return timestamp || null;
};
