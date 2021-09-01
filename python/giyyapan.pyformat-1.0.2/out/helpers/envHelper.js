"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Path = require("path");
const vscode = require("vscode");
function getModuleExecutable(moduleName, documentUri) {
    const pythonConfig = vscode.workspace.getConfiguration('python', documentUri);
    const venvPath = pythonConfig.get('venvPath') || '';
    const pythonPath = pythonConfig.get('pythonPath') || '';
    const workspacePath = vscode.workspace.getWorkspaceFolder(documentUri).uri.fsPath;
    if (venvPath) {
        if (isAbsolutePath(venvPath)) {
            // absolute path
            return Path.join(venvPath, 'bin', moduleName);
        }
        else {
            return Path.normalize(Path.join(workspacePath, venvPath, 'bin', moduleName));
        }
    }
    else if (pythonPath) {
        if (pythonPath.startsWith('python' || isAbsolutePath(pythonPath))) {
            // absolute path or global inteperator
            return `${pythonPath} -m ${moduleName}`;
        }
        else {
            // relative path
            return `${Path.join(workspacePath, pythonPath)} -m ${moduleName}`;
        }
    }
    else {
        return moduleName;
    }
}
exports.getModuleExecutable = getModuleExecutable;
function isModuleNotFoundError(err) {
    if (err.code === 'ENOENT' ||
        err.code === 127 ||
        err.message.indexOf('No module named') >= 0) {
        return true;
    }
    return false;
}
exports.isModuleNotFoundError = isModuleNotFoundError;
function isAbsolutePath(path) {
    if (path.startsWith('/') || path.indexOf(':\\') >= 0) {
        return true;
    }
    else {
        return false;
    }
}
//# sourceMappingURL=envHelper.js.map