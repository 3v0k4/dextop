import { contextBridge, ipcRenderer } from "electron";

const state = process.argv.at(-1);

if (state === undefined) throw new Error("State not found");

contextBridge.exposeInMainWorld("versions", {
  start: (session: import("./index").Session) =>
    ipcRenderer.invoke("start", session),
  onStartResponse: (callback: Parameters<typeof ipcRenderer.on>[1]) =>
    ipcRenderer.on("startResponseReceived", callback),
  onSession: (callback: Parameters<typeof ipcRenderer.on>[1]) =>
    ipcRenderer.on("retrievedSession", callback),
  state: JSON.parse(state),
});
