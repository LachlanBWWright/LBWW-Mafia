import type * as React from "react";
import {
  disconnectedChatGPTAccount,
  type ChatGPTAccount,
  type ChatGPTClient,
  type ChatGPTModel,
} from "./chatGPTConnection";

export function createUseChatGPTConnection({
  useState,
  useEffect,
  useRef,
  useCallback,
}: Pick<typeof React, "useState" | "useEffect" | "useRef" | "useCallback">) {
  return function useChatGPTConnection(client: ChatGPTClient) {
    const [account, setAccount] = useState<ChatGPTAccount>(
      disconnectedChatGPTAccount,
    );
    const [models, setModels] = useState<ChatGPTModel[]>([]);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const controller = useRef(new AbortController());
    useEffect(() => {
      controller.current = new AbortController();
      return () => controller.current.abort();
    }, [client]);
    const run = useCallback(
      async (action: (signal: AbortSignal) => Promise<void>) => {
        if (controller.current.signal.aborted) return;
        const signal = controller.current.signal;
        setBusy(true);
        setMessage("");
        try {
          await action(signal);
        } catch (error) {
          if (!signal.aborted)
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not connect to ChatGPT.",
            );
        } finally {
          if (!signal.aborted) setBusy(false);
        }
      },
      [],
    );
    const refresh = useCallback(
      () =>
        run(async (signal) => {
          const status = await client.status(signal);
          if (signal.aborted) return;
          setAccount(status);
          if (status.connected && status.planEnabled) {
            const available = await client.models(signal);
            if (!signal.aborted) setModels(available);
          } else setModels([]);
          if (status.error) setMessage(status.error.message);
        }),
      [client, run],
    );
    const connect = (open: (url: string) => void | Promise<void>) =>
      run(async (signal) => {
        const status = await client.connect(signal, open, () =>
          setMessage("Finish connecting ChatGPT on your computer."),
        );
        if (signal.aborted) return;
        setAccount(status);
        const available = status.planEnabled ? await client.models(signal) : [];
        if (!signal.aborted) {
          setModels(available);
          setMessage(
            status.planEnabled
              ? ""
              : "Enable ChatGPT plan usage to add AI characters.",
          );
        }
      });
    const disconnect = () =>
      run(async (signal) => {
        const result = await client.disconnect(signal);
        if (signal.aborted) return;
        setAccount(disconnectedChatGPTAccount);
        setModels([]);
        if (!result.remoteRevocationConfirmed)
          setMessage(
            "Disconnected here. Remove remaining access in ChatGPT settings.",
          );
      });
    const retry = () =>
      run(async (signal) => {
        await client.retry(signal);
        const status = await client.status(signal);
        if (!signal.aborted) setAccount(status);
        const available = await client.models(signal);
        if (!signal.aborted) setModels(available);
      });
    const cancel = async () => {
      controller.current.abort();
      controller.current = new AbortController();
      setBusy(false);
      setMessage("");
      try {
        await client.cancel(controller.current.signal);
      } catch {
        /* The request may have been cancelled before reaching the companion. */
      }
    };
    return {
      cancel,
      account,
      models,
      message,
      busy,
      refresh,
      connect,
      disconnect,
      retry,
    };
  };
}
