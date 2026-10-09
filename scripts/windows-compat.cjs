// Session-local Windows runtime compatibility. Uses the normal fs resolver
// only when the native resolver fails; filesystem permissions still apply.
const fs = require('node:fs');
const realpathSync = fs.realpathSync.bind(fs);
const nativeSync = fs.realpathSync.native.bind(fs);
fs.realpathSync.native = function(path, options) {
  try { return nativeSync(path, options); } catch(error) { if(error.code !== 'EPERM') throw error; return realpathSync(path, options); }
};
const originalPromise = fs.promises.realpath.bind(fs.promises);
fs.promises.realpath = async function(path, options) {
  try { return await originalPromise(path, options); } catch(error) { if(error.code !== 'EPERM') throw error; return realpathSync(path, options); }
};
const originalCallback = fs.realpath.native.bind(fs.realpath);
fs.realpath.native = function(path, options, callback) {
  if(typeof options === 'function') {callback = options; options = undefined;}
  originalCallback(path, options, (error, result) => {
    if(error?.code === 'EPERM') {try {callback(null, realpathSync(path, options));} catch(fallback) {callback(fallback);} }
    else callback(error, result);
  });
};
const mkdirPromise = fs.promises.mkdir.bind(fs.promises);
fs.promises.mkdir = async function(path, options) {
  try { return await mkdirPromise(path, options); } catch(error) { if(error.code !== 'EPERM') throw error; return fs.mkdirSync(path, options); }
};
const mkdirCallback = fs.mkdir.bind(fs);
fs.mkdir = function(path, options, callback) {
  if(typeof options === 'function') {callback=options;options=undefined;}
  mkdirCallback(path,options,(error,result)=>{if(error?.code==='EPERM'){try{callback(null,fs.mkdirSync(path,options));}catch(fallback){callback(fallback);}}else callback(error,result);});
};
require('node:module').syncBuiltinESMExports();
