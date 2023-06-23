type Credentials = import("./main").Credentials;

type OnStartResponseListener = (
  _: IpcRendererEvent,
  _: import("./main").Event
) => void;
type OnCredentialsListener = (_: IpcRendererEvent, _: Credentials) => void;

declare global {
  interface Window {
    versions: {
      start: (Credentials) => Promise<void>;
      onStartResponse: (_: OnStartResponseListener) => void;
      state: Credentials;
      onCredentials: (_: OnCredentialsListener) => void;
    };
  }
}

export {};
