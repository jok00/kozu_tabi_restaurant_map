import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { dirname,extname,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import communityHandler from '../api/community.js';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const commonMapRoot=resolve(projectRoot,'../common_web_map');
const listenIndex=process.argv.indexOf('--listen');
const requestedPort=listenIndex>=0 ? process.argv[listenIndex+1] : process.env.PORT;
const port=Number(requestedPort || 8300);
const host=process.env.HOST || '0.0.0.0';
const publicFiles=new Set([
  'index.html',
  'index_dev.html',
  'page_shell.js',
  'personal_features.css',
  'personal_features.js',
  'store_data.json',
  'tag_overrides.css',
  'tag_overrides.js'
]);
const contentTypes={
  '.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml'
};

function safePath(root,relativePath){
  const target=resolve(root,relativePath);
  return target===root || target.startsWith(`${root}${sep}`) ? target : null;
}

async function serveFile(response,target){
  try{
    const details=await stat(target);
    if(!details.isFile()) throw new Error('not a file');
    const body=await readFile(target);
    response.statusCode=200;
    response.setHeader('Content-Type',contentTypes[extname(target).toLowerCase()] || 'application/octet-stream');
    response.setHeader('Cache-Control','no-store');
    response.end(body);
  }catch(error){
    response.statusCode=404;
    response.setHeader('Content-Type','text/plain; charset=utf-8');
    response.end('Not found');
  }
}

const server=createServer(async (request,response)=>{
  const url=new URL(request.url || '/',`http://${request.headers.host || 'localhost'}`);
  if(url.pathname==='/api/community'){
    await communityHandler(request,response);
    return;
  }

  let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch(error){pathname='/';}
  if(pathname==='/') pathname='/index.html';

  if(pathname.startsWith('/common_web_map/')){
    const relative=pathname.slice('/common_web_map/'.length);
    const target=safePath(commonMapRoot,relative);
    if(target) return serveFile(response,target);
  }

  const relative=pathname.replace(/^\//,'');
  const topLevel=relative.split('/')[0];
  const allowed=publicFiles.has(relative) || topLevel==='regions' || topLevel==='landmarks';
  const target=allowed ? safePath(projectRoot,relative) : null;
  if(target) return serveFile(response,target);

  response.statusCode=404;
  response.setHeader('Content-Type','text/plain; charset=utf-8');
  response.end('Not found');
});

server.listen(port,host,()=>{
  console.log(`Kozu Tabi dev server: http://${host}:${port}`);
});
