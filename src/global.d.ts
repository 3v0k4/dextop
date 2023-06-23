type Session = import("./index").Session;

type OnStartResponseListener = (
  _: IpcRendererEvent,
  _: import("./index").Event
) => void;
type OnSessionListener = (_: IpcRendererEvent, _: Session) => void;

declare global {
  interface Window {
    versions: {
      start: (_: Session) => Promise<void>;
      onStartResponse: (_: OnStartResponseListener) => void;
      state: Session;
      onSession: (_: OnSessionListener) => void;
    };
  }
}

export {};
