import * as vscode from "vscode";

export type EventType =
  | "onFileChange"
  | "onFileDelete"
  | "onFileRename"
  | "onFileCreate"
  | "onFolderChange"
  | "onFolderCreate"
  | "onFolderDelete";

export interface ICommand {
  match: string;
  notMatch?: string;
  cmd: string;
  isAsync: boolean;
  event: EventType;
}

export type IPartialCommand = Partial<ICommand>;

export interface IConfig extends vscode.WorkspaceConfiguration {
  shell?: string;
  autoClearConsole?: boolean;
  commands?: ICommand[];
}

export interface IEventHandler {
  event: EventType;
  documentUri: vscode.Uri;
  documentOldUri?: vscode.Uri;
}

export type IDocumentUriMap = Omit<IEventHandler, "event">;

export interface ICmdReplaceInfo {
  pattern: RegExp;
  replaceStr: string;
}
