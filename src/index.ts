import {
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  app,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  session,
} from "electron";
import Positioner from "electron-positioner";
import AutoLaunch from "auto-launch";
import updateElectronApp from "update-electron-app";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// NEEDS TO BE THE FIRST THING IN THE FILE
if (require("electron-squirrel-startup")) {
  app.quit();
}

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const PRODUCTION_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "connect-src 'self'",
  "img-src 'self'",
  "style-src 'unsafe-inline' fonts.googleapis.com",
  "base-uri 'self'",
  "form-action 'self'",
  "font-src fonts.gstatic.com",
].join("; ");

const WEBSITE_URL = "https://dextop.odone.io";
const DONATE_URL = "http://tips.dextop.odone.io";
const CONTACT_URL = "http://contact.dextop.odone.io";

updateElectronApp();

type Region = "us" | "eu" | "";
export type Session = {
  email: string;
  password: string;
  region: Region;
};

export type Event =
  | { _kind: "ok" }
  | { _kind: "wrong-credentials" }
  | { _kind: "error" };

type Glucose = {
  timestamp: string;
  value: number | null;
  trend: string;
};

type Response<T = unknown> =
  | { _kind: "ok"; data: T }
  | { _kind: "error"; data: unknown }
  | { _kind: "wrong-credentials" }
  | { _kind: "fail" };

let tray: Tray | undefined;
let preferences: BrowserWindow | undefined;
let state: Session = { email: "", password: "", region: "" };
let loopId: ReturnType<typeof setInterval> | undefined;
let isAppQuitting = false;

if (process.platform === "darwin") {
  app.dock.hide();
}

const autoLaunch = new AutoLaunch({
  name: "DexTop",
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, _navigationUrl) => {
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (
      [new URL(CONTACT_URL).origin, new URL(DONATE_URL).origin].includes(
        new URL(url).origin
      )
    ) {
      setImmediate(() => {
        shell.openExternal(url);
      });
    }

    return { action: "deny" };
  });
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": app.isPackaged
          ? [PRODUCTION_CONTENT_SECURITY_POLICY + "; script-src 'self'"]
          : [
              PRODUCTION_CONTENT_SECURITY_POLICY +
                "; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            ],
      },
    });
  });

  ipcMain.handle("start", start);

  tray = new Tray(nativeImage.createEmpty());
  const contextMenu = Menu.buildFromTemplate(menuTemplate());
  tray.setContextMenu(contextMenu);

  tray.setToolTip("DexTop");

  // Needed to make sure the positioner places it correctly
  setTimeout(() => {
    showPreferences();
    setWatcher();
  }, 500);
});

const menuTemplate = (
  label?: string
): Parameters<typeof Menu.buildFromTemplate>[0] => {
  const DEFAULT: MenuItemConstructorOptions[] = [
    { label: "Preferences", click: showPreferences },
    { type: "separator" },
    {
      label: `DexTop version ${app.getVersion()}`,
      enabled: false,
    },
    {
      label: "Website",
      click: () => shell.openExternal(WEBSITE_URL),
    },
    {
      label: "Donate",
      click: () => shell.openExternal(DONATE_URL),
    },
    {
      label: "Contact",
      click: () => shell.openExternal(CONTACT_URL),
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
    height: 300,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      additionalArguments: [JSON.stringify(state)],
    },
  });

  if (process.platform === "darwin") {
    preferences.webContents
      .executeJavaScript("localStorage.getItem('alreadyRun')")
      .then((item) => {
        if (item) {
          return;
        }

        return dialog
          .showMessageBox({
            title: "DexTop",
            message:
              "DexTop will launch at startup. You may need to accept a permissions prompt.",
          })
          .then(() => autoLaunch.enable())
          .then(() => {
            if (!preferences) return;
            return preferences.webContents.executeJavaScript(
              "localStorage.setItem('alreadyRun', true)"
            );
          });
      });
  }

  preferences.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  preferences.webContents
    .executeJavaScript("localStorage.getItem('session')")
    .then((sessionString) => {
      if (!sessionString) {
        return;
      }
      const session = JSON.parse(sessionString);
      state = { ...state, ...session };
      if (!preferences) return;
      preferences.webContents.send("retrievedSession", session);
    });

  const positioner = new Positioner(preferences);
  const { x, y } = tray
    ? positioner.calculate(
        process.platform === "darwin" ? "trayCenter" : "trayBottomCenter",
        tray.getBounds()
      )
    : { x: 0, y: 0 };
  preferences.setPosition(x, y);

  preferences.once("ready-to-show", () => {
    if (!preferences) return;
    preferences.show();
  });

  app.on("before-quit", () => {
    isAppQuitting = true;
  });
  preferences.on("close", hide);
};

const hide = (event?: Electron.Event) => {
  if (event && !isAppQuitting) {
    event.preventDefault();
  }
  if (!preferences) {
    return;
  }
  preferences.removeListener("close", hide);
  preferences.hide();
  isAppQuitting = false;
};

const validateSender = (frame: Electron.WebFrameMain) => {
  return new URL(frame.url).host === new URL(MAIN_WINDOW_WEBPACK_ENTRY).host;
};

const start = async (event: Electron.IpcMainInvokeEvent, session: Session) => {
  if (!validateSender(event.senderFrame)) return null;

  if (!preferences) {
    return null;
  }

  if (loopId) {
    clearInterval(loopId);
  }
  const response = await start_(session);
  switch (response._kind) {
    case "ok":
      loopId = setInterval(() => start_(session), 1000 * 60);
      hide();
      preferences.webContents.send("startResponseReceived", response);
      preferences.webContents.executeJavaScript(
        `localStorage.setItem('session', '${JSON.stringify({
          email: session.email,
          region: session.region,
        })}')`
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

const start_ = async (session: Session): Promise<Event> => {
  if (!tray) return { _kind: "error" };

  const glucose = await getGlucose(session);
  switch (glucose._kind) {
    case "ok": {
      const contextMenu = Menu.buildFromTemplate(
        menuTemplate(`Last glucose at ${glucose.data.timestamp}`)
      );
      tray.setContextMenu(contextMenu);
      state = { ...state, ...session };
      // const RED_FG = '\033[31;1m';
      // const RED_BG = '\033[41;1m';
      setWatcher(glucose.data);
      return { _kind: "ok" };
    }
    case "no-glucose-in-5-minutes": {
      const contextMenu = Menu.buildFromTemplate(
        menuTemplate(`No glucose in the last 5 minutes..`)
      );
      tray.setContextMenu(contextMenu);
      setWatcher();
      return { _kind: "ok" };
    }
    case "wrong-credentials": {
      const contextMenu = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenu);
      setWatcher();
      return { _kind: "wrong-credentials" };
    }
    case "error": {
      const contextMenu = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenu);
      setWatcher();
      return { _kind: "error" };
    }
    case "fail": {
      const contextMenu = Menu.buildFromTemplate(menuTemplate());
      tray.setContextMenu(contextMenu);
      setWatcher();
      return { _kind: "error" };
    }
  }
};

const getGlucose = async (
  session: Session
): Promise<Response<Glucose> | { _kind: "no-glucose-in-5-minutes" }> => {
  const { email, password, region } = session;
  if (region === "") return { _kind: "fail" };
  const accountId = await getAccountId({ email, password, host: host(region) });
  if (accountId._kind !== "ok") return accountId;
  const sessionId = await getSessionId({
    accountId: accountId.data,
    password,
    host: host(region),
  });
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

const getAccountId = async ({
  email,
  password,
  host,
}: {
  email: string;
  password: string;
  host: string;
}): Promise<Response<string>> => {
  const body = {
    accountName: email,
    password,
    applicationId: DEXCOM_APPLICATION_ID,
  };
  const url = `https://${host}/ShareWebServices/Services/General/AuthenticatePublisherAccount`;
  const response = await post(body, url);
  if (response._kind !== "ok") {
    return response;
  }
  return { _kind: "ok", data: response.data as string };
};

const getSessionId = async ({
  accountId,
  password,
  host,
}: {
  accountId: string;
  password: string;
  host: string;
}): Promise<string | null> => {
  const body = {
    accountId,
    password,
    applicationId: DEXCOM_APPLICATION_ID,
  };
  const url = `https://${host}/ShareWebServices/Services/General/LoginPublisherAccountById`;
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
): Promise<Glucose[]> => {
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
    .map((glucose) => {
      const timestamp = convertToLocalTime(glucose.DT);
      if (!timestamp) return null;
      return {
        value: glucose.Value,
        trend: glucose.Trend,
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
  const [_2, epoch, sign, offset] = epochWithTz.match(/(\d+)([-+])(\d+)/) || [];
  if (!epoch || !sign || !offset) return null;
  const date = new Date(parseInt(epoch, 10));
  const iso =
    date.toISOString().slice(0, -1) + (sign === "-" ? "+" : "-") + offset;
  const local = new Date(iso).toISOString().slice(0, -1) + `${sign}${offset}`;
  const [_3, timestamp] = local.match(/.+T(\d\d:\d\d):.+/) || [];
  return timestamp || null;
};

const host = (region: Exclude<Region, "">): string => {
  switch (region) {
    case "us":
      return "share2.dexcom.com";
    case "eu":
      return "shareous1.dexcom.com";
  }
};

const drawIcon = (glucose?: Glucose) =>
  `
  canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.font = "${font(glucose)} Sofia Sans Extra Condensed";
  ctx.fillText("${glucose?.value ?? "..."}", 0, 22);
  ${trendToPath(glucose?.trend ?? "")}
  ctx.stroke();
  ctx.fill();
  canvas.toDataURL();
  `;

const font = (glucose?: Glucose): "32px" | "28px" => {
  if (!glucose) return "32px";
  const chars = String(glucose.value)
    .split("")
    .filter((x) => x !== ".");
  if (chars.length === 3) return "28px";
  if (chars.length === 2) return "32px";
  return "32px";
};

const trendToPath = (trend: string) => {
  switch (trend) {
    case "Flat":
      return `
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.moveTo(1, 28);
      ctx.lineTo(31, 28);
      ctx.moveTo(28, 26);
      ctx.lineTo(28, 30);
      ctx.lineTo(31, 28);
      ctx.closePath();
      `;
    case "FortyFiveUp":
      return `
      ctx.beginPath();
      ctx.moveTo(11, 32);
      ctx.lineTo(15, 26);
      ctx.lineTo(19, 32);
      ctx.closePath();
      `;
    case "FortyFiveDown":
      return `
      ctx.beginPath();
      ctx.moveTo(11, 26);
      ctx.lineTo(15, 32);
      ctx.lineTo(19, 26);
      ctx.closePath();
      `;
    case "SingleUp":
      return `
      ctx.beginPath();
      ctx.moveTo(1, 32);
      ctx.lineTo(5, 26);
      ctx.lineTo(9, 32);
      ctx.moveTo(21, 32);
      ctx.lineTo(25, 26);
      ctx.lineTo(29, 32);
      ctx.closePath();
      `;
    case "SingleDown":
      return `
      ctx.beginPath();
      ctx.moveTo(1, 26);
      ctx.lineTo(5, 32);
      ctx.lineTo(9, 26);
      ctx.moveTo(21, 26);
      ctx.lineTo(25, 32);
      ctx.lineTo(29, 26);
      ctx.closePath();
      `;
    case "DoubleUp":
      return `
      ctx.beginPath();
      ctx.moveTo(1, 32);
      ctx.lineTo(5, 26);
      ctx.lineTo(9, 32);
      ctx.moveTo(11, 32);
      ctx.lineTo(15, 26);
      ctx.lineTo(19, 32);
      ctx.moveTo(21, 32);
      ctx.lineTo(25, 26);
      ctx.lineTo(29, 32);
      ctx.closePath();
      `;
    case "DoubleDown":
      return `
      ctx.beginPath();
      ctx.moveTo(1, 26);
      ctx.lineTo(5, 32);
      ctx.lineTo(9, 26);
      ctx.moveTo(11, 26);
      ctx.lineTo(15, 32);
      ctx.lineTo(19, 26);
      ctx.moveTo(21, 26);
      ctx.lineTo(25, 32);
      ctx.lineTo(29, 26);
      ctx.closePath();
      `;
    default:
      return "";
  }
};

const setWatcher = (glucose?: Glucose) => {
  setTitle(glucose);
  setImage(glucose);
};

const setTitle = (glucose?: Glucose) => {
  if (process.platform !== "darwin") return;
  if (!tray) return;
  const title = glucose
    ? `${glucose.value} ${trendToIcon(glucose.trend)}`
    : "...";
  tray.setTitle(title);
};

const setImage = (glucose?: Glucose) => {
  if (process.platform !== "win32") return;
  if (!preferences) return;
  preferences.webContents
    .executeJavaScript(drawIcon(glucose))
    .then((dataUrl) => {
      const icon = nativeImage.createFromDataURL(dataUrl);
      if (!tray) return;
      tray.setImage(icon);
    });
};
