import * as vscode from "vscode";
import * as path from "path";
import { CommandType, IColors, ICommandValue, IDocumentUriMap } from "./types";

interface ICmdReplaceInfo {
  readonly pattern: RegExp;
  readonly replaceStr: string;
}

function getCmdReplaceInfo(
  documentUri: vscode.Uri,
  documentOldUri?: vscode.Uri
): ICmdReplaceInfo[] {
  const { fsPath } = documentUri;
  const workspaceRootPath: string =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  const currentWorkspacePath: string =
    vscode.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath ?? "";
  const extName: string = path.extname(fsPath);

  return [
    {
      pattern: /\${file}/,
      replaceStr: fsPath,
    },
    {
      pattern: /\${fileOld}/,
      replaceStr: documentOldUri?.fsPath ?? "",
    },
    {
      pattern: /\${workspaceRoot}/,
      replaceStr: workspaceRootPath,
    },
    {
      pattern: /\${workspaceRelativeDir}/,
      replaceStr: path.relative(workspaceRootPath, fsPath),
    },
    {
      pattern: /\${currentWorkspace}/,
      replaceStr: currentWorkspacePath,
    },
    {
      pattern: /\${currentRelativeWorkspace}/,
      replaceStr: path.relative(currentWorkspacePath, fsPath),
    },
    {
      pattern: /\${fileBasename}/,
      replaceStr: path.basename(fsPath),
    },
    {
      pattern: /\${fileDirname}/,
      replaceStr: path.dirname(fsPath),
    },
    {
      pattern: /\${fileExtname}/,
      replaceStr: extName,
    },
    {
      pattern: /\${fileBasenameNoExt}/,
      replaceStr: path.basename(fsPath, extName),
    },
  ];
}

export function getReplacedCmd(
  documentUriMap: IDocumentUriMap,
  cmd: string
): string {
  const { documentUri, documentOldUri } = documentUriMap;
  return getCmdReplaceInfo(documentUri, documentOldUri).reduce(
    (cmdResult, { pattern, replaceStr }) =>
      cmdResult.replace(new RegExp(pattern, "g"), replaceStr),
    cmd
  );
}

export function getThemeColors(
  defaultColor?: string | vscode.ThemeColor
): IColors {
  return {
    default: defaultColor,
    error: new vscode.ThemeColor("statusBarItem.errorBackground"),
    success: new vscode.ThemeColor("filewatcher.success"),
    run: new vscode.ThemeColor("filewatcher.run"),
  };
}

export function convertSingleUriToDocArr(uri: vscode.Uri): IDocumentUriMap[] {
  return [{ documentUri: uri }];
}

export function convertUriFiles(
  filesUri: readonly vscode.Uri[]
): IDocumentUriMap[] {
  return filesUri.map((uri) => ({ documentUri: uri }));
}

export function getClickableLinksInMsg(msg: string): string {
  const errorLinkRegex =
    /(?:file:\/\/\/)?([a-zA-Z]:(?:\/|\\)[^:"<>|?*\n]+):(\d+):(\d+)/g;
  return msg.replace(errorLinkRegex, (_, filePath, line, column) => {
    const uri: vscode.Uri = vscode.Uri.file(path.resolve(filePath)).with({
      fragment: `${line}:${column}`,
    });
    return `${filePath}:${line}:${column} (${String(uri)})`;
  });
}

export function isCmdShell(
  type: ICommandValue["type"],
  value: ICommandValue["value"]
): value is string {
  return type === CommandType.Shell && typeof value === "string";
}
