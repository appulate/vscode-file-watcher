import * as vscode from "vscode";
import { IColors } from "./types";
import { getThemeColors } from "./utils";

const STATUS_DELAY_DEFAULT: number = 5000;
const PRIORITY_SHOW: number = 1000;

export default class StatusBar {
  private statusBarItem: vscode.StatusBarItem =
    vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      PRIORITY_SHOW
    );
  private colors: IColors = getThemeColors(this.statusBarItem.color);
  private delay!: number;
  private isClear!: boolean;

  constructor(private isRunProcess: () => boolean) {
    this.initStatusBar();
  }

  public loadConfig({
    isClearStatusBar,
    statusBarDelay,
  }: {
    isClearStatusBar: boolean;
    statusBarDelay?: number;
  }): void {
    this.isClear = isClearStatusBar;
    this.delay = statusBarDelay || STATUS_DELAY_DEFAULT;
  }

  public showMessage(message: string): void {
    this.statusBarItem.text = message;
  }

  private setStatusBarColor(color?: vscode.ThemeColor): void {
    this.statusBarItem.color = color;
  }

  public normalizeStatusBar(): void {
    this.setStatusBarColor(this.colors.defaultColor);
    this.showMessage("File Watcher");
  }

  private normalizeStatusWithDelay(): void {
    setTimeout(() => {
      if (!this.isRunProcess()) {
        this.normalizeStatusBar();
      }
    }, this.delay);
  }

  public showRun(): void {
    const runIcon: string = "$(pulse)";
    this.setStatusBarColor(this.colors.runColor);
    this.showMessage(`${runIcon} File Watcher Run...`);
  }

  public showSuccess(): void {
    const successIcon: string = "$(check)";
    this.setStatusBarColor(this.colors.successColor);
    this.showMessage(`${successIcon} File Watcher Success`);
    if (this.isClear) {
      this.normalizeStatusWithDelay();
    }
  }

  public showError(): void {
    const stopIcon: string = "$(stop)";
    this.setStatusBarColor(this.colors.errorColor);
    this.showMessage(`${stopIcon} File Watcher Error`);
    if (this.isClear) {
      this.normalizeStatusWithDelay();
    }
  }

  private initStatusBar(): void {
    this.normalizeStatusBar();
    this.statusBarItem.show();
  }
}
