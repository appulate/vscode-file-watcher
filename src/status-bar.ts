import * as vscode from "vscode";
import { getThemeColors } from "./utils";
import { IColors, RegisterCommands } from "./types";

enum StatusIcon {
  Primary = "$(telescope)",
  Loading = "$(loading~spin)",
}

interface IStatusBarConfig {
  readonly isClearStatusBar: boolean;
  readonly statusBarDelay: number;
  readonly successColor: string;
  readonly runColor: string;
}

const STATUS_DELAY_DEFAULT: number = 5000;
const PRIORITY_SHOW: number = 1000;

export default class StatusBar {
  private statusBarItem: vscode.StatusBarItem =
    vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      PRIORITY_SHOW
    );
  private defaultColors: IColors = getThemeColors(this.statusBarItem.color);
  private colors: IColors = { ...this.defaultColors };
  private delay!: number;
  private isAutoClear!: boolean;

  public constructor(private isRunProcess: () => boolean) {
    this.initStatusBar();
  }

  public loadConfig({
    isClearStatusBar,
    statusBarDelay,
    successColor,
    runColor,
  }: Partial<IStatusBarConfig>): void {
    this.isAutoClear = Boolean(isClearStatusBar);
    this.delay = statusBarDelay || STATUS_DELAY_DEFAULT;
    this.colors.success = successColor
      ? successColor
      : this.defaultColors.success;
    this.colors.run = runColor ? runColor : this.defaultColors.run;
  }
  private showMessage(message: string): void {
    this.statusBarItem.text = message;
  }

  public showConfigReload(): void {
    this.normalizeStatusBar(false);
    this.showMessage(`${StatusIcon.Primary} ~ config reloaded`);
  }

  private setStatusBarColor(color?: vscode.ThemeColor | string): void {
    this.statusBarItem.color = color;
  }

  private setStatusBarBackground(color?: vscode.ThemeColor | string): void {
    this.statusBarItem.backgroundColor = color;
  }

  private normalizeStatusBar(isIcon = true): void {
    this.setStatusBarBackground(this.colors.default);
    this.setStatusBarColor(this.colors.default);
    if (isIcon) {
      this.showMessage(StatusIcon.Primary);
    }
  }

  private normalizeStatusWithDelay(): void {
    setTimeout(() => {
      if (!this.isRunProcess()) {
        this.normalizeStatusBar();
      }
    }, this.delay);
  }

  public showRun(): void {
    this.setStatusBarBackground(this.colors.default);
    this.setStatusBarColor(this.colors.run);
    this.showMessage(`${StatusIcon.Loading} Watcher Run...`);
  }

  public showSuccess(): void {
    this.setStatusBarBackground(this.colors.default);
    this.setStatusBarColor(this.colors.success);
    this.showMessage(`${StatusIcon.Primary} Success`);
    if (this.isAutoClear) {
      this.normalizeStatusWithDelay();
    }
  }

  public showError(): void {
    this.setStatusBarBackground(this.colors.error);
    this.showMessage(`${StatusIcon.Primary} Error`);
    if (this.isAutoClear) {
      this.normalizeStatusWithDelay();
    }
  }

  private initStatusBar(): void {
    this.normalizeStatusBar();
    this.statusBarItem.show();
    this.statusBarItem.command = RegisterCommands.FocusOutput;
  }
}
