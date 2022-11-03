import * as vscode from "vscode";
import FileWatcher from "./file-watcher";
import { convertSingleUriToDocArr, convertUriFiles } from "./utils";

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
    extension.statusBar.normalizeStatusBar();
    extension.statusBar.showMessage("File Watcher: config reloaded");
    extension.showOutputMessage("[Config reloaded]");
  });

  vscode.workspace.onDidSaveTextDocument(
    async (document: vscode.TextDocument) => {
      await extension.eventHandlerAsync({
        event: "onFileChange",
        documentsUri: convertSingleUriToDocArr(document.uri),
      });
    }
  );

  vscode.workspace.onDidCreateFiles(
    async (createEvent: vscode.FileCreateEvent) => {
      await extension.eventHandlerAsync({
        event: "onFileCreate",
        documentsUri: convertUriFiles(createEvent.files),
      });
    }
  );

  vscode.workspace.onDidDeleteFiles(
    async (deleteEvent: vscode.FileCreateEvent) => {
      await extension.eventHandlerAsync({
        event: "onFileDelete",
        documentsUri: convertUriFiles(deleteEvent.files),
      });
    }
  );

  vscode.workspace.onDidRenameFiles(
    async (renameEvent: vscode.FileRenameEvent) => {
      await extension.eventHandlerAsync({
        event: "onFileRename",
        documentsUri: renameEvent.files.map((file) => ({
          documentUri: file.newUri,
          documentOldUri: file.oldUri,
        })),
      });
    }
  );
}

function initFolderEvents(extension: FileWatcher): void {
  const watcher: vscode.FileSystemWatcher =
    vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

  watcher.onDidChange(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderChange",
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });

  watcher.onDidCreate(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderCreate",
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });

  watcher.onDidDelete(async (uri: vscode.Uri) => {
    await extension.eventHandlerAsync({
      event: "onFolderDelete",
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const extension: FileWatcher = new FileWatcher(context);
  extension.isEnabled = true;
  registerCommands(extension);
  initFileEvents(extension);
  initFolderEvents(extension);
}
