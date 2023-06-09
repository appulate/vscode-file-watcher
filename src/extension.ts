import * as vscode from "vscode";
import FileWatcher from "./file-watcher";
import { convertSingleUriToDocArr, convertUriFiles } from "./utils";
import { RegisterCommands, Event } from "./types";

function registerCommands(extension: FileWatcher): void {
  vscode.commands.registerCommand(RegisterCommands.Enable, () => {
    extension.isEnabled = true;
  });

  vscode.commands.registerCommand(RegisterCommands.Disable, () => {
    extension.isEnabled = false;
  });

  vscode.commands.registerCommand(RegisterCommands.FocusOutput, () => {
    extension.outputChannel.showChannel();
  });
}

function initFileEvents(extension: FileWatcher): void {
  vscode.workspace.onDidChangeConfiguration(() => {
    extension.loadConfig();
  });

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    extension.eventHandlerAsync({
      event: Event.FileChange,
      documentsUri: convertSingleUriToDocArr(document.uri),
    });
  });

  vscode.workspace.onDidChangeTextDocument(
    ({ document }: vscode.TextDocumentChangeEvent) => {
      extension.eventHandlerAsync({
        event: Event.FileChangeImmediate,
        documentsUri: convertSingleUriToDocArr(document.uri),
      });
    }
  );

  vscode.workspace.onDidCreateFiles((createEvent: vscode.FileCreateEvent) => {
    extension.eventHandlerAsync({
      event: Event.FileCreate,
      documentsUri: convertUriFiles(createEvent.files),
    });
  });

  vscode.workspace.onDidDeleteFiles((deleteEvent: vscode.FileCreateEvent) => {
    extension.eventHandlerAsync({
      event: Event.FileDelete,
      documentsUri: convertUriFiles(deleteEvent.files),
    });
  });

  vscode.workspace.onDidRenameFiles((renameEvent: vscode.FileRenameEvent) => {
    extension.eventHandlerAsync({
      event: Event.FileRename,
      documentsUri: renameEvent.files.map((file) => ({
        documentUri: file.newUri,
        documentOldUri: file.oldUri,
      })),
    });
  });
}

function initFolderEvents(extension: FileWatcher): void {
  const watcher: vscode.FileSystemWatcher =
    vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

  watcher.onDidChange((uri: vscode.Uri) => {
    extension.eventHandlerAsync({
      event: Event.FolderChange,
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });

  watcher.onDidCreate((uri: vscode.Uri) => {
    extension.eventHandlerAsync({
      event: Event.FolderCreate,
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });

  watcher.onDidDelete((uri: vscode.Uri) => {
    extension.eventHandlerAsync({
      event: Event.FolderDelete,
      documentsUri: convertSingleUriToDocArr(uri),
    });
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const extension: FileWatcher = new FileWatcher(context);
  registerCommands(extension);
  initFileEvents(extension);
  initFolderEvents(extension);
}
