import * as vscode from "vscode";
import {
  EnabledState,
  ICommandValue,
  OutputReservedKeys,
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
    this.showMessage(`${OutputReservedKeys.Error} ${message}`);
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
    this.showMessage(OutputReservedKeys.Reload);
  }

  public showHandleMessage(): void {
    this.showMessage("");
    this.showMessage(`${OutputReservedKeys.EventHandled} ...`);
  }

  public showProcess(
    { event, match }: PreparedCommand,
    processType: "started" | "finished"
  ): void {
    this.showMessage(`[${event}] for pattern "${match}" ${processType}`);
  }

  public showTask({ type, value }: ICommandValue): void {
    const taskType: OutputReservedKeys = isCmdShell(type, value)
      ? OutputReservedKeys.Cmd
      : OutputReservedKeys.Task;
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
