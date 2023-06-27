import * as vscode from "vscode";
import {
  EnabledState,
  ICommandValue,
  OutputReservedKey,
  PreparedCommand,
} from "./types";
import { isCmdShell } from "./utils";

class OutputChannel {
  private channel: vscode.OutputChannel =
    vscode.window.createOutputChannel("File Watcher");

  public showMessage(message: string): void {
    this.channel.appendLine(message);
  }

  public showError(message: string): void {
    this.showMessage(`${OutputReservedKey.Error} ${message}`);
  }

  public showEnabledState({
    version,
    name,
    isEnable,
  }: {
    version: string;
    name: string;
    isEnable: boolean;
  }): void {
    const stateType: EnabledState = isEnable
      ? EnabledState.Enable
      : EnabledState.Disable;
    this.showMessage(`${name} ${version} is ${stateType}.`);
  }

  public showConfigReload(): void {
    this.showMessage(OutputReservedKey.Reload);
  }

  public showHandleMessage(): void {
    this.showMessage("");
    this.showMessage(`${OutputReservedKey.EventHandled} ...`);
  }

  public showProcess(
    { event, match }: PreparedCommand,
    processType: "started" | "finished"
  ): void {
    this.showMessage(`[${event}] for pattern "${match}" ${processType}`);
  }

  public showTask({ type, value }: ICommandValue): void {
    const taskType: OutputReservedKey = isCmdShell(type, value)
      ? OutputReservedKey.Cmd
      : OutputReservedKey.Task;
    this.showMessage(`${taskType} ${value}`);
  }

  public showChannel(): void {
    this.channel.show(true);
  }

  public clear(): void {
    this.channel.clear();
  }
}

export default OutputChannel;
