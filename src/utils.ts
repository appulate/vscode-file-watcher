import * as vscode from "vscode";
import * as path from "path";
import { ICmdReplaceInfo, IDocumentUriMap } from "./types";
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
    (cmdResult, { pattern, replaceStr }) => {
      cmdResult = cmdResult.replace(new RegExp(pattern, "g"), replaceStr);
      return cmdResult;
    },
    cmd
  );
}
