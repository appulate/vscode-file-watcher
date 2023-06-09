import * as vscode from "vscode";
import ConfigValidator from "./config-validator";
import { getReplacedCmd, isCmdShell } from "./utils";
import {
  CommandType,
  ICommandValue,
  IDocumentUriMap,
  IExecOptions,
  InitConfig,
  Nullable,
  PartialInitCommand,
  PreparedCommand,
  PreparedConfig,
  Event,
  ValidCommand,
  IPackageConfigSchema,
  PartialInitConfig,
} from "./types";

class ConfigController {
  public data: Nullable<PreparedConfig> = null;
  public validator: ConfigValidator;

  public constructor(packageConfigSchema: IPackageConfigSchema) {
    this.validator = new ConfigValidator(packageConfigSchema);
  }

  private getPreparedCmd(
    cmd: ValidCommand["cmd"] = "",
    task: ValidCommand["vscodeTask"] = ""
  ): ICommandValue {
    const isCmd: boolean = Boolean(cmd);
    return {
      type: isCmd ? CommandType.Shell : CommandType.Vscode,
      value: isCmd ? cmd : task,
    };
  }

  private getPreparedCommands(
    commands: ValidCommand[],
    commonShell: InitConfig<PartialInitCommand>["shell"]
  ): PreparedCommand[] {
    const prepareCommand = (command: ValidCommand): PreparedCommand => {
      const {
        shell: commandShell,
        isAsync,
        vscodeTask,
        cmd,
        ...restOptions
      } = command;
      const shell: string | undefined = commandShell || commonShell;
      const execOptions: Nullable<IExecOptions> = shell ? { shell } : null;

      return {
        ...restOptions,
        cmd: this.getPreparedCmd(cmd, vscodeTask),
        isAsync: Boolean(isAsync),
        execOptions,
      };
    };

    return commands.map(prepareCommand);
  }

  private getPreparedConfig(config: InitConfig<ValidCommand>): PreparedConfig {
    return {
      ...config,
      commands: this.getPreparedCommands(config.commands, config.shell),
    };
  }

  private isFileNameValid(documentUri: vscode.Uri, pattern?: string): boolean {
    return pattern != undefined && new RegExp(pattern).test(documentUri.fsPath);
  }

  public isPreparedConfig(
    isLoad: boolean,
    config: Nullable<PreparedConfig>
  ): config is PreparedConfig {
    return isLoad && config != null;
  }

  public get isClearConsole(): boolean {
    return this.data?.autoClearConsole === true;
  }

  public get isSyncRunEvents(): boolean {
    return this.data?.isSyncRunEvents === true;
  }

  public get isCommands(): boolean {
    return (this.data?.commands || []).length > 0;
  }

  public get isValidConfig(): boolean {
    return this.validator.isValid;
  }

  public get errorMessage(): Nullable<string> {
    return this.validator.errorMessage;
  }

  private getCommandsByReplacedCmd(
    commands: PreparedCommand[],
    documentUriMap: IDocumentUriMap
  ): PreparedCommand[] {
    function replaceCmd(command: PreparedCommand): PreparedCommand {
      const { cmd, ...restConfig } = command;
      const { type, value } = cmd;
      const cmdValResult: string | string[] = isCmdShell(type, value)
        ? getReplacedCmd(documentUriMap, value)
        : value;
      return {
        ...restConfig,
        cmd: {
          type,
          value: cmdValResult,
        },
      };
    }

    return commands.map(replaceCmd);
  }

  public getValidCommandsByEvent(
    event: Event,
    documentUriMap: IDocumentUriMap
  ): PreparedCommand[] {
    const isValidCommand = (command: PreparedCommand): boolean => {
      return (
        event === command.event &&
        !this.isFileNameValid(documentUriMap.documentUri, command.notMatch) &&
        this.isFileNameValid(documentUriMap.documentUri, command.match)
      );
    };

    const commandsByEvent: PreparedCommand[] =
      this.data?.commands.filter(isValidCommand) ?? [];

    return this.getCommandsByReplacedCmd(commandsByEvent, documentUriMap);
  }

  public load(config: PartialInitConfig): boolean {
    if (this.validator.validate(config)) {
      this.data = this.getPreparedConfig(config);
      return true;
    }
    return false;
  }
}

export default ConfigController;
