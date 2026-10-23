const { contextBridge, ipcRenderer } = require("electron");
const methods = new Set([
  "status",
  "models",
  "connect",
  "cancel",
  "retry",
  "disconnect",
  "join",
]);
contextBridge.exposeInMainWorld(
  "mafiaDesktop",
  Object.freeze({
    chatGPT: async (method, body) => {
      if (!methods.has(method)) throw new Error("Unsupported desktop action.");
      const result = await ipcRenderer.invoke("mafia:chatgpt", method, body);
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },
  }),
);
