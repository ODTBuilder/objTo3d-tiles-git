'use strict';

var obj23dtiles = require('../lib/obj23dtiles');

var convertState = {
                    state : 500,
                    content : '파일변환이 실패하였습니다.',
                    filePath : 'http://localhost'
                    }

 module.exports = createConvertFile;

//타입에 따른 
function createConvertFile(req, res, exportPath, arFileName){
    var combineFlag = req.body.combine;
    var args = req.body.args;

    var defaults = obj23dtiles.defaults;

    var argv = {};

    //기본 옵션 생성
    argv.batchId = defaults.batchId;
    argv.binary = defaults.binary;
    argv.b3dm = defaults.b3dm;
    argv.i2dm = defaults.i2dm;
    argv.tileset = defaults.tileset;
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



    //String 설정 옵션
    for(key in req.body) {
        if(key.charAt(0)=='-'){
            if(key.charAt(1)=='m'){

            }
            if(key.charAt(1)=='i'){
                argv.i = exportPath+'/'+arFileName;
                argv.input = exportPath+'/'+arFileName;
            }
            if(key.charAt(1)=='c'){
                argv.customBatchTable = req.body[key];
            }
            if(key.charAt(1)=='o'){
                argv.output = req.body[key];
            }
            if(key.charAt(1)=='f'){
                argv.customFeatureTable = req.body[key];
            }
            if(key.charAt(1)=='b'){
                argv.binary = true;
            }
            if(key.charAt(1)=='p'){
                argv.tilesetOptions = req.body[key];
            }
            if(key.charAt(1)=='s'){
                argv.separate = true;
            }
        }
    }

    if(combineFlag){
        console.time('Total');
        return combine({
            inputDir: argv.input,
            outputTileset: argv.output,
        })
        .then(function(result) {
            var tileset = result.tileset;
            var output = result.output;
            return fsExtra.writeJson(output, tileset, {spaces: 2});
        })
        .then(function() {
            console.timeEnd('Total');
        })
        .catch(function(err) {
            console.log(err);
        });
    }


    //일반 옵션처리
    for(var i=0, item; item=args[i]; i++) {
        if(item==='batchId'){
            argv.batchId = true;
        }
        if(item==='b3dm'){
            argv.b3dm = true;
        }
        if(item==='i2dm'){
            argv.i2dm = true;
        }
        if(item==='i3dm'){
            argv.i2dm = true;
        }
        if(item==='tileset'){
            argv.tileset = true;
        }
        if(item==='outputBatchTable'){
            argv.outputBatchTable = true;
        }
        if(item==='useOcclusion'){
            argv.useOcclusion = true;
        }
        if(item==='checkTransparency'){
            argv.checkTransparency = true;
        }
        if(item==='secure'){
            argv.secure = true;
        }
        if(item==='packOcclusion'){
            argv.packOcclusion = true;
        }
        if(item==='metallicRoughness'){
            argv.metallicRoughness = true;
        }
        if(item==='specularGlossiness'){
            argv.specularGlossiness = true;
        }
        if(item==='materialsCommon'){
            argv.materialsCommon = true;
        }
    }


    if (argv.metallicRoughness + argv.specularGlossiness + argv.materialsCommon > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
    process.exit(1);
    }

    if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
    process.exit(1);
    }

    objPath = convertFolderPath+'/'+arFileName;
    var outputPath = argv.output;

    //export 경로 설정
    var name = path.basename(objPath, path.extname(objPath));

    if (!defined(outputPath)) {
        outputPath = path.join(path.dirname(objPath), name + '.gltf');
    }

    var outputDirectory = path.dirname(outputPath);
    var extension = path.extname(outputPath).toLowerCase();
    if (argv.binary || extension === '.glb') {
        argv.binary = true;
        extension = '.glb';
    }
    if (argv.tileset || argv.b3dm || extension === '.b3dm') {
        argv.binary = true;
        argv.batchId = true;
        argv.b3dm = true;
        extension = '.b3dm';
    }
    if (argv.i3dm || extension === '.i3dm') {
        argv.binary = true;
        argv.batchId = false;
        argv.b3dm = false;
        argv.i3dm = true;
        extension = '.i3dm';
    }
    outputPath = path.join(outputDirectory, name + extension);



    var overridingTextures = {
    metallicRoughnessOcclusionTexture : argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture : argv.specularGlossinessTexture,
    occlusionTexture : argv.occlusionTexture,
    normalTexture : argv.normalTexture,
    baseColorTexture : argv.baseColorTexture,
    emissiveTexture : argv.emissiveTexture,
    alphaTexture : argv.alphaTexture
    };

    var options = {
    binary : argv.binary,
    batchId: argv.batchId,
    b3dm: argv.b3dm,
    i3dm: argv.i3dm,
    outputBatchTable : argv.outputBatchTable,
    customBatchTable : argv.customBatchTable,
    customFeatureTable : argv.customFeatureTable,
    tileset : argv.tileset,
    tilesetOptions : argv.tilesetOptions,
    useOcclusion : argv.useOcclusion,
    separate : argv.separate,
    separateTextures : argv.separateTextures,
    checkTransparency : argv.checkTransparency,
    secure : argv.secure,
    packOcclusion : argv.packOcclusion,
    metallicRoughness : argv.metallicRoughness,
    specularGlossiness : argv.specularGlossiness,
    materialsCommon : argv.materialsCommon,
    overridingTextures : overridingTextures,
    outputDirectory : outputDirectory
    };
   
    obj23dtiles(objPath, outputPath, options, function(result){
      res.send(result);
    });



    return convertState;
}


function checkFile(filePath){
   var flag = flase;

    return flag;
}

