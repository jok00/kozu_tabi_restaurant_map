import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source=await readFile(new URL('../personal_features.js',import.meta.url),'utf8');
const requests=[];
const favoriteFilterEvents=[];
const backend={
  cityPosts:[{id:'1',text:'既存の共有投稿',createdAt:'2026-07-16T00:00:00.000Z'}],
  storeMemos:[{storeId:'cal_pep',text:'既存の共有メモ',updatedAt:'2026-07-16T00:00:00.000Z'}],
  favoriteStoreIds:['cal_pep']
};

const markup=`<!doctype html><body>
  <header><div class="hero"><div id="regionTabs"><button class="regionBtn active">バルセロナ</button></div><div id="filters"></div></div></header>
  <main><div id="restaurantList">
    <article class="restaurantCard" id="restaurant-card-cal_pep">
      <div class="cardTop"><div class="cardText"><div class="tags"></div></div><div class="rating">★ 4.5</div></div>
      <div class="actions"></div>
    </article>
    <article class="restaurantCard" id="restaurant-card-not-favorite">
      <div class="cardTop"><div class="cardText"><div class="tags"></div></div><div class="rating">★ 4.0</div></div>
      <div class="actions"></div>
    </article>
  </div></main>
</body>`;

const dom=new JSDOM(markup,{
  url:'http://localhost:8300/index.html',
  runScripts:'outside-only'
});

const {window}=dom;
window.KOZU_TABI_MAP_PAGE={communityApiUrl:'/api/community'};
window.document.addEventListener('kozu:favorite-filter-change',event=>favoriteFilterEvents.push(event.detail));
window.localStorage.setItem('kozuTabiPersonal:v1:cityNotes:バルセロナ','[{"text":"旧投稿"}]');
window.localStorage.setItem('kozuTabiCommunity:v1:legacyMigrated:barcelona','1');
window.fetch=async (url,options={})=>{
  const target=String(url);
  if(target.includes('store_data.json')){
    return response({regions:[{id:'barcelona',name:'バルセロナ'}]});
  }
  if((options.method || 'GET')==='GET'){
    return response({regionId:'barcelona',...backend});
  }
  const body=JSON.parse(options.body);
  requests.push(body);
  if(body.action==='create_city_post'){
    const post={id:'2',text:body.text,createdAt:'2026-07-16T01:00:00.000Z'};
    backend.cityPosts.unshift(post);
    return response({post},201);
  }
  if(body.action==='save_store_memo'){
    const memo=body.text ? {storeId:body.storeId,text:body.text,updatedAt:'2026-07-16T01:00:00.000Z'} : null;
    backend.storeMemos=memo ? [memo] : [];
    return response({memo});
  }
  if(body.action==='set_favorite'){
    backend.favoriteStoreIds=body.active ? [body.storeId] : [];
    return response({storeId:body.storeId,active:body.active});
  }
  return response({error:'unknown action'},400);
};

function response(body,status=200){
  return {
    ok:status>=200 && status<300,
    status,
    async json(){return body;}
  };
}

function wait(ms=25){
  return new Promise(resolve=>window.setTimeout(resolve,ms));
}

window.eval(source);
await wait(80);

const document=window.document;
assert.equal(window.localStorage.getItem('kozuTabiPersonal:v1:cityNotes:バルセロナ'),null);
assert.equal(window.localStorage.getItem('kozuTabiCommunity:v1:legacyMigrated:barcelona'),null);
assert.equal(document.querySelector('.cityNoteText').textContent,'既存の共有投稿');
assert.equal(document.querySelector('main').lastElementChild.className,'cityNotesPanel');
assert.equal(document.querySelector('.cityNoteInput').placeholder,'街の感想');
assert.equal(document.querySelector('.cityNoteMeta').textContent.includes('グループで共有'),false);
assert.equal(document.querySelector('.cityNoteMeta').hidden,true);
assert.equal(document.querySelector('.cityNotesSummary span').textContent,'感想内容');
assert.equal(document.querySelector('.personalMemoTitle'),null);
assert.equal(document.querySelector('.personalMemoInput').placeholder,'メモを入力');
assert.equal(document.querySelector('.personalMemoInput').value,'既存の共有メモ');
assert.equal(document.querySelector('.favoriteBtn').getAttribute('aria-pressed'),'true');

document.querySelector('.favoriteFilterBtn').click();
await wait();
assert.equal(favoriteFilterEvents.at(-1).active,true);
assert.deepEqual(Array.from(favoriteFilterEvents.at(-1).storeIds),['cal_pep']);
assert.equal(document.querySelector('#restaurant-card-cal_pep').hidden,false);
assert.equal(document.querySelector('#restaurant-card-cal_pep').classList.contains('favoriteFilteredOut'),false);
assert.equal(document.querySelector('#restaurant-card-not-favorite').hidden,true);
assert.equal(document.querySelector('#restaurant-card-not-favorite').classList.contains('favoriteFilteredOut'),true);
document.querySelector('.favoriteFilterBtn').click();
await wait();
assert.equal(favoriteFilterEvents.at(-1).active,false);
assert.deepEqual(Array.from(favoriteFilterEvents.at(-1).storeIds),[]);
assert.equal(document.querySelector('#restaurant-card-not-favorite').hidden,false);
assert.equal(document.querySelector('#restaurant-card-not-favorite').classList.contains('favoriteFilteredOut'),false);

document.querySelector('.favoriteBtn').click();
await wait();
assert.equal(requests.at(-1).action,'set_favorite');
assert.equal(requests.at(-1).active,false);
assert.equal(document.querySelector('.favoriteBtn').getAttribute('aria-pressed'),'false');

const cityInput=document.querySelector('.cityNoteInput');
cityInput.value='新しい共有投稿';
document.querySelector('.cityNoteForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await wait();
assert.equal(requests.at(-1).action,'create_city_post');
assert.equal(document.querySelector('.cityNoteText').textContent,'新しい共有投稿');

const memoInput=document.querySelector('.personalMemoInput');
memoInput.value='更新した共有メモ';
memoInput.dispatchEvent(new window.Event('input',{bubbles:true}));
assert.equal(document.querySelector('.personalMemoSave'),null);
assert.equal(document.querySelector('.personalMemoStatus').textContent,'入力中…');
await wait(700);
assert.equal(requests.at(-1).action,'save_store_memo');
assert.equal(requests.at(-1).text,'更新した共有メモ');
assert.equal(document.querySelector('.personalMemoStatus').textContent,'自動保存済み');

window.close();

const errorDom=new JSDOM(markup,{
  url:'http://localhost:8300/index.html',
  runScripts:'outside-only'
});
const errorWindow=errorDom.window;
errorWindow.KOZU_TABI_MAP_PAGE={communityApiUrl:'/api/community'};
errorWindow.console.warn=()=>{};
errorWindow.fetch=async url=>String(url).includes('store_data.json')
  ? response({regions:[{id:'barcelona',name:'バルセロナ'}]})
  : response({error:'共有データの処理に失敗しました。'},503);
errorWindow.eval(source);
await new Promise(resolve=>setTimeout(resolve,80));
assert.equal(errorWindow.document.body.textContent.includes('共有データの処理に失敗しました。'),false);
assert.equal(errorWindow.document.querySelector('.communityMessage').textContent,'投稿はまだありません。');
errorWindow.close();

console.log('personal features DOM test: ok');
