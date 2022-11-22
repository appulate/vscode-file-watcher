import { exec } from "child_process";
import * as vscode from "vscode";
import StatusBar from "./status-bar";
import {
  ICommand,
  ICommandValue,
  IEventConfig,
  IPartialCommand,
  IDocumentUriMap,
  StatusType,
  IConfig,
} from "./types";
import { getReplacedCmd } from "./utils";

class FileWatcher {
  private outputChannel: vscode.OutputChannel =
    vscode.window.createOutputChannel("File Watcher");
  private config!: Partial<IConfig>;
  private isRunProcess: boolean = false;
  public statusBar: StatusBar = new StatusBar(() => this.isRunProcess);
  private eventRunPromise: Promise<void> = Promise.resolve();

  public constructor(private context: vscode.ExtensionContext) {
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
      return commands !== undefined && commands.length > 0;
    });

    const workspaceConfig = vscode.workspace.getConfiguration(
      configName[0]
    ) as Partial<IConfig>;

    this.config = {
        ...workspaceConfig,
        commands: workspaceConfig.commands?.map(command => {
            return {
                ...command,
                ...(typeof command.cmd === "string" && {
                    cmd: {
                        type: "shell",
                        value: command.cmd
                    }
                })
            };
        })
    };

    this.statusBar.loadConfig({
      isClearStatusBar: Boolean(this.config.isClearStatusBar),
      statusBarDelay: this.config.statusBarDelay,
    });
  }

  public showEnabledState(): void {
    this.showOutputMessage(
      `File Watcher ${this.isEnabled ? "enabled" : "disabled"}.`
    );
  }

  public get isEnabled(): boolean {
    return Boolean(this.context.globalState.get("isEnabled", true));
  }

  public set isEnabled(value: boolean) {
    this.context.globalState.update("isEnabled", value);
    this.showEnabledState();
  }

  private get execOption(): { shell: string } | null {
    const shell: string | undefined = this.config.shell;
    return shell ? { shell } : null;
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

  private isFileNameValid(documentUri: vscode.Uri, pattern?: string): boolean {
    return pattern != undefined && new RegExp(pattern).test(documentUri.fsPath);
  }

  private getCommandsByConfigs(
    commandConfigs: IPartialCommand[],
    documentUriMap: IDocumentUriMap
  ): ICommand[] {
    return commandConfigs.reduce((commands: ICommand[], config) => {
      const { cmd, event, match, isAsync } = config;
      if (cmd != undefined && event != undefined && match != undefined) {
        commands.push({
          cmd: {
            ...<ICommandValue>cmd,
            value: getReplacedCmd(documentUriMap, (<ICommandValue> cmd).value)
          },
          isAsync: Boolean(isAsync),
          event,
          match,
        });
      }
      return commands;
    }, []);
  }

  private onStartedProcessHandler({ event, cmd, match }: ICommand): void {
    this.isRunProcess = true;
    this.statusBar.showRun();
    this.showOutputMessage(`[${event}] for pattern "${match}" started`);
    this.showOutputMessage(`[cmd] ${cmd}`);
  }

  private onFinishProcessHandler({ event, match }: ICommand): void {
    this.isRunProcess = false;
    this.showOutputMessage(`[${event}]: for pattern "${match}" finished`);
  }

  private async runProcessAsync(cmd: ICommandValue): Promise<StatusType> {
    return new Promise(async (resolve) => {

      if (cmd.type == "shell") {
        exec(cmd.value, this.execOption, (_, stdout, stderr) => {
        if (stderr != "") {
          this.showOutputMessage(`[error] ${stderr}`);
          resolve(StatusType.Error);
          return;
        }
        this.showOutputMessage(stdout as string);
        resolve(StatusType.Success);
      });
      } else {
        await vscode.commands.executeCommand(cmd.value).then(message => {
            this.showOutputMessage(message as string);
            resolve(StatusType.Success);
        },
        message => {
            this.showOutputMessage(`[error] ${message}`);
            resolve(StatusType.Error);
        });
      }
    });
  }

  private async runCommandsAsync(
    commands: ICommand[]
  ): Promise<Array<StatusType | Promise<StatusType>>> {
    const commandsResult: Array<StatusType | Promise<StatusType>> = [];

    for (const command of commands) {
      this.onStartedProcessHandler(command);
      const proccessPromise: Promise<StatusType> = this.runProcessAsync(
        <ICommandValue> command.cmd
      );
      proccessPromise.finally(() => this.onFinishProcessHandler(command));

      if (command.isAsync) {
        commandsResult.push(proccessPromise);
      } else {
        commandsResult.push(await proccessPromise);
      }
    }

    return commandsResult;
  }

  private async showStatusResultAsync(
    statusResultPromise: Array<StatusType | Promise<StatusType>>
  ): Promise<void> {
    if (statusResultPromise.length > 0) {
      const commandsResult: string[] = await Promise.all(statusResultPromise);
      if (commandsResult.includes(StatusType.Error)) {
        this.statusBar.showError();
      } else {
        this.statusBar.showSuccess();
      }
    }
  }

  private async runEventHandleAsync({
    event,
    documentsUri,
  }: IEventConfig): Promise<void> {
    return new Promise(async (resolve) => {
      const statusResult: Array<StatusType | Promise<StatusType>> = [];

      for (const { documentUri, documentOldUri } of documentsUri) {
        const commandConfigs: IPartialCommand[] = this.commands.filter(
          (cfg) =>
            event === cfg.event &&
            !this.isFileNameValid(documentUri, cfg.notMatch) &&
            this.isFileNameValid(documentUri, cfg.match)
        );

        if (commandConfigs.length === 0) {
          continue;
        }

        this.showOutputMessage("");
        this.showOutputMessage("[Event handled] ...");
        const commands: ICommand[] = this.getCommandsByConfigs(commandConfigs, {
          documentUri,
          documentOldUri,
        });
        statusResult.push(...(await this.runCommandsAsync(commands)));
      }

      await this.showStatusResultAsync(statusResult);
      resolve();
    });
  }

  public async eventHandlerAsync(eventConfig: IEventConfig): Promise<void> {
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

    if (Boolean(this.config.isSyncRunEvents)) {
      await this.eventRunPromise;
    }

    this.eventRunPromise = this.runEventHandleAsync(eventConfig);
  }
}

export default FileWatcher;
