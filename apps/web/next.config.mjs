export default {
  env:{NEXT_PUBLIC_FODO_BUILD:process.env.FODO_BUILD_LABEL||'development'},
  serverExternalPackages:['@electric-sql/pglite'], poweredByHeader:false,
  async headers(){return [{source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]},{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache'},{key:'Service-Worker-Allowed',value:'/'}]}];}
};
