const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentWorkflow", {
  openWorkflow: () => ipcRenderer.invoke("workflow:open"),
  saveWorkflow: (filePath, content) => ipcRenderer.invoke("workflow:save", { filePath, content }),
  saveWorkflowAs: (content, defaultPath) => ipcRenderer.invoke("workflow:saveAs", { content, defaultPath }),
});
