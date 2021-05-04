"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXlfFilesForExtensions = exports.packageADSExtensionsStream = exports.modifyI18nPackFiles = void 0;
const path = require("path");
const fs = require("fs");
const Is = require("is");
const gulp = require("gulp");
const glob = require("glob");
const rename = require("gulp-rename");
const es = require("event-stream");
const event_stream_1 = require("event-stream");
const File = require("vinyl");
const i18n = require("./i18n");
const ext = require("./extensions");
const extensionsProject = 'extensions';
const i18nPackVersion = '1.0.0';
const root = path.dirname(path.dirname(__dirname));
function createI18nFile(originalFilePath, messages) {
    let result = Object.create(null);
    result[''] = [
        '--------------------------------------------------------------------------------------------',
        'Copyright (c) Microsoft Corporation. All rights reserved.',
        'Licensed under the Source EULA. See License.txt in the project root for license information.',
        '--------------------------------------------------------------------------------------------',
        'Do not edit this file. It is machine generated.'
    ];
    for (let key of Object.keys(messages)) {
        result[key] = messages[key];
    }
    let content = JSON.stringify(result, null, '\t');
    if (process.platform === 'win32') {
        content = content.replace(/\n/g, '\r\n');
    }
    return new File({
        path: path.join(originalFilePath + '.i18n.json'),
        contents: Buffer.from(content, 'utf8')
    });
}
function updateMainI18nFile(existingTranslationFilePath, originalFilePath, messages) {
    let currFilePath = path.join(existingTranslationFilePath + '.i18n.json');
    let currentContent = fs.readFileSync(currFilePath);
    let currentContentObject = JSON.parse(currentContent.toString());
    let result = Object.create(null);
    messages.contents = Object.assign(Object.assign({}, currentContentObject.contents), messages.contents);
    result[''] = [
        '--------------------------------------------------------------------------------------------',
        'Copyright (c) Microsoft Corporation. All rights reserved.',
        'Licensed under the Source EULA. See License.txt in the project root for license information.',
        '--------------------------------------------------------------------------------------------',
        'Do not edit this file. It is machine generated.'
    ];
    for (let key of Object.keys(messages)) {
        result[key] = messages[key];
    }
    let content = JSON.stringify(result, null, '\t');
    if (process.platform === 'win32') {
        content = content.replace(/\n/g, '\r\n');
    }
    return new File({
        path: path.join(originalFilePath + '.i18n.json'),
        contents: Buffer.from(content, 'utf8'),
    });
}
function modifyI18nPackFiles(existingTranslationFolder, adsExtensions, resultingTranslationPaths, pseudo = false) {
    let parsePromises = [];
    let mainPack = { version: i18nPackVersion, contents: {} };
    let extensionsPacks = {};
    let errors = [];
    return event_stream_1.through(function (xlf) {
        let project = path.basename(path.dirname(xlf.relative));
        let resource = path.basename(xlf.relative, '.xlf');
        let contents = xlf.contents.toString();
        let parsePromise = pseudo ? i18n.XLF.parsePseudo(contents) : i18n.XLF.parse(contents);
        parsePromises.push(parsePromise);
        parsePromise.then(resolvedFiles => {
            resolvedFiles.forEach(file => {
                const path = file.originalFilePath;
                const firstSlash = path.indexOf('/');
                if (project === extensionsProject) {
                    let extPack = extensionsPacks[resource];
                    if (!extPack) {
                        extPack = extensionsPacks[resource] = { version: i18nPackVersion, contents: {} };
                    }
                    const adsId = adsExtensions[resource];
                    if (adsId) { // internal ADS extension: remove 'extensions/extensionId/' segnent
                        const secondSlash = path.indexOf('/', firstSlash + 1);
                        extPack.contents[path.substr(secondSlash + 1)] = file.messages;
                    }
                    else {
                        extPack.contents[path] = file.messages;
                    }
                }
                else {
                    mainPack.contents[path.substr(firstSlash + 1)] = file.messages;
                }
            });
        }).catch(reason => {
            errors.push(reason);
        });
    }, function () {
        Promise.all(parsePromises)
            .then(() => {
            if (errors.length > 0) {
                throw errors;
            }
            const translatedMainFile = updateMainI18nFile(existingTranslationFolder + '\\main', './main', mainPack);
            this.queue(translatedMainFile);
            for (let extension in extensionsPacks) {
                const translatedExtFile = createI18nFile(`extensions/${extension}`, extensionsPacks[extension]);
                this.queue(translatedExtFile);
                const adsExtensionId = adsExtensions[extension];
                if (adsExtensionId) {
                    resultingTranslationPaths.push({ id: adsExtensionId, resourceName: `extensions/${extension}.i18n.json` });
                }
                else {
                    resultingTranslationPaths.push({ id: `vscode.${extension}`, resourceName: `extensions/${extension}.i18n.json` });
                }
            }
            this.queue(null);
        })
            .catch((reason) => {
            this.emit('error', reason);
        });
    });
}
exports.modifyI18nPackFiles = modifyI18nPackFiles;
var LocalizeInfo;
(function (LocalizeInfo) {
    function is(value) {
        let candidate = value;
        return Is.defined(candidate) && Is.string(candidate.key) && (Is.undef(candidate.comment) || (Is.array(candidate.comment) && candidate.comment.every(element => Is.string(element))));
    }
    LocalizeInfo.is = is;
})(LocalizeInfo || (LocalizeInfo = {}));
var PackageJsonFormat;
(function (PackageJsonFormat) {
    function is(value) {
        if (Is.undef(value) || !Is.object(value)) {
            return false;
        }
        return Object.keys(value).every(key => {
            let element = value[key];
            return Is.string(element) || (Is.object(element) && Is.defined(element.message) && Is.defined(element.comment));
        });
    }
    PackageJsonFormat.is = is;
})(PackageJsonFormat || (PackageJsonFormat = {}));
function packageADSExtensionsStream() {
    const currentADSJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../i18nExtensions/ADSExtensions.json'), 'utf8'));
    const ADSExtensions = currentADSJson.ADSExtensions;
    const extenalExtensionDescriptions = glob.sync('extensions/*/package.json')
        .map(manifestPath => {
        const extensionPath = path.dirname(path.join(root, manifestPath));
        const extensionName = path.basename(extensionPath);
        return { name: extensionName, path: extensionPath };
    })
        .filter(({ name }) => ADSExtensions[name] !== undefined);
    const builtExtensions = extenalExtensionDescriptions.map(extension => {
        return fromLocal(extension.path, false)
            .pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
    });
    return es.merge(builtExtensions);
}
exports.packageADSExtensionsStream = packageADSExtensionsStream;
function fromLocal(extensionPath, forWeb) {
    const webpackConfigFileName = forWeb ? 'extension-browser.webpack.config.js' : 'extension.webpack.config.js';
    const isWebPacked = fs.existsSync(path.join(extensionPath, webpackConfigFileName));
    //let input = ext.fromLocalNormal(extensionPath);
    let input = isWebPacked
        ? ext.fromLocalWebpack(extensionPath, webpackConfigFileName)
        : ext.fromLocalNormal(extensionPath);
    if (isWebPacked) {
        input = ext.updateExtensionPackageJSON(input, (data) => {
            delete data.scripts;
            delete data.dependencies;
            delete data.devDependencies;
            if (data.main) {
                data.main = data.main.replace('/out/', /dist/);
            }
            return data;
        });
    }
    return input;
}
function createXlfFilesForExtensions() {
    let counter = 0;
    let folderStreamEnded = false;
    let folderStreamEndEmitted = false;
    return event_stream_1.through(function (extensionFolder) {
        const folderStream = this;
        const stat = fs.statSync(extensionFolder.path);
        if (!stat.isDirectory()) {
            return;
        }
        let extensionName = path.basename(extensionFolder.path);
        counter++;
        let _xlf;
        function getXlf() {
            if (!_xlf) {
                _xlf = new i18n.XLF(extensionsProject);
            }
            return _xlf;
        }
        gulp.src([`.locbuild/builtInExtensions/${extensionName}/package.nls.json`, `.locbuild/extensions/${extensionName}/package.nls.json`, `.locbuild/extensions/${extensionName}/**/nls.metadata.json`], { allowEmpty: true }).pipe(event_stream_1.through(function (file) {
            if (file.isBuffer()) {
                const buffer = file.contents;
                const basename = path.basename(file.path);
                if (basename === 'package.nls.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    const keys = Object.keys(json);
                    const messages = keys.map((key) => {
                        const value = json[key];
                        if (Is.string(value)) {
                            return value;
                        }
                        else if (value) {
                            return value.message;
                        }
                        else {
                            return `Unknown message for key: ${key}`;
                        }
                    });
                    getXlf().addFile(`extensions/${extensionName}/package`, keys, messages);
                }
                else if (basename === 'nls.metadata.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    const relPath = path.relative(`.locbuild/extensions/${extensionName}`, path.dirname(file.path));
                    for (let file in json) {
                        const fileContent = json[file];
                        getXlf().addFile(`extensions/${extensionName}/${relPath}/${file}`, fileContent.keys, fileContent.messages);
                    }
                }
                else {
                    this.emit('error', new Error(`${file.path} is not a valid extension nls file`));
                    return;
                }
            }
        }, function () {
            if (_xlf) {
                let xlfFile = new File({
                    path: path.join(extensionsProject, extensionName + '.xlf'),
                    contents: Buffer.from(_xlf.toString(), 'utf8')
                });
                folderStream.queue(xlfFile);
            }
            this.queue(null);
            counter--;
            if (counter === 0 && folderStreamEnded && !folderStreamEndEmitted) {
                folderStreamEndEmitted = true;
                folderStream.queue(null);
            }
        }));
    }, function () {
        folderStreamEnded = true;
        if (counter === 0) {
            folderStreamEndEmitted = true;
            this.queue(null);
        }
    });
}
exports.createXlfFilesForExtensions = createXlfFilesForExtensions;