"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Crypto = require("crypto");
const FSExtra = require("fs-extra");
const MimeTypes = require("mime-types");
const NormalizeHeaderCase = require("header-case-normalizer");
const Path = require("path");
const UUID = require("uuid");
const vschc = require("./extension");
const vschc_html = require("./html");
const vschc_http = require("./http");
const vschc_scripts = require("./scripts");
const vscode = require("vscode");
const vscode_helpers = require("vscode-helpers");
/**
 * Name of an event that is invoked after a WebView panel has been disposed.
 */
exports.EVENT_WEBVIEWPANEL_DISPOSED = 'webviewpanel.disposed';
let nextHTTPRequestId = Number.MIN_SAFE_INTEGER;
/**
 * The global list of requests.
 */
exports.REQUESTS = [];
/**
 * A basic HTTP request.
 */
class HTTPRequestBase extends vscode_helpers.DisposableBase {
    /**
     * Initializes a new instance of that class.
     */
    constructor() {
        super();
        /**
         * Stores the HTML for the WebView.
         */
        this._html = false;
        this.id = `${nextHTTPRequestId++}\n${UUID.v4()}`;
    }
    /**
     * @inheritdoc
     */
    applyRequest(requestData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.postMessage('applyRequest', requestData);
        });
    }
    /**
     * Returns an URI from the 'resources' directory.
     *
     * @param {string} p The (relative) path.
     *
     * @return {vscode.Uri} The URI.
     */
    getResourceUri(p) {
        p = vscode_helpers.toStringSafe(p);
        let u;
        for (const R of vschc.getWebViewResourceUris()) {
            const PATH_TO_CHECK = Path.resolve(Path.join(R.fsPath, p));
            u = vscode.Uri.file(PATH_TO_CHECK).with({
                scheme: 'vscode-resource'
            });
            try {
                if (vscode_helpers.isFileSync(PATH_TO_CHECK)) {
                    break;
                }
            }
            catch (_a) { }
        }
        return u;
    }
    /**
     * Initializes the request.
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            ME._html = '';
            ME._styleChangedListener = (uri) => {
                const RES_URI = `${uri}`;
                ME.postMessage('styleChanged', RES_URI);
            };
            vscode_helpers.EVENTS.addListener(vschc.EVENT_STYLE_CHANGED, ME._styleChangedListener);
            yield ME.onInitialize();
        });
    }
    /**
     * Invokes an action for a cancellation token source.
     *
     * @param {vscode.CancellationTokenSource} cancelTokenSrc The token source.
     * @param {Function} action The action to invoke.
     * @param {any[]} [args] One or more arguments for the action.
     *
     * @return {Promise<TResult>} The promise with the result of the action.
     */
    invokeForCancellationTokenSource(cancelTokenSrc, action, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const DISPOSED_LISTENER = () => {
                try {
                    cancelTokenSrc.cancel();
                }
                catch (e) {
                    vschc.showError(e);
                }
            };
            this.once(exports.EVENT_WEBVIEWPANEL_DISPOSED, DISPOSED_LISTENER);
            try {
                return yield Promise.resolve(action.apply(null, args));
            }
            finally {
                vscode_helpers.tryRemoveListener(this, exports.EVENT_WEBVIEWPANEL_DISPOSED, DISPOSED_LISTENER);
            }
        });
    }
    /**
     * @inheritdoc
     */
    onDidChangeVisibility(listener) {
        const ME = this;
        if (listener) {
            this.panel.onDidChangeViewState((e) => {
                try {
                    Promise.resolve(listener(e.webviewPanel.visible)).then(() => {
                    }, (err) => {
                        ME.showError(err);
                    });
                }
                catch (e) {
                    ME.showError(e);
                }
            });
        }
        return this;
    }
    /**
     * Is invoked after the underlying panel has been disposed.
     */
    onDidDispose() {
        const _super = Object.create(null, {
            onDispose: { get: () => super.onDispose }
        });
        return __awaiter(this, void 0, void 0, function* () {
            _super.onDispose.call(this);
            vscode_helpers.tryRemoveListener(vscode_helpers.EVENTS, vschc.EVENT_STYLE_CHANGED, this._styleChangedListener);
            removeRequest(this);
        });
    }
    /**
     * Is invoked when the web view received a message from the browser.
     *
     * @param {WebViewMessage} msg The received message.
     */
    onDidReceiveMessage(msg) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    /**
     * @inheritdoc
     */
    onDispose() {
        vscode_helpers.tryDispose(this._panel);
        const OPTS = this.startOptions;
        if (OPTS) {
            for (const DISP of vscode_helpers.asArray(OPTS.disposables)) {
                vscode_helpers.tryDispose(DISP);
            }
        }
    }
    /**
     * Gets the underlying panel.
     */
    get panel() {
        return this._panel;
    }
    /**
     * @inheritdoc
     */
    postMessage(command, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const MSG = {
                command: command,
                data: data,
            };
            return yield this.view.postMessage(MSG);
        });
    }
    /**
     * Gets the root directories for the web view's resources.
     */
    get resourceRoots() {
        return vschc.getWebViewResourceUris()
            .map(u => u.fsPath);
    }
    /**
     * Shows an error.
     *
     * @param {any} err The error to show.
     */
    showError(err) {
        return __awaiter(this, void 0, void 0, function* () {
            return vschc.showError(err);
        });
    }
    /**
     * Opens the view to start a request.
     *
     * @param {StartNewRequestOptions} [opts] Custom options.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    start(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            if (this._panel) {
                return false;
            }
            if (_.isNil(opts)) {
                opts = {};
            }
            let title = vscode_helpers.toStringSafe(opts.title).trim();
            if ('' === title) {
                title = 'New HTTP Request';
            }
            let showOptions = opts.showOptions;
            if (_.isNil(showOptions)) {
                showOptions = vscode.ViewColumn.One;
            }
            let newPanel;
            try {
                newPanel = vscode.window.createWebviewPanel('vscodeHTTPClient', title, showOptions, {
                    enableCommandUris: true,
                    enableFindWidget: true,
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: vschc.getWebViewResourceUris(),
                });
                newPanel.webview.onDidReceiveMessage((msg) => {
                    try {
                        if (vschc.handleDefaultWebViewMessage(msg)) {
                            return;
                        }
                        Promise.resolve(ME.onDidReceiveMessage(msg)).then(() => { }, (err) => {
                            ME.showError(err);
                        });
                    }
                    catch (e) {
                        ME.showError(e);
                    }
                });
                newPanel.onDidDispose(() => {
                    let err;
                    try {
                        ME.onDidDispose().then(() => {
                        }, () => { });
                    }
                    catch (e) {
                        err = e;
                    }
                    ME.emit(exports.EVENT_WEBVIEWPANEL_DISPOSED, err, ME.panel);
                });
                if (false !== ME._html) {
                    newPanel.webview.html = vscode_helpers.toStringSafe(ME._html);
                }
                ME._startOptions = opts;
                ME._panel = newPanel;
                return true;
            }
            catch (e) {
                vscode_helpers.tryDispose(newPanel);
                throw e;
            }
        });
    }
    /**
     * Gets the last start options.
     */
    get startOptions() {
        return this._startOptions;
    }
    /**
     * Gets the underlying web view.
     */
    get view() {
        return this.panel.webview;
    }
}
exports.HTTPRequestBase = HTTPRequestBase;
/**
 * A HTTP request.
 */
class HTTPRequest extends HTTPRequestBase {
    cloneRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let newRequest;
            try {
                newRequest = yield startNewRequest({
                    onLoaded: () => __awaiter(this, void 0, void 0, function* () {
                        yield newRequest.applyRequest(request);
                    })
                });
            }
            catch (e) {
                vscode_helpers.tryDispose(newRequest);
                throw e;
            }
        });
    }
    createHTTPFromResponse(response) {
        let http = `HTTP/${response.httpVersion} ${response.code} ${response.status}\r\n`;
        if (response.headers) {
            for (const H in response.headers) {
                http += `${H}: ${response.headers[H]}\r\n`;
            }
        }
        http += `\r\n`;
        let data = new Buffer(http, 'ascii');
        if (response.body) {
            data = Buffer.concat([
                data,
                new Buffer(response.body, 'base64'),
            ]);
        }
        return data;
    }
    executeScript(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            let result;
            try {
                let editorsFound = false;
                const VISIBLE_EDITORS = vscode_helpers.asArray(vscode.window.visibleTextEditors).filter(e => {
                    return e.document &&
                        !e.document.isClosed;
                });
                if (VISIBLE_EDITORS.length > 0) {
                    for (const EDITOR of VISIBLE_EDITORS) {
                        try {
                            const DOC = EDITOR.document;
                            if (!DOC.isUntitled) {
                                if (!vscode_helpers.isEmptyString(DOC.fileName)) {
                                    if (!(yield vscode_helpers.isFile(DOC.fileName))) {
                                        continue;
                                    }
                                }
                            }
                            editorsFound = true;
                            yield vscode.window.withProgress({
                                cancellable: true,
                                location: vscode.ProgressLocation.Notification,
                                title: 'Executing HTTP Script ...'
                            }, (progress, cancelToken) => __awaiter(this, void 0, void 0, function* () {
                                yield vschc_scripts.executeScript({
                                    cancelToken: cancelToken,
                                    code: DOC.getText(),
                                    getResourceUri: (p) => {
                                        return ME.getResourceUri(p);
                                    },
                                    handler: ME,
                                    onDidSend: (err, result) => __awaiter(this, void 0, void 0, function* () {
                                        yield ME.sendRequestCompleted(err, result);
                                    }),
                                    output: vschc.getOutputChannel(),
                                    progress: progress,
                                    request: request,
                                    webResourceRoots: ME.resourceRoots,
                                });
                            }));
                        }
                        catch (e) {
                            yield ME.sendRequestCompleted(e, null);
                        }
                    }
                }
                if (!editorsFound) {
                    vscode.window.showWarningMessage('No open (script) editor found!');
                }
            }
            catch (e) {
                yield ME.sendRequestCompleted(e, null);
            }
            finally {
                yield ME.postMessage('executeScriptCompleted', result);
            }
        });
    }
    exportRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (request.body) {
                delete request.body.mime;
            }
            const DATA_TO_SAVE = new Buffer(JSON.stringify(request, null, 2), 'utf8');
            yield vschc.saveFile((file) => __awaiter(this, void 0, void 0, function* () {
                yield FSExtra.writeFile(file.fsPath, DATA_TO_SAVE);
            }), {
                filters: {
                    "HTTP Requests": ['http-request']
                },
                saveLabel: "Export Request",
            });
        });
    }
    getBodyLength(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let length = false;
            if (request.body) {
                if (false !== request.body.content) {
                    length = (new Buffer(request.body.content.trim(), 'base64')).length;
                }
            }
            yield this.postMessage('getBodyLengthCompleted', length);
        });
    }
    getBodyMD5(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let md5 = false;
            if (request.body) {
                if (false !== request.body.content) {
                    const DIGEST = Crypto.createHash('md5');
                    DIGEST.update(new Buffer(request.body.content.trim(), 'base64'));
                    md5 = DIGEST.digest().toString('base64');
                }
            }
            yield this.postMessage('getBodyMD5Completed', md5);
        });
    }
    importHTTPFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            yield vschc.openFiles((files) => __awaiter(this, void 0, void 0, function* () {
                const REQUEST = yield fromHTTPFile(files[0].fsPath);
                if (REQUEST) {
                    yield ME.importRequestCompleted(REQUEST);
                }
            }), {
                filters: {
                    "HTTP File": ['http']
                },
                openLabel: "Import HTTP File",
            });
        });
    }
    importRequest() {
        return __awaiter(this, void 0, void 0, function* () {
            yield vschc.openFiles((files) => __awaiter(this, void 0, void 0, function* () {
                const DATA = (yield FSExtra.readFile(files[0].fsPath)).toString('utf8');
                if (!vscode_helpers.isEmptyString(DATA)) {
                    const REQUEST = JSON.parse(DATA);
                    if (REQUEST) {
                        if (REQUEST.body) {
                            const FILE = REQUEST.body.file;
                            if (false !== FILE && !vscode_helpers.isEmptyString(FILE)) {
                                REQUEST.body.mime = MimeTypes.lookup(FILE);
                            }
                        }
                        yield this.importRequestCompleted(REQUEST);
                    }
                }
            }), {
                filters: {
                    "HTTP Requests": ['http-request']
                },
                openLabel: "Import Request",
            });
        });
    }
    importRequestCompleted(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.applyRequest(request);
        });
    }
    loadBodyContent() {
        return __awaiter(this, void 0, void 0, function* () {
            yield vschc.openFiles((files) => __awaiter(this, void 0, void 0, function* () {
                const PATH = files[0].fsPath;
                const DATA = yield FSExtra.readFile(PATH);
                yield this.setBodyContentFromFile({
                    data: DATA.toString('base64'),
                    mime: MimeTypes.lookup(PATH),
                    path: PATH,
                    size: DATA.length,
                });
            }));
        });
    }
    /**
     * @inheritdoc
     */
    onDidReceiveMessage(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (msg.command) {
                case 'cloneRequest':
                    yield this.cloneRequest(msg.data);
                    break;
                case 'executeScript':
                    yield this.executeScript(msg.data);
                    break;
                case 'exportRequest':
                    yield this.exportRequest(msg.data);
                    break;
                case 'getBodyLength':
                    yield this.getBodyLength(msg.data);
                    break;
                case 'getBodyMD5':
                    yield this.getBodyMD5(msg.data);
                    break;
                case 'importHTTPFile':
                    yield this.importHTTPFile();
                    break;
                case 'importRequest':
                    yield this.importRequest();
                    break;
                case 'loadBodyContent':
                    yield this.loadBodyContent();
                    break;
                case 'onLoaded':
                    {
                        yield this.postMessage('initTitle', vscode_helpers.toStringSafe(this.panel.title));
                        if (!_.isNil(this.startOptions.file)) {
                            const FILE_PATH = this.startOptions.file.fsPath;
                            const OPTS = {
                                data: (yield FSExtra.readFile(FILE_PATH)).toString('base64'),
                                mime: MimeTypes.lookup(FILE_PATH),
                                path: FILE_PATH,
                                size: (yield FSExtra.lstat(FILE_PATH)).size,
                            };
                            yield this.setBodyContentFromFile(OPTS);
                        }
                        if (!_.isNil(this.startOptions.body)) {
                            yield this.postMessage('setBodyContent', {
                                data: this.startOptions.body
                            });
                        }
                        if (!_.isNil(this.startOptions.headers)) {
                            yield this.postMessage('setHeaders', this.startOptions.headers);
                        }
                        if (!_.isNil(this.startOptions.data)) {
                            yield this.postMessage('importRequestCompleted', this.startOptions.data);
                        }
                        if (!_.isNil(this.startOptions.isBodyContentReadOnly)) {
                            yield this.postMessage('setIfBodyContentIsReadOnly', vscode_helpers.toBooleanSafe(this.startOptions.isBodyContentReadOnly));
                        }
                        if (!_.isNil(this.startOptions.hideBodyFromFileButton)) {
                            yield this.postMessage('setIfHideBodyFromFileButton', vscode_helpers.toBooleanSafe(this.startOptions.hideBodyFromFileButton));
                        }
                        yield this.postMessage('findInitialControlToFocus');
                        if (this.startOptions.onLoaded) {
                            yield Promise.resolve(this.startOptions.onLoaded());
                        }
                    }
                    break;
                case 'openReponseContentInApp':
                    yield this.openReponseContentInApp(msg.data);
                    break;
                case 'openReponseInEditor':
                    yield this.openReponseInEditor(msg.data);
                    break;
                case 'openRequestInEditor':
                    yield this.openRequestInEditor(msg.data);
                    break;
                case 'resetAllHeaders':
                    yield this.resetAllHeaders();
                    break;
                case 'resetResponses':
                    yield this.resetResponses();
                    break;
                case 'saveContent':
                    yield this.saveContent(msg.data);
                    break;
                case 'saveRawResponse':
                    yield this.saveRawResponse(msg.data);
                    break;
                case 'sendRequest':
                    yield this.sendRequest(msg.data);
                    break;
                case 'titleUpdated':
                    try {
                        this.panel.title = vscode_helpers.toStringSafe(msg.data);
                    }
                    catch (_a) { }
                    break;
                case 'unsetBodyFromFile':
                    yield this.unsetBodyFromFile();
                    break;
            }
        });
    }
    /**
     * @inheritdoc
     */
    onInitialize() {
        return __awaiter(this, void 0, void 0, function* () {
            this._html = vschc_html.generateHtmlDocument({
                getContent: () => `
<main role="main" class="container">
    <div class="vschc-card card">
        <div class="card-header bg-info text-white">
            <span>Request Settings</span>
        </div>

        <div class="card-body">
            <form>
                <div class="form-group row">
                    <label for="vschc-input-title" class="col-sm-2 col-form-label text-right">
                        <span class="align-middle">Title:</span>
                    </label>

                    <div class="col-sm-10">
                        <input type="url" class="form-control" id="vschc-input-title" placeholder="Title of that request">
                    </div>
                </div>

                <div class="form-group row">
                    <label for="vschc-input-url" class="col-sm-2 col-form-label text-right">
                        <span class="align-middle">URL:</span>
                    </label>

                    <div class="col-sm-8">
                        <div class="input-group" id="vschc-input-url-group">
                            <input type="url" class="form-control" id="vschc-input-url" placeholder="https://example.com/resource/123">

                            <div class="input-group-append" title="Edit URL Parameters">
                                <div class="input-group-text">
                                    <i class="fa fa-pencil" aria-hidden="true"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-sm-2" id="vschc-input-method-col">
                        <select class="form-control" id="vschc-input-method">
                            <option>DELETE</option>
                            <option selected>GET</option>
                            <option>HEAD</option>
                            <option>OPTIONS</option>
                            <option>PATCH</option>
                            <option>POST</option>
                            <option>PUT</option>
                        </select>
                    </div>
                </div>

                <div class="form-group row">
                    <label for="vschc-input-body-text" id="vschc-input-body-text-label" class="col-sm-2 col-form-label text-right">Body:</label>

                    <div class="col-sm-10" id="vschc-input-body-text-col" style="display: none;">
                        <textarea class="form-control" id="vschc-input-body-text" rows="10"></textarea>
                    </div>

                    <div class="col-sm-10" id="vschc-input-body-file-col" style="display: none;">
                        <div id="vschc-body-file-path"><a class="vschc-path" title="Click here to reset ..." href="#"></a>&nbsp;(<span class="vschc-size"></span>)</div>
                        <div id="vschc-body-file-content-to-display" style="display: none;"></div>
                        <input type="hidden" id="vschc-input-body-file">
                    </div>
                </div>

                <div class="form-group row" id="vschc-btn-from-file-col" style="display: none;">
                    <label class="col-sm-2 text-right"></label>

                    <div class="col-sm-10">
                        <a class="btn btn-primary" id="vschc-btn-from-file" role="button">
                            <i class="fa fa-file-text" aria-hidden="true"></i>
                            <span>From File</span>
                        </a>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div id="vschc-headers-card-accordion">
        <div class="vschc-card card" id="vschc-headers-card">
            <div class="card-header bg-info" id="vschc-headers-card-heading">
                <span title="Click Here To (Un)Collapse" class="align-middle text-white" data-toggle="collapse" data-target="#vschc-headers-card-body" aria-expanded="true" aria-controls="vschc-headers-card-body">
                    Custom Headers
                </span>

                <a class="btn btn-danger btn-sm float-right" id="vschc-reset-all-headers-btn" title="Remove All Headers">
                    <i class="fa fa-eraser" aria-hidden="true"></i>
                </a>

                <a class="btn btn-secondary btn-sm float-right" id="vschc-import-headers-btn" title="Import Header List">
                    <i class="fa fa-arrow-circle-o-down text-dark" aria-hidden="true"></i>
                </a>

                <a class="btn btn-dark btn-sm float-right" id="vschc-add-header-btn" title="Add New Header">
                    <i class="fa fa-plus-circle" aria-hidden="true"></i>
                </a>
            </div>

            <div id="vschc-headers-card-body" class="collapse show" aria-labelledby="vschc-headers-card-heading" data-parent="#vschc-headers-card-accordion">
                <div class="card-body"></div>
            </div>

            <div class="card-footer">
                <a title="Insert 'Content-MD5' Header" class="btn btn-sm btn-dark float-right align-middle" id="vschc-insert-md5-header-btn">
                    MD5
                </a>

                <a title="Insert 'Content-Length' Header" class="btn btn-sm btn-dark float-right align-middle" id="vschc-insert-length-header-btn">
                    LEN
                </a>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-sm-12 text-right" id="vschc-send-request-col">
            <a class="btn btn-dark" id="vschc-execute-script" role="button">
                <i class="fa fa-cogs" aria-hidden="true"></i>
                <span>Execute Script</span>
            </a>

            <a class="btn btn-success" id="vschc-send-request" role="button">
                <i class="fa fa-paper-plane" aria-hidden="true"></i>
                <span>Send Request</span>
            </a>
        </div>
    </div>

    <div class="vschc-card card" id="vschc-response-card">
        <div class="card-header bg-info text-white">
            <span class="align-middle">Responses</span>

            <a class="btn btn-danger btn-sm float-right" id="vschc-reset-responses-btn" style="display: none;" title="Reset Responses">
                <i class="fa fa-eraser" aria-hidden="true"></i>
            </a>
        </div>

        <div class="card-body"></div>
    </div>
</main>
`,
                getFooter: () => {
                    return `

<div class="modal" tabindex="-1" role="dialog" id="vschc-edit-url-parameters-modal">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title">Edit URL Parameters</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true" class="text-white">&times;</span>
        </button>
      </div>

      <div class="modal-body"></div>

      <div class="modal-footer">
        <a type="button" class="btn btn-warning vschc-undo-btn">
          <i class="fa fa-undo" aria-hidden="true"></i>
          <span>Undo</span>
        </a>

        <a type="button" class="btn btn-success vschc-update-btn">
            <i class="fa fa-floppy-o" aria-hidden="true"></i>
            <span>Update</span>
        </a>
      </div>
    </div>
  </div>
</div>

<div class="modal" tabindex="-1" role="dialog" id="vschc-import-headers-modal">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title">Import Header List</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true" class="text-white">&times;</span>
        </button>
      </div>

      <div class="modal-body">
        <form>
          <textarea class="form-control" rows="5" placeholder="Enter one header and its value per line, like: 'X-Header: Header value'"></textarea>
        </form>
      </div>

      <div class="modal-footer">
        <a type="button" class="btn btn-success vschc-import-btn">
            <i class="fa fa-floppy-o" aria-hidden="true"></i>
            <span>Import</span>
        </a>
      </div>
    </div>
  </div>
</div>

`;
                },
                getHeaderButtons: () => {
                    return `
<a class="btn btn-primary btn-sm" id="vschc-import-request-btn" title="Load Request Settings From File">
    <i class="fa fa-book" aria-hidden="true"></i>
</a>

<a class="btn btn-secondary btn-sm" id="vschc-export-request-btn" title="Save Request Settings To File">
    <i class="fa fa-floppy-o text-dark" aria-hidden="true"></i>
</a>

<a class="btn btn-secondary btn-sm" id="vschc-import-http-file-btn" title="Import HTTP File">
    <i class="fa fa-file-text text-dark" aria-hidden="true"></i>
</a>

<a class="btn btn-primary btn-sm" id="vschc-clone-request-btn" title="Clone The Settings Of That Request">
    <i class="fa fa-clone" aria-hidden="true"></i>
</a>
`;
                },
                getResourceUri: (path) => {
                    return this.getResourceUri(path);
                },
                name: 'http-request',
            });
        });
    }
    openReponseContentInApp(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let extension = data.suggestedExtension;
            if (false === extension) {
                extension = '';
            }
            extension = vscode_helpers.normalizeString(extension);
            if ('' === extension) {
                extension = 'txt';
            }
            yield vscode_helpers.tempFile((tempFile) => __awaiter(this, void 0, void 0, function* () {
                let tryDeleteTempFile = true;
                try {
                    yield vschc.confirm((yes) => __awaiter(this, void 0, void 0, function* () {
                        if (!yes) {
                            return;
                        }
                        const DATA = new Buffer(data.data, 'base64');
                        yield FSExtra.writeFile(tempFile, DATA);
                        yield vschc.exec(tempFile);
                        tryDeleteTempFile = false;
                    }), `The content will be opened / executed as '${tempFile}'. Are you sure to do that?`);
                }
                finally {
                    if (tryDeleteTempFile) {
                        try {
                            if (yield vscode_helpers.isFile(tempFile)) {
                                yield FSExtra.unlink(tempFile);
                            }
                        }
                        catch (_a) { }
                    }
                }
            }), {
                keep: true,
                prefix: 'vschc-',
                suffix: '.' + extension,
            });
        });
    }
    openReponseInEditor(response) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode_helpers.openAndShowTextDocument({
                content: this.createHTTPFromResponse(response).toString('ascii'),
                language: 'http',
            });
        });
    }
    openRequestInEditor(response) {
        return __awaiter(this, void 0, void 0, function* () {
            const REQUEST = response.request;
            if (!REQUEST) {
                return;
            }
            let data;
            {
                let http = `${REQUEST.method} ${REQUEST.url} HTTP/1.1\r\n`;
                if (REQUEST.headers) {
                    for (const H in REQUEST.headers) {
                        http += `${H}: ${REQUEST.headers[H]}\r\n`;
                    }
                }
                http += `\r\n`;
                data = new Buffer(http, 'ascii');
                if (!vscode_helpers.isEmptyString(REQUEST.body)) {
                    data = Buffer.concat([
                        data,
                        new Buffer(REQUEST.body, 'base64'),
                    ]);
                }
            }
            yield vscode_helpers.openAndShowTextDocument({
                content: data.toString('ascii'),
                language: 'http',
            });
        });
    }
    resetAllHeaders() {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            yield vschc.confirm((yes) => __awaiter(this, void 0, void 0, function* () {
                if (yes) {
                    yield ME.postMessage('resetAllHeadersCompleted');
                }
            }), 'Really remove all headers?');
        });
    }
    resetResponses() {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            yield vschc.confirm((yes) => __awaiter(this, void 0, void 0, function* () {
                if (yes) {
                    yield ME.postMessage('resetResponsesCompleted');
                }
            }), 'Are you sure to reset the current list of responses?');
        });
    }
    saveContent(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const OPTS = {
                saveLabel: 'Save response content',
            };
            if (data.suggestedExtension) {
                OPTS.filters = {
                    'HTTP Response': [data.suggestedExtension]
                };
            }
            yield vschc.saveFile((file) => __awaiter(this, void 0, void 0, function* () {
                yield FSExtra.writeFile(file.fsPath, new Buffer(data.data, 'base64'));
            }), OPTS);
        });
    }
    saveRawResponse(response) {
        return __awaiter(this, void 0, void 0, function* () {
            const DATA_TO_SAVE = this.createHTTPFromResponse(response);
            yield vschc.saveFile((file) => __awaiter(this, void 0, void 0, function* () {
                yield FSExtra.writeFile(file.fsPath, DATA_TO_SAVE);
            }), {
                filters: {
                    'HTTP file': ['http']
                },
                saveLabel: 'Save raw response',
            });
        });
    }
    sendRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            yield vscode_helpers.using(new vscode.CancellationTokenSource(), (cancelTokenSrc) => __awaiter(this, void 0, void 0, function* () {
                yield ME.invokeForCancellationTokenSource(cancelTokenSrc, () => __awaiter(this, void 0, void 0, function* () {
                    yield vscode_helpers.using(new vschc_http.HTTPClient(ME, request), (client) => __awaiter(this, void 0, void 0, function* () {
                        let err;
                        let result;
                        try {
                            client.setupFromActiveWorkspace();
                            result = yield client.send(cancelTokenSrc.token);
                        }
                        catch (e) {
                            err = e;
                        }
                        yield ME.sendRequestCompleted(err, result);
                    }));
                }));
            }));
        });
    }
    sendRequestCompleted(err, result) {
        return __awaiter(this, void 0, void 0, function* () {
            let r;
            if (err) {
                err = vscode_helpers.toStringSafe(err);
            }
            else {
                err = undefined;
                const RESP = result.response;
                const BODY = yield vscode_helpers.readAll(RESP);
                const GET_IF_TEXT = (d) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        if (!_.isNil(d)) {
                            if (!Buffer.isBuffer(d)) {
                                d = new Buffer(d, 'base64');
                            }
                            if (d.length > 0) {
                                return !(yield vscode_helpers.isBinaryContent(d));
                            }
                        }
                        return true;
                    }
                    catch (_a) { }
                    return false;
                });
                let url = `${result.url.protocol}//`;
                {
                    if (!_.isNil(result.url.auth)) {
                        url += vscode_helpers.toStringSafe(result.url.auth) + '@';
                    }
                    url += vscode_helpers.toStringSafe(result.url.host);
                    url += vscode_helpers.toStringSafe(result.url.path);
                }
                const REQUEST_BODY = yield result.readRequestBody();
                r = {
                    body: (BODY && BODY.length > 0) ? BODY.toString('base64') : null,
                    bodyIsText: yield GET_IF_TEXT(BODY),
                    code: RESP.statusCode,
                    headers: {},
                    httpVersion: RESP.httpVersion,
                    request: {
                        body: REQUEST_BODY,
                        bodyIsText: yield GET_IF_TEXT(REQUEST_BODY),
                        executionTime: result.executionTime,
                        headers: vscode_helpers.cloneObject(result.options.headers),
                        method: result.options.method,
                        startTime: result.startTime.toISOString(),
                        url: url,
                    },
                    suggestedExtension: false,
                    status: RESP.statusMessage,
                };
                if (r.headers) {
                    for (const H in RESP.headers) {
                        r.headers[NormalizeHeaderCase(H)] = RESP.headers[H];
                    }
                    r.suggestedExtension = MimeTypes.extension(RESP.headers['content-type']);
                }
            }
            yield this.postMessage('sendRequestCompleted', {
                error: err,
                response: r,
            });
        });
    }
    setBodyContentFromFile(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.postMessage('setBodyContentFromFile', opts);
        });
    }
    unsetBodyFromFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const ME = this;
            yield vschc.confirm((yes) => __awaiter(this, void 0, void 0, function* () {
                if (yes) {
                    yield ME.setBodyContentFromFile(null);
                }
            }), 'Do really want to unset the current body?');
        });
    }
}
exports.HTTPRequest = HTTPRequest;
/**
 * Adds a request to the global list.
 *
 * @param {IHTTPRequest} request The request to add.
 *
 * @return {boolean} Item has been added or not.
 */
function addRequest(request) {
    if (request) {
        return exports.REQUESTS.push(request);
    }
    return false;
}
exports.addRequest = addRequest;
/**
 * Creates a request data object from a HTTP file.
 *
 * @param {string} file The path to the file.
 *
 * @return {RequestData|false} The new object or (false) if failed.
 */
function fromHTTPFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
        file = vscode_helpers.toStringSafe(file);
        let data = false;
        const CRLF = vscode_helpers.toEOL(vscode.EndOfLine.CRLF);
        const HTTP = yield FSExtra.readFile(file, 'ascii');
        const HTTP_LINES = vscode_helpers.from(HTTP.split(CRLF)).skipWhile(x => {
            return vscode_helpers.isEmptyString(x);
        }).toArray();
        if (HTTP_LINES.length > 0) {
            let body;
            let headers = {};
            let method;
            let mime = '';
            let url = '';
            const FIRST_LINE = HTTP_LINES[0].trim();
            const METHOD_URL_SEP = FIRST_LINE.indexOf(' ');
            if (METHOD_URL_SEP > -1) {
                method = FIRST_LINE.substr(0, METHOD_URL_SEP).trim();
                const URL_VERSION_SEP = FIRST_LINE.lastIndexOf(' ');
                if (URL_VERSION_SEP > -1) {
                    // 012345678901234 [15]
                    // abcdef bcd jaka
                    // POST https://example.com/api/comments/1 HTTP/1.1
                    // 34 = 48
                    url = FIRST_LINE.substr(METHOD_URL_SEP + 1, URL_VERSION_SEP - METHOD_URL_SEP - 1);
                }
                else {
                    url = FIRST_LINE.substr(METHOD_URL_SEP + 1);
                }
            }
            else {
                method = FIRST_LINE;
            }
            method = method.toUpperCase().trim();
            if ('' === method) {
                method = 'GET';
            }
            url = vscode_helpers.toStringSafe(url).trim();
            const HEADER_LINES = vscode_helpers.from(HTTP_LINES).skip(1).select(l => {
                return l.trim();
            }).takeWhile(l => '' !== l).forEach(l => {
                let name;
                let value;
                const NAME_VALUE_SEP = l.indexOf(':');
                if (NAME_VALUE_SEP > -1) {
                    name = l.substr(0, NAME_VALUE_SEP);
                    value = l.substr(NAME_VALUE_SEP + 1);
                }
                else {
                    name = l;
                }
                name = vscode_helpers.toStringSafe(name).trim();
                if ('' !== name) {
                    headers[name] = vscode_helpers.toStringSafe(value).trim();
                }
            });
            for (const H in headers) {
                const NAME = vscode_helpers.normalizeString(H);
                const VALUE = headers[H];
                switch (NAME) {
                    case 'content-type':
                        mime = vscode_helpers.from(VALUE).takeWhile(c => {
                            return ';' !== c;
                        }).joinToString('');
                        break;
                }
            }
            mime = vscode_helpers.normalizeString(mime);
            if ('' === mime) {
                mime = false;
            }
            body = new Buffer(vscode_helpers.from(HTTP_LINES).skipWhile(l => {
                return !vscode_helpers.isEmptyString(l);
            }).skip(1).joinToString(CRLF), 'ascii');
            let requestBody = {
                content: false,
                file: false,
                fileSize: false,
                mime: mime,
            };
            if (Buffer.isBuffer(body)) {
                let fileSuffix = false;
                if (false !== mime) {
                    fileSuffix = MimeTypes.extension(mime);
                }
                yield vscode_helpers.tempFile((bodyFile) => __awaiter(this, void 0, void 0, function* () {
                    yield FSExtra.writeFile(bodyFile, body);
                    requestBody.content = yield FSExtra.readFile(bodyFile, 'base64');
                    requestBody.file = bodyFile;
                    requestBody.fileSize = yield vscode_helpers.size(bodyFile);
                }), {
                    suffix: false === fileSuffix ? ''
                        : ('.' + fileSuffix),
                });
            }
            data = {
                body: requestBody,
                headers: headers,
                method: method,
                title: false,
                url: url,
            };
        }
        return data;
    });
}
exports.fromHTTPFile = fromHTTPFile;
/**
 * Removes a request from the global list.
 *
 * @param {IHTTPRequest} request The request to remove.
 *
 * @return {IHTTPRequest[]} The list of removed items.
 */
function removeRequest(request) {
    const REMOVED_REQUESTS = [];
    if (request) {
        for (let i = 0; i < exports.REQUESTS.length;) {
            const R = exports.REQUESTS[i];
            if (R.id === request.id) {
                exports.REQUESTS.splice(i, 1);
                REMOVED_REQUESTS.push(R);
            }
            else {
                ++i;
            }
        }
    }
    return REMOVED_REQUESTS;
}
exports.removeRequest = removeRequest;
/**
 * Restores all saved requests.
 */
function restoreSavedRequests() {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO: implement
    });
}
exports.restoreSavedRequests = restoreSavedRequests;
/**
 * Saves all open requests.
 */
function saveOpenRequests() {
    return __awaiter(this, void 0, void 0, function* () {
        for (const R of vscode_helpers.asArray(exports.REQUESTS)) {
            try {
                // TODO: implement
            }
            catch (_a) { }
        }
    });
}
exports.saveOpenRequests = saveOpenRequests;
/**
 * Starts a new request.
 *
 * @param {StartNewRequestOptions} [opts] Custom options.
 *
 * @return {Promise<IHTTPRequest>} The promise with the new request object.
 */
function startNewRequest(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        let newRequest;
        try {
            newRequest = new HTTPRequest();
            yield newRequest.initialize();
            yield newRequest.start(opts);
            addRequest(newRequest);
            return newRequest;
        }
        catch (e) {
            vscode_helpers.tryDispose(newRequest);
            throw e;
        }
    });
}
exports.startNewRequest = startNewRequest;
//# sourceMappingURL=requests.js.map