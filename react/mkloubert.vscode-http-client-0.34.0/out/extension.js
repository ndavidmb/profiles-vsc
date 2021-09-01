'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file is part of the vscode-http-client distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 *
 * vscode-http-client is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-http-client is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const _ = require("lodash");
const ChildProcess = require("child_process");
const FSExtra = require("fs-extra");
const Marked = require("marked");
const MergeDeep = require('merge-deep');
const MimeTypes = require("mime-types");
const Moment = require("moment");
const Path = require("path");
const OS = require("os");
const URL = require("url");
const vschc_help = require("./help");
const vschc_html = require("./html");
const vschc_requests = require("./requests");
const vschc_workspaces = require("./workspaces");
const vscode = require("vscode");
const vscode_helpers = require("vscode-helpers");
let activeWorkspace;
/**
 * The name of the event, when style changed.
 */
exports.EVENT_STYLE_CHANGED = 'webview.style.changed';
let extension;
/**
 * Indicates that something is unset.
 */
exports.IS_UNSET = Symbol('IS_UNSET');
const KEY_CURRENT_STYLE = 'vschcCurrentStyle';
const KEY_LAST_KNOWN_DEFAULT_URI = 'vschcLastKnownDefaultUri';
const KEY_LAST_KNOWN_VERSION = 'vschcLastKnownVersion';
let isDeactivating = false;
const KNOWN_URLS = {
    'github': 'https://github.com/mkloubert/vscode-http-client',
    'paypal': 'https://paypal.me/MarcelKloubert',
    'twitter': 'https://twitter.com/mjkloubert',
};
let outputChannel;
let packageFile;
let workspaceWatcher;
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        extension = context;
        const WF = vscode_helpers.buildWorkflow();
        // user's extension directory
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const EXT_DIR = getUsersExtensionDir();
                if (!(yield vscode_helpers.isDirectory(EXT_DIR))) {
                    yield FSExtra.mkdirs(EXT_DIR);
                }
            }
            catch (e) {
                showError(e);
            }
        }));
        // output channel
        WF.next(() => {
            context.subscriptions.push(outputChannel = vscode.window.createOutputChannel('HTTP Client'));
            outputChannel.hide();
        });
        // package file
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const CUR_DIR = __dirname;
                const FILE_PATH = Path.join(CUR_DIR, '../package.json');
                packageFile = JSON.parse(yield FSExtra.readFile(FILE_PATH, 'utf8'));
            }
            catch (_a) { }
        }));
        // extension information
        WF.next(() => {
            const NOW = Moment();
            if (packageFile) {
                outputChannel.appendLine(`${packageFile.displayName} (${packageFile.name}) - v${packageFile.version}`);
            }
            outputChannel.appendLine(`Copyright (c) ${NOW.format('YYYY')}-${NOW.format('YYYY')}  Marcel Joachim Kloubert <marcel.kloubert@gmx.net>`);
            outputChannel.appendLine('');
            outputChannel.appendLine(`GitHub : https://github.com/mkloubert/vscode-http-client`);
            outputChannel.appendLine(`Twitter: https://twitter.com/mjkloubert`);
            outputChannel.appendLine(`Donate : https://paypal.me/MarcelKloubert`);
            outputChannel.appendLine('');
        });
        // commands
        WF.next(() => {
            extension.subscriptions.push(
            // newRequest
            vscode.commands.registerCommand('extension.http.client.changeStyle', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const CURRENT_FILE = getCurrentStyle();
                    const STYLE_FILES = [{
                            file: vscode.Uri.file(Path.resolve(Path.join(__dirname, 'res/css/bootstrap.min.css'))).fsPath,
                            name: '(default)',
                        }];
                    const BOOTSWATCH_DIR = Path.join(__dirname, 'res/css/bootswatch');
                    const FILES = vscode_helpers.from((yield vscode_helpers.glob('/*.min.css', {
                        absolute: true,
                        cwd: BOOTSWATCH_DIR,
                        dot: false,
                        nocase: true,
                        nodir: true,
                        nonull: false,
                        nosort: true,
                        root: BOOTSWATCH_DIR,
                    }))).select(f => {
                        let name = Path.basename(f, '.min.css');
                        name = (name[0].toUpperCase() + name.substr(1).toLowerCase()).trim();
                        return {
                            file: vscode.Uri.file(Path.resolve(f)).fsPath,
                            name: name,
                            value: 'bootswatch/' + Path.basename(f),
                        };
                    }).orderBy(sf => {
                        return vscode_helpers.normalizeString(sf.name);
                    }).thenBy(sf => {
                        return vscode_helpers.normalizeString(sf.name);
                    }).pushTo(STYLE_FILES);
                    const QUICK_PICKS = STYLE_FILES.map((sf, index) => {
                        let isCurrent;
                        if (false !== CURRENT_FILE) {
                            isCurrent = vscode.Uri.file(Path.resolve(CURRENT_FILE)).fsPath ===
                                vscode.Uri.file(Path.resolve(sf.file)).fsPath;
                        }
                        else {
                            isCurrent = 0 === index;
                        }
                        return {
                            action: () => __awaiter(this, void 0, void 0, function* () {
                                yield extension.globalState.update(KEY_CURRENT_STYLE, sf.value);
                                vscode_helpers.EVENTS.emit(exports.EVENT_STYLE_CHANGED, vscode.Uri.file(sf.file).with({
                                    scheme: 'vscode-resource'
                                }));
                            }),
                            description: isCurrent ? '(current)' : '',
                            detail: sf.file,
                            label: sf.name,
                        };
                    });
                    const SELECTED_ITEM = yield vscode.window.showQuickPick(QUICK_PICKS, {
                        placeHolder: 'Select the style the HTTP request forms ...',
                    });
                    if (SELECTED_ITEM) {
                        yield SELECTED_ITEM['action']();
                    }
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // newRequest
            vscode.commands.registerCommand('extension.http.client.newRequest', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield vschc_requests.startNewRequest();
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // newRequestForEditor
            vscode.commands.registerCommand('extension.http.client.newRequestForEditor', function (file) {
                return __awaiter(this, arguments, void 0, function* () {
                    let newRequest;
                    try {
                        const DISPOSABLES = [];
                        let editorFile = false;
                        let headers;
                        let fileWatcher;
                        let hideBodyFromFileButton;
                        let text = false;
                        if (arguments.length > 0) {
                            text = yield FSExtra.readFile(file.fsPath, 'binary');
                            editorFile = file.fsPath;
                        }
                        else {
                            const EDITOR = vscode.window.activeTextEditor;
                            if (EDITOR && EDITOR.document) {
                                text = EDITOR.document.getText();
                                editorFile = EDITOR.document.fileName;
                            }
                        }
                        if (false === text) {
                            vscode.window.showWarningMessage('No editor (content) found!');
                        }
                        else {
                            if (false !== editorFile && !vscode_helpers.isEmptyString(editorFile)) {
                                try {
                                    const CONTENT_TYPE = MimeTypes.lookup(editorFile);
                                    if (false !== CONTENT_TYPE) {
                                        headers = {
                                            'Content-Type': CONTENT_TYPE,
                                        };
                                    }
                                }
                                catch (_a) { }
                                try {
                                    if (yield vscode_helpers.isFile(editorFile)) {
                                        let newEditorFileWatcher;
                                        try {
                                            newEditorFileWatcher = vscode.workspace.createFileSystemWatcher(editorFile, false, false, false);
                                            const INVOKE_FOR_FILE = (action) => {
                                                const REQUEST = newRequest;
                                                if (!REQUEST) {
                                                    return;
                                                }
                                                try {
                                                    Promise.resolve(action()).then(() => { }, (err) => {
                                                        showError(err);
                                                    });
                                                }
                                                catch (e) {
                                                    showError(e);
                                                }
                                            };
                                            let isSettingBodyContent = false;
                                            const SET_BODY_CONTENT = function (content) {
                                                return __awaiter(this, arguments, void 0, function* () {
                                                    const ARGS = arguments;
                                                    if (isSettingBodyContent) {
                                                        setTimeout(() => {
                                                            SET_BODY_CONTENT.apply(null, ARGS);
                                                        }, 1000);
                                                        return;
                                                    }
                                                    isSettingBodyContent = true;
                                                    try {
                                                        const REQUEST = newRequest;
                                                        if (REQUEST) {
                                                            yield REQUEST.postMessage('setBodyContent', {
                                                                data: vscode_helpers.toStringSafe(content),
                                                            });
                                                        }
                                                    }
                                                    finally {
                                                        isSettingBodyContent = false;
                                                    }
                                                });
                                            };
                                            newEditorFileWatcher.onDidChange((e) => {
                                                INVOKE_FOR_FILE(() => __awaiter(this, void 0, void 0, function* () {
                                                    if (yield vscode_helpers.isFile(e.fsPath)) {
                                                        yield SET_BODY_CONTENT(yield FSExtra.readFile(e.fsPath, 'binary'));
                                                    }
                                                }));
                                            });
                                            newEditorFileWatcher.onDidCreate((e) => {
                                                INVOKE_FOR_FILE(() => __awaiter(this, void 0, void 0, function* () {
                                                    if (yield vscode_helpers.isFile(e.fsPath)) {
                                                        yield SET_BODY_CONTENT(yield FSExtra.readFile(e.fsPath, 'binary'));
                                                    }
                                                }));
                                            });
                                            fileWatcher = newEditorFileWatcher;
                                        }
                                        catch (e) {
                                            vscode_helpers.tryDispose(newEditorFileWatcher);
                                            throw e;
                                        }
                                    }
                                }
                                catch (_b) { }
                            }
                            if (false !== fileWatcher) {
                                DISPOSABLES.push(fileWatcher);
                                hideBodyFromFileButton = true;
                            }
                            newRequest = yield vschc_requests.startNewRequest({
                                body: vscode_helpers.toStringSafe(text),
                                disposables: DISPOSABLES,
                                headers: headers,
                                hideBodyFromFileButton: hideBodyFromFileButton,
                                isBodyContentReadOnly: false !== fileWatcher,
                                showOptions: vscode.ViewColumn.Two,
                            });
                            newRequest.onDidChangeVisibility((isVisible) => __awaiter(this, void 0, void 0, function* () {
                                try {
                                    if (isVisible) {
                                        if (false !== editorFile && !vscode_helpers.isEmptyString(editorFile)) {
                                            if (yield vscode_helpers.isFile(editorFile)) {
                                                yield newRequest.postMessage('setBodyContent', {
                                                    data: yield FSExtra.readFile(editorFile, 'ascii'),
                                                });
                                            }
                                        }
                                    }
                                }
                                catch (e) {
                                    showError(e);
                                }
                            }));
                        }
                    }
                    catch (e) {
                        vscode_helpers.tryDispose(newRequest);
                        showError(e);
                    }
                });
            }), 
            // newRequestFromFile
            vscode.commands.registerCommand('extension.http.client.newRequestFromFile', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield openFiles((files) => __awaiter(this, void 0, void 0, function* () {
                        yield vschc_requests.startNewRequest({
                            file: files[0],
                        });
                    }), {
                        openLabel: 'Start request',
                    });
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // newRequestScript
            vscode.commands.registerCommand('extension.http.client.newRequestScript', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    let code = `
// The following modules are supported:
//
// $fs      =>   https://github.com/jprichardson/node-fs-extra
// $h       =>   https://github.com/mkloubert/vscode-helpers
// $moment  =>   https://github.com/moment/moment
// $uuid    =>   https://github.com/kelektiv/node-uuid
// $vs      =>   https://code.visualstudio.com/docs/extensionAPI/vscode-api

const CURRENT_TIME = now();
const CURRENT_UTC_TIME = utc();

const SESSION_ID = $uuid.v4();
const USERS = [ 1, 2, 3 ];

for (let i = 0; i < USERS.length; i++) {
    if (cancel.isCancellationRequested) {
        break;  // user wants to cancel
    }

    const USER_ID = USERS[i];

    // update progress
    progress.report({
        message: \`Execute request for user \${ i + 1 } (ID \${ USER_ID }) of \${ USERS.length }\`,
        increment: 1.0 / USERS.length * 100.0
    });

    // create new request
    // s. https://mkloubert.github.io/vscode-http-client/classes/_http_.httpclient.html
    const REQUEST = new_request();

    // set custom query / URL parameter(s)
    REQUEST.param('user', USER_ID)
           .param('foo', 'bar');

    // set custom header(s)
    REQUEST.header('X-MyApp-Session', SESSION_ID)
           .header('X-MyApp-Time', CURRENT_UTC_TIME.format('YYYY-MM-DD HH:mm:ss'));

    // set custom body from a file, e.g.
    REQUEST.body(
        await $fs.readFile(\`/path/to/user/data/user_\${ USER_ID }.json\`)
    );

    // build and the send request
    //
    // httpResult.response  =>  the object with the response data
    let httpResult;
    try {
        httpResult = await REQUEST.send();
    } catch (e) {
        // send error
    }

    // wait about 1.5 seconds
    await sleep( 1.5 );
}
`;
                    yield vscode_helpers.openAndShowTextDocument({
                        content: code,
                        language: 'javascript',
                    });
                    yield vschc_requests.startNewRequest({
                        showOptions: vscode.ViewColumn.Two,
                    });
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // newRequestSplitView
            vscode.commands.registerCommand('extension.http.client.newRequestSplitView', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield vschc_requests.startNewRequest({
                        showOptions: vscode.ViewColumn.Two,
                    });
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // openCustomCSS
            vscode.commands.registerCommand('extension.http.client.openCustomCSS', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const CUSTOM_CSS_FILE = vschc_html.getCustomCSSUri();
                    if (!(yield vscode_helpers.exists(CUSTOM_CSS_FILE.fsPath))) {
                        let newCSS = `/**
 * This is a new CSS file for HTML forms, generated by 'HTTP Client' Visual Studio Code extension (vscode-http-client).
 *
 * The changes will be applied after the file has been saved and a new tab is opened.
 **/

`;
                        yield FSExtra.writeFile(CUSTOM_CSS_FILE.fsPath, new Buffer(newCSS, 'utf8'));
                    }
                    yield vscode_helpers.openAndShowTextDocument(CUSTOM_CSS_FILE.fsPath);
                }
                catch (e) {
                    showError(e);
                }
            })), 
            // showHelp
            vscode.commands.registerCommand('extension.http.client.showHelp', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield vschc_help.showScriptHelp();
                }
                catch (e) {
                    showError(e);
                }
            })));
        });
        // workspace(s)
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            extension.subscriptions.push(workspaceWatcher = vscode_helpers.registerWorkspaceWatcher(context, (event, folder, workspace) => __awaiter(this, void 0, void 0, function* () {
                try {
                    switch (event) {
                        case vscode_helpers.WorkspaceWatcherEvent.Added:
                            const NEW_WORKSPACE = new vschc_workspaces.Workspace(folder);
                            {
                                yield NEW_WORKSPACE.initialize();
                            }
                            return NEW_WORKSPACE;
                    }
                }
                finally {
                    yield updateActiveWorkspace();
                }
            })));
            vschc_workspaces.getAllWorkspaces = () => {
                return vscode_helpers.from(vscode_helpers.asArray(workspaceWatcher.workspaces)).orderBy(ws => {
                    return ws.folder.index;
                }).thenBy(ws => {
                    return vscode_helpers.normalizeString(ws.folder.name);
                }).thenBy(ws => {
                    return vscode_helpers.normalizeString(ws.folder.uri.fsPath);
                }).toArray();
            };
            vschc_workspaces.getActiveWorkspace = () => {
                const AWS = activeWorkspace;
                if (AWS && !AWS.isInFinalizeState) {
                    return AWS;
                }
                return false;
            };
            yield workspaceWatcher.reload();
            yield updateActiveWorkspace();
        }));
        // openRequestsOnStartup
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            try {
                for (const WF of workspaceWatcher.workspaces) {
                    try {
                        if (!WF.isInFinalizeState) {
                            try {
                                yield WF.openRequestsOnStartup();
                            }
                            finally {
                                WF.executeOpenRequestsOnStartup = true;
                            }
                        }
                    }
                    catch (e) {
                        showError(e);
                    }
                }
            }
            catch (e) {
                showError(e);
            }
        }));
        // events
        WF.next(() => {
            context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
                updateActiveWorkspace().then(() => { }, (err) => {
                });
            }));
        });
        // restore saved requests
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield vschc_requests.restoreSavedRequests();
            }
            catch (_b) { }
        }));
        // show CHANGELOG
        WF.next(() => __awaiter(this, void 0, void 0, function* () {
            let versionToUpdate = false;
            try {
                if (packageFile) {
                    const VERSION = vscode_helpers.normalizeString(packageFile.version);
                    if ('' !== VERSION) {
                        const LAST_VERSION = vscode_helpers.normalizeString(extension.globalState.get(KEY_LAST_KNOWN_VERSION, ''));
                        if (LAST_VERSION !== VERSION) {
                            const CHANGELOG_FILE = Path.resolve(Path.join(__dirname, '../CHANGELOG.md'));
                            if (yield vscode_helpers.isFile(CHANGELOG_FILE)) {
                                const MARKDOWN = yield FSExtra.readFile(CHANGELOG_FILE, 'utf8');
                                let changeLogView;
                                try {
                                    changeLogView = vscode.window.createWebviewPanel('vscodeHTTPClientScriptChangelog', 'HTTP Client ChangeLog', vscode.ViewColumn.One, {
                                        enableCommandUris: false,
                                        enableFindWidget: false,
                                        enableScripts: false,
                                        retainContextWhenHidden: true,
                                    });
                                    changeLogView.webview.html = Marked(MARKDOWN, {
                                        breaks: true,
                                        gfm: true,
                                        mangle: true,
                                        silent: true,
                                        tables: true,
                                        sanitize: true,
                                    });
                                }
                                catch (e) {
                                    vscode_helpers.tryDispose(changeLogView);
                                    throw e;
                                }
                            }
                            versionToUpdate = VERSION;
                        }
                    }
                }
            }
            catch (_c) {
            }
            finally {
                try {
                    if (false !== versionToUpdate) {
                        yield extension.globalState.update(KEY_LAST_KNOWN_VERSION, versionToUpdate);
                    }
                }
                catch (_d) { }
            }
        }));
        if (!isDeactivating) {
            yield WF.start();
        }
    });
}
exports.activate = activate;
/**
 * Shows a confirm window.
 *
 * @param {Function} action The action to invoke.
 * @param {string} prompt The promt text.
 *
 * @return {Promise<TResult>} The promise with the result of the action.
 */
function confirm(action, prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        const SELECTED_ITEM = yield vscode.window.showWarningMessage(prompt, {
            title: 'No',
            isCloseAffordance: true,
            value: 0,
        }, {
            title: 'Yes',
            value: 1,
        });
        if (SELECTED_ITEM) {
            return yield Promise.resolve(action(1 === SELECTED_ITEM.value));
        }
    });
}
exports.confirm = confirm;
function deactivate() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isDeactivating) {
            return;
        }
        isDeactivating = true;
        // save open requests
        try {
            yield vschc_requests.saveOpenRequests();
        }
        catch (_a) { }
    });
}
exports.deactivate = deactivate;
/**
 * Executes a file / command.
 *
 * @param {string} command The command to execute.
 *
 * @return {Promise<ExecResult>} The promise with the result.
 */
function exec(command) {
    command = vscode_helpers.toStringSafe(command);
    return new Promise((resolve, reject) => {
        const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);
        try {
            ChildProcess.exec(command, (err, stdout, stderr) => {
                COMPLETED(err, {
                    stdErr: stderr,
                    stdOut: stdout,
                });
            });
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
exports.exec = exec;
/**
 * Returns the current extension context.
 */
function getContext() {
    return extension;
}
exports.getContext = getContext;
/**
 * Returns the path of the current, existing style (CSS) file.
 *
 * @return {string|false} The file path or (false) if not found.
 */
function getCurrentStyle() {
    let value = vscode_helpers.toStringSafe(extension.globalState.get(KEY_CURRENT_STYLE, ''));
    if (!vscode_helpers.isEmptyString(value)) {
        value = Path.resolve(Path.join(__dirname + '/res/css', value));
        if (vscode_helpers.isFileSync(value)) {
            return Path.resolve(value);
        }
    }
    return false;
}
exports.getCurrentStyle = getCurrentStyle;
/**
 * Returns the URI for the current style file.
 *
 * @param {Function} getResourceUri The function to use to resolve the default URI.
 *
 * @return {vscode.Uri} The resource URI of the current style.
 */
function getCurrentStyleUri(getResourceUri) {
    let uri;
    let style = getCurrentStyle();
    if (false === style) {
        uri = getResourceUri('css/bootstrap.min.css');
    }
    else {
        uri = vscode.Uri.file(style).with({
            scheme: 'vscode-resource'
        });
    }
    return uri;
}
exports.getCurrentStyleUri = getCurrentStyleUri;
function getDefaultUriForDialogs() {
    return __awaiter(this, void 0, void 0, function* () {
        let uri;
        const CHECKERS = [
            // first check last known
            () => __awaiter(this, void 0, void 0, function* () {
                const LAST_KNOWN = vscode_helpers.toStringSafe(extension.workspaceState.get(KEY_LAST_KNOWN_DEFAULT_URI, ''));
                if (!vscode_helpers.isEmptyString(LAST_KNOWN)) {
                    if (yield vscode_helpers.isDirectory(LAST_KNOWN)) {
                        uri = vscode.Uri.file(LAST_KNOWN);
                    }
                }
            }),
            // then check active workspace
            () => __awaiter(this, void 0, void 0, function* () {
                const ACTIVE_WORKSPACE = vschc_workspaces.getActiveWorkspace();
                if (ACTIVE_WORKSPACE) {
                    const DIRS = [
                        // .vscode sub folder
                        Path.join(ACTIVE_WORKSPACE.folder.uri.fsPath, '.vscode'),
                        // workspace folder
                        ACTIVE_WORKSPACE.folder.uri.fsPath,
                    ];
                    for (const D of DIRS) {
                        try {
                            if (uri) {
                                break;
                            }
                            if (yield vscode_helpers.isDirectory(D)) {
                                uri = vscode.Uri.file(D);
                            }
                        }
                        catch (_b) { }
                    }
                }
            }),
            // last, but not least => try home directory
            () => __awaiter(this, void 0, void 0, function* () {
                const EXT_DIR = getUsersExtensionDir();
                if (yield vscode_helpers.isDirectory(EXT_DIR)) {
                    uri = vscode.Uri.file(EXT_DIR);
                }
            }),
        ];
        for (const CHK of CHECKERS) {
            if (uri) {
                break;
            }
            try {
                yield CHK();
            }
            catch (_a) { }
        }
        return uri;
    });
}
/**
 * Returns the current output channel.
 *
 * @return {vscode.OutputChannel} The output channel.
 */
function getOutputChannel() {
    return outputChannel;
}
exports.getOutputChannel = getOutputChannel;
/**
 * Returns the extension's path inside the user's home directory.
 *
 * @return string The path to the (possible) directory.
 */
function getUsersExtensionDir() {
    return Path.resolve(Path.join(OS.homedir(), '.vscode-http-client'));
}
exports.getUsersExtensionDir = getUsersExtensionDir;
/**
 * Returns all possible resource URIs for web views.
 *
 * @return {vscode.Uri[]} The list of URIs.
 */
function getWebViewResourceUris() {
    const URIs = [];
    try {
        URIs.push(vscode.Uri.file(getUsersExtensionDir()));
    }
    catch (_a) { }
    try {
        URIs.push(vscode.Uri.file(Path.resolve(Path.join(__dirname, './res'))));
    }
    catch (_b) { }
    return URIs;
}
exports.getWebViewResourceUris = getWebViewResourceUris;
/**
 * Handles a default webview message.
 *
 * @param {WebViewMessage} msg The message to handle.
 *
 * @return {boolean} Message has been handled or not.
 */
function handleDefaultWebViewMessage(msg) {
    if (_.isNil(msg)) {
        return true;
    }
    let action;
    switch (msg.command) {
        case 'log':
            action = () => {
                if (!_.isNil(msg.data) && !_.isNil(msg.data.message)) {
                    try {
                        console.log(JSON.parse(vscode_helpers.toStringSafe(msg.data.message)));
                    }
                    catch (e) { }
                }
            };
            break;
        case 'openExternalUrl':
            {
                const URL_TO_OPEN = vscode_helpers.toStringSafe(msg.data.url);
                const URL_TEXT = vscode_helpers.toStringSafe(msg.data.text).trim();
                if (!vscode_helpers.isEmptyString(URL_TO_OPEN)) {
                    action = () => __awaiter(this, void 0, void 0, function* () {
                        // check if "parsable"
                        URL.parse(URL_TO_OPEN);
                        let urlPromptText;
                        if ('' === URL_TEXT) {
                            urlPromptText = `'${URL_TO_OPEN}'`;
                        }
                        else {
                            urlPromptText = `'${URL_TEXT}' (${URL_TO_OPEN})`;
                        }
                        const SELECTED_ITEM = yield vscode.window.showWarningMessage(`Do you really want to open the URL ${urlPromptText}?`, {
                            title: 'Yes',
                            action: () => __awaiter(this, void 0, void 0, function* () {
                                yield open(URL_TO_OPEN);
                            })
                        }, {
                            title: 'No',
                            isCloseAffordance: true
                        });
                        if (SELECTED_ITEM) {
                            if (SELECTED_ITEM.action) {
                                yield SELECTED_ITEM.action();
                            }
                        }
                    });
                }
            }
            break;
        case 'openKnownUrl':
            const KU = KNOWN_URLS[vscode_helpers.normalizeString(msg.data)];
            if (!_.isNil(KU)) {
                action = () => __awaiter(this, void 0, void 0, function* () {
                    yield open(KU);
                });
            }
            break;
    }
    if (action) {
        Promise.resolve(action()).then(() => {
        }, (err) => {
            showError(err);
        });
        return true;
    }
    return false;
}
exports.handleDefaultWebViewMessage = handleDefaultWebViewMessage;
/**
 * Opens a target.
 *
 * @param {string} target The target to open.
 * @param {OpenOptions} [opts] The custom options to set.
 *
 * @param {Promise<ChildProcess.ChildProcess>} The promise with the child process.
 */
function open(target, opts) {
    if (!opts) {
        opts = {};
    }
    target = vscode_helpers.toStringSafe(target);
    const WAIT = vscode_helpers.toBooleanSafe(opts.wait, true);
    return new Promise((resolve, reject) => {
        const COMPLETED = vscode_helpers.createCompletedAction(resolve, reject);
        try {
            let app = opts.app;
            let cmd;
            let appArgs = [];
            let args = [];
            let cpOpts = {
                cwd: opts.cwd,
                env: opts.env,
            };
            if (Array.isArray(app)) {
                appArgs = app.slice(1);
                app = opts.app[0];
            }
            if (process.platform === 'darwin') {
                // Apple
                cmd = 'open';
                if (WAIT) {
                    args.push('-W');
                }
                if (app) {
                    args.push('-a', app);
                }
            }
            else if (process.platform === 'win32') {
                // Microsoft
                cmd = 'cmd';
                args.push('/c', 'start', '""');
                target = target.replace(/&/g, '^&');
                if (WAIT) {
                    args.push('/wait');
                }
                if (app) {
                    args.push(app);
                }
                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }
            }
            else {
                // Unix / Linux
                if (app) {
                    cmd = app;
                }
                else {
                    cmd = Path.join(__dirname, 'xdg-open');
                }
                if (appArgs.length > 0) {
                    args = args.concat(appArgs);
                }
                if (!WAIT) {
                    // xdg-open will block the process unless
                    // stdio is ignored even if it's unref'd
                    cpOpts.stdio = 'ignore';
                }
            }
            args.push(target);
            if (process.platform === 'darwin' && appArgs.length > 0) {
                args.push('--args');
                args = args.concat(appArgs);
            }
            let cp = ChildProcess.spawn(cmd, args, cpOpts);
            if (WAIT) {
                cp.once('error', (err) => {
                    COMPLETED(err);
                });
                cp.once('close', function (code) {
                    if (code > 0) {
                        COMPLETED(new Error('Exited with code ' + code));
                        return;
                    }
                    COMPLETED(null, cp);
                });
            }
            else {
                cp.unref();
                COMPLETED(null, cp);
            }
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
exports.open = open;
/**
 * Invokes an action for an 'oprn files' dialog.
 *
 * @param {Function} action The action to invoke.
 * @param {OpenDialogOptions} [options] Custom options.
 *
 * @return {Promise<TResult>} The promise with the result of the action.
 */
function openFiles(action, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const DEFAULT_OPTS = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: yield getDefaultUriForDialogs(),
            openLabel: 'Open',
        };
        const OPTS = MergeDeep(DEFAULT_OPTS, options);
        const FILES = yield vscode.window.showOpenDialog(OPTS);
        if (FILES && FILES.length > 0) {
            const FIRST_FILE = FILES[0];
            let lastKnownUri = OPTS.defaultUri;
            try {
                return yield Promise.resolve(action(FILES));
            }
            finally {
                try {
                    if (vscode_helpers.from(FILES).all(f => f.fsPath === FIRST_FILE.fsPath)) {
                        lastKnownUri = vscode.Uri.file(Path.dirname(FIRST_FILE.fsPath));
                    }
                }
                catch (_a) { }
                yield updateLastKnownDefaultUriForDialogs(lastKnownUri);
            }
        }
    });
}
exports.openFiles = openFiles;
/**
 * Invokes an action for an 'oprn files' dialog.
 *
 * @param {Function} action The action to invoke.
 * @param {SaveDialogOptions} [options] Custom options.
 *
 * @return {Promise<TResult>} The promise with the result of the action.
 */
function saveFile(action, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const DEFAULT_OPTS = {
            defaultUri: yield getDefaultUriForDialogs(),
            saveLabel: 'Save',
        };
        const OPTS = MergeDeep(DEFAULT_OPTS, options);
        const FILE = yield vscode.window.showSaveDialog(OPTS);
        if (FILE) {
            let lastKnownUri = OPTS.defaultUri;
            try {
                return yield Promise.resolve(action(FILE));
            }
            finally {
                try {
                    lastKnownUri = vscode.Uri.file(Path.dirname(FILE.fsPath));
                }
                catch (_a) { }
                yield updateLastKnownDefaultUriForDialogs(lastKnownUri);
            }
        }
    });
}
exports.saveFile = saveFile;
/**
 * Shows an error.
 *
 * @param {any} err The error to show.
 */
function showError(err) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!_.isNil(err)) {
            return yield vscode.window.showErrorMessage(`[ERROR] '${vscode_helpers.toStringSafe(err)}'`);
        }
    });
}
exports.showError = showError;
function updateActiveWorkspace() {
    return __awaiter(this, void 0, void 0, function* () {
        let aws;
        try {
            const ALL_WORKSPACES = vschc_workspaces.getAllWorkspaces();
            if (ALL_WORKSPACES.length > 0) {
                if (1 === ALL_WORKSPACES.length) {
                    aws = ALL_WORKSPACES[0];
                }
                else {
                    aws = activeWorkspace;
                    const ACTIVE_EDITOR = vscode.window.activeTextEditor;
                    if (ACTIVE_EDITOR) {
                        const DOC = ACTIVE_EDITOR.document;
                        if (DOC) {
                            const FILE = DOC.fileName;
                            if (!vscode_helpers.isEmptyString(FILE)) {
                                const LAST_MATCHING_WORKSPACE = vscode_helpers.from(ALL_WORKSPACES)
                                    .firstOrDefault(ws => ws.isPathOf(FILE), false);
                                if (LAST_MATCHING_WORKSPACE) {
                                    aws = LAST_MATCHING_WORKSPACE;
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (e) {
            aws = null;
        }
        activeWorkspace = aws;
    });
}
function updateLastKnownDefaultUriForDialogs(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (uri) {
                try {
                    yield extension.workspaceState.update(KEY_LAST_KNOWN_DEFAULT_URI, uri.fsPath);
                }
                catch (_a) { }
            }
        }
        catch (_b) { }
    });
}
//# sourceMappingURL=extension.js.map