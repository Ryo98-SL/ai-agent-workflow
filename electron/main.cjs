const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const started = require("electron-squirrel-startup");

if (started) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: "AI Agent Workflow",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
};

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("workflow:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open workflow",
    properties: ["openFile"],
    filters: [{ name: "Agent workflow", extensions: ["agentflow.json", "json"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  return { ok: true, filePath, content };
});

ipcMain.handle("workflow:save", async (_event, payload) => {
  const filePath = payload && payload.filePath;
  const content = payload && payload.content;
  if (!filePath || typeof content !== "string") {
    return { ok: false, error: "Missing file path or content." };
  }

  await fs.writeFile(filePath, content, "utf8");
  return { ok: true, filePath };
});

ipcMain.handle("workflow:saveAs", async (_event, payload) => {
  const defaultPath = payload && payload.defaultPath;
  const content = payload && payload.content;
  if (typeof content !== "string") {
    return { ok: false, error: "Missing file content." };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save workflow",
    defaultPath: defaultPath || "untitled.agentflow.json",
    filters: [{ name: "Agent workflow", extensions: ["agentflow.json", "json"] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  await fs.writeFile(result.filePath, content, "utf8");
  return { ok: true, filePath: result.filePath };
});
