import { ChildProcess, exec } from "child_process";
import * as path from "path";
// import { trueCasePathSync } from "true-case-path";
import * as vscode from "vscode";
import StatusBar from "./status-bar";

export function activate(context: vscode.ExtensionContext): void {
	const extension: FileWatcherExtension = new FileWatcherExtension(context);
	extension.showEnabledState();

	vscode.workspace.onDidChangeConfiguration(() => {
		extension.loadConfig();
		extension.showStatusMessage("config reloaded");
		extension.showOutputMessage("[Config reloaded]");
	});

	vscode.commands.registerCommand("extension.enableFileWatcher", () => {
		extension.isEnabled = true;
	});

	vscode.commands.registerCommand("extension.disableFileWatcher", () => {
		extension.isEnabled = false;
	});

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		extension.eventHandler({ event: "onFileChange", documentUri: document.uri });
	});

	const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/*", false, false, false);

	watcher.onDidChange((uri: vscode.Uri) => {
		extension.eventHandler({ event: "onFolderChange", documentUri: uri });
	});
}

type EventType = "onFileChange" | "onFolderChange";
const baseChannelName = "File Watcher";

interface ICommand {
	match?: string;
	notMatch?: string;
	channelName?: string;
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
	documentUri: vscode.Uri;
}

class FileWatcherExtension {
	private _outputChannel: vscode.OutputChannel;
	private _context: vscode.ExtensionContext;
	private _config!: IConfig;
	private _statusBar: StatusBar;
	private _channelMap: Map<string, vscode.OutputChannel>;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		// this._outputChannel = vscode.window.createOutputChannel(baseChannelName);
		this._channelMap = new Map<string, vscode.OutputChannel>();
		this._outputChannel = this.GetOrCreateChannel(baseChannelName);
		this.loadConfig();
		this._statusBar = new StatusBar();
	}

	public GetOrCreateChannel(channelName: string): vscode.OutputChannel {
		let channel: vscode.OutputChannel | undefined = this._channelMap.get(channelName);
		if (channel == undefined) {
			channel = vscode.window.createOutputChannel(channelName);
			this._channelMap.set(channelName, channel);
		}

		return channel;
	}

	public loadConfig(): void {
		const configName: string[] = ["filewatcher", "appulateinc.filewatcher"].filter(name => {
			const commands: ICommand[] | undefined = vscode.workspace.getConfiguration(name).get<ICommand[]>("commands");
			return commands && commands.length > 0;
		});
		this._config = vscode.workspace.getConfiguration(configName[0]) as IConfig;
	}

	public showEnabledState(): void {
		this._outputChannel.appendLine(`File Watcher ${this.isEnabled ? "enabled" : "disabled"}.`);
	}

	/**
	 * Show message in output channel
	 */
	public showOutputMessage(message: string, channelList: Array<vscode.OutputChannel> | null = null): void {
		if (channelList == null) {
			this._outputChannel.appendLine(message);
			return;
		}
		for (let i = 0; i < channelList?.length; i++) {
			channelList[i].appendLine(message);
		}

	}

	/**
	 * Show message in status bar and output channel.
	 */
	public showStatusMessage(message: string): void {
		this._statusBar.showMessage(`FileWatcher: ${message}`);
	}

	public eventHandler({ event, documentUri }: IEventHandler): void {
		if (this.autoClearConsole) {
			this._outputChannel.clear();
		}

		if (!this.isEnabled) {
			return;
		}

		if (this.commands.length === 0) {
			this.showOutputMessage("[error] Settings sections are empty");
			return;
		}

		const isfileNameValid: (pattern: string) => boolean = (pattern: string) =>
			Boolean(pattern && new RegExp(pattern).test(documentUri.fsPath));

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

		this.showOutputMessage("");
		this.showOutputMessage("[Event handled] ...");

		// build our commands by replacing parameters with values
		const commands: ICommand[] = [];
		for (const cfg of commandConfigs) {
			let cmdStr: string = cfg.cmd;

			const extName: string = path.extname(documentUri.fsPath);
			const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
			const rootPath: string = workspaceFolders?.[0]?.uri.fsPath ?? "";
			const currentWorkspace: string = vscode.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath ?? "";

			cmdStr = cmdStr.replace(/\${file}/g, `${documentUri.fsPath}`);
			cmdStr = cmdStr.replace(/\${workspaceRoot}/g, `${rootPath}`);
			cmdStr = cmdStr.replace(/\${currentWorkspace}/g, `${currentWorkspace}`);
			cmdStr = cmdStr.replace(/\${fileBasename}/g, `${path.basename(documentUri.fsPath)}`);
			cmdStr = cmdStr.replace(/\${fileDirname}/g, `${path.dirname(documentUri.fsPath)}`);
			cmdStr = cmdStr.replace(/\${fileExtname}/g, `${extName}`);
			cmdStr = cmdStr.replace(/\${fileBasenameNoExt}/g, `${path.basename(documentUri.fsPath, extName)}`);

			commands.push({
				cmd: cmdStr,
				isAsync: !!cfg.isAsync,
				event,
				match: cfg.match,
				channelName: cfg.channelName
			});
		}

		this._runCommands(commands);
	}

	private _runCommands(commands: ICommand[]): void {
		if (commands.length) {
			const cfg: ICommand = commands.shift()!;
			

			let channelList: Array<vscode.OutputChannel> = [this._outputChannel];
			if (cfg.channelName && cfg.channelName.trim().length>0) {
				let newChannel = this.GetOrCreateChannel(baseChannelName + "-" + cfg.channelName.trim());
				channelList.push(newChannel);
			}

			this.showStatusMessage(cfg.event);

			this.showOutputMessage(`[${cfg.event}] for pattern "${cfg.match}" started`, channelList);
			this.showOutputMessage(`[cmd] ${cfg.cmd}`, channelList);

			const child: ChildProcess = exec(cfg.cmd, this._execOption);
			child.stdout?.on("data", data => {
				for(let i=0;i<channelList.length;i++){
					channelList[i].append(data);
				}
			});
			child.stderr?.on("data", data => {
				this.showOutputMessage(`[error] ${data}`, channelList);
				this._statusBar.showError();
			});
			child.on("exit", () => {

				this.showOutputMessage(`[${cfg.event}]: for pattern "${cfg.match}" finished`, channelList);
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
		this.showEnabledState();
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
