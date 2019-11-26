import * as vscode from "vscode";

export default class StatusBar {
	private _statusBarItem: vscode.StatusBarItem;
	private _errorColor: vscode.ThemeColor;
	private _normalColor: string | vscode.ThemeColor | undefined;

	constructor() {
		const priority: number = 1000;
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
		this._errorColor = new vscode.ThemeColor("filewatcher.error");
		this._normalColor = this._statusBarItem.color;
	}
	/**
	 * Show message in status bar
	 */
	public showMessage(message: string): void {
		this._statusBarItem.color = this._normalColor;
		this._statusBarItem.text = message;
		this._statusBarItem.show();
	}
	/**
	 * Show error in status bar
	 */
	public showError(): void {
		const stopIcon: string = "$(stop)";
		this._statusBarItem.color = this._errorColor;
		this._statusBarItem.text = `${stopIcon} File Watcher Error`;
		this._statusBarItem.show();
	}
}
