(function(){
  const storagePrefix='kozuTabiPersonal:v1';
  let favoriteFilterActive=false;
  let scheduled=false;

  function getRegionName(){
    const active=document.querySelector('.regionBtn.active');
    return active ? active.textContent.trim() : document.title.replace(/旅マップ|飲食店マップ|レストランマップ/g,'').trim() || 'default';
  }

  function getCardId(card){
    return card && card.id ? card.id.replace(/^restaurant-card-/,'') : '';
  }

  function storageKey(type, id=''){
    const region=getRegionName();
    return `${storagePrefix}:${type}:${region}${id ? `:${id}` : ''}`;
  }

  function loadJson(key, fallback){
    try{
      const value=localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    }catch(error){
      return fallback;
    }
  }

  function saveJson(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"]/g, char=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;'
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

  function getCityNotes(){
    return loadJson(storageKey('cityNotes'), []);
  }

  function renderCityNoteList(panel){
    const list=panel.querySelector('.cityNoteList');
    const count=panel.querySelector('.cityNoteCount');
    const notes=getCityNotes();
    const nextCount=`${notes.length}件`;
    if(count && count.textContent!==nextCount) count.textContent=nextCount;
    if(!list) return;
    const html=notes.length
      ? notes.map(note=>`
        <article class="cityNoteItem">
          <time class="cityNoteTime">${escapeHtml(formatTimestamp(note.createdAt))}</time>
          <p class="cityNoteText">${escapeHtml(note.text)}</p>
        </article>`).join('')
      : '';
    if(list.dataset.renderedNotes!==html){
      list.innerHTML=html;
      list.dataset.renderedNotes=html;
    }
  }

  function ensureCityNotesPanel(){
    const hero=document.querySelector('.hero');
    const filters=document.getElementById('filters');
    if(!hero || !filters) return;
    let panel=document.querySelector('.cityNotesPanel');
    if(!panel){
      panel=document.createElement('section');
      panel.className='cityNotesPanel';
      panel.innerHTML=`
        <div class="cityNotesHead">
          <h2 class="cityNotesTitle">都市の感想</h2>
          <span class="cityNoteCount">0件</span>
        </div>
        <form class="cityNoteForm">
          <textarea class="cityNoteInput" rows="1" placeholder="この都市の感想を投稿"></textarea>
          <button class="cityNoteSubmit" type="submit">投稿</button>
        </form>
        <div class="cityNoteList" aria-live="polite"></div>`;
      filters.insertAdjacentElement('afterend', panel);
      panel.querySelector('.cityNoteForm').addEventListener('submit', event=>{
        event.preventDefault();
        const input=panel.querySelector('.cityNoteInput');
        const text=input.value.trim();
        if(!text) return;
        const notes=getCityNotes();
        notes.unshift({text,createdAt:new Date().toISOString()});
        saveJson(storageKey('cityNotes'), notes);
        input.value='';
        renderCityNoteList(panel);
      });
    }else if(panel.previousElementSibling!==filters){
      filters.insertAdjacentElement('afterend', panel);
    }
    renderCityNoteList(panel);
  }

  function isFavorite(id){
    return localStorage.getItem(storageKey('favorite', id))==='1';
  }

  function setFavorite(id, active){
    const key=storageKey('favorite', id);
    if(active) localStorage.setItem(key,'1');
    else localStorage.removeItem(key);
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
      button.addEventListener('click', event=>{
        event.stopPropagation();
        favoriteFilterActive=!favoriteFilterActive;
        applyFavoriteFilter();
      });
      filters.insertBefore(button, filters.children[1] || null);
    }
    button.classList.toggle('active', favoriteFilterActive);
  }

  function ensureFavoriteTag(card, active){
    const row=card.querySelector('.tags');
    if(!row) return;
    let tag=row.querySelector('.favoriteTag');
    if(active && !tag){
      tag=document.createElement('span');
      tag.className='tag favoriteTag';
      tag.textContent='★ お気に入り';
      row.insertBefore(tag, row.firstChild);
    }else if(!active && tag){
      tag.remove();
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
      button.setAttribute('aria-label','お気に入りに追加');
      button.addEventListener('click', event=>{
        event.preventDefault();
        event.stopPropagation();
        const next=!isFavorite(id);
        setFavorite(id, next);
        decorateCards();
        applyFavoriteFilter();
      });
      const rating=top.querySelector('.rating');
      if(rating) top.insertBefore(button, rating);
      else top.appendChild(button);
    }
    const label=active ? '★' : '☆';
    if(button.textContent!==label) button.textContent=label;
    button.classList.toggle('active', active);
    const pressed=String(active);
    const ariaLabel=active ? 'お気に入りを解除' : 'お気に入りに追加';
    if(button.getAttribute('aria-pressed')!==pressed) button.setAttribute('aria-pressed', pressed);
    if(button.getAttribute('aria-label')!==ariaLabel) button.setAttribute('aria-label', ariaLabel);
    ensureFavoriteTag(card, active);
  }

  function getMemo(id){
    return localStorage.getItem(storageKey('memo', id)) || '';
  }

  function setMemo(id, value){
    const key=storageKey('memo', id);
    if(value.trim()) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  }

  function ensureMemoBox(card){
    const id=getCardId(card);
    if(!id) return;
    let box=card.querySelector('.personalMemoBox');
    if(!box){
      box=document.createElement('section');
      box.className='personalMemoBox';
      box.innerHTML=`
        <div class="personalMemoHead">
          <h4 class="personalMemoTitle">店舗メモ</h4>
          <span class="personalMemoStatus"></span>
        </div>
        <textarea class="personalMemoInput" rows="2" placeholder="この店舗のメモを入力"></textarea>
        <div class="personalMemoActions">
          <button class="personalMemoSave" type="button">保存</button>
        </div>`;
      const actions=card.querySelector('.actions');
      if(actions) actions.insertAdjacentElement('beforebegin', box);
      else card.appendChild(box);
      box.addEventListener('click', event=>event.stopPropagation());
      box.querySelector('.personalMemoSave').addEventListener('click', event=>{
        event.preventDefault();
        event.stopPropagation();
        const input=box.querySelector('.personalMemoInput');
        setMemo(id, input.value);
        const status=box.querySelector('.personalMemoStatus');
        status.textContent='保存済み';
        setTimeout(()=>{ status.textContent=''; }, 1400);
      });
    }
    const input=box.querySelector('.personalMemoInput');
    if(document.activeElement!==input) input.value=getMemo(id);
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
      if(visible) visibleCount+=1;
    });
    let empty=document.querySelector('.favoriteEmptyState');
    if(favoriteFilterActive && list && visibleCount===0){
      if(!empty){
        empty=document.createElement('p');
        empty.className='favoriteEmptyState';
        empty.textContent='お気に入りの店舗はまだありません。';
        list.appendChild(empty);
      }
    }else if(empty){
      empty.remove();
    }
  }

  function enhance(){
    ensureCityNotesPanel();
    ensureFavoriteFilter();
    decorateCards();
    applyFavoriteFilter();
  }

  function scheduleEnhance(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      enhance();
    });
  }

  scheduleEnhance();
  new MutationObserver(scheduleEnhance).observe(document.body,{childList:true,subtree:true});
}());