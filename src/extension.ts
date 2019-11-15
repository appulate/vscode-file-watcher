import { ChildProcess, exec } from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { trueCasePathSync } from "true-case-path";

export function activate(context: vscode.ExtensionContext): void {
	const extension: FileWatcherExtension = new FileWatcherExtension(context);
	extension.showOutputMessage();

	vscode.workspace.onDidChangeConfiguration(() => {
		extension.showStatusMessage("File Watcher: Reloading config.");
		extension.loadConfig();
	});

	vscode.commands.registerCommand("extension.enableFileWatcher", () => {
		extension.isEnabled = true;
	});

	vscode.commands.registerCommand("extension.disableFileWatcher", () => {
		extension.isEnabled = false;
	});

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		extension.eventHandler({ event: "onFileChange", fileName: trueCasePathSync(document.fileName) });
	});

	const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

	watcher.onDidChange((uri: vscode.Uri) => {
		extension.eventHandler({ event: "onFolderChange", fileName: trueCasePathSync(uri.fsPath) });
	});
}

type EventType = "onFileChange" | "onFolderChange";

interface ICommand {
	match?: string;
	notMatch?: string;
	cmd: string;
	isAsync: boolean;
	event: EventType;
}

interface IConfig extends vscode.WorkspaceConfiguration {
	shell: string;
	autoClearConsole: boolean;
	commands: ICommand[];
}

interface IEventHandler {
	event: EventType;
	fileName: string;
}

class FileWatcherExtension {
	private _outputChannel: vscode.OutputChannel;
	private _context: vscode.ExtensionContext;
	private _config!: IConfig;	
	private _statusBarItem: vscode.StatusBarItem;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._outputChannel = vscode.window.createOutputChannel("File Watcher");
		this.loadConfig();
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
	}
	
	public loadConfig(): void {
		const configName = ["filewatcher", "appulateinc.filewatcher"].filter(name => {
			const commands = vscode.workspace.getConfiguration(name).get<ICommand[]>("commands");
			return commands && commands.length > 0;
		});
		this._config = vscode.workspace.getConfiguration(configName[0]) as IConfig;
	}

	/**
	 * Show message in output channel
	 */
	public showOutputMessage(message?: string): void {
		message = message || `File Watcher ${this.isEnabled ? "enabled" : "disabled"}.`;
		this._outputChannel.appendLine(message);
	}

	/**
	 * Show message in status bar
	 */
	public showStatusBarError(): void {
		const stopIcon = "$(stop)";
		this._statusBarItem.color = new vscode.ThemeColor("filewatcher.error");
		this._statusBarItem.text = `${stopIcon} File Watcher Error`;
		this._statusBarItem.show();
	}

	/**
	 * Show message in status bar and output channel.
	 * Return a disposable to remove status bar message.
	 */
	public showStatusMessage(message: string): void {
		this.showOutputMessage(message);
		this._statusBarItem.color = "white";		
		this._statusBarItem.text = message;
		this._statusBarItem.show();
	}

	public eventHandler({ event, fileName }: IEventHandler): void {
		if (this.autoClearConsole) {
			this._outputChannel.clear();
		}

		if (!this.isEnabled || this.commands.length === 0) {
			this.showOutputMessage();
			return;
		}

		const isfileNameValid: (pattern: string) => boolean = (pattern: string) =>
			Boolean(pattern && new RegExp(pattern).test(fileName));

		const commandConfigs: ICommand[] = this.commands
			.filter(cfg => {
				const matchPattern: string = cfg.match || "";
				const negatePattern: string = cfg.notMatch || "";
				const eventName: string = cfg.event || "";

				const isMatch: boolean = matchPattern.length === 0 || isfileNameValid(matchPattern);
				const isNegate: boolean = negatePattern.length > 0 && isfileNameValid(negatePattern);
				const isValidEvent: boolean = eventName === event;

				return !isNegate && isMatch && isValidEvent;
			});

		if (commandConfigs.length === 0) {
			return;
		}
		
		this.showStatusMessage("[Event handled]....");
		
		// build our commands by replacing parameters with values
		const commands: ICommand[] = [];
		for (const cfg of commandConfigs) {
			let cmdStr: string = cfg.cmd;

			const extName: string = path.extname(fileName);
			const rootPath = trueCasePathSync(vscode.workspace.rootPath || "");

			cmdStr = cmdStr.replace(/\${file}/g, `${fileName}`);
			cmdStr = cmdStr.replace(/\${workspaceRoot}/g, `${rootPath}`);			
			cmdStr = cmdStr.replace(/\${fileBasename}/g, `${path.basename(fileName)}`);
			cmdStr = cmdStr.replace(/\${fileDirname}/g, `${path.dirname(fileName)}`);
			cmdStr = cmdStr.replace(/\${fileExtname}/g, `${extName}`);
			cmdStr = cmdStr.replace(/\${fileBasenameNoExt}/g, `${path.basename(fileName, extName)}`);

			commands.push({
				cmd: cmdStr,
				isAsync: !!cfg.isAsync,
				event,
				match: cfg.match
			});
		}

		this._runCommands(commands);
	}

	private _runCommands(commands: ICommand[]): void {
		if (commands.length) {
			const cfg: ICommand = commands.shift()!;

			this.showOutputMessage(`[${cfg.event}] for pattern "${cfg.match}" started`);
			this.showOutputMessage(`[cmd] ${cfg.cmd}`);

			const child: ChildProcess = exec(cfg.cmd, this._execOption);
			child.stdout?.on("data", data => this._outputChannel.append(data));
			child.stderr?.on("data", data => {
				this.showOutputMessage(`[error] ${data}`);
				this.showStatusBarError();
			});
			child.on("exit", () => {
				this.showOutputMessage(`[${cfg.event}]: for pattern "${cfg.match}" finished`);
				if (!cfg.isAsync) {
					this._runCommands(commands);
				}
			});

			if (cfg.isAsync) {
				this._runCommands(commands);
			}
		}
	}

	private get _execOption(): { shell: string } | null {
		return this.shell ? { shell: this.shell } : null;
	}

	public get isEnabled(): boolean {
		return !!this._context.globalState.get("isEnabled", true);
	}
	public set isEnabled(value: boolean) {
		this._context.globalState.update("isEnabled", value);
		this.showOutputMessage();
	}

	public get shell(): string {
		return this._config.shell;
	}

	public get autoClearConsole(): boolean {
		return !!this._config.autoClearConsole;
	}

	public get commands(): ICommand[] {
		return this._config.commands || [];
	}
}
