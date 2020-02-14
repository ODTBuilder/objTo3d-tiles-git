'use strict';
var path = require('path');
var fsExtra = require('fs-extra');
var obj2gltf = require('./obj2gltf');
var obj2B3dm = require('./obj2B3dm');
var obj2I3dm = require('./obj2I3dm');
var obj2Tileset = require('./obj2Tileset');
var combine = require('./combineTileset');
var fs = require('fs');
var request = require('request');
const zl = require("zip-lib");

module.exports = editObj23dtiles;

function editObj23dtiles(req, res, objPath, b3dmPath, options, exportPath, unzippath, urloptions) {
    //  console.time('Total');

    var user = req.body.user;
    var time = req.body.time;
    var originObjFolder = req.body.originObjFolder;

    var serverhost = urloptions.host;
    var serverport = urloptions.port;
    var strarr = urloptions.path.split('/');
    var serverpath = strarr[1];

    var tilesetOptionspath = options.tilesetOptions;
    var customBatchTablepath = options.customBatchTable;
    var customFeatureTablepath = options.customBatchTable;

    if (typeof options.tilesetOptions === 'string') {
        options.tilesetOptions = fsExtra.readJsonSync(options.tilesetOptions);
    }
    if (typeof options.customBatchTable === 'string') {
        options.customBatchTable = fsExtra.readJsonSync(options.customBatchTable);
    }
    if (typeof options.customFeatureTable === 'string') {
        options.customFeatureTable = fsExtra.readJsonSync(options.customFeatureTable);
    }

    if (options && options.tileset) {
        if (!options.i3dm) {
            options.binary = true;
            options.batchId = true;
            options.b3dm = true;

            var iscombined = false;

            var writeb3dmpath;
            var writetilessetpath;
            var writefolder;

            obj2Tileset(objPath, b3dmPath, options, iscombined)
                .then(function (result) {
                    var b3dm = result.b3dm;
                    var batchTableJson = result.batchTableJson;
                    var tileset = result.tilesetJson;
                    var tilePath = result.tilePath;
                    var tilesetPath = result.tilesetPath;

                    if (options.outputBatchTable) {
                        var batchTableJsonPath = tilePath.replace(/\.[^/.]+$/, '') + '_batchTable.json';
                        fsExtra.ensureDirSync(path.dirname(batchTableJsonPath));
                        fsExtra.writeJsonSync(batchTableJsonPath, batchTableJson, { spaces: 2 });
                    }

                    var tasks = [];
                    fsExtra.ensureDirSync(path.dirname(tilePath));
                    tasks.push(fsExtra.outputFileSync(tilePath, b3dm));
                    tasks.push(fsExtra.writeJsonSync(tilesetPath, tileset, { spaces: 2 }));

                    writeb3dmpath = tilePath;
                    writetilessetpath = tilesetPath;
                    writefolder = result.tilesetFolderName;

                    fs.unlinkSync(objPath);
                    fs.existsSync(tilesetOptionspath) && fs.unlinkSync(tilesetOptionspath);
                    fs.existsSync(customBatchTablepath) && fs.unlinkSync(customBatchTablepath);
                    fs.existsSync(customFeatureTablepath) && fs.unlinkSync(customFeatureTablepath);

                    return Promise.all(tasks);
                })
                .then(function () {

                    var b3dmarr = writeb3dmpath.split("\\");
                    var tilearr = writetilessetpath.split("\\");

                    var b3dmfilename = b3dmarr[b3dmarr.length - 1];
                    var tilefilename = tilearr[tilearr.length - 1];

                    fs.renameSync(writeb3dmpath, unzippath + b3dmfilename);
                    fs.renameSync(writetilessetpath, unzippath + tilefilename);
                    fs.rmdirSync(unzippath + writefolder);

                    var zipname = unzippath + 'edit3dtiles.zip';
                    zl.archiveFolder(unzippath, zipname).then(function () {
                        console.log("edit3dtiles.zip done");
                        request.post({
                            url: 'http://' + serverhost + ':' + serverport + '/' + serverpath + '/uploadEdit3dtiles.do',
                            formData: {
                                file: fs.createReadStream(zipname),
                                filetype: 'zip',
                                filename: 'edit3dtiles.zip',
                                originObjFolder : originObjFolder,
                                user: user,
                                time: time
                            },
                        }, function (error, response, body) {
                            var bodyjson = JSON.parse(body);
                            if (bodyjson.succ === true) {
                                deleteFolderRecursive(exportPath);
                                function deleteFolderRecursive(exportPath) {
                                    if (fs.existsSync(exportPath)) {
                                        fs.readdirSync(exportPath).forEach(function (file) {
                                            var curPath = exportPath + "/" + file;
                                            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                                                deleteFolderRecursive(curPath);
                                            } else { // delete file
                                                fs.unlinkSync(curPath);
                                            }
                                        });
                                        fs.rmdirSync(exportPath);
                                    }
                                };
                                console.log(bodyjson);
                                res.send(bodyjson);
                            } else {
                                console.log(bodyjson);
                                res.send(bodyjson);
                            }
                        });
                    }, function (err) {
                        console.log(err);
                    });

                })
                .catch(function (error) {
                    console.log(error.message || error);
                    //  process.exit(1);
                });
        }
    }
}

/**`
 * Default values that will used when call obj23dtiles to use.
 */
editObj23dtiles.defaults = JSON.parse(JSON.stringify(obj2gltf.defaults));
Object.assign(editObj23dtiles.defaults, JSON.parse(JSON.stringify(obj2B3dm.defaults)));
Object.assign(editObj23dtiles.defaults, JSON.parse(JSON.stringify(obj2I3dm.defaults)));
Object.assign(editObj23dtiles.defaults, JSON.parse(JSON.stringify(obj2Tileset.defaults)));
