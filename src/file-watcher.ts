import { ChildProcess, exec } from "child_process";
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
      return commands && commands.length > 0;
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

  public eventHandler({
    event,
    documentUri,
    documentOldUri,
  }: IEventHandler): void {
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
    this.runCommands(commands);
  }

  private runProcess(command: ICommand, commands: ICommand[]) {
    const child: ChildProcess = exec(command.cmd, this.execOption);
    this.isRunProcess = true;

    child.stdout?.on("data", (data) => {
      this.showOutputMessage(data);
      this.statusBar.showSuccess();
    });
    child.stderr?.on("data", (data) => {
      this.showOutputMessage(`[error] ${data}`);
      this.statusBar.showError();
    });
    child.on("exit", () => {
      this.isRunProcess = false;
      this.showOutputMessage(
        `[${command.event}]: for pattern "${command.match}" finished`
      );
      if (!command.isAsync) {
        this.runCommands(commands);
      }
    });
  }

  private runCommands(commands: ICommand[]): void {
    if (commands.length > 0) {
      const command: ICommand = commands.shift()!;

      this.showOutputMessage(
        `[${command.event}] for pattern "${command.match}" started`
      );
      this.showOutputMessage(`[cmd] ${command.cmd}`);
      this.runProcess(command, commands);

      if (command.isAsync) {
        this.runCommands(commands);
      }
    }
  }
}

export default FileWatcher;
