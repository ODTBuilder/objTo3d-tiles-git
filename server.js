// lib
var properties = require('./config.json');
var obj23dtiles = require('./lib/obj23dtiles');
var editObj23dtiles = require('./lib/editobj23dtiles');

// Dependencies
var fsExtra = require('fs-extra');
var Cesium = require('cesium');
var defined = Cesium.defined;
var path = require('path');
var express = require('express');
var app = express();
var fs = require('fs');
var url = require('url');
var http = require('http');
const unzip = require('unzip-stream');
const zl = require("zip-lib");

const port = 3000;
const apachfolderpath = properties.apachfolderpath;
!fs.existsSync(apachfolderpath) && fs.mkdirSync(apachfolderpath); // 디폴트 폴더 없을시 생성
app.use(express.json()) //json파싱을 위한 선언

var objnum;
var iscombined;
var unzippath;

var response;
var request;
var userPath;
var urloptions;

var combine = require('./lib/combineTileset');

app.post('/convert/combineTileset', async function (req, res) {

  var postrequest = require('request');

  // param
  var user = req.body.user;
  var time = req.body.time;
  var path = req.body.path;
  var file = req.body.file;


  var parsedURL = url.parse(path);
  var options = {
    host: parsedURL.hostname,
    port: parsedURL.port,
    path: parsedURL.path
  };
  var strarr = parsedURL.path.split('/');
  var serverpath = strarr[1];
  

  var userPath = realtimeCreateFolder(apachfolderpath, user);
  unzippath = realtimeCreateFolder(userPath, time) + "/";

  var filews = fs.createWriteStream(unzippath + file);
  var repath = unzippath + file;
  http.get(options, function (result) {
    result.on('data', function (data) {
      filews.write(data);
    }).on('end', function () {
      filews.end();
      console.log(file + ' downloaded to ' + unzippath);
      // 압축해제
      fs.createReadStream(repath).pipe(unzip.Extract({ path: unzippath }).on('close', function () {
        // combine 3d tiles
        combine({
          inputDir: unzippath,
          outputTileset: unzippath,
        }).then(function (result) {
          var tileset = result.tileset;
          var output = result.output;
          fsExtra.writeJson(output, tileset, { spaces: 2 });
        }).then(function () {
          fs.unlinkSync(repath);
          var zipname = unzippath + '3dtiles.zip';
          zl.archiveFolder(unzippath, zipname).then(function () {
            console.log("3dtiles.zip done");
            postrequest.post({
              url: 'http://' + parsedURL.hostname + ':' + parsedURL.port + '/' + serverpath + '/upload3dtiles.do',
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
          });
        });
      }));
    });
  });
});


app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.post('/convert/editObjTo3dtiles', async function (req, res) {

  request = req;
  response = res;
  var state = {};
  req.setTimeout(0);

  // param
  var user = req.body.user;
  var time = req.body.time;
  var file = req.body.file;
  var downurl = req.body.path;

  // 1._obj.zip을 다운로드할 경로 생성  ex) D:\data\guest
  userPath = realtimeCreateFolder(apachfolderpath, user);

  // 2._obj.zip 압축 해제 경로 생성 ex) D:\data\guest\20191227_095347
  unzippath = realtimeCreateFolder(userPath, time) + "/";

  // 3._obj.zip 다운로드 요청
  download_zipfile_convertEditObjTo3dtiles(downurl, file, userPath + "/", unzippath).then(function (result) {
    state.state = 200;
    state.dirname = unzippath;
  }).catch(error => {
    console.log(error);
    state.state = 500;
    state.error = error;
  });
  //res.send(state);
});

// Function for downloading file using HTTP.get
function download_zipfile_convertEditObjTo3dtiles(path, filename, userPath) {

  var parsedURL = url.parse(path);
  var options = {
    host: parsedURL.hostname,
    port: parsedURL.port,
    path: parsedURL.path
  };
  urloptions = options;

  var filews = fs.createWriteStream(userPath + filename);
  var repath = userPath + filename;
  http.get(options, function (res) {
    res.on('data', function (data) {
      filews.write(data);
    }).on('end', function () {
      filews.end();
      console.log(filename + ' downloaded to ' + userPath);
      // 압축해제
      fs.createReadStream(repath).pipe(unzip.Extract({ path: unzippath }).on('close', function () {
        // obj to 3d tiles
        editObjFilesearch(unzippath);
      }));
    });
  });
  return Promise.resolve(repath);
};

function editObjFilesearch(dirname) {
  var filelist = fs.readdirSync(dirname);
  var i = 0;
  while (i < filelist.length) {
    full_filename = dirname + filelist[i];
    if (fs.lstatSync(full_filename).isDirectory()) {
      editObjFilesearch(full_filename + '/'); //다시 호출
    }
    else {
      var extname = path.extname(full_filename);
      if (extname === '.obj') {
        // obj to 3d tiles
        convertEditObjTo3dtiles(dirname, full_filename);
      }
    }
    i = i + 1;
  }
  return Promise.resolve(dirname);
}

// convert 3d tiles
async function convertEditObjTo3dtiles(dirname, full_filename) {

  var extname = path.extname(full_filename);
  // if (extname === '.obj') {
  var name = path.basename(full_filename, extname);
  var objpath = full_filename;
  var tilesetoptionpath = dirname + name + "tile.json";
  var custombatchpath = dirname + name + "batch.json";

  var argv = {};
  var defaults = obj23dtiles.defaults;
  argv.i2dm = defaults.i2dm;
  argv.outputBatchTable = defaults.outputBatchTable;
  argv.useOcclusion = defaults.useOcclusion;
  argv.separateTextures = defaults.separateTextures;
  argv.checkTransparency = defaults.checkTransparency;
  argv.secure = defaults.secure;
  argv.packOcclusion = defaults.packOcclusion;
  argv.metallicRoughness = defaults.metallicRoughness;
  argv.specularGlossiness = defaults.specularGlossiness;
  argv.materialsCommon = defaults.materialsCommon;
  argv.metallicRoughnessOcclusionTexture = undefined;
  argv.specularGlossinessTexture = undefined;
  argv.occlusionTexture = undefined;
  argv.normalTexture = undefined;
  argv.baseColorTexture = undefined;
  argv.emissiveTexture = undefined;
  argv.alphaTexture = undefined;

  argv.batchId = true;
  argv.binary = true;
  argv.b3dm = true;
  argv.tileset = true;
  argv.customBatchTable = custombatchpath;
  argv.tilesetOptions = tilesetoptionpath;
  argv.output = dirname;

  if (argv.metallicRoughness + argv.specularGlossiness + argv.materialsCommon > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
  }

  if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
  }

  var overridingTextures = {
    metallicRoughnessOcclusionTexture: argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture: argv.specularGlossinessTexture,
    occlusionTexture: argv.occlusionTexture,
    normalTexture: argv.normalTexture,
    baseColorTexture: argv.baseColorTexture,
    emissiveTexture: argv.emissiveTexture,
    alphaTexture: argv.alphaTexture
  };

  var options = {
    binary: argv.binary,
    batchId: argv.batchId,
    b3dm: argv.b3dm,
    i3dm: argv.i3dm,
    outputBatchTable: argv.outputBatchTable,
    customBatchTable: argv.customBatchTable,
    customFeatureTable: argv.customFeatureTable,
    tileset: argv.tileset,
    tilesetOptions: argv.tilesetOptions,
    useOcclusion: argv.useOcclusion,
    separate: argv.separate,
    separateTextures: argv.separateTextures,
    checkTransparency: argv.checkTransparency,
    secure: argv.secure,
    packOcclusion: argv.packOcclusion,
    metallicRoughness: argv.metallicRoughness,
    specularGlossiness: argv.specularGlossiness,
    materialsCommon: argv.materialsCommon,
    overridingTextures: overridingTextures,
    outputDirectory: dirname
  };
  var b3dmPath = dirname + name + ".b3dm";
  editObj23dtiles(request, response, objpath, b3dmPath, options, userPath, unzippath, urloptions);
}

// obj to gltf
app.post('/convert/objTogltf', function (req, res) {

  request = req;
  response = res;
  

  // param
  var user = req.body.user;
  var time = req.body.time;
  var path = req.body.path;
  var file = req.body.file;

  var userPath = realtimeCreateFolder(apachfolderpath, user);
  unzippath = realtimeCreateFolder(userPath, time) + "/";

  var type = 'gltf';

  download_zipfile_convertObjTo3dtiles(path, file, userPath + "/", type);

});

function convertObjToGltf(inputPath, filename) {

  var argv = {};
  var defaults = obj23dtiles.defaults;
  argv.i2dm = defaults.i2dm;
  argv.outputBatchTable = defaults.outputBatchTable;
  argv.useOcclusion = defaults.useOcclusion;
  argv.separateTextures = defaults.separateTextures;
  argv.checkTransparency = defaults.checkTransparency;
  argv.secure = defaults.secure;
  argv.packOcclusion = defaults.packOcclusion;
  argv.metallicRoughness = defaults.metallicRoughness;
  argv.specularGlossiness = defaults.specularGlossiness;
  argv.materialsCommon = defaults.materialsCommon;
  argv.metallicRoughnessOcclusionTexture = undefined;
  argv.specularGlossinessTexture = undefined;
  argv.occlusionTexture = undefined;
  argv.normalTexture = undefined;
  argv.baseColorTexture = undefined;
  argv.emissiveTexture = undefined;
  argv.alphaTexture = undefined;
  argv.batchId = defaults.batchId;
  argv.binary = defaults.binary;
  argv.b3dm = defaults.b3dm;
  argv.tileset = defaults.tileset;
  argv.customBatchTable = undefined;
  argv.tilesetOptions = undefined;
  argv.output = undefined;

  if (argv.metallicRoughness + argv.specularGlossiness + argv.materialsCommon > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
  }

  if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
  }

  var overridingTextures = {
    metallicRoughnessOcclusionTexture: argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture: argv.specularGlossinessTexture,
    occlusionTexture: argv.occlusionTexture,
    normalTexture: argv.normalTexture,
    baseColorTexture: argv.baseColorTexture,
    emissiveTexture: argv.emissiveTexture,
    alphaTexture: argv.alphaTexture
  };

  var options = {
    binary: argv.binary,
    batchId: argv.batchId,
    b3dm: argv.b3dm,
    i3dm: argv.i3dm,
    outputBatchTable: argv.outputBatchTable,
    customBatchTable: argv.customBatchTable,
    customFeatureTable: argv.customFeatureTable,
    tileset: argv.tileset,
    tilesetOptions: argv.tilesetOptions,
    useOcclusion: argv.useOcclusion,
    separate: argv.separate,
    separateTextures: argv.separateTextures,
    checkTransparency: argv.checkTransparency,
    secure: argv.secure,
    packOcclusion: argv.packOcclusion,
    metallicRoughness: argv.metallicRoughness,
    specularGlossiness: argv.specularGlossiness,
    materialsCommon: argv.materialsCommon,
    overridingTextures: overridingTextures,
    outputDirectory: argv.outputDirectory
  }

  var extname = path.extname(filename);
  // if (extname === '.obj') {
  var name = path.basename(filename, extname);
  var outputPath = path.join(path.dirname(filename), name + '.gltf');
  obj23dtiles(filename, outputPath, options, null, userPath, unzippath, request, response, urloptions, null, null);
};

// obj to 3dtiles
app.post('/convert/objTo3dtiles', async function (req, res) {

  request = req;
  response = res;
  var state = {};
  req.setTimeout(0);

  // param
  var user = req.body.user;
  var time = req.body.time;
  var file = req.body.file;
  var downurl = req.body.path;
  objnum = req.body.objnum;
  iscombined = req.body.combine;

  var type = '3dtiles';

  // 1._obj.zip을 다운로드할 경로 생성  ex) D:\data\guest
  userPath = realtimeCreateFolder(apachfolderpath, user);

  // 2._obj.zip 압축 해제 경로 생성 ex) D:\data\guest\20191227_095347
  unzippath = realtimeCreateFolder(userPath, time) + "/";

  // 3._obj.zip 다운로드 요청
  download_zipfile_convertObjTo3dtiles(downurl, file, userPath + "/", type);

});

// Function for downloading file using HTTP.get
function download_zipfile_convertObjTo3dtiles(path, filename, userPath, type) {

  var parsedURL = url.parse(path);
  var options = {
    host: parsedURL.hostname,
    port: parsedURL.port,
    path: parsedURL.path
  };
  urloptions = options;

  var filews = fs.createWriteStream(userPath + filename);
  var repath = userPath + filename;
  http.get(options, function (res) {
    res.on('data', function (data) {
      filews.write(data);
    }).on('end', function () {
      filews.end();
      console.log(filename + ' downloaded to ' + userPath);
      // 압축해제
      fs.createReadStream(repath).pipe(unzip.Extract({ path: unzippath }).on('close', function () {
        // obj to 3d tiles
        objFilesearch(unzippath, type);
      }));
    });
  });
  return Promise.resolve(repath);
};

function objFilesearch(dirname, type) {
  var filelist = fs.readdirSync(dirname);
  var i = 0;
  while (i < filelist.length) {
    full_filename = dirname + filelist[i];
    if (fs.lstatSync(full_filename).isDirectory()) {
      objFilesearch(full_filename + '/', type); //다시 호출
    }
    else {
      var extname = path.extname(full_filename);
      if (extname === '.obj') {
        if (type === '3dtiles') {
          // obj to 3d tiles
          convertObjTo3dtiles(dirname, full_filename);
        }
        if (type === 'gltf') {
          convertObjToGltf(dirname, full_filename);
        }

      }
    }
    i = i + 1;
  }
  return Promise.resolve(dirname);
}

// convert 3d tiles
async function convertObjTo3dtiles(dirname, full_filename) {
  var extname = path.extname(full_filename);
  // if (extname === '.obj') {
  var name = path.basename(full_filename, extname);
  var objpath = full_filename;
  var tilesetoptionpath = dirname + name + "tile.json";
  var custombatchpath = dirname + name + "batch.json";

  var argv = {};
  var defaults = obj23dtiles.defaults;
  argv.i2dm = defaults.i2dm;
  argv.outputBatchTable = defaults.outputBatchTable;
  argv.useOcclusion = defaults.useOcclusion;
  argv.separateTextures = defaults.separateTextures;
  argv.checkTransparency = defaults.checkTransparency;
  argv.secure = defaults.secure;
  argv.packOcclusion = defaults.packOcclusion;
  argv.metallicRoughness = defaults.metallicRoughness;
  argv.specularGlossiness = defaults.specularGlossiness;
  argv.materialsCommon = defaults.materialsCommon;
  argv.metallicRoughnessOcclusionTexture = undefined;
  argv.specularGlossinessTexture = undefined;
  argv.occlusionTexture = undefined;
  argv.normalTexture = undefined;
  argv.baseColorTexture = undefined;
  argv.emissiveTexture = undefined;
  argv.alphaTexture = undefined;

  argv.batchId = true;
  argv.binary = true;
  argv.b3dm = true;
  argv.tileset = true;
  argv.customBatchTable = custombatchpath;
  argv.tilesetOptions = tilesetoptionpath;
  argv.output = dirname;

  if (argv.metallicRoughness + argv.specularGlossiness + argv.materialsCommon > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
  }

  if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
  }

  var overridingTextures = {
    metallicRoughnessOcclusionTexture: argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture: argv.specularGlossinessTexture,
    occlusionTexture: argv.occlusionTexture,
    normalTexture: argv.normalTexture,
    baseColorTexture: argv.baseColorTexture,
    emissiveTexture: argv.emissiveTexture,
    alphaTexture: argv.alphaTexture
  };

  var options = {
    binary: argv.binary,
    batchId: argv.batchId,
    b3dm: argv.b3dm,
    i3dm: argv.i3dm,
    outputBatchTable: argv.outputBatchTable,
    customBatchTable: argv.customBatchTable,
    customFeatureTable: argv.customFeatureTable,
    tileset: argv.tileset,
    tilesetOptions: argv.tilesetOptions,
    useOcclusion: argv.useOcclusion,
    separate: argv.separate,
    separateTextures: argv.separateTextures,
    checkTransparency: argv.checkTransparency,
    secure: argv.secure,
    packOcclusion: argv.packOcclusion,
    metallicRoughness: argv.metallicRoughness,
    specularGlossiness: argv.specularGlossiness,
    materialsCommon: argv.materialsCommon,
    overridingTextures: overridingTextures,
    outputDirectory: dirname
  };
  var b3dm = dirname + name + ".b3dm";
  obj23dtiles(objpath, b3dm, options, objnum, userPath, unzippath, request, response, urloptions, iscombined);
}

// 폴더경로생성
function realtimeCreateFolder(apachfolderpath, uid) {
  !fs.existsSync(apachfolderpath + '/' + uid) && fs.mkdirSync(apachfolderpath + '/' + uid); // 사용자 폴더 없을시 생성

  //사용자폴더 + 실시간 폴더생성
  var convertFolderPath = apachfolderpath + '/' + uid;
  !fs.existsSync(convertFolderPath) && fs.mkdirSync(convertFolderPath);

  return convertFolderPath;
}

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});
