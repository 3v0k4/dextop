type Listener = (_: IpcRendererEvent, _: import("./main").Event) => void;

type Credentials = import("./main").Credentials;

declare global {
  interface Window {
    versions: {
      start: (Credentials) => Promise<void>;
      onStartResponse: (_: Listener) => void;
      state: Credentials;
    };
  }
}

export {};
