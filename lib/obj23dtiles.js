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

module.exports = obj23dtiles;

var objcomplete = 1;

//objpath, b3dmPath, options, objnum, userPath, unzippath, request, response, urloptions, iscombined

function obj23dtiles(objPath, b3dmPath, options, numobj, userPath, unzippath, req, res, urloptions, iscombined) {
    //  console.time('Total');

    var user = req.body.user;
    var time = req.body.time;

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
                    if (objcomplete === numobj) {
                        if (numobj > 1) {
                            // combine tileset
                            combine({
                                inputDir: unzippath,
                                outputTileset: unzippath,
                            }).then(function (result) {
                                var tileset = result.tileset;
                                var output = result.output;
                                return fsExtra.writeJson(output, tileset, { spaces: 2 });
                            }).then(function () {
                                var zipname = unzippath + '3dtiles.zip';
                                zl.archiveFolder(unzippath, zipname).then(function () {
                                    console.log("3dtiles.zip done");
                                    request.post({
                                        url: 'http://' + serverhost + ':' + serverport + '/' + serverpath + '/upload3dtiles.do',
                                        formData: {
                                            file: fs.createReadStream(zipname),
                                            filetype: 'zip',
                                            filename: '3dtiles.zip',
                                            user: user,
                                            time: time
                                        },
                                    }, function (error, response, body) {
                                        var bodyjson = JSON.parse(body);
                                        if (bodyjson.succ === true) {
                                            deleteFolderRecursive(userPath);
                                            function deleteFolderRecursive(userPath) {
                                                if (fs.existsSync(userPath)) {
                                                    fs.readdirSync(userPath).forEach(function (file) {
                                                        var curPath = userPath + "/" + file;
                                                        if (fs.lstatSync(curPath).isDirectory()) { // recurse
                                                            deleteFolderRecursive(curPath);
                                                        } else { // delete file
                                                            fs.unlinkSync(curPath);
                                                        }
                                                    });
                                                    fs.rmdirSync(userPath);
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
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                        else {
                            var b3dmarr = writeb3dmpath.split("\\");
                            var tilearr = writetilessetpath.split("\\");

                            var b3dmfilename = b3dmarr[b3dmarr.length - 1];
                            var tilefilename = tilearr[tilearr.length - 1];

                            fs.renameSync(writeb3dmpath, unzippath + b3dmfilename);
                            fs.renameSync(writetilessetpath, unzippath + tilefilename);
                            fs.rmdirSync(unzippath + writefolder);

                            var zipname = unzippath + '3dtiles.zip';
                            zl.archiveFolder(unzippath, zipname).then(function () {
                                console.log("3dtiles.zip done");
                                request.post({
                                    url: 'http://' + serverhost + ':' + serverport + '/' + serverpath + '/upload3dtiles.do',
                                    formData: {
                                        file: fs.createReadStream(zipname),
                                        filetype: 'zip',
                                        filename: '3dtiles.zip',
                                        user: user,
                                        time: time
                                    },
                                }, function (error, response, body) {
                                    var bodyjson = JSON.parse(body);
                                    if (bodyjson.succ === true) {
                                        deleteFolderRecursive(userPath);
                                        function deleteFolderRecursive(userPath) {
                                            if (fs.existsSync(userPath)) {
                                                fs.readdirSync(userPath).forEach(function (file) {
                                                    var curPath = userPath + "/" + file;
                                                    if (fs.lstatSync(curPath).isDirectory()) { // recurse
                                                        deleteFolderRecursive(curPath);
                                                    } else { // delete file
                                                        fs.unlinkSync(curPath);
                                                    }
                                                });
                                                fs.rmdirSync(userPath);
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
                        }
                    } else {
                        objcomplete++;
                    }

                })
                .catch(function (error) {
                    console.log(error.message || error);
                    //  process.exit(1);
                });
        } else if (options.i3dm) {
            options.binary = true;
            options.batchId = false;
            if (!options.customFeatureTable) {
                console.log('Convert to i3dm need a custom FeatureTable.');
                //   process.exit(1);
            }
            obj2Tileset(objPath, b3dmPath, options)
                .then(function (result) {
                    var i3dm = result.i3dm;
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
                    tasks.push(fsExtra.outputFile(tilePath, i3dm));
                    tasks.push(fsExtra.writeJson(tilesetPath, tileset, { spaces: 2 }));
                    return Promise.all(tasks);
                })
                // .then(function() {
                //     console.timeEnd('Total');
                // })
                .catch(function (error) {
                    console.log(error.message || error);
                    //  process.exit(1);
                });
        }
    }
    else if (options && options.b3dm) {
        options.binary = true;
        options.batchId = true;
        obj2B3dm(objPath, options)
            .then(function (result) {
                var b3dm = result.b3dm;
                var batchTableJson = result.batchTableJson;

                if (options.outputBatchTable) {
                    var batchTableJsonPath = b3dmPath.replace(/\.[^/.]+$/, '') + '_batchTable.json';
                    fsExtra.ensureDirSync(path.dirname(batchTableJsonPath));
                    fsExtra.writeJsonSync(batchTableJsonPath, batchTableJson, { spaces: 2 });
                }
                fsExtra.ensureDirSync(path.dirname(b3dmPath));
                return fsExtra.outputFile(b3dmPath, b3dm);
            })
            // .then(function() {
            //     console.timeEnd('Total');
            // })
            .catch(function (error) {
                console.log(error.message || error);
                // process.exit(1);
            });
    }
    else if (options && options.i3dm) {
        options.binary = true;
        options.batchId = false;
        if (!options.customFeatureTable) {
            console.log('Convert to i3dm need a custom FeatureTable.');
            // process.exit(1);
        }
        obj2I3dm(objPath, options)
            .then(function (result) {
                var i3dm = result.i3dm;
                var batchTableJson = result.batchTableJson;

                if (options.outputBatchTable) {
                    var batchTableJsonPath = b3dmPath.replace(/\.[^/.]+$/, '') + '_batchTable.json';
                    fsExtra.ensureDirSync(path.dirname(batchTableJsonPath));
                    fsExtra.writeJsonSync(batchTableJsonPath, batchTableJson, { spaces: 2 });
                }
                fsExtra.ensureDirSync(path.dirname(b3dmPath));
                return fsExtra.outputFile(b3dmPath, i3dm);
            })
            // .then(function() {
            //     console.timeEnd('Total');
            // })
            .catch(function (error) {
                console.log(error.message || error);
                //process.exit(1);
            });
    }
    else {
        obj2gltf(objPath, options)
            .then(function (result) {
                var gltf = result.gltf;
                if (options && options.binary) {
                    // gltf is a glb buffer
                    return fsExtra.outputFile(b3dmPath, gltf);
                }
                var jsonOptions = {
                    spaces: 2
                };
                return fsExtra.outputJson(b3dmPath, gltf, jsonOptions);
            })
            .then(function () {
                console.log("done");
                var filename = path.parse(b3dmPath).name + ".gltf";
                request.post({
                    url: 'http://' + serverhost + ':' + serverport + '/' + serverpath + '/uploadGltf.do',
                    formData: {
                        file: fs.createReadStream(b3dmPath),
                        filetype: 'gltf',
                        filename: filename,
                        user: user,
                        time: time
                    },
                }, function (error, response, body) {
                    var bodyjson = JSON.parse(body);
                    deleteFolderRecursive(userPath);
                    function deleteFolderRecursive(userPath) {
                        if (fs.existsSync(userPath)) {
                            fs.readdirSync(userPath).forEach(function (file) {
                                var curPath = userPath + "/" + file;
                                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                                    deleteFolderRecursive(curPath);
                                } else { // delete file
                                    fs.unlinkSync(curPath);
                                }
                            });
                            fs.rmdirSync(userPath);
                        }
                    };
                    console.log(bodyjson);
                    res.send(bodyjson);
                });
            })
            .catch(function (error) {
                console.log(error.message || error);
                res.send(error.message);
            });
    }
    //return Promise.resolve(objPath);
}

/**
 * Default values that will used when call obj23dtiles to use.
 */
obj23dtiles.defaults = JSON.parse(JSON.stringify(obj2gltf.defaults));
Object.assign(obj23dtiles.defaults, JSON.parse(JSON.stringify(obj2B3dm.defaults)));
Object.assign(obj23dtiles.defaults, JSON.parse(JSON.stringify(obj2I3dm.defaults)));
Object.assign(obj23dtiles.defaults, JSON.parse(JSON.stringify(obj2Tileset.defaults)));
