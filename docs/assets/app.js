/* Static site: all research lives in data/listings.json. No backend or API key. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = (value) => `S$${Number(value).toLocaleString('en-SG')}`;
  const date = (value) => value ? value.replace(/-/g, '.') : '미확인';
  const top = (value) => value.length === 4 ? `${value}년` : `${value.slice(0,4)}년 ${Number(value.slice(5))}월`;
  const colours = ['#728764','#608ca1','#b19162','#4e8d83','#8b7c9e','#ca927f'];
  let dataset, rows, regions, map, tiles, office, visible = [], selected = null, markers = [], markerGroup;
  let activeRegion = 'all', tileFailures = 0, lastTrigger = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showView(view) {
    document.body.classList.toggle('view-list', view === 'list');
    ['map','list'].forEach((name) => {
      $(`#show-${name}`).classList.toggle('active', name === view);
      $(`#show-${name}`).setAttribute('aria-pressed', String(name === view));
    });
    if (map && view === 'map') requestAnimationFrame(() => map.invalidateSize());
  }

  function filteredRows() {
    const query = $('#search').value.trim().toLocaleLowerCase();
    const beds = Number($('#beds').value);
    const underBudget = $('#budget').checked;
    return rows.filter((row) => (activeRegion === 'all' || row.region === activeRegion)
      && (!underBudget || row.rent <= 6000) && (!beds || row.beds === beds)
      && `${row.name} ${row.address} ${row.mrt} ${row.region} ${row.subregion || ''}`.toLocaleLowerCase().includes(query))
      .sort((a,b) => {
        const key = $('#sort').value;
        if (key === 'region') return a.index - b.index;
        return a[key] - b[key] || a.index - b.index;
      });
  }

  function renderRegions() {
    $('#regions').innerHTML = [{name:'all',label:'전체',count:rows.length}, ...regions.map((name,i) => ({name,label:name,count:rows.filter((r)=>r.region===name).length,colour:colours[i]}))]
      .map((r) => `<button class="region-chip ${activeRegion === r.name ? 'active' : ''}" data-region="${escape(r.name)}" aria-pressed="${activeRegion === r.name}" style="--region:${r.colour || '#1d5446'}">${r.colour ? '<span class="dot" aria-hidden="true"></span>' : ''}${escape(r.label)}<span class="chip-count">${r.count}</span></button>`).join('');
    $('#regions').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      activeRegion = button.dataset.region;
      renderRegions(); update(true);
    }));
  }

  function renderCards() {
    $('#listings').innerHTML = visible.length ? visible.map((row) => `<button type="button" class="listing-card ${selected?.id === row.id ? 'selected' : ''}" data-id="${row.id}" style="--region:${row.colour}" aria-label="${escape(row.name)}, ${escape(row.address)}, 월 ${money(row.rent)}, 상세 보기" aria-pressed="${selected?.id === row.id}">
      <span class="card-top"><span class="region-dot" aria-hidden="true"></span>${escape(row.subregion || row.region)}<span class="commute">Google 약 ${row.commute}분</span></span>
      <span class="card-name">${escape(row.name)}</span><span class="card-address">${escape(row.address)}</span>
      <span class="card-price-row"><span class="card-price">${money(row.rent)}<small>/월</small></span><span class="card-facts">방 ${row.beds}개 · ${row.area.toLocaleString()} sqft</span></span>
      <span class="card-bottom"><span class="mrt-symbol">MRT</span>${escape(row.mrt)} · 도보 ${row.walk}분${row.rent > 6000 ? `<span class="over-budget">예산 +${money(row.rent-6000)}</span>` : ''}</span>
    </button>`).join('') : '<div class="empty"><strong>조건에 맞는 매물이 없어요.</strong>지역이나 검색 조건을 조금 넓혀 보세요.<br><button id="reset-filters">필터 초기화</button></div>';
    $('#listings').querySelectorAll('.listing-card').forEach((button) => button.addEventListener('click', () => selectRow(button.dataset.id, {trigger:button})));
    $('#reset-filters')?.addEventListener('click', resetFilters);
  }

  function resetFilters() {
    activeRegion = 'all'; $('#budget').checked = false; $('#beds').value = '0'; $('#search').value = ''; $('#sort').value = 'region';
    renderRegions(); update(true);
  }

  function update(fit = false) {
    visible = filteredRows();
    if (selected && !visible.some((row) => row.id === selected.id)) closeDetail(false);
    $('#result-count').textContent = `${visible.length}개 매물`;
    $('#map-count').textContent = visible.length;
    $('#mobile-count').textContent = visible.length;
    $('#result-caption').textContent = $('#budget').checked ? '기준예산 S$6,000 이내' : '검색 상한 S$6,500';
    renderCards(); renderMarkers();
    if (fit) fitVisible();
  }

  function tooltip(row) {
    return `<strong>${escape(row.name)}</strong><small>${escape(row.address)}</small><small>${money(row.rent)}/월 · 방 ${row.beds}개 · Google 약 ${row.commute}분</small>`;
  }

  function renderMarkers() {
    if (!map) return;
    markerGroup.clearLayers(); markers = [];
    const groups = [];
    // Cluster by screen distance; underlying building coordinates are never shifted.
    visible.forEach((row) => {
      const point = map.latLngToLayerPoint([row.lat, row.lng]);
      const group = row.id !== selected?.id && map.getZoom() < 18 && groups.find((g) => !g.rows.some((r)=>r.id===selected?.id) && Math.abs(point.x-g.point.x)<82 && Math.abs(point.y-g.point.y)<43);
      if (group) group.rows.push(row); else groups.push({point, rows:[row]});
    });
    groups.forEach((group) => {
      const member = group.rows[0];
      const isGroup = group.rows.length > 1;
      const isSelected = group.rows.some((r) => r.id === selected?.id);
      const centre = isGroup ? [group.rows.reduce((s,r)=>s+r.lat,0)/group.rows.length,group.rows.reduce((s,r)=>s+r.lng,0)/group.rows.length] : [member.lat,member.lng];
      const html = isGroup ? `<span class="price-pin cluster-pin"><b>${group.rows.length}</b> 매물</span>` : `<span class="price-pin" style="--region:${member.colour}"><span class="pin-dot"></span>${money(member.rent)}</span>`;
      const marker = L.marker(centre, {icon:L.divIcon({className:`pin-shell ${isSelected ? 'pin-selected' : ''}`,html,iconSize:[78,34],iconAnchor:[39,38],tooltipAnchor:[0,-37]}),title:isGroup ? `${group.rows.length}개 매물 확대` : `${member.name} · ${member.address} · ${money(member.rent)}`,keyboard:true,riseOnHover:true,zIndexOffset:isSelected ? 1000 : 0});
      marker.bindTooltip(isGroup ? `<strong>${group.rows.length}개 매물 · 클릭하여 확대</strong>${group.rows.map((r)=>`<small>${escape(r.name)} · ${escape(r.address)}</small>`).join('')}` : tooltip(member),{direction:'top',offset:[0,-4]});
      marker.on('click', () => {
        if (isGroup) map.fitBounds(L.latLngBounds(group.rows.map((r)=>[r.lat,r.lng])),{padding:[80,80],maxZoom:18,animate:!reducedMotion});
        else selectRow(member.id,{trigger:marker.getElement()});
      });
      marker.addTo(markerGroup); markers.push({marker,ids:group.rows.map((r)=>r.id)});
    });
  }

  function fitVisible() {
    const points = [...visible.map((r)=>[r.lat,r.lng]), [office.lat,office.lng]];
    if (points.length === 1) map.setView(points[0],13,{animate:!reducedMotion});
    else map.fitBounds(L.latLngBounds(points),{padding:[64,70],maxZoom:14,animate:!reducedMotion});
  }

  function selectRow(id, {trigger = null, focus = true} = {}) {
    const row = rows.find((r)=>r.id===id);
    if (!row) return;
    selected = row; lastTrigger = trigger;
    showView('map');
    const route = new URL('https://www.google.com/maps/dir/');
    route.search = new URLSearchParams({api:'1',origin:`${row.address}, Singapore ${row.postal}`,destination:dataset.destination,travelmode:'transit'}).toString();
    const extra = row.note ? `<div class="detail-note"><strong>확인 메모</strong><br>${escape(row.note)}</div>` : '';
    $('#detail').innerHTML = `<div class="detail-header"><button id="detail-close" class="close-button" aria-label="매물 상세 닫기">×</button>
      <div class="detail-region"><span class="region-dot" style="--region:${row.colour}"></span>${escape(row.region)}${row.subregion ? ` / ${escape(row.subregion)}` : ''}</div>
      <h2>${escape(row.name)}</h2><p class="detail-address">${escape(row.address)}<br>Singapore ${row.postal}</p>
      <div class="detail-price">${money(row.rent)}<small>/ 월</small></div><span class="budget-status ${row.rent>6000 ? 'over' : ''}">${row.rent>6000 ? `기준예산보다 ${money(row.rent-6000)} 초과` : row.rent===6000 ? '기준예산 S$6,000 이내' : `기준예산보다 ${money(6000-row.rent)} 여유`}</span></div>
      <div class="detail-body"><div class="main-facts"><div><span>BEDROOMS</span><strong>방 ${row.beds}개</strong><small>침실 수</small></div><div><span>FLOOR AREA</span><strong>${row.area.toLocaleString()}</strong><small>sqft · 약 ${Math.round(row.area*0.092903)}㎡</small></div><div><span>MRT WALK</span><strong>${row.walk}분</strong><small>매물 표시 기준</small></div></div>
      <div class="commute-box"><div class="commute-heading"><span>대중교통 예상 통근</span><strong>약 ${row.commute}<small>분</small></strong></div><div class="commute-dest"><span class="g-small">G</span>Google Singapore</div><p>Mapletree Business City · PropertyGuru 앱 예상값<br>아침 도착 시각 미지정 · 실제 경로는 아래에서 확인</p></div>
      <dl class="detail-facts"><dt>가까운 MRT</dt><dd>${escape(row.mrt)} · 도보 ${row.walk}분</dd><dt>준공 · TOP</dt><dd>${top(row.top)}</dd><dt>입주 가능일</dt><dd>${row.available ? date(row.available) : escape(row.availabilityNote || '별도 확인 필요')}</dd><dt>지역 분류</dt><dd>${escape(row.region)}</dd><dt>조사 기준일</dt><dd>${date(dataset.checkedDate)}</dd></dl>${extra}
      <div class="detail-actions"><a class="primary-link" href="${escape(row.url)}" target="_blank" rel="noopener noreferrer">PropertyGuru에서 매물 보기 <span aria-hidden="true">↗</span></a><a class="secondary-link" href="${escape(route.href)}" target="_blank" rel="noopener noreferrer">Google Maps에서 대중교통 경로 확인 <span aria-hidden="true">↗</span></a></div>
      <p class="detail-footnote">지도 핀은 OneMap 주소 기준 건물 위치입니다.<br>가격·입주 가능 여부는 조사 이후 달라질 수 있습니다.</p></div>`;
    $('#detail').hidden = false; $('#detail').scrollTop = 0;
    $('#detail-close').addEventListener('click', () => closeDetail());
    history.replaceState(null,'',`#${row.id}`);
    renderCards();
    const mobile = window.matchMedia('(max-width:760px)').matches;
    const zoom = Math.max(map.getZoom(),16);
    const targetPoint = map.project([row.lat,row.lng],zoom);
    // Keep the selected building visible beside the desktop drawer / above the mobile sheet.
    const offset = mobile ? L.point(0,map.getSize().y*.30) : L.point(Math.min(185,map.getSize().x*.25),0);
    map.setView(map.unproject(targetPoint.add(offset),zoom),zoom,{animate:!reducedMotion});
    renderMarkers();
    if (focus) $('#detail-close').focus({preventScroll:true});
  }

  function closeDetail(restoreFocus = true) {
    selected = null; $('#detail').hidden = true; history.replaceState(null,'',location.pathname+location.search);
    renderCards(); renderMarkers();
    if (restoreFocus) {
      const card = lastTrigger?.dataset?.id && $(`.listing-card[data-id="${lastTrigger.dataset.id}"]`);
      if (card && window.matchMedia('(min-width:761px)').matches) card.focus({preventScroll:true});
      else $('#fit-map').focus({preventScroll:true});
    }
  }

  async function init() {
    const response = await fetch('data/listings.json');
    if (!response.ok) throw new Error('매물 데이터를 불러오지 못했습니다.');
    dataset = await response.json(); office = dataset.office;
    regions = [...new Set(dataset.rows.map((r)=>r.region))];
    rows = dataset.rows.map((row,index)=>({...row,index,colour:colours[regions.indexOf(row.region)]}));
    map = L.map('map',{zoomControl:false,minZoom:10,maxZoom:19,scrollWheelZoom:true}).setView([1.305,103.836],12);
    L.control.zoom({position:'bottomright'}).addTo(map);
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on('tileerror', () => { if (++tileFailures >= 3) $('#tile-error').hidden=false; });
    tiles.on('tileload', () => { tileFailures=0; $('#tile-error').hidden=true; });
    $('#tile-retry').addEventListener('click', () => {tileFailures=0;tiles.redraw();});
    L.marker([office.lat,office.lng],{icon:L.divIcon({className:'pin-shell',html:'<span class="office-marker">G</span>',iconSize:[38,38],iconAnchor:[19,19]}),title:'Google Singapore · Mapletree Business City',zIndexOffset:900}).addTo(map).bindTooltip('<strong>Google Singapore</strong><small>Mapletree Business City</small><small>70 Pasir Panjang Road · 통근 목적지</small>',{direction:'top',offset:[0,-25]});
    markerGroup = L.layerGroup().addTo(map);
    map.on('zoomend moveend',renderMarkers);
    renderRegions(); update(true);
    $('#search').addEventListener('input',()=>update(true));
    ['budget','beds'].forEach((id)=>$(`#${id}`).addEventListener('change',()=>update(true)));
    $('#sort').addEventListener('change',()=>update());
    $('#fit-map').addEventListener('click',()=>{closeDetail(false);fitVisible();});
    $('#office-focus').addEventListener('click',()=>{closeDetail(false);map.setView([office.lat,office.lng],16,{animate:!reducedMotion});});
    $('#show-map').addEventListener('click',()=>showView('map'));
    $('#show-list').addEventListener('click',()=>{closeDetail(false);showView('list');});
    const about = $('#about-dialog');
    ['about-open','data-info'].forEach((id)=>$(`#${id}`).addEventListener('click',()=>about.showModal()));
    $('#about-close').addEventListener('click',()=>about.close());
    about.addEventListener('click',(event)=>{if(event.target===about){const r=about.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)about.close();}});
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!about.open&&selected)closeDetail();});
    const openHash = () => {const id = decodeURIComponent(location.hash.slice(1)); if(rows.some((r)=>r.id===id)) {if(!visible.some((r)=>r.id===id)) resetFilters();selectRow(id,{focus:false});}};
    openHash(); window.addEventListener('hashchange',openHash);
    window.addEventListener('resize',()=>{
      if (document.body.classList.contains('view-list')) return;
      map.invalidateSize();
      if (selected) selectRow(selected.id,{focus:false}); else fitVisible();
    });
  }
  init().catch((error)=>{
    console.error(error);
    $('#listings').innerHTML='<div class="empty"><strong>데이터를 불러오지 못했습니다.</strong>인터넷 연결을 확인하고<br>페이지를 새로고침해 주세요.</div>';
    $('#result-count').textContent='불러오기 실패';
  });
})();
