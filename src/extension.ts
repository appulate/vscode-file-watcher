import * as vscode from "vscode";
import FileWatcher from "./file-watcher";

function registerCommands(extension: FileWatcher): void {
  vscode.commands.registerCommand("extension.enableFileWatcher", () => {
    extension.isEnabled = true;
  });

  vscode.commands.registerCommand("extension.disableFileWatcher", () => {
    extension.isEnabled = false;
  });
}

function initFileEvents(extension: FileWatcher): void {
  vscode.workspace.onDidChangeConfiguration(() => {
    extension.loadConfig();
    extension.showStatusMessage("config reloaded");
    extension.showOutputMessage("[Config reloaded]");
  });

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    extension.eventHandler({
      event: "onFileChange",
      documentUri: document.uri,
    });
  });

  vscode.workspace.onDidCreateFiles((createEvent: vscode.FileCreateEvent) => {
    createEvent.files.forEach((documentUri) => {
      extension.eventHandler({
        event: "onFileCreate",
        documentUri,
      });
    });
  });

  vscode.workspace.onDidDeleteFiles((deleteEvent: vscode.FileDeleteEvent) => {
    deleteEvent.files.forEach((documentUri) => {
      extension.eventHandler({
        event: "onFileDelete",
        documentUri,
      });
    });
  });

  vscode.workspace.onDidRenameFiles((renameEvent: vscode.FileRenameEvent) => {
    renameEvent.files.forEach((document) => {
      extension.eventHandler({
        event: "onFileRename",
        documentUri: document.newUri,
        documentOldUri: document.oldUri,
      });
    });
  });
}

function initFolderEvents(extension: FileWatcher): void {
  const watcher: vscode.FileSystemWatcher =
    vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

  watcher.onDidChange((uri: vscode.Uri) => {
    extension.eventHandler({ event: "onFolderChange", documentUri: uri });
  });

  watcher.onDidCreate((uri: vscode.Uri) => {
    extension.eventHandler({ event: "onFolderCreate", documentUri: uri });
  });

  watcher.onDidDelete((uri: vscode.Uri) => {
    extension.eventHandler({ event: "onFolderDelete", documentUri: uri });
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const extension: FileWatcher = new FileWatcher(context);
  extension.showEnabledState();
  registerCommands(extension);
  initFileEvents(extension);
  initFolderEvents(extension);
}
