import * as vscode from "vscode";
import CommandRunner from "./command-runner";
import ConfigController from "./config-controller";
import OutputChannel from "./output-channel";
import StatusBar from "./status-bar";
import {
  IEventConfig,
  StatusType,
  PreparedCommand,
  PreparedConfig,
  Nullable,
  IPackage,
  PartialInitConfig,
} from "./types";

class FileWatcher {
  public outputChannel: OutputChannel = new OutputChannel();
  private packageJson: IPackage = this.context.extension.packageJSON;
  private name: string = this.packageJson.displayName;
  private version: string = this.packageJson.version;
  private configController: ConfigController = new ConfigController(
    this.packageJson.contributes.configuration
  );
  private commandRunner: CommandRunner = new CommandRunner(this.outputChannel);
  private statusBar: StatusBar = new StatusBar(
    () => this.commandRunner.isRunProcess
  );
  private eventRunPromise: Promise<void> = Promise.resolve();
  public constructor(private context: vscode.ExtensionContext) {
    this.isEnabled = true;
    this.loadConfig();
  }

  public loadConfig(): void {
    const config = vscode.workspace.getConfiguration(
      "filewatcher"
    ) as PartialInitConfig;
    if ((config.commands || []).length > 0) {
      const isLoad: boolean = this.configController.load(config);
      const preparedConfig: Nullable<PreparedConfig> =
        this.configController.data;
      if (this.configController.isPreparedConfig(isLoad, preparedConfig)) {
        this.statusBar.loadConfig({
          isClearStatusBar: preparedConfig.isClearStatusBar,
          statusBarDelay: preparedConfig.statusBarDelay,
          successColor: preparedConfig.successTextColor,
          runColor: preparedConfig.runTextColor,
        });
        this.outputChannel.showConfigReload();
        this.statusBar.showConfigReload();
      } else {
        this.showConfigError();
      }
    }
  }

  private showConfigError(): void {
    const { errorMessage } = this.configController;
    if (errorMessage != null) {
      this.outputChannel.showError(errorMessage);
    }
    this.statusBar.showError();
  }

  public get isEnabled(): boolean {
    return Boolean(this.context.globalState.get("isEnabled", true));
  }

  public set isEnabled(value: boolean) {
    this.context.globalState.update("isEnabled", value);
    this.outputChannel.showEnabledState({
      name: this.name,
      version: this.version,
      isEnable: this.isEnabled,
    });
  }

  private get isAutoClearConsole(): boolean {
    return (
      !this.commandRunner.isRunProcess && this.configController.isClearConsole
    );
  }

  private getProcessHandlers() {
    return {
      onStarted: (command: PreparedCommand) => {
        this.statusBar.showRun();
        this.outputChannel.showProcess(command, "started");
        this.outputChannel.showTask(command.cmd);
      },
      onFinish: (command: PreparedCommand) => {
        this.outputChannel.showProcess(command, "finished");
      },
    };
  }

  private async showStatusResultAsync(
    statusResultPromise: Array<StatusType | Promise<StatusType>>
  ): Promise<void> {
    if (statusResultPromise.length > 0) {
      const commandsResult: StatusType[] = await Promise.all(
        statusResultPromise
      );
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

      for (const documentMapUri of documentsUri) {
        const validCommands: PreparedCommand[] =
          this.configController.getValidCommandsByEvent(event, documentMapUri);
        if (validCommands.length > 0) {
          if (this.isAutoClearConsole) {
            this.outputChannel.clear();
          }
          this.outputChannel.showHandleMessage();
          const statusTypes = await this.commandRunner.runCommandsAsync(
            validCommands,
            this.getProcessHandlers()
          );
          statusResult.push(...statusTypes);
        }
      }

      await this.showStatusResultAsync(statusResult);
      resolve();
    });
  }

  public async eventHandlerAsync(eventConfig: IEventConfig): Promise<void> {
    if (!this.isEnabled || !this.configController.isValidConfig) {
      return;
    }
    if (this.configController.isSyncRunEvents) {
      await this.eventRunPromise;
    }

    this.eventRunPromise = this.runEventHandleAsync(eventConfig);
  }
}

export default FileWatcher;
