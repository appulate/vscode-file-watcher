import * as vscode from "vscode";

const STATUS_DELAY: number = 5000;

export default class StatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private delay: number;
  private errorColor: vscode.ThemeColor;
  private successColor: vscode.ThemeColor;
  private defaultColor: vscode.ThemeColor;

  constructor() {
    const priority: number = 1000;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      priority
    );
    this.delay = STATUS_DELAY;
    this.defaultColor = new vscode.ThemeColor("filewatcher.default");
    this.errorColor = new vscode.ThemeColor("filewatcher.error");
    this.successColor = new vscode.ThemeColor("filewatcher.success");
    this.initStatusBar();
  }

  public showMessage(message: string): void {
    this.statusBarItem.text = message;
  }

  public setStatusBarColor(color: vscode.ThemeColor): void {
    this.statusBarItem.color = color;
  }

  private normalizeStatusBar(): Promise<void> {
    return new Promise((res) => {
      setTimeout(() => {
        this.setStatusBarColor(this.defaultColor);
        this.showMessage("File Watcher");
        res();
      }, this.delay);
    });
  }

  public showSuccess(): void {
    const successIcon: string = "$(check)";
    this.setStatusBarColor(this.successColor);
    this.showMessage(`${successIcon} File Watcher Success`);
    this.normalizeStatusBar();
  }

  public showError(): void {
    const stopIcon: string = "$(stop)";
    this.setStatusBarColor(this.errorColor);
    this.showMessage(`${stopIcon} File Watcher Error`);
    this.normalizeStatusBar();
  }

  public initStatusBar(): void {
    this.normalizeStatusBar().then(() => this.statusBarItem.show());
  }
}
