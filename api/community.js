import { neon } from '@neondatabase/serverless';

const REGION_PATTERN=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const STORE_PATTERN=/^[A-Za-z0-9._:-]{1,180}$/;
const MAX_CITY_POSTS=200;

class RequestError extends Error{
  constructor(message,status=400){
    super(message);
    this.status=status;
  }
}

function sendJson(response,status,payload){
  response.statusCode=status;
  response.setHeader('Content-Type','application/json; charset=utf-8');
  response.setHeader('Cache-Control','no-store');
  response.end(JSON.stringify(payload));
}

function getSql(){
  const connectionString=process.env.KOZUTABI_DATABASE_URL || process.env.DATABASE_URL;
  if(!connectionString) throw new RequestError('データベース接続が設定されていません。',503);
  return neon(connectionString);
}

function getQueryValue(request,name){
  const direct=request.query && request.query[name];
  if(Array.isArray(direct)) return direct[0];
  if(direct != null) return direct;
  const url=new URL(request.url || '/', 'http://localhost');
  return url.searchParams.get(name);
}

async function readBody(request){
  if(request.body && typeof request.body==='object' && !Buffer.isBuffer(request.body)) return request.body;
  if(Buffer.isBuffer(request.body)){
    try{return JSON.parse(request.body.toString('utf8'));}
    catch(error){throw new RequestError('JSON形式が正しくありません。');}
  }
  if(typeof request.body==='string'){
    try{return JSON.parse(request.body);}catch(error){throw new RequestError('JSON形式が正しくありません。');}
  }
  const chunks=[];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch(error){throw new RequestError('JSON形式が正しくありません。');}
}

function requireRegion(value){
  const region=String(value || '').trim();
  if(!REGION_PATTERN.test(region)) throw new RequestError('都市IDが正しくありません。');
  return region;
}

function requireStore(value){
  const store=String(value || '').trim();
  if(!STORE_PATTERN.test(store)) throw new RequestError('店舗IDが正しくありません。');
  return store;
}

function normalizeText(value,maxLength,label,{allowEmpty=false}={}){
  const text=String(value == null ? '' : value).trim();
  if(!text && allowEmpty) return '';
  if(!text) throw new RequestError(`${label}を入力してください。`);
  if(text.length>maxLength) throw new RequestError(`${label}は${maxLength}文字以内で入力してください。`);
  return text;
}

function mapCityPost(row){
  return {
    id:String(row.id),
    text:row.body,
    createdAt:row.created_at
  };
}

function mapStoreMemo(row){
  return {
    storeId:row.store_id,
    text:row.body,
    updatedAt:row.updated_at
  };
}

async function getCommunity(request,response){
  const regionId=requireRegion(getQueryValue(request,'region'));
  const sql=getSql();
  const [cityRows,memoRows,favoriteRows]=await sql.transaction([
    sql`select id::text, body, created_at
        from kozu_city_posts
        where region_id=${regionId}
        order by created_at desc, id desc
        limit ${MAX_CITY_POSTS}`,
    sql`select store_id, body, updated_at
        from kozu_store_memos
        where region_id=${regionId}
        order by store_id`,
    sql`select store_id
        from kozu_favorites
        where region_id=${regionId}
        order by store_id`
  ],{readOnly:true});

  sendJson(response,200,{
    regionId,
    cityPosts:cityRows.map(mapCityPost),
    storeMemos:memoRows.map(mapStoreMemo),
    favoriteStoreIds:favoriteRows.map(row=>row.store_id)
  });
}

async function createCityPost(sql,body,response){
  const regionId=requireRegion(body.regionId);
  const text=normalizeText(body.text,1000,'投稿');
  const rows=await sql`insert into kozu_city_posts (region_id,body)
    values (${regionId},${text})
    returning id::text,body,created_at`;
  sendJson(response,201,{post:mapCityPost(rows[0])});
}

async function saveStoreMemo(sql,body,response){
  const regionId=requireRegion(body.regionId);
  const storeId=requireStore(body.storeId);
  const text=normalizeText(body.text,2000,'店舗メモ',{allowEmpty:true});
  if(!text){
    await sql`delete from kozu_store_memos
      where region_id=${regionId} and store_id=${storeId}`;
    sendJson(response,200,{memo:null});
    return;
  }
  const rows=await sql`insert into kozu_store_memos (region_id,store_id,body)
    values (${regionId},${storeId},${text})
    on conflict (region_id,store_id) do update
      set body=excluded.body,updated_at=now()
    returning store_id,body,updated_at`;
  sendJson(response,200,{memo:mapStoreMemo(rows[0])});
}

async function setFavorite(sql,body,response){
  const regionId=requireRegion(body.regionId);
  const storeId=requireStore(body.storeId);
  if(typeof body.active!=='boolean') throw new RequestError('お気に入り状態が正しくありません。');
  if(body.active){
    await sql`insert into kozu_favorites (region_id,store_id)
      values (${regionId},${storeId})
      on conflict (region_id,store_id) do nothing`;
  }else{
    await sql`delete from kozu_favorites
      where region_id=${regionId} and store_id=${storeId}`;
  }
  sendJson(response,200,{storeId,active:body.active});
}

async function changeCommunity(request,response){
  const body=await readBody(request);
  const sql=getSql();
  switch(body.action){
    case 'create_city_post':
      return createCityPost(sql,body,response);
    case 'save_store_memo':
      return saveStoreMemo(sql,body,response);
    case 'set_favorite':
      return setFavorite(sql,body,response);
    default:
      throw new RequestError('操作が正しくありません。');
  }
}

export default async function handler(request,response){
  try{
    if(request.method==='GET') return await getCommunity(request,response);
    if(request.method==='POST') return await changeCommunity(request,response);
    if(request.method==='OPTIONS'){
      response.statusCode=204;
      response.setHeader('Allow','GET, POST, OPTIONS');
      response.end();
      return;
    }
    response.setHeader('Allow','GET, POST, OPTIONS');
    throw new RequestError('対応していないHTTPメソッドです。',405);
  }catch(error){
    const status=error instanceof RequestError ? error.status : 500;
    if(status>=500) console.error(error);
    sendJson(response,status,{
      error:status>=500 ? '共有データの処理に失敗しました。' : error.message
    });
  }
}
