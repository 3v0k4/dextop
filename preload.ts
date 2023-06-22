import { contextBridge, ipcRenderer } from "electron";

const state = process.argv.at(-1);

if (state === undefined) throw new Error("State not found");

contextBridge.exposeInMainWorld("versions", {
  start: (credentials: { email: string; password: string }) =>
    ipcRenderer.invoke("start", credentials),
  onStartResponse: (callback: Parameters<typeof ipcRenderer.on>[1]) =>
    ipcRenderer.on("startResponseReceived", callback),
  state: JSON.parse(state),
});
