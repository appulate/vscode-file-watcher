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
  shell: string;
  autoClearConsole: boolean;
  commands: ICommand[];
  isClearStatusBar: boolean;
  statusBarDelay: number;
  isSyncRunEvents: boolean;
}

export interface IDocumentUriMap {
  documentUri: vscode.Uri;
  documentOldUri?: vscode.Uri;
}

export interface IEventConfig {
  event: EventType;
  documentsUri: readonly IDocumentUriMap[];
}

export interface ICmdReplaceInfo {
  pattern: RegExp;
  replaceStr: string;
}

export interface IColors {
  errorColor: vscode.ThemeColor;
  successColor: vscode.ThemeColor;
  defaultColor?: vscode.ThemeColor;
  runColor: vscode.ThemeColor;
}

export enum StatusType {
  Success = "success",
  Error = "error",
}
