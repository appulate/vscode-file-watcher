import { exec } from "child_process";
import * as vscode from "vscode";
import StatusBar from "./status-bar";
import {
  IConfig,
  ICommand,
  IEventHandler,
  IPartialCommand,
  IDocumentUriMap,
} from "./types";
import { getReplacedCmd } from "./utils";

class FileWatcher {
  private outputChannel: vscode.OutputChannel;
  private config!: IConfig;
  private statusBar: StatusBar;
  private isRunProcess: boolean;

  public constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel("File Watcher");
    this.statusBar = new StatusBar();
    this.isRunProcess = false;
    this.loadConfig();
  }

  public loadConfig(): void {
    const configName: string[] = [
      "filewatcher",
      "appulateinc.filewatcher",
    ].filter((name) => {
      const commands: IPartialCommand[] | undefined = vscode.workspace
        .getConfiguration(name)
        .get<ICommand[]>("commands");
      return commands != null && commands.length > 0;
    });
    this.config = vscode.workspace.getConfiguration(configName[0]) as IConfig;
  }

  public showEnabledState(): void {
    this.showOutputMessage(
      `File Watcher ${this.isEnabled ? "enabled" : "disabled"}.`
    );
  }

  public get isEnabled(): boolean {
    return !!this.context.globalState.get("isEnabled");
  }

  public set isEnabled(value: boolean) {
    this.context.globalState.update("isEnabled", value);
    this.showEnabledState();
  }

  private get execOption(): { shell: string } | null {
    const shell: string | null = this.config.shell ?? null;
    return shell != null ? { shell } : null;
  }

  public get isAutoClearConsole(): boolean {
    return !this.isRunProcess && this.config.autoClearConsole === true;
  }

  public get commands(): IPartialCommand[] {
    return this.config.commands ?? [];
  }

  public showOutputMessage(message: string): void {
    this.outputChannel.appendLine(message);
  }

  public showStatusMessage(message: string): void {
    this.statusBar.showMessage(`File Watcher: ${message}`);
  }

  private isFileNameValid(
    documentUri: vscode.Uri,
    pattern: string | null
  ): boolean {
    return pattern != null && new RegExp(pattern).test(documentUri.fsPath);
  }

  private getCommandsByConfigs(
    commandConfigs: IPartialCommand[],
    documentUriMap: IDocumentUriMap
  ): ICommand[] {
    return commandConfigs.reduce((commands: ICommand[], config) => {
      const { cmd, event, match } = config;
      if (cmd != null && event != null && match != null) {
        commands.push({
          cmd: getReplacedCmd(documentUriMap, cmd),
          isAsync: !!config.isAsync,
          event,
          match,
        });
      }
      return commands;
    }, []);
  }

  public async eventHandlerAsync({
    event,
    documentUri,
    documentOldUri,
  }: IEventHandler): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    if (this.isAutoClearConsole) {
      this.outputChannel.clear();
    }

    if (this.commands.length === 0) {
      this.showOutputMessage("[error] Settings sections are empty");
      return;
    }

    const commandConfigs: IPartialCommand[] = this.commands.filter(
      (cfg) =>
        event === cfg.event &&
        !this.isFileNameValid(documentUri, cfg.notMatch ?? null) &&
        this.isFileNameValid(documentUri, cfg.match ?? null)
    );

    if (commandConfigs.length === 0) {
      return;
    }

    this.showOutputMessage("");
    this.showOutputMessage("[Event handled] ...");
    const commands: ICommand[] = this.getCommandsByConfigs(commandConfigs, {
      documentUri,
      documentOldUri,
    });
    await this.runCommandsAsync(commands);
  }

  private runExecCommand(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(cmd, this.execOption, (error, stdout) => {
        if (error != null) {
          this.showOutputMessage(`[error] ${error}`);
          this.statusBar.showError();
          reject();
          return;
        }
        this.showOutputMessage(stdout as string);
        this.statusBar.showSuccess();
        resolve();
      });
    });
  }

  private async runProcessAsync({
    cmd,
    match,
    event,
    isAsync,
  }: ICommand): Promise<void> {
    const onFinishProcessHandler = (): void => {
      this.isRunProcess = false;
      this.showOutputMessage(`[${event}]: for pattern "${match}" finished`);
    };

    this.isRunProcess = true;

    if (isAsync) {
      this.runExecCommand(cmd).then(onFinishProcessHandler);
    } else {
      await this.runExecCommand(cmd);
      onFinishProcessHandler();
    }
  }

  private async runCommandsAsync(commands: ICommand[]): Promise<void> {
    for (const command of commands) {
      this.showOutputMessage(
        `[${command.event}] for pattern "${command.match}" started`
      );
      this.showOutputMessage(`[cmd] ${command.cmd}`);
      await this.runProcessAsync(command);
    }
  }
}

export default FileWatcher;
