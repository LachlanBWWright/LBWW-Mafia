import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  shell,
  dialog,
} from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createChatGPTRuntime } from "../tools/ai-bots/chatgpt/runtime.mjs";
import { createBotRunner } from "../shared/ai/partyRunner.mjs";
import { createProtectedStore } from "./protectedStore.mjs";
import {
  acceptsSender,
  createDesktopController,
  trustedOrigin,
} from "./controller.mjs";
import config from "./config.json" with { type: "json" };

app.setName("LBWW Mafia");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  void app.whenReady().then(() => {
    try {
      const appUrl = process.env.MAFIA_DESKTOP_APP_URL ?? config.appUrl;
      const socketUrl =
        process.env.MAFIA_DESKTOP_SOCKET_URL ?? config.socketUrl;
      if (!appUrl || !socketUrl)
        throw new Error(
          "Set the website and game server addresses before distributing the desktop app.",
        );
      const appOrigin = trustedOrigin(appUrl);
      const socketOrigin = trustedOrigin(socketUrl);
      const runtime = createChatGPTRuntime({
        store: createProtectedStore(
          join(app.getPath("userData"), "chatgpt"),
          safeStorage,
        ),
      });
      const runner = createBotRunner({
        WebSocket,
        randomUUID,
        generate: (input) => runtime.generate(input),
      });
      const controller = createDesktopController({
        runtime,
        runner,
        socketOrigin,
        open: (url) => shell.openExternal(url),
      });
      let window;
      const createWindow = () => {
        window = new BrowserWindow({
          width: 1280,
          height: 860,
          backgroundColor: "#060912",
          title: "LBWW Mafia",
          webPreferences: {
            preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        window.webContents.session.setPermissionRequestHandler(
          (_contents, _permission, callback) => callback(false),
        );
        window.webContents.session.setPermissionCheckHandler(() => false);
        window.webContents.setWindowOpenHandler(({ url }) => {
          // App login and usage links open in the system browser; no child gets native privileges.
          try {
            const target = new URL(url);
            if (
              target.protocol === "https:" &&
              !target.username &&
              !target.password
            )
              void shell.openExternal(target.href);
          } catch {}
          return { action: "deny" };
        });
        window.webContents.on("will-navigate", (event, url) => {
          if (new URL(url).origin !== appOrigin) event.preventDefault();
        });
        window.webContents.on("will-redirect", (event, url) => {
          if (new URL(url).origin !== appOrigin) event.preventDefault();
        });
        window.on("closed", () => {
          window = null;
          controller.close();
        });
        void window.loadURL(appUrl);
      };
      ipcMain.handle("mafia:chatgpt", async (event, method, body) => {
        if (!window || !acceptsSender(event, window, appOrigin))
          return { ok: false, error: "Untrusted desktop request." };
        try {
          return { ok: true, value: await controller.invoke(method, body) };
        } catch (error) {
          return {
            ok: false,
            error: error.code
              ? error.message
              : "Could not complete the ChatGPT action. Try again.",
          };
        }
      });
      app.on("second-instance", () => {
        window?.show();
        window?.focus();
      });
      app.on("before-quit", () => controller.close());
      // Closing the app ends its bot runtime on every platform, including macOS.
      app.on("window-all-closed", () => app.quit());
      createWindow();
    } catch (error) {
      dialog.showErrorBox("Mafia could not start", error.message);
      app.quit();
    }
  });
}
