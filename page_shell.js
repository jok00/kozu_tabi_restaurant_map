(function(){
  const defaults={
    title:'スペイン旅レストランマップ',
    description:'スペインの飲食店・宿泊地・予定地を都市別に切り替えて、地図と一覧で確認できる旅マップです。',
    mapAriaLabel:'スペイン旅レストランマップ',
    mapLabel:'地域別店舗ピン',
    legend:'スペインの飲食店ピンと予定地ピンを重ねて表示します。ピンまたはカードを選ぶと、選択中の地点が強調表示されます。',
    commonAssetBase:'https://common-web-map.vercel.app/',
    commonAssetVersion:'20260624-split'
  };
  const config={...defaults,...(window.KOZU_TABI_MAP_PAGE || {})};
  const commonAssetBase=config.commonAssetBase.endsWith('/') ? config.commonAssetBase : `${config.commonAssetBase}/`;
  const versionSuffix=config.commonAssetVersion ? `?v=${encodeURIComponent(config.commonAssetVersion)}` : '';

  function setMetaDescription(){
    let description=document.querySelector('meta[name="description"]');
    if(!description){
      description=document.createElement('meta');
      description.name='description';
      document.head.appendChild(description);
    }
    description.content=config.description;
  }

  function addLink(attributes){
    const selector=attributes.href ? `link[href="${attributes.href}"]` : '';
    if(selector && document.querySelector(selector)) return;
    const link=document.createElement('link');
    Object.entries(attributes).forEach(([key,value])=>{
      if(value !== undefined && value !== null) link.setAttribute(key,value);
    });
    document.head.appendChild(link);
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`${src} の読み込みに失敗しました。`));
      document.body.appendChild(script);
    });
  }

  function renderHead(){
    document.title=config.title;
    setMetaDescription();
    addLink({rel:'preconnect',href:'https://fonts.googleapis.com'});
    addLink({rel:'preconnect',href:'https://fonts.gstatic.com',crossorigin:''});
    addLink({
      rel:'stylesheet',
      href:'https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Noto+Sans+JP:wght@400;500;700;800&display=swap'
    });
    addLink({rel:'stylesheet',href:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'});
    addLink({rel:'stylesheet',href:`${commonAssetBase}map_app.css${versionSuffix}`});
    addLink({rel:'stylesheet',href:`./tag_overrides.css${versionSuffix}`});
    addLink({rel:'stylesheet',href:`./personal_features.css${versionSuffix}`});
  }

  function renderBody(){
    document.body.innerHTML=`
  <header>
    <div class="wrap hero">
      <div class="heroText">
      </div>
      <div class="regionTabs" id="regionTabs" aria-label="地域を選択"></div>
      <div class="filters" id="filters"></div>
    </div>
  </header>

  <main class="wrap">
    <section class="layout">
      <section class="panel mapPanel">
        <div id="map">
          <div id="mapCanvas" class="mapFrame" aria-label="${config.mapAriaLabel}"></div>
          <div id="restaurantLabelLayer" class="restaurantLabelLayer" aria-hidden="true"></div>
          <div class="mapLabel" id="mapLabel">${config.mapLabel}</div>
          <button class="locationButton" id="locationButton" type="button" aria-label="現在地を地図に表示">現在地</button>
        </div>
        <div class="mapFoot">
          <p class="legend">${config.legend}</p>
          <p class="mapStatus" id="mapStatus"></p>
        </div>
      </section>

      <aside class="panel listPanel">
        <div class="panelBody">
          <div class="mobileCarouselWrap">
          <div class="restaurantList" id="restaurantList"></div>
          </div>
        </div>
      </aside>
    </section>
  </main>`;
  }

  async function start(){
    renderHead();
    renderBody();
    await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    await loadScript(`${commonAssetBase}map_app.js${versionSuffix}`);
    await loadScript(`./tag_overrides.js${versionSuffix}`);
    await loadScript(`./personal_features.js${versionSuffix}`);
  }

  start().catch(error=>{
    console.error(error);
    document.body.innerHTML='<main class="wrap"><p class="memo">ページの読み込みに失敗しました。</p></main>';
  });
}());
