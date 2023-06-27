import * as vscode from "vscode";

export type Nullable<T> = T | null;

export enum Event {
  FileChange = "onFileChange",
  FileChangeImmediate = "onFileChangeImmediate",
  FileDelete = "onFileDelete",
  FileRename = "onFileRename",
  FileCreate = "onFileCreate",
  FolderChange = "onFolderChange",
  FolderCreate = "onFolderCreate",
  FolderDelete = "onFolderDelete",
}

export enum CommandType {
  Shell = "shell",
  Vscode = "vscode",
}

export interface ICommandValue<T extends CommandType = CommandType> {
  readonly type: T;
  readonly value: T extends CommandType.Shell ? string : string | string[];
}

export interface IExecOptions {
  readonly shell: string;
}

interface ICmdOptions {
  readonly execOptions: Nullable<IExecOptions>;
}

interface IConfig<T> extends vscode.WorkspaceConfiguration {
  readonly shell: string;
  readonly autoClearConsole: boolean;
  readonly commands: T[];
  readonly isClearStatusBar: boolean;
  readonly statusBarDelay: number;
  readonly isSyncRunEvents: boolean;
  readonly successTextColor: string;
  readonly runTextColor: string;
}

interface ICommand<T> {
  readonly event: Event;
  readonly match: string;
  readonly cmd: T;
  readonly shell: string;
  readonly vscodeTask: string | string[];
  readonly isAsync: boolean;
  readonly notMatch?: string;
}

export type PartialInitCommand = Partial<ICommand<string>>;

export type ValidCommand = PartialInitCommand & {
  readonly event: ICommand<string>["event"];
  readonly match: ICommand<string>["match"];
};

export type PreparedCommand = Omit<
  ICommand<ICommandValue>,
  "shell" | "vscodeTask"
> &
  ICmdOptions;

type InitConfig<T> = Partial<IConfig<T>> & {
  readonly commands: IConfig<T>["commands"];
};

export type WorkspaceConfig = Partial<IConfig<PartialInitCommand>>;

export type PartialInitConfig = InitConfig<PartialInitCommand>;

export type ValidInitConfig = InitConfig<ValidCommand>;

export type PreparedConfig = InitConfig<PreparedCommand>;

export interface IDocumentUriMap {
  readonly documentUri: vscode.Uri;
  readonly documentOldUri?: vscode.Uri;
}

export interface IEventConfig {
  readonly event: Event;
  readonly documentsUri: readonly IDocumentUriMap[];
}

export interface IColors {
  readonly default?: vscode.ThemeColor;
  readonly error: vscode.ThemeColor;
  success: vscode.ThemeColor;
  run: vscode.ThemeColor;
}

export interface IPackageConfigSchema {
  readonly title: string;
  readonly type: string;
  readonly properties: {
    [key: string]: {
      readonly type: string;
      readonly default?: unknown;
      readonly description?: string;
    };
  };
}

export interface IPackage {
  readonly displayName: string;
  readonly version: string;
  readonly contributes: {
    readonly configuration: IPackageConfigSchema;
  };
}

export enum StatusType {
  Success = "success",
  Error = "error",
}

export enum EnabledState {
  Enable = "enabled",
  Disable = "disabled",
}

export enum OutputReservedKey {
  Error = "[error]",
  Cmd = "[cmd]",
  Task = "[vscode-task]",
  Reload = "[Config reloaded]",
  EventHandled = "[Event handled]",
}

export enum RegisterCommands {
  Enable = "extension.enableFileWatcher",
  Disable = "extension.disableFileWatcher",
  FocusOutput = "extension.focusIntoOutput",
}
