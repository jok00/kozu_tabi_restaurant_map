(function(){
  const obsoleteStoragePrefixes=['kozuTabiPersonal:v1:','kozuTabiCommunity:v1:'];
  const apiUrl=(window.KOZU_TABI_MAP_PAGE && window.KOZU_TABI_MAP_PAGE.communityApiUrl) || './api/community';
  const refreshIntervalMs=20000;
  let regionIndexPromise=null;
  let activeRegion=null;
  let loadToken=0;
  let refreshPromise=null;
  let favoriteFilterActive=false;
  let scheduled=false;
  const pendingFavorites=new Set();
  const pendingMemos=new Set();
  let communityState=createState('');

  function createState(regionId){
    return {
      regionId,
      cityPosts:[],
      storeMemos:new Map(),
      favoriteStoreIds:new Set(),
      loading:Boolean(regionId),
      loaded:false
    };
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,char=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[char]));
  }

  function formatTimestamp(iso){
    const date=new Date(iso);
    if(Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP',{
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    }).format(date);
  }

  function discardObsoleteStorage(){
    try{
      const obsoleteKeys=[];
      for(let index=0;index<localStorage.length;index+=1){
        const key=localStorage.key(index) || '';
        if(obsoleteStoragePrefixes.some(prefix=>key.startsWith(prefix))) obsoleteKeys.push(key);
      }
      obsoleteKeys.forEach(key=>localStorage.removeItem(key));
    }catch(error){
      console.warn('旧バージョンのブラウザ保存データを削除できませんでした。',error);
    }
  }

  function getCardId(card){
    return card && card.id ? card.id.replace(/^restaurant-card-/,'') : '';
  }

  async function requestJson(options={}){
    const response=await fetch(options.url || apiUrl,{
      method:options.method || 'GET',
      headers:options.body ? {'Content-Type':'application/json'} : undefined,
      body:options.body ? JSON.stringify(options.body) : undefined,
      cache:'no-store'
    });
    let payload={};
    try{payload=await response.json();}catch(error){/* HTTP状態で処理する */}
    if(!response.ok) throw new Error(payload.error || `共有機能に接続できませんでした (${response.status})`);
    return payload;
  }

  async function getRegionIndex(){
    if(!regionIndexPromise){
      regionIndexPromise=fetch('./store_data.json',{cache:'no-store'})
        .then(response=>{
          if(!response.ok) throw new Error('地域情報を読み込めませんでした。');
          return response.json();
        })
        .then(data=>Array.isArray(data.regions) ? data.regions : []);
    }
    return regionIndexPromise;
  }

  function decorateRegionButtons(regions){
    const byName=new Map(regions.map(region=>[String(region.name || '').trim(),region]));
    document.querySelectorAll('.regionBtn').forEach(button=>{
      const region=byName.get(button.textContent.trim());
      if(region) button.dataset.regionId=region.id;
    });
  }

  function applyCommunityPayload(payload){
    communityState.cityPosts=Array.isArray(payload.cityPosts) ? payload.cityPosts : [];
    communityState.storeMemos=new Map(
      (Array.isArray(payload.storeMemos) ? payload.storeMemos : [])
        .map(memo=>[memo.storeId,memo])
    );
    communityState.favoriteStoreIds=new Set(
      Array.isArray(payload.favoriteStoreIds) ? payload.favoriteStoreIds : []
    );
    communityState.loading=false;
    communityState.loaded=true;
  }

  async function refreshCommunity({silent=false}={}){
    if(!activeRegion || refreshPromise || pendingFavorites.size || pendingMemos.size) return refreshPromise;
    const regionId=activeRegion.id;
    const token=loadToken;
    if(!silent){
      communityState.loading=true;
      renderSharedFeatures();
    }
    refreshPromise=requestJson({url:`${apiUrl}?region=${encodeURIComponent(regionId)}`})
      .then(payload=>{
        if(token!==loadToken || !activeRegion || activeRegion.id!==regionId) return;
        applyCommunityPayload(payload);
        renderSharedFeatures();
      })
      .catch(error=>{
        if(token!==loadToken || !activeRegion || activeRegion.id!==regionId) return;
        communityState.loading=false;
        console.warn('共有データを読み込めませんでした。',error);
        renderSharedFeatures();
      })
      .finally(()=>{
        refreshPromise=null;
      });
    return refreshPromise;
  }

  async function synchronizeRegion(){
    const regions=await getRegionIndex();
    decorateRegionButtons(regions);
    const activeButton=document.querySelector('.regionBtn.active');
    if(!activeButton) return;
    const regionId=activeButton.dataset.regionId;
    const region=regions.find(item=>item.id===regionId);
    if(!region || (activeRegion && activeRegion.id===region.id)) return;

    activeRegion=region;
    loadToken+=1;
    refreshPromise=null;
    communityState=createState(region.id);
    renderSharedFeatures();
    await refreshCommunity();
  }

  function showSharedStatus(message,isError=false){
    const status=document.querySelector('.cityNoteStatus');
    if(!status) return;
    status.textContent=message || '';
    status.classList.toggle('error',Boolean(isError));
  }

  function renderCityNoteList(panel){
    const list=panel.querySelector('.cityNoteList');
    const count=panel.querySelector('.cityNoteCount');
    const posts=communityState.cityPosts;
    const nextCount=communityState.loaded ? `${posts.length}件` : '—';
    if(count && count.textContent!==nextCount) count.textContent=nextCount;
    if(!list) return;

    let html='';
    if(communityState.loading && !communityState.loaded){
      html='<p class="communityMessage">共有投稿を読み込み中…</p>';
    }else if(posts.length){
      html=posts.map(post=>`
        <article class="cityNoteItem">
          <time class="cityNoteTime">${escapeHtml(formatTimestamp(post.createdAt))}</time>
          <p class="cityNoteText">${escapeHtml(post.text)}</p>
        </article>`).join('');
    }else{
      html='<p class="communityMessage">投稿はまだありません。</p>';
    }
    if(list.dataset.renderedNotes!==html){
      list.innerHTML=html;
      list.dataset.renderedNotes=html;
    }
  }

  async function submitCityPost(panel){
    if(!activeRegion) return;
    const input=panel.querySelector('.cityNoteInput');
    const button=panel.querySelector('.cityNoteSubmit');
    const text=input.value.trim();
    if(!text) return;
    const regionId=activeRegion.id;
    button.disabled=true;
    showSharedStatus('投稿中…');
    try{
      const payload=await requestJson({
        method:'POST',
        body:{action:'create_city_post',regionId,text}
      });
      if(!activeRegion || activeRegion.id!==regionId) return;
      communityState.cityPosts.unshift(payload.post);
      communityState.loaded=true;
      input.value='';
      renderCityNoteList(panel);
      showSharedStatus('共有しました');
      setTimeout(()=>showSharedStatus(''),1400);
    }catch(error){
      showSharedStatus(error.message,true);
    }finally{
      button.disabled=false;
    }
  }

  function ensureCityNotesPanel(){
    const main=document.querySelector('main');
    if(!main) return;
    let panel=document.querySelector('.cityNotesPanel');
    if(!panel){
      panel=document.createElement('section');
      panel.className='cityNotesPanel';
      panel.innerHTML=`
        <form class="cityNoteForm">
          <textarea class="cityNoteInput" rows="1" maxlength="1000" placeholder="街の感想"></textarea>
          <button class="cityNoteSubmit" type="submit" aria-label="投稿">➤</button>
        </form>
        <div class="cityNoteMeta" aria-live="polite">
          <span class="cityNoteStatus"></span>
        </div>
        <details class="cityNotesDetails">
          <summary class="cityNotesSummary">
            <span>投稿内容</span>
            <span class="cityNoteCount">—</span>
          </summary>
          <div class="cityNoteList" aria-live="polite"></div>
        </details>`;
      main.appendChild(panel);
      panel.querySelector('.cityNoteForm').addEventListener('submit',event=>{
        event.preventDefault();
        submitCityPost(panel);
      });
    }else if(panel.parentElement!==main || panel!==main.lastElementChild){
      main.appendChild(panel);
    }
    renderCityNoteList(panel);
  }

  function isFavorite(id){
    return communityState.favoriteStoreIds.has(id);
  }

  async function changeFavorite(id,active){
    if(!activeRegion || pendingFavorites.has(id)) return;
    const regionId=activeRegion.id;
    const previous=isFavorite(id);
    pendingFavorites.add(id);
    if(active) communityState.favoriteStoreIds.add(id);
    else communityState.favoriteStoreIds.delete(id);
    decorateCards();
    applyFavoriteFilter();
    showSharedStatus('お気に入りを更新中…');
    try{
      await requestJson({
        method:'POST',
        body:{action:'set_favorite',regionId,storeId:id,active}
      });
      if(activeRegion && activeRegion.id===regionId){
        showSharedStatus('お気に入りを共有しました');
        setTimeout(()=>showSharedStatus(''),1400);
      }
    }catch(error){
      if(activeRegion && activeRegion.id===regionId){
        if(previous) communityState.favoriteStoreIds.add(id);
        else communityState.favoriteStoreIds.delete(id);
        showSharedStatus(error.message,true);
      }
    }finally{
      pendingFavorites.delete(id);
      decorateCards();
      applyFavoriteFilter();
    }
  }

  function setFavoriteFilter(active){
    favoriteFilterActive=active;
    applyFavoriteFilter();
  }

  function ensureFavoriteFilter(){
    const filters=document.getElementById('filters');
    if(!filters) return;
    let button=filters.querySelector('.favoriteFilterBtn');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='filterBtn favoriteFilterBtn';
      button.textContent='★ お気に入り';
      button.addEventListener('click',event=>{
        event.stopPropagation();
        setFavoriteFilter(!favoriteFilterActive);
      });
      filters.insertBefore(button,filters.children[1] || null);
    }
    button.classList.toggle('active',favoriteFilterActive);
    button.setAttribute('aria-pressed',String(favoriteFilterActive));
  }

  function ensureFavoriteTag(card,active){
    const row=card.querySelector('.tags');
    if(!row) return;
    let tag=row.querySelector('.favoriteTag');
    if(active && !tag){
      tag=document.createElement('span');
      tag.className='tag favoriteTag';
      tag.textContent='★ お気に入り';
      row.insertBefore(tag,row.firstChild);
    }else if(!active && tag){
      tag.remove();
    }
    if(tag){
      tag.setAttribute('role','button');
      tag.setAttribute('tabindex','0');
      tag.setAttribute('aria-label','お気に入りで絞り込む');
    }
    if(tag && !tag.dataset.favoriteTagBound){
      tag.dataset.favoriteTagBound='1';
      tag.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        setFavoriteFilter(true);
      });
      tag.addEventListener('keydown',event=>{
        if(event.key!=='Enter' && event.key!==' ') return;
        event.preventDefault();
        event.stopPropagation();
        setFavoriteFilter(true);
      });
    }
  }

  function ensureFavoriteButton(card){
    const id=getCardId(card);
    const top=card.querySelector('.cardTop');
    if(!id || !top) return;
    let button=card.querySelector('.favoriteBtn');
    const active=isFavorite(id);
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='favoriteBtn';
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        changeFavorite(id,!isFavorite(id));
      });
      const rating=top.querySelector('.rating');
      if(rating) top.insertBefore(button,rating);
      else top.appendChild(button);
    }
    button.textContent=active ? '★' : '☆';
    button.classList.toggle('active',active);
    button.disabled=pendingFavorites.has(id);
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active ? '共有お気に入りを解除' : '共有お気に入りに追加');
    ensureFavoriteTag(card,active);
  }

  function getMemo(id){
    const memo=communityState.storeMemos.get(id);
    return memo ? memo.text : '';
  }

  async function saveMemo(id,box){
    if(!activeRegion || pendingMemos.has(id)) return;
    const regionId=activeRegion.id;
    const input=box.querySelector('.personalMemoInput');
    const button=box.querySelector('.personalMemoSave');
    const status=box.querySelector('.personalMemoStatus');
    const text=input.value.trim();
    pendingMemos.add(id);
    button.disabled=true;
    status.textContent='保存中…';
    status.classList.remove('error');
    try{
      const payload=await requestJson({
        method:'POST',
        body:{action:'save_store_memo',regionId,storeId:id,text}
      });
      if(!activeRegion || activeRegion.id!==regionId) return;
      if(payload.memo) communityState.storeMemos.set(id,payload.memo);
      else communityState.storeMemos.delete(id);
      input.value=payload.memo ? payload.memo.text : '';
      input.dataset.dirty='0';
      status.textContent='共有済み';
      setTimeout(()=>{
        if(status.textContent==='共有済み') status.textContent='';
      },1400);
    }catch(error){
      status.textContent=error.message;
      status.classList.add('error');
    }finally{
      pendingMemos.delete(id);
      button.disabled=false;
    }
  }

  function ensureMemoBox(card){
    const id=getCardId(card);
    if(!id) return;
    let box=card.querySelector('.personalMemoBox');
    if(!box){
      box=document.createElement('section');
      box.className='personalMemoBox';
      box.innerHTML=`
        <textarea class="personalMemoInput" rows="2" maxlength="2000" placeholder="メモを入力"></textarea>
        <div class="personalMemoActions">
          <span class="personalMemoStatus" aria-live="polite"></span>
          <button class="personalMemoSave" type="button">共有保存</button>
        </div>`;
      const actions=card.querySelector('.actions');
      if(actions) actions.insertAdjacentElement('beforebegin',box);
      else card.appendChild(box);
      box.addEventListener('click',event=>event.stopPropagation());
      const input=box.querySelector('.personalMemoInput');
      input.addEventListener('input',()=>{input.dataset.dirty='1';});
      box.querySelector('.personalMemoSave').addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        saveMemo(id,box);
      });
    }
    const input=box.querySelector('.personalMemoInput');
    if(document.activeElement!==input && input.dataset.dirty!=='1') input.value=getMemo(id);
    const button=box.querySelector('.personalMemoSave');
    button.disabled=pendingMemos.has(id);
  }

  function decorateCards(){
    document.querySelectorAll('.restaurantCard').forEach(card=>{
      ensureFavoriteButton(card);
      ensureMemoBox(card);
    });
  }

  function applyFavoriteFilter(){
    ensureFavoriteFilter();
    let visibleCount=0;
    const list=document.getElementById('restaurantList');
    document.querySelectorAll('.restaurantCard').forEach(card=>{
      const visible=!favoriteFilterActive || isFavorite(getCardId(card));
      card.hidden=!visible;
      card.classList.toggle('favoriteFilteredOut',!visible);
      if(visible) visibleCount+=1;
    });
    let empty=document.querySelector('.favoriteEmptyState');
    if(favoriteFilterActive && list && visibleCount===0){
      if(!empty){
        empty=document.createElement('p');
        empty.className='favoriteEmptyState';
        empty.textContent=communityState.loading
          ? '共有お気に入りを読み込み中です。'
          : 'お気に入りの店舗はまだありません。';
        list.appendChild(empty);
      }
    }else if(empty){
      empty.remove();
    }
  }

  function renderSharedFeatures(){
    ensureCityNotesPanel();
    ensureFavoriteFilter();
    decorateCards();
    applyFavoriteFilter();
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(()=>{
      scheduled=false;
      renderSharedFeatures();
      synchronizeRegion().catch(error=>{
        communityState.loading=false;
        console.warn('共有機能の初期化に失敗しました。',error);
        renderSharedFeatures();
      });
    },0);
  }

  discardObsoleteStorage();
  scheduleEnhance();
  new MutationObserver(scheduleEnhance).observe(document.body,{childList:true,subtree:true});
  window.setInterval(()=>{
    if(!document.hidden) refreshCommunity({silent:true});
  },refreshIntervalMs);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) refreshCommunity({silent:true});
  });
}());
