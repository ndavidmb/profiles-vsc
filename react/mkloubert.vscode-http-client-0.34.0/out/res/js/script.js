
function vschc_apply_highlight(selector) {
    selector.find('pre code').each(function(i, block) {
        hljs.highlightBlock(block);
    });
}

function vschc_as_array(val) {
    if (!Array.isArray(val)) {
        val = [ val ];
    }

    return val;
}

function vschc_external_url(url, text) {
    vschc_post('openExternalUrl', {
        text: vschc_to_string(text),
        url: vschc_to_string(url)
    });
}

function vschc_from_markdown(md) {
    const CONVERTER = vschc_showdown();

    const HTML = CONVERTER.makeHtml( vschc_to_string(md) );

    const CONTENT = jQuery('<div class="vschc-markdown" />');
    CONTENT.html( HTML );

    CONTENT.find('script')
           .remove();

    CONTENT.find('table')
           .addClass('table')
           .addClass('table-striped')
           .addClass('table-hover');

    CONTENT.find('img')
           .addClass('img-fluid');

    CONTENT.find('a').each(function() {
        const A = jQuery(this);

        let text = vschc_to_string( A.text() );
        let href = vschc_to_string( A.attr('href') );

        if ('' === text.trim()) {
            text = href;
        }

        A.attr('href', '#');
        A.on('click', function() {
            vschc_external_url(href, text);
        });
    });

    return CONTENT;
}

function vschc_get_content_type(headers) {
    if (headers) {
        for (const H in headers) {
            if ('content-type' === vschc_normalize_str(H)) {
                return vschc_normalize_str( headers[H] ).split(';')[0].trim();
            }
        }
    }
}

function vschc_is_empty(val) {
    return !val || !val.length;
}

function vschc_is_empty_str(val) {
    return '' === vschc_normalize_str(val);
}

function vschc_is_nil(val) {
    return null === val ||
           'undefined' === typeof val;
}

function vschc_is_mime(mime, list) {
    mime = vschc_normalize_str(mime).split(';')[0].trim();
    list = vschc_as_array(list);

    for (const ITEM of list) {
        if (vschc_normalize_str(ITEM) === mime) {
            return true;
        }
    }

    return false;
}

function vschc_normalize_str(val) {
    return vschc_to_string(val).toLowerCase().trim();
}

function vschc_open_url(urlId) {
    vschc_post('openKnownUrl',
               vschc_normalize_str(urlId));
}

function vschc_post(command, data) {
    vscode.postMessage({
        command: vschc_to_string(command),
        data: data
    });
}

function vschc_showdown() {
    return new showdown.Converter({
        completeHTMLDocument: false,
        ghCodeBlocks: true,
        ghCompatibleHeaderId: true,
        headerLevelStart: 3,
        openLinksInNewWindow: false,
        simpleLineBreaks: true,
        simplifiedAutoLink: true,
        tables: true
    });
}

function vschc_to_string(val) {
    if ('string' === typeof val) {
        return val;
    }

    if (vschc_is_nil(val)) {
        return '';
    }

    try {
        if (val instanceof Error) {
            let errName = '';
            try {
                if (val.constructor) {
                    errName = val.constructor.name;
                }

                if (errName) {
                    errName = ` ('${ errName }')`;
                }
            } catch (e) {
                errName = '';
            }
    
            return `ERROR${ errName }: ${ val.message }
    
${ val.stack }`;
        }
    } catch (e) { }

    try {
        if ('function' === typeof val['toString']) {
            return '' + val.toString();
        }
    } catch (e) { }

    try {
        if (Array.isArray(val) || ('object' === typeof val)) {
            return JSON.stringify(val);
        }
    } catch (e) { }

    try {
        return '' + val;
    } catch (e) { }

    return '';
}

jQuery(() => {
    jQuery('#vschc-to-top-btn').on('click', () => {
        const BODY_TOP = jQuery('#vschc-body-top');

        jQuery(document).scrollTop(
            BODY_TOP.offset().top - BODY_TOP.outerHeight(true) - 24
        );
    });

    jQuery('#vschc-to-bottom-btn').on('click', () => {
        const BODY_BOTTOM = jQuery('#vschc-body-bottom');

        jQuery(document).scrollTop(
            BODY_BOTTOM.offset().top - BODY_BOTTOM.outerHeight(true) - 24
        );
    });

    jQuery('.vschc-btn-with-known-url').on('click', function() {
        const BTN = jQuery(this);

        const URL_ID = vschc_normalize_str( BTN.attr('vschc-url') );
        if ('' === URL_ID) {
            return;
        }

        vschc_open_url(URL_ID);
    });
});
