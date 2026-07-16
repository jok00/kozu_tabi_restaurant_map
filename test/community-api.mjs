import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
import handler from '../api/community.js';

const connectionString=process.env.KOZUTABI_DATABASE_URL || process.env.DATABASE_URL;
assert.ok(connectionString,'KOZUTABI_DATABASE_URL または DATABASE_URL が必要です。');

const regionId='test_region';
const storeId='test_store';

function invoke({method='GET',url='/api/community',body}={}){
  const headers=new Map();
  const request={method,url,body,query:{}};
  const response={
    statusCode:200,
    setHeader(name,value){headers.set(name.toLowerCase(),value);},
    end(value=''){
      this.body=value;
    }
  };
  return handler(request,response).then(()=>({
    status:response.statusCode,
    headers,
    body:response.body ? JSON.parse(response.body) : null
  }));
}

async function post(body){
  return invoke({method:'POST',body});
}

const sql=neon(connectionString);

try{
  await sql.transaction([
    sql`delete from kozu_city_posts where region_id=${regionId}`,
    sql`delete from kozu_store_memos where region_id=${regionId}`,
    sql`delete from kozu_favorites where region_id=${regionId}`
  ]);

  const city=await post({action:'create_city_post',regionId,text:'共有投稿テスト'});
  assert.equal(city.status,201);
  assert.equal(city.body.post.text,'共有投稿テスト');

  const memo=await post({action:'save_store_memo',regionId,storeId,text:'共有メモテスト'});
  assert.equal(memo.status,200);
  assert.equal(memo.body.memo.text,'共有メモテスト');

  const favorite=await post({action:'set_favorite',regionId,storeId,active:true});
  assert.equal(favorite.status,200);
  assert.equal(favorite.body.active,true);

  const state=await invoke({url:`/api/community?region=${regionId}`});
  assert.equal(state.status,200);
  assert.equal(state.body.cityPosts.length,1);
  assert.equal(state.body.storeMemos.length,1);
  assert.deepEqual(state.body.favoriteStoreIds,[storeId]);

  const clearMemo=await post({action:'save_store_memo',regionId,storeId,text:''});
  assert.equal(clearMemo.body.memo,null);
  const clearFavorite=await post({action:'set_favorite',regionId,storeId,active:false});
  assert.equal(clearFavorite.body.active,false);

  console.log('community API integration test: ok');
}finally{
  await sql.transaction([
    sql`delete from kozu_city_posts where region_id=${regionId}`,
    sql`delete from kozu_store_memos where region_id=${regionId}`,
    sql`delete from kozu_favorites where region_id=${regionId}`
  ]);
}
