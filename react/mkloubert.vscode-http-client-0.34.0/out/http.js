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
const HTTP = require("http");
const HTTPs = require("https");
const Moment = require("moment");
const NormalizeHeaderCase = require("header-case-normalizer");
const URL = require("url");
const vschc = require("./extension");
const vscode_helpers = require("vscode-helpers");
const vscode_workspaces = require("./workspaces");
/**
 * A HTTP client.
 */
class HTTPClient extends vscode_helpers.DisposableBase {
    /**
     * Initializes a new instance of that class.
     *
     * @param {vschc_requests.IHTTPRequest} request The request.
     * @param {vschc_requests.RequestData} data The data.
     * @param {vscode.CancellationToken} [cancelToken] An optional cancellation token to use.
     */
    constructor(request, data, cancelToken) {
        super();
        this.request = request;
        this.data = data;
        this.cancelToken = cancelToken;
        this._noResult = false;
        this._rejectUnauthorized = false;
        this.unsetAll();
        this.unsetOnDidSendListeners();
    }
    /**
     * Gets or sets the custom value for the body.
     *
     * @param {any} [newValue] The new custom value.
     *
     * @return {HTTPClientValue<Buffer>}
     */
    body(newValue) {
        if (arguments.length > 0) {
            if (_.isSymbol(newValue)) {
                newValue = vschc.IS_UNSET;
            }
            this._body = newValue;
            return this;
        }
        return this._body;
    }
    /**
     * Gets or sets the custom headers.
     *
     * @param {string} [name] The name of the header. If not defined an object with all custom headers is returned.
     * @param {any} [newValue] The value for the header. If not defined, the current value is returned.
     *
     * @return {HTTPClientValue<any>}
     */
    header(name, newValue) {
        if (arguments.length < 1) {
            return this._headers;
        }
        name = vscode_helpers.normalizeString(name);
        if (arguments.length < 2) {
            let value = this._headers[name];
            if (_.isNil(value)) {
                value = vschc.IS_UNSET;
            }
            return value;
        }
        if (_.isSymbol(newValue)) {
            delete this._headers[name];
        }
        else {
            this._headers[name] = vscode_helpers.toStringSafe(newValue);
        }
        return this;
    }
    /**
     * Gets or sets the custom HTTP.
     *
     * @param {any} [newValue] The new value.
     *
     * @return {HTTPClientValue<string>}
     */
    method(newValue) {
        if (arguments.length > 0) {
            if (_.isSymbol(newValue)) {
                newValue = vschc.IS_UNSET;
            }
            else if (!_.isNil(newValue)) {
                newValue = vscode_helpers.toStringSafe(newValue);
            }
            this._method = newValue;
            return this;
        }
        return this._method;
    }
    /**
     * Gets or sets if a result should be shown or not.
     *
     * @param {any} [newValue] The new value.
     *
     * @return {boolean|this}
     */
    noResult(newValue) {
        if (arguments.length > 0) {
            this._noResult = vscode_helpers.toBooleanSafe(newValue);
            return this;
        }
        return this._noResult;
    }
    /**
     * Adds an event listener that is invoked AFTER a request has been send.
     *
     * @param {OnDidSendListener} listener The listener to add.
     *
     * @return {this}
     */
    onDidSend(listener) {
        if (listener) {
            this._onDidSend.push(listener);
        }
        return this;
    }
    /**
     * Gets or sets the custom query parameter(s).
     *
     * @param {string} [name] The name of the header. If not defined an object with all custom parameters is returned.
     * @param {any} [newValue] The value for the header. If not defined, the current value is returned.
     *
     * @return {HTTPClientValue<any>}
     */
    param(name, newValue) {
        if (arguments.length < 1) {
            return this._query;
        }
        name = vscode_helpers.toStringSafe(name).trim();
        if (arguments.length < 2) {
            let value = this._query[name];
            if (_.isNil(value)) {
                value = vschc.IS_UNSET;
            }
            return value;
        }
        if (_.isSymbol(newValue)) {
            delete this._query[name];
        }
        else {
            this._query[name] = vscode_helpers.toStringSafe(newValue);
        }
        return this;
    }
    /**
     * Gets or sets the 'rejectUnauthorized' for secure HTTP requests.
     *
     * @param {any} [newValue] The new value.
     *
     * @return {boolean|this}
     */
    rejectUnauthorized(newValue) {
        if (arguments.length < 1) {
            return this._rejectUnauthorized;
        }
        this._rejectUnauthorized = vscode_helpers.toBooleanSafe(newValue);
        return this;
    }
    /**
     * Sends the request based on the current data.
     *
     * @param {vscode.CancellationToken} [token] The (custom) cancellation token to use.
     */
    send(token) {
        const START_TIME = Moment.utc();
        const ME = this;
        if (arguments.length < 1) {
            token = ME.cancelToken; // use default
        }
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let completedInvoked = false;
            const COMPLETED = (err, result) => __awaiter(this, void 0, void 0, function* () {
                const END_TIME = Moment.utc();
                if (result) {
                    result.executionTime = END_TIME.diff(START_TIME, 'milliseconds');
                }
                if (completedInvoked) {
                    return;
                }
                completedInvoked = true;
                if (!ME._noResult) {
                    for (const L of vscode_helpers.toArray(ME._onDidSend)) {
                        yield Promise.resolve(L(err, result));
                    }
                }
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
            const COMPLETED_SYNC = (err, result) => {
                try {
                    COMPLETED(err, result).then(() => {
                    }, (err) => {
                        reject(err);
                    });
                }
                catch (e) {
                    reject(e);
                }
            };
            try {
                const DATA = vscode_helpers.cloneObject(ME.data);
                let requestUrlValue = ME._url;
                if (_.isSymbol(requestUrlValue)) {
                    requestUrlValue = vscode_helpers.toStringSafe(DATA.url); // no custom URL
                }
                if (!vscode_helpers.normalizeString(requestUrlValue).startsWith('http')) {
                    requestUrlValue = 'http://' + requestUrlValue;
                }
                const REQUEST_URL = URL.parse(requestUrlValue);
                const PROTOCOL = vscode_helpers.normalizeString(REQUEST_URL.protocol);
                let createRequest = false;
                let newRequest;
                const OPTS = {
                    auth: REQUEST_URL.auth,
                    headers: {},
                    hostname: vscode_helpers.toStringSafe(REQUEST_URL.hostname),
                    method: ME._method,
                    path: REQUEST_URL.pathname,
                    timeout: ME._timeout,
                };
                let bodyReader;
                const CALLBACK = (resp) => {
                    COMPLETED_SYNC(null, {
                        data: DATA,
                        executionTime: undefined,
                        options: OPTS,
                        readRequestBody: bodyReader,
                        request: newRequest,
                        response: resp,
                        startTime: START_TIME,
                        url: REQUEST_URL,
                    });
                };
                if (_.isSymbol(OPTS.method)) {
                    OPTS.method = vscode_helpers.toStringSafe(DATA.method); // no custom method
                }
                if (_.isSymbol(OPTS.timeout)) {
                    OPTS.timeout = 10000; // no custom timeout
                }
                const APPLY_HEADERS = (headersToApply) => __awaiter(this, void 0, void 0, function* () {
                    if (headersToApply) {
                        for (const H in headersToApply) {
                            const NAME = NormalizeHeaderCase(H);
                            if ('' !== NAME) {
                                let value = yield asStringValue(headersToApply[H]);
                                if (!_.isSymbol(value)) {
                                    if ('Authorization' === NAME) {
                                        if (value.toLowerCase().trim().startsWith('basic ')) {
                                            const AUTH_SEP = value.indexOf(':');
                                            if (AUTH_SEP > -1) {
                                                // automatically convert to Base64 string
                                                value = value.trim();
                                                value = value.substr(value.indexOf(' ') + 1).trim();
                                                value = 'Basic ' + (new Buffer(value, 'ascii')).toString('base64');
                                            }
                                        }
                                    }
                                    OPTS.headers[NAME] = value;
                                }
                            }
                        }
                    }
                });
                yield APPLY_HEADERS(DATA.headers); // first the default value
                yield APPLY_HEADERS(ME._headers); // then the custom ones
                if (vscode_helpers.isEmptyString(OPTS.hostname)) {
                    OPTS.hostname = '127.0.0.1';
                }
                if (vscode_helpers.isEmptyString(OPTS.method)) {
                    OPTS.method = 'GET';
                }
                OPTS.method = OPTS.method.toUpperCase().trim();
                OPTS.port = parseInt(vscode_helpers.normalizeString(REQUEST_URL.port));
                // query params
                let query = [];
                {
                    const APPLY_PARAMS = (q) => __awaiter(this, void 0, void 0, function* () {
                        if (q) {
                            for (let p in q) {
                                const VALUE = yield asStringValue(q[p]);
                                if (!_.isSymbol(VALUE)) {
                                    query.push({
                                        'name': vscode_helpers.toStringSafe(p).trim(),
                                        'value': VALUE,
                                    });
                                }
                            }
                        }
                    });
                    yield APPLY_PARAMS(uriParamsToObject(REQUEST_URL));
                    yield APPLY_PARAMS(ME._query);
                    if (query.length > 0) {
                        OPTS.path += '?';
                        OPTS.path += query.map(x => {
                            return `${x.name}=${encodeURIComponent(x.value)}`;
                        }).join('&');
                    }
                }
                switch (PROTOCOL) {
                    case 'http:':
                        createRequest = () => {
                            const HTTP_OPTS = OPTS;
                            HTTP_OPTS.protocol = 'http:';
                            if (isNaN(HTTP_OPTS.port)) {
                                HTTP_OPTS.port = 80;
                            }
                            return HTTP.request(HTTP_OPTS, CALLBACK);
                        };
                        break;
                    case 'https:':
                        createRequest = () => {
                            const HTTPs_OPTS = OPTS;
                            HTTPs_OPTS.rejectUnauthorized = vscode_helpers.toBooleanSafe(ME._rejectUnauthorized);
                            HTTPs_OPTS.protocol = 'https:';
                            if (isNaN(HTTPs_OPTS.port)) {
                                HTTPs_OPTS.port = 443;
                            }
                            return HTTPs.request(HTTPs_OPTS, CALLBACK);
                        };
                        break;
                }
                if (false === createRequest) {
                    throw new Error(`Invalid protocol '${PROTOCOL}'!`);
                }
                newRequest = createRequest();
                let body = ME._body;
                if (_.isSymbol(body)) {
                    body = undefined; // no custom body
                    if (DATA.body) {
                        if (false !== DATA.body.content) {
                            body = new Buffer(vscode_helpers.toStringSafe(DATA.body.content).trim(), 'base64');
                        }
                    }
                }
                body = yield vscode_helpers.asBuffer(body);
                if (body && body.length > 0) {
                    newRequest.write(body);
                }
                bodyReader = () => __awaiter(this, void 0, void 0, function* () {
                    if (body) {
                        return body.toString('base64');
                    }
                });
                newRequest.once('error', (err) => {
                    if (err) {
                        COMPLETED_SYNC(err);
                    }
                });
                const ABORT = () => {
                    let err = null;
                    try {
                        newRequest.abort();
                    }
                    catch (e) {
                        err = e;
                    }
                    COMPLETED_SYNC(err);
                };
                if (token) {
                    token.onCancellationRequested(() => {
                        ABORT();
                    });
                }
                newRequest.end();
            }
            catch (e) {
                COMPLETED_SYNC(e);
            }
        }));
    }
    /**
     * Sets up settings from active workspace.
     *
     * @return this
     */
    setupFromActiveWorkspace() {
        const ACTIVE_WORKSPACE = vscode_workspaces.getActiveWorkspace();
        if (ACTIVE_WORKSPACE) {
            const CFG = ACTIVE_WORKSPACE.config;
            if (CFG) {
                this._rejectUnauthorized = vscode_helpers.toBooleanSafe(CFG.rejectUnauthorized);
            }
        }
        return this;
    }
    /**
     * Gets or sets the custom timeout.
     *
     * @param {any} [newValue] The new value.
     *
     * @return {HTTPClientValue<number>}
     */
    timeout(newValue) {
        if (arguments.length < 1) {
            return this._timeout;
        }
        if (_.isSymbol(newValue)) {
            newValue = vschc.IS_UNSET;
        }
        else {
            newValue = parseInt(vscode_helpers.toStringSafe(newValue).trim());
            if (isNaN(newValue)) {
                newValue = undefined;
            }
        }
        this._timeout = newValue;
        return this;
    }
    /**
     * Unsets all custom values.
     *
     * @return {this}
     */
    unsetAll() {
        this.unsetBody();
        this.unsetHeaders();
        this.unsetMethod();
        this.unsetParams();
        this.unsetTimeout();
        this.unsetUrl();
        return this;
    }
    /**
     * Unsets the custom body.
     *
     * @return {this}
     */
    unsetBody() {
        this._body = vschc.IS_UNSET;
        return this;
    }
    /**
     * Unsets the custom headers.
     *
     * @return {this}
     */
    unsetHeaders() {
        this._headers = {};
        return this;
    }
    /**
     * Unsets the custom HTTP method.
     *
     * @return {this}
     */
    unsetMethod() {
        this._method = vschc.IS_UNSET;
        return this;
    }
    /**
     * Unsets all 'onDidSend' listeners.
     *
     * @return {this}
     */
    unsetOnDidSendListeners() {
        this._onDidSend = [];
        return this;
    }
    /**
     * Unsets the custom query parameters.
     *
     * @return {this}
     */
    unsetParams() {
        this._query = {};
        return this;
    }
    /**
     * Unsets the custom timeout.
     *
     * @return {this}
     */
    unsetTimeout() {
        this._timeout = vschc.IS_UNSET;
        return this;
    }
    /**
     * Unsets the custom url.
     *
     * @return {this}
     */
    unsetUrl() {
        this._url = vschc.IS_UNSET;
        return this;
    }
    /**
     * Gets or sets the custom URL.
     *
     * @param {any} [newValue] The new value.
     *
     * @return {HTTPClientValue<string>}
     */
    url(newValue) {
        if (arguments.length > 0) {
            if (_.isSymbol(newValue)) {
                newValue = vschc.IS_UNSET;
            }
            else if (!_.isNil(newValue)) {
                newValue = vscode_helpers.toStringSafe(newValue);
            }
            this._url = newValue;
            return this;
        }
        return this._url;
    }
}
exports.HTTPClient = HTTPClient;
function asStringValue(val) {
    return __awaiter(this, void 0, void 0, function* () {
        if (_.isString(val)) {
            return val;
        }
        if (_.isSymbol(val)) {
            return vschc.IS_UNSET;
        }
        if (!_.isNil(val)) {
            if (Moment.isDate(val)) {
                return Moment(val).toISOString();
            }
            else if (Moment.isMoment(val)) {
                val = val.toISOString();
            }
            else {
                val = (yield vscode_helpers.asBuffer(val)).toString('ascii');
            }
        }
        return vscode_helpers.toStringSafe(val);
    });
}
function uriParamsToObject(uri) {
    if (!uri) {
        return uri;
    }
    let params;
    if (!vscode_helpers.isEmptyString(uri.query)) {
        // s. https://css-tricks.com/snippets/jquery/get-query-params-object/
        params = uri.query.replace(/(^\?)/, '')
            .split("&")
            .map(function (n) {
            return n = n.split("="), this[vscode_helpers.normalizeString(n[0])] =
                vscode_helpers.toStringSafe(decodeURIComponent(n[1])), this;
        }
            .bind({}))[0];
    }
    return params || {};
}
//# sourceMappingURL=http.js.map