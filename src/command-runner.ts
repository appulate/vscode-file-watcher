import * as vscode from "vscode";
import { exec } from "child_process";
import OutputChannel from "./output-channel";
import { isCmdShell, getClickableLinksInMsg } from "./utils";
import {
  ICommandValue,
  IExecOptions,
  Nullable,
  PreparedCommand,
  StatusType,
} from "./types";

type ProcessHandleFn = (command: PreparedCommand) => void;

interface IProcessHandlers {
  onStarted: ProcessHandleFn;
  onFinish: ProcessHandleFn;
}

class CommandRunner {
  public isRunProcess: boolean = false;

  public constructor(private outputChannel: OutputChannel) {}

  private resolveProcessSuccess(msg: string): StatusType {
    this.outputChannel.showMessage(getClickableLinksInMsg(msg));
    return StatusType.Success;
  }

  private resolveProcessError(msg: string): StatusType {
    this.outputChannel.showError(getClickableLinksInMsg(msg));
    return StatusType.Error;
  }

  private runShellProcess(
    cmdVal: string,
    execOptions: Nullable<IExecOptions>
  ): Promise<StatusType> {
    return new Promise((resolve) => {
      exec(cmdVal, execOptions, (_, stdout, stderr) => {
        const statusType: StatusType =
          stderr !== ""
            ? this.resolveProcessError(String(stderr))
            : this.resolveProcessSuccess(String(stdout));

        resolve(statusType);
      });
    });
  }

  private runVscodeTask(cmd: string | string[]): Promise<StatusType> {
    const [primaryCmd, ...restOptions] = [cmd].flat();
    return new Promise((resolve) => {
      vscode.commands
        .executeCommand<Nullable<string>>(primaryCmd, ...restOptions)
        .then(
          (fulfillMsg) => {
            resolve(this.resolveProcessSuccess(String(fulfillMsg ?? "")));
          },
          (rejectMsg) => {
            resolve(this.resolveProcessError(String(rejectMsg)));
          }
        );
    });
  }

  private runProcess(
    command: ICommandValue,
    execOptions: Nullable<IExecOptions>
  ): Promise<StatusType> {
    const { type, value } = command;
    if (isCmdShell(type, value)) {
      return this.runShellProcess(value, execOptions);
    }
    return this.runVscodeTask(value);
  }

  private runCommand(
    command: PreparedCommand,
    handlers: IProcessHandlers
  ): Promise<StatusType> {
    this.isRunProcess = true;
    handlers.onStarted(command);
    const proccessPromise: Promise<StatusType> = this.runProcess(
      command.cmd,
      command.execOptions
    );
    proccessPromise.finally(() => {
      this.isRunProcess = false;
      handlers.onFinish(command);
    });
    return proccessPromise;
  }

  public async runCommandsAsync(
    commands: PreparedCommand[],
    handlers: IProcessHandlers
  ): Promise<Array<StatusType | Promise<StatusType>>> {
    const proccessResult: Array<StatusType | Promise<StatusType>> = [];

    for (const command of commands) {
      const proccessPromise: Promise<StatusType> = this.runCommand(
        command,
        handlers
      );
      if (command.isAsync) {
        proccessResult.push(proccessPromise);
      } else {
        proccessResult.push(await proccessPromise);
      }
    }

    return proccessResult;
  }
}

export default CommandRunner;
