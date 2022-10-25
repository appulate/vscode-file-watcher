import * as vscode from "vscode";
import * as path from "path";
import { ICmdReplaceInfo, IColors, IDocumentUriMap } from "./types";
import { trueCasePathSync } from "true-case-path";

function getCmdReplaceInfo(
  documentUri: vscode.Uri,
  documentOldUri?: vscode.Uri
): ICmdReplaceInfo[] {
  const { fsPath } = documentUri;
  const workspaceRootPath: string = trueCasePathSync(
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
  );
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
      replaceStr: trueCasePathSync(
        vscode.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath ?? ""
      ),
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

export function getThemeColors(): IColors {
  return {
    defaultColor: new vscode.ThemeColor("filewatcher.default"),
    errorColor: new vscode.ThemeColor("filewatcher.error"),
    successColor: new vscode.ThemeColor("filewatcher.success"),
    runColor: new vscode.ThemeColor("filewatcher.run"),
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
