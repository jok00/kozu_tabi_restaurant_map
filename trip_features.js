(function(){
  'use strict';

  const storageKey='kozuTabiPersonalData.v1';
  const state={
    regions:[],
    activeRegionId:'',
    favoriteOnly:false,
    journalOpen:{},
    data:loadData()
  };
  let enhanceScheduled=false;

  function emptyData(){
    return {version:1,journals:{},favorites:{},storeNotes:{}};
  }

  function loadData(){
    try{
      const parsed=JSON.parse(localStorage.getItem(storageKey) || 'null');
      if(!parsed || typeof parsed!=='object') return emptyData();
      return {
        version:1,
        journals:parsed.journals && typeof parsed.journals==='object' ? parsed.journals : {},
        favorites:parsed.favorites && typeof parsed.favorites==='object' ? parsed.favorites : {},
        storeNotes:parsed.storeNotes && typeof parsed.storeNotes==='object' ? parsed.storeNotes : {}
      };
    }catch(error){
      console.warn('旅メモの保存データを読み込めませんでした。',error);
      return emptyData();
    }
  }

  function saveData(){
    try{
      localStorage.setItem(storageKey,JSON.stringify(state.data));
      return true;
    }catch(error){
      console.warn('旅メモをブラウザに保存できませんでした。',error);
      return false;
    }
  }

  function regionName(regionId){
    const region=state.regions.find(item=>item.id===regionId);
    return region ? region.name : regionId;
  }

  function assignRegionIds(){
    const buttons=Array.from(document.querySelectorAll('#regionTabs .regionBtn'));
    buttons.forEach((button,index)=>{
      const byName=state.regions.find(item=>item.name===button.textContent.trim());
      const region=byName || state.regions[index];
      if(region) button.dataset.regionId=region.id;
    });
  }

  function detectActiveRegion(){
    assignRegionIds();
    const activeButton=document.querySelector('#regionTabs .regionBtn.active');
    return activeButton && activeButton.dataset.regionId ? activeButton.dataset.regionId : '';
  }

  function getRegionFavorites(regionId){
    if(!state.data.favorites[regionId] || typeof state.data.favorites[regionId]!=='object'){
      state.data.favorites[regionId]={};
    }
    return state.data.favorites[regionId];
  }

  function getRegionNotes(regionId){
    if(!state.data.storeNotes[regionId] || typeof state.data.storeNotes[regionId]!=='object'){
      state.data.storeNotes[regionId]={};
    }
    return state.data.storeNotes[regionId];
  }

  function getRegionPosts(regionId){
    if(!Array.isArray(state.data.journals[regionId])) state.data.journals[regionId]=[];
    return state.data.journals[regionId];
  }

  function storeIdFromCard(card){
    return card.id.startsWith('restaurant-card-') ? card.id.slice('restaurant-card-'.length) : '';
  }

  function formatTime(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP',{
      year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'
    }).format(date);
  }

  function renderJournal(){
    const mount=document.getElementById('tripJournalMount');
    if(!mount || !state.activeRegionId) return;
    const regionId=state.activeRegionId;
    const posts=getRegionPosts(regionId);
    mount.innerHTML='';

    const details=document.createElement('details');
    details.className='tripJournal';
    details.open=state.journalOpen[regionId] ?? window.innerWidth>640;
    details.addEventListener('toggle',()=>{
      state.journalOpen[regionId]=details.open;
    });

    const summary=document.createElement('summary');
    summary.className='tripJournalSummary';
    const summaryTitle=document.createElement('span');
    summaryTitle.textContent=`${regionName(regionId)}の旅メモ`;
    const summaryMeta=document.createElement('span');
    summaryMeta.className='tripJournalSummaryMeta';
    summaryMeta.textContent=`${posts.length}件`;
    summary.append(summaryTitle,summaryMeta);

    const body=document.createElement('div');
    body.className='tripJournalBody';
    const form=document.createElement('form');
    form.className='tripJournalForm';
    const label=document.createElement('label');
    label.className='tripJournalLabel';
    label.htmlFor=`trip-journal-input-${regionId}`;
    label.textContent='この都市で残したいこと';
    const textarea=document.createElement('textarea');
    textarea.className='tripJournalTextarea';
    textarea.id=label.htmlFor;
    textarea.maxLength=2000;
    textarea.placeholder='訪れた場所、食べたもの、次に行きたい場所などを記録…';
    const actions=document.createElement('div');
    actions.className='tripJournalActions';
    const hint=document.createElement('p');
    hint.className='tripJournalHint';
    hint.textContent='投稿時刻と一緒に、このブラウザへ保存されます。';
    const submit=document.createElement('button');
    submit.type='submit';
    submit.className='tripJournalSubmit';
    submit.textContent='メモを投稿';
    submit.disabled=true;
    textarea.addEventListener('input',()=>{
      submit.disabled=!textarea.value.trim();
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const text=textarea.value.trim();
      if(!text) return;
      posts.unshift({
        id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        text,
        createdAt:new Date().toISOString()
      });
      saveData();
      renderJournal();
    });
    actions.append(hint,submit);
    form.append(label,textarea,actions);

    const postList=document.createElement('div');
    postList.className='tripJournalPosts';
    if(!posts.length){
      const empty=document.createElement('p');
      empty.className='tripJournalEmpty';
      empty.textContent='まだ旅メモはありません。';
      postList.appendChild(empty);
    }else{
      posts.forEach(post=>{
        const article=document.createElement('article');
        article.className='tripJournalPost';
        const time=document.createElement('time');
        time.className='tripJournalTime';
        time.dateTime=post.createdAt;
        time.textContent=formatTime(post.createdAt);
        const remove=document.createElement('button');
        remove.type='button';
        remove.className='tripJournalDelete';
        remove.textContent='削除';
        remove.addEventListener('click',()=>{
          if(!window.confirm('この旅メモを削除しますか？')) return;
          const index=posts.findIndex(item=>item.id===post.id);
          if(index>=0) posts.splice(index,1);
          saveData();
          renderJournal();
        });
        const text=document.createElement('p');
        text.className='tripJournalPostText';
        text.textContent=post.text;
        article.append(time,remove,text);
        postList.appendChild(article);
      });
    }

    body.append(form,postList);
    details.append(summary,body);
    mount.appendChild(details);
  }

  function setFavoriteButtonState(button,isFavorite,storeName){
    button.setAttribute('aria-pressed',String(isFavorite));
    button.setAttribute('aria-label',`${storeName || '店舗'}をお気に入り${isFavorite ? 'から解除' : 'に登録'}`);
    button.title=isFavorite ? 'お気に入りから解除' : 'お気に入りに登録';
  }

  function createFavoriteButton(card,storeId){
    const button=document.createElement('button');
    button.type='button';
    button.className='favoriteButton';
    button.textContent='★';
    const storeName=(card.querySelector('h3') || {}).textContent || '';
    setFavoriteButtonState(button,Boolean(getRegionFavorites(state.activeRegionId)[storeId]),storeName);
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const favorites=getRegionFavorites(state.activeRegionId);
      if(favorites[storeId]) delete favorites[storeId];
      else favorites[storeId]=true;
      saveData();
      updateFavoriteControls();
      applyFavoriteFilter();
    });
    return button;
  }

  function createStoreMemo(card,storeId){
    const editor=document.createElement('section');
    editor.className='storeMemoEditor';
    const heading=document.createElement('div');
    heading.className='storeMemoHeading';
    const label=document.createElement('label');
    label.className='storeMemoLabel';
    label.htmlFor=`store-memo-${state.activeRegionId}-${storeId}`;
    label.textContent='店舗メモ';
    const status=document.createElement('span');
    status.className='storeMemoStatus';
    const notes=getRegionNotes(state.activeRegionId);
    const saved=notes[storeId];
    status.textContent=saved && saved.updatedAt ? `${formatTime(saved.updatedAt)} 更新` : '自動保存';
    heading.append(label,status);
    const textarea=document.createElement('textarea');
    textarea.className='storeMemoTextarea';
    textarea.id=label.htmlFor;
    textarea.maxLength=3000;
    textarea.placeholder='注文したい料理、予約情報、訪問後の感想など…';
    textarea.value=saved && typeof saved.text==='string' ? saved.text : '';
    textarea.addEventListener('click',event=>event.stopPropagation());
    textarea.addEventListener('keydown',event=>event.stopPropagation());
    textarea.addEventListener('input',()=>{
      const text=textarea.value;
      const updatedAt=new Date().toISOString();
      if(text.trim()) notes[storeId]={text,updatedAt};
      else delete notes[storeId];
      const savedSuccessfully=saveData();
      status.textContent=savedSuccessfully ? `${formatTime(updatedAt)} 保存` : '保存できませんでした';
    });
    editor.addEventListener('click',event=>event.stopPropagation());
    editor.append(heading,textarea);
    return editor;
  }

  function enhanceCards(){
    if(!state.activeRegionId) return;
    document.querySelectorAll('#restaurantList .restaurantCard').forEach(card=>{
      const storeId=storeIdFromCard(card);
      if(!storeId || card.dataset.tripFeatureRegion===state.activeRegionId) return;
      card.dataset.tripFeatureRegion=state.activeRegionId;
      const cardText=card.querySelector('.cardText');
      if(cardText) cardText.appendChild(createFavoriteButton(card,storeId));
      const memo=createStoreMemo(card,storeId);
      const details=card.querySelector('.moreDetails');
      if(details) card.insertBefore(memo,details);
      else card.appendChild(memo);
    });
  }

  function updateFavoriteControls(){
    if(!state.activeRegionId) return;
    const favorites=getRegionFavorites(state.activeRegionId);
    document.querySelectorAll('#restaurantList .restaurantCard').forEach(card=>{
      const storeId=storeIdFromCard(card);
      const button=card.querySelector('.favoriteButton');
      if(!button) return;
      const storeName=(card.querySelector('h3') || {}).textContent || '';
      setFavoriteButtonState(button,Boolean(favorites[storeId]),storeName);
    });
    const filter=document.querySelector('.favoriteFilterButton');
    if(filter){
      const count=Object.keys(favorites).filter(storeId=>favorites[storeId]).length;
      const label=`お気に入り ${count}`;
      if(filter.textContent!==label) filter.textContent=label;
      filter.classList.toggle('active',state.favoriteOnly);
      filter.setAttribute('aria-pressed',String(state.favoriteOnly));
    }
  }

  function ensureFavoriteFilter(){
    const filters=document.getElementById('filters');
    if(!filters || !state.activeRegionId) return;
    let button=filters.querySelector('.favoriteFilterButton');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='filterBtn favoriteFilterButton';
      button.addEventListener('click',event=>{
        event.preventDefault();
        state.favoriteOnly=!state.favoriteOnly;
        updateFavoriteControls();
        applyFavoriteFilter();
      });
      filters.insertBefore(button,filters.children[1] || null);
    }
    updateFavoriteControls();
  }

  function applyFavoriteFilter(){
    if(!state.activeRegionId) return;
    const favorites=getRegionFavorites(state.activeRegionId);
    const cards=Array.from(document.querySelectorAll('#restaurantList .restaurantCard'));
    const allNames=new Set();
    const visibleNames=new Set();
    let visibleCount=0;
    cards.forEach(card=>{
      const storeId=storeIdFromCard(card);
      const name=((card.querySelector('h3') || {}).textContent || '').trim();
      if(name) allNames.add(name);
      const hidden=state.favoriteOnly && !favorites[storeId];
      card.classList.toggle('favoriteFilteredOut',hidden);
      if(!hidden){
        visibleCount+=1;
        if(name) visibleNames.add(name);
      }
    });

    const list=document.getElementById('restaurantList');
    const oldEmpty=list && list.querySelector('.favoriteEmptyState');
    if(oldEmpty) oldEmpty.remove();
    if(list && state.favoriteOnly && cards.length && visibleCount===0){
      const empty=document.createElement('p');
      empty.className='favoriteEmptyState';
      empty.textContent='この条件に一致するお気に入り店舗はありません。';
      list.appendChild(empty);
    }

    document.querySelectorAll('#mapCanvas .leaflet-marker-icon[title]').forEach(marker=>{
      const title=(marker.getAttribute('title') || '').trim();
      if(!allNames.has(title)) return;
      marker.style.display=state.favoriteOnly && !visibleNames.has(title) ? 'none' : '';
    });
    document.querySelectorAll('#restaurantLabelLayer .restaurantLabel').forEach(label=>{
      if(!state.favoriteOnly){
        label.style.display='';
        return;
      }
      const text=(label.textContent || '').trim();
      const visible=Array.from(visibleNames).some(name=>text.includes(name.split(' / ')[0]));
      label.style.display=visible ? '' : 'none';
    });
  }

  function enhance(){
    enhanceScheduled=false;
    const nextRegionId=detectActiveRegion();
    if(nextRegionId && nextRegionId!==state.activeRegionId){
      state.favoriteOnly=false;
      state.activeRegionId=nextRegionId;
      renderJournal();
    }
    ensureFavoriteFilter();
    enhanceCards();
    updateFavoriteControls();
    applyFavoriteFilter();
  }

  function scheduleEnhance(){
    if(enhanceScheduled) return;
    enhanceScheduled=true;
    requestAnimationFrame(enhance);
  }

  function observeApp(){
    const observer=new MutationObserver(scheduleEnhance);
    ['regionTabs','filters','restaurantList','mapCanvas','restaurantLabelLayer'].forEach(id=>{
      const element=document.getElementById(id);
      if(element) observer.observe(element,{childList:true,subtree:true});
    });
    window.addEventListener('storage',event=>{
      if(event.key!==storageKey) return;
      state.data=loadData();
      renderJournal();
      updateFavoriteControls();
      applyFavoriteFilter();
    });
    scheduleEnhance();
  }

  async function init(){
    try{
      const response=await fetch('./store_data.json',{cache:'no-store'});
      if(response.ok){
        const index=await response.json();
        state.regions=Array.isArray(index.regions) ? index.regions : [];
      }
    }catch(error){
      console.warn('地域一覧を読み込めませんでした。',error);
    }
    observeApp();
  }

  init();
}());
