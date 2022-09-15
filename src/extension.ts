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

  vscode.workspace.onDidSaveTextDocument(
    async (document: vscode.TextDocument) => {
      await extension.eventHandlerAsync({
        event: "onFileChange",
        documentUri: document.uri,
      });
    }
  );

  vscode.workspace.onDidCreateFiles(
    async (createEvent: vscode.FileCreateEvent) => {
      for (const documentUri of createEvent.files) {
        await extension.eventHandlerAsync({
          event: "onFileCreate",
          documentUri,
        });
      }
    }
  );

  vscode.workspace.onDidDeleteFiles(
    async (deleteEvent: vscode.FileCreateEvent) => {
      extension.showOutputMessage(deleteEvent.files.toString());
      for (const documentUri of deleteEvent.files) {
        await extension.eventHandlerAsync({
          event: "onFileDelete",
          documentUri,
        });
      }
    }
  );

  vscode.workspace.onDidRenameFiles(
    async (renameEvent: vscode.FileRenameEvent) => {
      for (const document of renameEvent.files) {
        await extension.eventHandlerAsync({
          event: "onFileDelete",
          documentUri: document.newUri,
          documentOldUri: document.oldUri,
        });
      }
    }
  );
}

function initFolderEvents(extension: FileWatcher): void {
  const watcher: vscode.FileSystemWatcher =
    vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

  watcher.onDidChange(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderChange",
      documentUri: uri,
    });
  });

  watcher.onDidCreate(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderCreate",
      documentUri: uri,
    });
  });

  watcher.onDidDelete(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderDelete",
      documentUri: uri,
    });
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const extension: FileWatcher = new FileWatcher(context);
  extension.showEnabledState();
  registerCommands(extension);
  initFileEvents(extension);
  initFolderEvents(extension);
}
