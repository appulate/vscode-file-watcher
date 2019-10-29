"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path = require("path");
const vscode = require("vscode");
function activate(context) {
    const extension = new FileWatcherExtension(context);
    extension.showOutputMessage();
    vscode.workspace.onDidChangeConfiguration(() => {
        const disposeStatus = extension.showStatusMessage("File Watcher: Reloading config.");
        extension.loadConfig();
        disposeStatus.dispose();
    });
    vscode.commands.registerCommand("extension.enableFileWatcher", () => {
        extension.isEnabled = true;
    });
    vscode.commands.registerCommand("extension.disableFileWatcher", () => {
        extension.isEnabled = false;
    });
    vscode.workspace.onDidSaveTextDocument((document) => {
        extension.eventHandler({ event: "onFileChange", fileName: document.fileName });
    });
    const watcher = vscode.workspace.createFileSystemWatcher("**/*", false, false, false);
    watcher.onDidChange((uri) => {
        extension.eventHandler({ event: "onFolderChange", fileName: uri.fsPath });
    });
}
exports.activate = activate;
class FileWatcherExtension {
    constructor(context) {
        this._context = context;
        this._outputChannel = vscode.window.createOutputChannel("File Watcher");
        this.loadConfig();
    }
    loadConfig() {
        this._config = vscode.workspace.getConfiguration("appulateinc.filewatcher");
    }
    /**
     * Show message in output channel
     */
    showOutputMessage(message) {
        message = message || `File Watcher ${this.isEnabled ? "enabled" : "disabled"}.`;
        this._outputChannel.appendLine(message);
    }
    /**
     * Show message in status bar and output channel.
     * Return a disposable to remove status bar message.
     */
    showStatusMessage(message) {
        this.showOutputMessage(message);
        return vscode.window.setStatusBarMessage(message);
    }
    eventHandler({ event, fileName }) {
        if (this.autoClearConsole) {
            this._outputChannel.clear();
        }
        if (!this.isEnabled || this.commands.length === 0) {
            this.showOutputMessage();
            return;
        }
        const isfileNameValid = (pattern) => Boolean(pattern && new RegExp(pattern).test(fileName));
        const commandConfigs = this.commands
            .filter(cfg => {
            const matchPattern = cfg.match || "";
            const negatePattern = cfg.notMatch || "";
            const eventName = cfg.event || "";
            const isMatch = matchPattern.length === 0 || isfileNameValid(matchPattern);
            const isNegate = negatePattern.length > 0 && isfileNameValid(negatePattern);
            const isValidEvent = eventName === event;
            return !isNegate && isMatch && isValidEvent;
        });
        if (commandConfigs.length === 0) {
            return;
        }
        this.showStatusMessage("Running commands...");
        // build our commands by replacing parameters with values
        const commands = [];
        for (const cfg of commandConfigs) {
            let cmdStr = cfg.cmd;
            const extName = path.extname(fileName);
            cmdStr = cmdStr.replace(/\${file}/g, `${fileName}`);
            cmdStr = cmdStr.replace(/\${workspaceRoot}/g, `${vscode.workspace.rootPath}`);
            cmdStr = cmdStr.replace(/\${fileBasename}/g, `${path.basename(fileName)}`);
            cmdStr = cmdStr.replace(/\${fileDirname}/g, `${path.dirname(fileName)}`);
            cmdStr = cmdStr.replace(/\${fileExtname}/g, `${extName}`);
            cmdStr = cmdStr.replace(/\${fileBasenameNoExt}/g, `${path.basename(fileName, extName)}`);
            commands.push({
                cmd: cmdStr,
                isAsync: !!cfg.isAsync,
                event
            });
        }
        this._runCommands(commands);
    }
    _runCommands(commands) {
        if (commands.length) {
            const cfg = commands.shift();
            this.showOutputMessage(`*** cmd start: ${cfg.cmd}`);
            const child = child_process_1.exec(cfg.cmd, this._execOption);
            child.stdout.on("data", data => this._outputChannel.append(data));
            child.stderr.on("data", data => this._outputChannel.append(data));
            child.on("exit", () => {
                if (!cfg.isAsync) {
                    this._runCommands(commands);
                }
            });
            if (cfg.isAsync) {
                this._runCommands(commands);
            }
        }
        else {
            this.showStatusMessage("File Watcher done.");
        }
    }
    get _execOption() {
        return this.shell ? { shell: this.shell } : null;
    }
    get isEnabled() {
        return !!this._context.globalState.get("isEnabled", true);
    }
    set isEnabled(value) {
        this._context.globalState.update("isEnabled", value);
        this.showOutputMessage();
    }
    get shell() {
        return this._config.shell;
    }
    get autoClearConsole() {
        return !!this._config.autoClearConsole;
    }
    get commands() {
        return this._config.commands || [];
    }
}
//# sourceMappingURL=extension.js.map