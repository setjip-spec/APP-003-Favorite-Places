(() => {
'use strict';

const SUPABASE_URL='https://lepvlmclsbciwvhxyktf.supabase.co';
const SUPABASE_KEY='sb_publishable_V_s6ONo_RtLR3sR96asPJw_M92v98vR';
const APP_VERSION='0.1';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const val=v=>v===null||v===undefined||v===''?null:v;
const num=v=>v===''||v===null||v===undefined?null:Number(v);
const fmtMoney=v=>v===null||v===undefined?'неизвестно':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(Number(v));
const fmtDate=v=>v?new Date(v+'T00:00:00').toLocaleDateString('ru-RU'):'—';
const fmtDuration=v=>v==null?'—':v<60?`${v} мин`:v%60?`${Math.floor(v/60)} ч ${v%60} мин`:`${v/60} ч`;

let db=null;
let user=null;
let places=[];
let visits=[];
let refs=[];
let settings=null;
let currentScreen='quick';
let busyCount=0;

const GROUP={
 status:'STATUS',verdict:'VERDICT',mode:'MODE',frequency:'FREQUENCY',placeType:'PLACE_TYPE',effect:'PRIMARY_EFFECT',tempo:'TEMPO',venue:'VENUE_TYPE',social:'SOCIAL_FORMAT',energy:'REQUIRED_ENERGY',friction:'STARTUP_FRICTION',physical:'PHYSICAL_LOAD',booking:'BOOKING_REQUIREMENT',availability:'AVAILABILITY',visitVerdict:'VISIT_VERDICT',companions:'COMPANIONS',time:'TIME_OF_DAY',glad:'GLAD_WENT'
};

function setBusy(on){busyCount+=on?1:-1;busyCount=Math.max(0,busyCount);$('#busy').classList.toggle('hidden',busyCount===0)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add('hidden'),2200)}
function options(group,includeAny=true,anyLabel='Любой'){const list=refs.filter(r=>r.group_code===group&&r.is_active!==false).sort((a,b)=>a.sort_order-b.sort_order);return (includeAny?`<option value="">${esc(anyLabel)}</option>`:'')+list.map(r=>`<option value="${esc(r.display_name)}">${esc(r.display_name)}</option>`).join('')}
function unique(field){return [...new Set(places.map(p=>p[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ru'))}
function badgeClass(v){if(v==='Понравилось'||v==='Был')return'good';if(v==='Не понравилось')return'bad';if(v==='Запланировано')return'plan';return''}
function moneyOrDash(v){return v===null||v===undefined?'—':fmtMoney(v)}

async function boot(){
  if(!window.supabase?.createClient){showAuth('Не загрузилась библиотека Supabase. Обновите страницу.');return}
  db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  bindStatic();
  const {data:{session},error}=await db.auth.getSession();
  if(error){showAuth(error.message);return}
  if(session)await enter(session.user);else showAuth();
}

function bindStatic(){
  $('#authForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;$('#authError').textContent='';setBusy(true);const {data,error}=await db.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});setBusy(false);if(error){$('#authError').textContent=error.message;return}await enter(data.user)});
  $('#logoutBtn').onclick=async()=>{await db.auth.signOut();location.reload()};
  $('#refreshBtn').onclick=loadAll;
  $('#addPlaceBtn').onclick=()=>openPlaceForm();
  $('#resetQuickBtn').onclick=()=>{renderQuickFilters(true);renderQuick()};
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('button[data-screen]');if(b)switchScreen(b.dataset.screen)});
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
}

function showAuth(msg=''){$('#authGate').classList.remove('hidden');$('#app').classList.add('hidden');$('#authError').textContent=msg}
async function enter(u){user=u;$('#authGate').classList.add('hidden');$('#app').classList.remove('hidden');$('#cloudStatus').textContent=`${u.email||'профиль'} · облако`;await loadAll()}

async function loadAll(){
  setBusy(true);
  try{
    const [p,v,r,s]=await Promise.all([
      db.from('app003_places').select('*').order('place_code'),
      db.from('app003_visits').select('*').order('visit_date',{ascending:false}).order('created_at',{ascending:false}),
      db.from('app003_reference_options').select('*').eq('is_active',true).order('group_code').order('sort_order'),
      db.from('app003_settings').select('*').maybeSingle()
    ]);
    for(const x of [p,v,r,s])if(x.error)throw x.error;
    places=p.data||[];visits=v.data||[];refs=r.data||[];settings=s.data||{};
    initControls();renderAll();
  }catch(e){console.error(e);toast('Ошибка загрузки: '+e.message)}finally{setBusy(false)}
}

function initControls(){
  if(!$('#quickFilters').children.length)renderQuickFilters(true);
  $('#quickSort').innerHTML='<option value="travel">Дорога ↑</option><option value="cost">Стоимость ↑</option><option value="rating">Оценка ↓</option><option value="duration">Время на месте ↑</option><option value="name">Название А–Я</option>';
  $('#quickSort').onchange=renderQuick;
  $('#catalogSearch').oninput=renderCatalog;
  $('#catalogStatus').innerHTML=options(GROUP.status,true,'Любой статус');
  $('#catalogVerdict').innerHTML=options(GROUP.verdict,true,'Любой вердикт');
  $('#catalogType').innerHTML=options(GROUP.placeType,true,'Любой тип');
  $('#catalogSort').innerHTML='<option value="code">Код</option><option value="travel">Дорога ↑</option><option value="cost">Стоимость ↑</option><option value="rating">Оценка ↓</option><option value="visits">Посещения ↓</option><option value="last">Последнее посещение ↓</option><option value="name">Название А–Я</option>';
  for(const id of ['catalogStatus','catalogVerdict','catalogType','catalogSort'])$('#'+id).onchange=renderCatalog;
  $('#visitPlaceFilter').innerHTML='<option value="">Все места</option>'+places.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#visitVerdictFilter').innerHTML=options(GROUP.visitVerdict,true,'Любой вердикт');
  $('#visitCompanionFilter').innerHTML=options(GROUP.companions,true,'Любая компания');
  $('#visitTimeFilter').innerHTML=options(GROUP.time,true,'Любое время');
  for(const id of ['visitPlaceFilter','visitVerdictFilter','visitCompanionFilter','visitTimeFilter'])$('#'+id).onchange=renderVisits;
}

function renderQuickFilters(reset=false){
  const main=[
    ['qStatus','Статус',`<select>${options(GROUP.status)}</select>`],
    ['qVerdict','Вердикт',`<select>${options(GROUP.verdict)}</select>`],
    ['qType','Тип',`<select>${options(GROUP.placeType)}</select>`],
    ['qVenue','Где проходит',`<select>${options(GROUP.venue)}</select>`],
    ['qTime','Время суток','<select><option value="">Любое</option><option>Утро</option><option>День</option><option>Вечер</option><option>Ночь</option></select>'],
    ['qSocial','Социальный формат',`<select>${options(GROUP.social)}</select>`],
    ['qTravel','Макс. дорога, мин','<input type="number" min="0" step="5" placeholder="без ограничения">'],
    ['qBudget','Макс. бюджет, ₽','<input type="number" min="0" step="100" placeholder="без ограничения">'],
    ['qEnergy','Нужная мощность',`<select>${options(GROUP.energy)}</select>`],
    ['qEffect','Главный эффект',`<select>${options(GROUP.effect)}</select>`],
    ['qMode','Режим опыта',`<select>${options(GROUP.mode)}</select>`]
  ];
  const adv=[
    ['qSeason','Сезон','<select><option value="">Любой</option><option>Весна</option><option>Лето</option><option>Осень</option><option>Зима</option></select>'],
    ['qFriction','Стартовое трение',`<select>${options(GROUP.friction)}</select>`],
    ['qPhysical','Физ. нагрузка',`<select>${options(GROUP.physical)}</select>`],
    ['qTempo','Темп',`<select>${options(GROUP.tempo)}</select>`],
    ['qBooking','Бронь',`<select>${options(GROUP.booking)}</select>`],
    ['qRange','Диапазон дороги','<select><option value="">Любой</option><option>0–10</option><option>11–20</option><option>21–30</option><option>31–40</option><option>41–50</option><option>51–60</option><option>61–90</option><option>90+</option></select>'],
    ['qArea','Район',`<select><option value="">Любой</option>${unique('area').map(x=>`<option>${esc(x)}</option>`).join('')}</select>`],
    ['qRatingMin','Оценка от','<input type="number" min="0" max="10" step="0.5">'],
    ['qRatingMax','Оценка до','<input type="number" min="0" max="10" step="0.5">'],
    ['qFrequency','Частота повторения',`<select>${options(GROUP.frequency)}</select>`]
  ];
  const make=a=>a.map(([id,label,control])=>`<div class="filter-field" id="${id}Wrap"><label>${label}</label>${control.replace(/<(select|input)/,`<$1 id="${id}"`)}</div>`).join('');
  $('#quickFilters').innerHTML=make(main);$('#advancedFilters').innerHTML=make(adv);
  if(reset)$('#qStatus').value='Не изучено';
  for(const id of [...main,...adv].map(x=>x[0]))$('#'+id).addEventListener($('#'+id).tagName==='INPUT'?'input':'change',renderQuick);
}

function quickFiltered(){
  const f={status:$('#qStatus')?.value||'',verdict:$('#qVerdict')?.value||'',type:$('#qType')?.value||'',venue:$('#qVenue')?.value||'',time:$('#qTime')?.value||'',social:$('#qSocial')?.value||'',travel:num($('#qTravel')?.value),budget:num($('#qBudget')?.value),energy:$('#qEnergy')?.value||'',effect:$('#qEffect')?.value||'',mode:$('#qMode')?.value||'',season:$('#qSeason')?.value||'',friction:$('#qFriction')?.value||'',physical:$('#qPhysical')?.value||'',tempo:$('#qTempo')?.value||'',booking:$('#qBooking')?.value||'',range:$('#qRange')?.value||'',area:$('#qArea')?.value||'',rmin:num($('#qRatingMin')?.value),rmax:num($('#qRatingMax')?.value),frequency:$('#qFrequency')?.value||''};
  const timeMap={Утро:'morning_availability',День:'day_availability',Вечер:'evening_availability',Ночь:'night_availability'};
  const seasonMap={Весна:'spring_availability',Лето:'summer_availability',Осень:'autumn_availability',Зима:'winter_availability'};
  let arr=places.filter(p=>!p.is_archived)
    .filter(p=>!f.status||p.visit_status===f.status)
    .filter(p=>!f.verdict||p.verdict===f.verdict)
    .filter(p=>!f.type||p.place_type===f.type)
    .filter(p=>!f.venue||p.venue_type===f.venue)
    .filter(p=>!f.social||p.social_format===f.social)
    .filter(p=>f.travel==null||(p.travel_minutes_one_way!=null&&p.travel_minutes_one_way<=f.travel))
    .filter(p=>f.budget==null||(p.estimated_total_cost!=null&&Number(p.estimated_total_cost)<=f.budget))
    .filter(p=>!f.energy||p.required_energy===f.energy)
    .filter(p=>!f.effect||p.primary_effect===f.effect)
    .filter(p=>!f.mode||p.experience_mode===f.mode)
    .filter(p=>!f.friction||p.startup_friction===f.friction)
    .filter(p=>!f.physical||p.physical_load===f.physical)
    .filter(p=>!f.tempo||p.tempo===f.tempo)
    .filter(p=>!f.booking||p.booking_requirement===f.booking)
    .filter(p=>!f.range||p.travel_range===f.range)
    .filter(p=>!f.area||p.area===f.area)
    .filter(p=>f.rmin==null||(p.user_rating!=null&&Number(p.user_rating)>=f.rmin))
    .filter(p=>f.rmax==null||(p.user_rating!=null&&Number(p.user_rating)<=f.rmax))
    .filter(p=>!f.frequency||p.repeat_frequency===f.frequency);
  if(f.time)arr=arr.filter(p=>p[timeMap[f.time]]==='Да');
  if(f.season)arr=arr.filter(p=>p[seasonMap[f.season]]==='Да');
  return sortPlaces(arr,$('#quickSort')?.value||'travel');
}

function sortPlaces(arr,mode){const a=[...arr];const nullBig=v=>v==null?Number.POSITIVE_INFINITY:Number(v);const nullSmall=v=>v==null?Number.NEGATIVE_INFINITY:Number(v);a.sort((x,y)=>{switch(mode){case'travel':return nullBig(x.travel_minutes_one_way)-nullBig(y.travel_minutes_one_way)||x.name.localeCompare(y.name,'ru');case'cost':return nullBig(x.estimated_total_cost)-nullBig(y.estimated_total_cost)||x.name.localeCompare(y.name,'ru');case'rating':return nullSmall(y.user_rating)-nullSmall(x.user_rating)||x.name.localeCompare(y.name,'ru');case'duration':return nullBig(x.estimated_duration_minutes)-nullBig(y.estimated_duration_minutes);case'visits':return (y.visits_count||0)-(x.visits_count||0);case'last':return String(y.last_visited_at||'').localeCompare(String(x.last_visited_at||''));case'name':return x.name.localeCompare(y.name,'ru');case'code':default:return x.place_code.localeCompare(y.place_code)}});return a}

function renderQuick(){const arr=quickFiltered();$('#quickCount').textContent=`${arr.length} ${plural(arr.length,'вариант','варианта','вариантов')}`;$('#quickResults').innerHTML=arr.length?arr.map(cardHtml).join(''):'<div class="empty">Под эти условия ничего не найдено.</div>';bindCardClicks('#quickResults')}
function plural(n,a,b,c){const m=n%100;if(m>=11&&m<=19)return c;const d=n%10;return d===1?a:d>=2&&d<=4?b:c}
function cardHtml(p){return `<article class="place-card" data-place="${p.id}"><div class="place-code">${esc(p.place_code)}</div><h3>${esc(p.name)}</h3><div class="badges"><span class="badge ${badgeClass(p.visit_status)}">${esc(p.visit_status)}</span><span class="badge ${badgeClass(p.verdict)}">${esc(p.verdict)}</span>${p.place_type?`<span class="badge">${esc(p.place_type)}</span>`:''}</div><div class="card-meta"><div>Дорога<strong>${p.travel_minutes_one_way==null?'—':p.travel_minutes_one_way+' мин'}</strong></div><div>Стоимость<strong>${moneyOrDash(p.estimated_total_cost)}</strong></div><div>Время на месте<strong>${fmtDuration(p.estimated_duration_minutes)}</strong></div><div>Моя оценка<strong>${p.user_rating==null?'—':esc(p.user_rating)+'/10'}</strong></div></div></article>`}
function bindCardClicks(sel){$$(sel+' [data-place]').forEach(el=>el.onclick=()=>openPlace(el.dataset.place))}

function renderCatalog(){const q=($('#catalogSearch').value||'').trim().toLowerCase(),status=$('#catalogStatus').value,verdict=$('#catalogVerdict').value,type=$('#catalogType').value,sort=$('#catalogSort').value;let arr=places.filter(p=>!p.is_archived).filter(p=>!status||p.visit_status===status).filter(p=>!verdict||p.verdict===verdict).filter(p=>!type||p.place_type===type).filter(p=>!q||[p.name,p.area,p.nearest_point,p.included_description].some(v=>String(v||'').toLowerCase().includes(q)));arr=sortPlaces(arr,sort);$('#catalogBody').innerHTML=arr.map(p=>`<tr data-place="${p.id}"><td>${esc(p.place_code)}</td><td><strong>${esc(p.name)}</strong></td><td><span class="badge ${badgeClass(p.visit_status)}">${esc(p.visit_status)}</span></td><td>${esc(p.verdict)}</td><td>${esc(p.place_type||'—')}</td><td>${p.travel_minutes_one_way??'—'}${p.travel_minutes_one_way!=null?' мин':''}</td><td>${moneyOrDash(p.estimated_total_cost)}</td><td>${p.user_rating==null?'—':esc(p.user_rating)}</td></tr>`).join('');$('#catalogMobile').innerHTML=arr.map(cardHtml).join('');bindCardClicks('#catalogBody');bindCardClicks('#catalogMobile')}

function renderVisits(){const pf=$('#visitPlaceFilter').value,vf=$('#visitVerdictFilter').value,cf=$('#visitCompanionFilter').value,tf=$('#visitTimeFilter').value;const pmap=Object.fromEntries(places.map(p=>[p.id,p]));const arr=visits.filter(v=>!pf||v.place_id===pf).filter(v=>!vf||v.visit_verdict===vf).filter(v=>!cf||v.companions===cf).filter(v=>!tf||v.time_of_day===tf);$('#visitsList').innerHTML=arr.length?arr.map(v=>`<div class="visit-row"><div><strong>${fmtDate(v.visit_date)}</strong><div class="muted">${esc(v.visit_code)}</div></div><div><strong>${esc(pmap[v.place_id]?.name||'Место')}</strong><div class="muted">${esc(v.comment||'')}</div></div><div>${esc(v.visit_verdict||'—')}<div class="muted">${esc(v.glad_went||'')}</div></div><div>${v.actual_spent==null?'—':fmtMoney(v.actual_spent)}<div class="muted">${v.actual_duration_minutes==null?'':fmtDuration(v.actual_duration_minutes)}</div></div><button class="secondary" data-visit="${v.id}">Открыть</button></div>`).join(''):'<div class="empty">Посещений пока нет.</div>';$$('[data-visit]').forEach(b=>b.onclick=()=>openVisit(b.dataset.visit))}
function renderArchive(){const arr=places.filter(p=>p.is_archived);$('#archiveList').innerHTML=arr.length?arr.map(cardHtml).join(''):'<div class="empty">Архив пуст.</div>';bindCardClicks('#archiveList')}
function renderSettings(){const s=settings||{};$('#settingsInfo').innerHTML=[['Точка отсчёта',s.base_location||'Коптево'],['Валюта',s.currency||'RUB'],['Локаль',s.locale||'ru-RU'],['Часовой пояс',s.timezone||'Europe/Moscow'],['Следующий Place',`LM-${String(s.next_place_seq||1).padStart(4,'0')}`],['Следующий Visit',`VIS-${String(s.next_visit_seq||1).padStart(6,'0')}`]].map(([a,b])=>`<div class="setting"><span>${a}</span><strong>${esc(b)}</strong></div>`).join('')}
function renderAll(){renderQuick();renderCatalog();renderVisits();renderArchive();renderSettings()}

function switchScreen(name){currentScreen=name;$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));$$('.screen').forEach(s=>s.classList.remove('active'));$('#'+name+'Screen').classList.add('active');$('#screenTitle').textContent={quick:'Быстрый выбор',catalog:'Каталог',visits:'История посещений',archive:'Архив',settings:'Настройки'}[name];if(name==='catalog')renderCatalog();if(name==='visits')renderVisits();if(name==='archive')renderArchive();if(name==='settings')renderSettings()}

function closeModal(){$('#modal').classList.add('hidden');$('#modalCard').innerHTML=''}
function showModal(html){$('#modalCard').innerHTML=html;$('#modal').classList.remove('hidden')}
function placeById(id){return places.find(p=>p.id===id)}
function visitById(id){return visits.find(v=>v.id===id)}

function openPlace(id){const p=placeById(id);if(!p)return;const pv=visits.filter(v=>v.place_id===p.id).sort((a,b)=>String(b.visit_date).localeCompare(String(a.visit_date)));showModal(`<div class="modal-head"><div><div class="place-code">${esc(p.place_code)}</div><h2>${esc(p.name)}</h2><div class="badges"><span class="badge ${badgeClass(p.visit_status)}">${esc(p.visit_status)}</span><span class="badge ${badgeClass(p.verdict)}">${esc(p.verdict)}</span>${p.experience_mode?`<span class="badge">${esc(p.experience_mode)}</span>`:''}</div></div><button class="icon-btn" id="closeModal">×</button></div><div class="detail-grid">
${detailBlock('Главное',[['Частота',p.repeat_frequency],['Моя оценка',p.user_rating==null?null:p.user_rating+'/10'],['Посещений',p.visits_count],['Последнее',p.last_visited_at?fmtDate(p.last_visited_at):null]])}
${detailBlock('Что это',[['Тип',p.place_type],['Главный эффект',p.primary_effect],['Темп',p.tempo],['Где',p.venue_type],['Описание',p.included_description]])}
${detailBlock('Когда подходит',[['Весна / лето',`${p.spring_availability||'—'} / ${p.summer_availability||'—'}`],['Осень / зима',`${p.autumn_availability||'—'} / ${p.winter_availability||'—'}`],['Утро / день',`${p.morning_availability||'—'} / ${p.day_availability||'—'}`],['Вечер / ночь',`${p.evening_availability||'—'} / ${p.night_availability||'—'}`],['Социально',p.social_format],['Мощность',p.required_energy],['Стартовое трение',p.startup_friction],['Физ. нагрузка',p.physical_load]])}
${detailBlock('Логистика',[['Район',p.area],['Точка',p.nearest_point],['Адрес',p.address],['Дорога',p.travel_minutes_one_way==null?null:p.travel_minutes_one_way+' мин'],['Диапазон',p.travel_range],['Пешком',p.walk_minutes_from_transport==null?null:p.walk_minutes_from_transport+' мин']])}
${detailBlock('Деньги и время',[['Активность',moneyOrDash(p.activity_price)],['Транспорт',moneyOrDash(p.transport_cost_round_trip)],['Допрасходы',moneyOrDash(p.extra_cost)],['Итого',moneyOrDash(p.estimated_total_cost)],['На месте',fmtDuration(p.estimated_duration_minutes)],['Бронь',p.booking_requirement]])}
${detailBlock('Предварительная аналитика',[['Что может дать',p.potential_value],['Почему может подойти',p.personal_fit_reason],['Что может не зайти',p.possible_downside]])}
${detailBlock('Мой опыт',[['Мой комментарий',p.user_comment],['Последние посещения',pv.slice(0,3).map(v=>`${fmtDate(v.visit_date)} — ${v.visit_verdict||'без вердикта'}`).join('; ')||'нет']])}
${detailBlock('Источник',[['Ссылка',p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener">открыть источник</a>`:null,true],['Проверено',p.conditions_checked_at?fmtDate(p.conditions_checked_at):null],['Заметки',p.internal_notes]])}
</div><div class="detail-actions"><button class="primary" id="addVisit">+ Добавить посещение</button><button class="secondary" id="editPlace">Редактировать</button>${p.source_url?'<button class="secondary" id="openSource">Открыть ссылку</button>':''}<button class="secondary" id="toggleArchive">${p.is_archived?'Восстановить':'Архивировать'}</button>${p.visits_count===0?'<button class="danger" id="deletePlace">Удалить навсегда</button>':''}</div>`);
$('#closeModal').onclick=closeModal;$('#addVisit').onclick=()=>openVisitForm(p.id);$('#editPlace').onclick=()=>openPlaceForm(p.id);if($('#openSource'))$('#openSource').onclick=()=>window.open(p.source_url,'_blank','noopener');$('#toggleArchive').onclick=()=>toggleArchive(p);if($('#deletePlace'))$('#deletePlace').onclick=()=>deletePlace(p)}
function detailBlock(title,rows){return `<div class="detail-block"><h3>${esc(title)}</h3>${rows.map(([k,v,html])=>v===null||v===undefined||v===''?'':`<div class="detail-line"><b>${esc(k)}:</b> ${html?v:esc(v)}</div>`).join('')}</div>`}

function field(label,name,type='text',value='',extra='',cls=''){return `<label class="${cls}">${label}<input name="${name}" type="${type}" value="${esc(value??'')}" ${extra}></label>`}
function selectField(label,name,group,value='',cls=''){return `<label class="${cls}">${label}<select name="${name}">${options(group,true,'—')}</select></label>`}
function textField(label,name,value='',cls='full'){return `<label class="${cls}">${label}<textarea name="${name}">${esc(value??'')}</textarea></label>`}
function availabilityFields(p={}){const o=options(GROUP.availability,true,'—');return [['spring_availability','Весна'],['summer_availability','Лето'],['autumn_availability','Осень'],['winter_availability','Зима'],['morning_availability','Утро'],['day_availability','День'],['evening_availability','Вечер'],['night_availability','Ночь']].map(([n,l])=>`<label>${l}<select name="${n}">${o}</select></label>`).join('')}
function setFormSelects(form,obj,names){names.forEach(n=>{if(form.elements[n])form.elements[n].value=obj[n]??''})}

function openPlaceForm(id=null){const p=id?placeById(id):{visit_status:'Не изучено',verdict:'Не оценено'};showModal(`<div class="modal-head"><div><div class="eyebrow">${id?'Редактирование':'Новое место'}</div><h2>${id?esc(p.name):'Добавить место'}</h2></div><button class="icon-btn" id="closeModal">×</button></div><form id="placeForm"><div class="form-grid">
${field('Название *','name','text',p.name||'','required','full')}
${selectField('Статус','visit_status',GROUP.status,p.visit_status)}${selectField('Вердикт','verdict',GROUP.verdict,p.verdict)}
${selectField('Режим опыта','experience_mode',GROUP.mode,p.experience_mode)}${selectField('Частота','repeat_frequency',GROUP.frequency,p.repeat_frequency)}
${selectField('Тип','place_type',GROUP.placeType,p.place_type)}${selectField('Главный эффект','primary_effect',GROUP.effect,p.primary_effect)}
${selectField('Темп','tempo',GROUP.tempo,p.tempo)}${selectField('Где проходит','venue_type',GROUP.venue,p.venue_type)}
${selectField('Социальный формат','social_format',GROUP.social,p.social_format)}${selectField('Нужная мощность','required_energy',GROUP.energy,p.required_energy)}
${selectField('Стартовое трение','startup_friction',GROUP.friction,p.startup_friction)}${selectField('Физ. нагрузка','physical_load',GROUP.physical,p.physical_load)}
${selectField('Бронь','booking_requirement',GROUP.booking,p.booking_requirement)}${field('Моя оценка 0–10','user_rating','number',p.user_rating,'min="0" max="10" step="0.5"')}
<div class="full"><div class="eyebrow" style="margin:6px 0">Сезон и время суток</div><div class="form-grid">${availabilityFields(p)}</div></div>
${field('Район / город','area','text',p.area)}${field('Ближайшая станция / точка','nearest_point','text',p.nearest_point)}
${field('Адрес','address','text',p.address,'','full')}
${field('Дорога в одну сторону, мин','travel_minutes_one_way','number',p.travel_minutes_one_way,'min="0"')}${field('Пешком от транспорта, мин','walk_minutes_from_transport','number',p.walk_minutes_from_transport,'min="0"')}
${field('Цена активности, ₽','activity_price','number',p.activity_price,'min="0" step="1"')}${field('Транспорт туда-обратно, ₽','transport_cost_round_trip','number',p.transport_cost_round_trip,'min="0" step="1"')}
${field('Допрасходы, ₽','extra_cost','number',p.extra_cost,'min="0" step="1"')}${field('Время на месте, мин','estimated_duration_minutes','number',p.estimated_duration_minutes,'min="0"')}
${textField('Что входит / что делать','included_description',p.included_description)}${textField('Что может дать','potential_value',p.potential_value)}${textField('Почему может подойти','personal_fit_reason',p.personal_fit_reason)}${textField('Что может не зайти','possible_downside',p.possible_downside)}
${field('Источник URL','source_url','url',p.source_url,'','full')}${field('Дата проверки условий','conditions_checked_at','date',p.conditions_checked_at)}
${textField('Мой комментарий','user_comment',p.user_comment)}${textField('Заметки / что изменить','internal_notes',p.internal_notes)}
</div><div id="placeError" class="form-error"></div><div class="form-actions"><button type="button" class="secondary" id="cancelForm">Отмена</button><button type="submit" class="primary">Сохранить</button></div></form>`);
const f=$('#placeForm');setFormSelects(f,p,['visit_status','verdict','experience_mode','repeat_frequency','place_type','primary_effect','tempo','venue_type','social_format','required_energy','startup_friction','physical_load','booking_requirement','spring_availability','summer_availability','autumn_availability','winter_availability','morning_availability','day_availability','evening_availability','night_availability']);$('#closeModal').onclick=$('#cancelForm').onclick=closeModal;f.onsubmit=e=>savePlace(e,id)}

async function savePlace(e,id){e.preventDefault();const f=e.currentTarget,d=new FormData(f);const payload={user_id:user.id,name:d.get('name').trim(),visit_status:d.get('visit_status')||'Не изучено',verdict:d.get('verdict')||'Не оценено',experience_mode:val(d.get('experience_mode')),repeat_frequency:val(d.get('repeat_frequency')),place_type:val(d.get('place_type')),primary_effect:val(d.get('primary_effect')),tempo:val(d.get('tempo')),venue_type:val(d.get('venue_type')),social_format:val(d.get('social_format')),required_energy:val(d.get('required_energy')),startup_friction:val(d.get('startup_friction')),physical_load:val(d.get('physical_load')),booking_requirement:val(d.get('booking_requirement')),user_rating:num(d.get('user_rating')),spring_availability:val(d.get('spring_availability')),summer_availability:val(d.get('summer_availability')),autumn_availability:val(d.get('autumn_availability')),winter_availability:val(d.get('winter_availability')),morning_availability:val(d.get('morning_availability')),day_availability:val(d.get('day_availability')),evening_availability:val(d.get('evening_availability')),night_availability:val(d.get('night_availability')),area:val(d.get('area')),nearest_point:val(d.get('nearest_point')),address:val(d.get('address')),travel_minutes_one_way:num(d.get('travel_minutes_one_way')),walk_minutes_from_transport:num(d.get('walk_minutes_from_transport')),activity_price:num(d.get('activity_price')),transport_cost_round_trip:num(d.get('transport_cost_round_trip')),extra_cost:num(d.get('extra_cost')),estimated_duration_minutes:num(d.get('estimated_duration_minutes')),included_description:val(d.get('included_description')),potential_value:val(d.get('potential_value')),personal_fit_reason:val(d.get('personal_fit_reason')),possible_downside:val(d.get('possible_downside')),source_url:val(d.get('source_url')),conditions_checked_at:val(d.get('conditions_checked_at')),user_comment:val(d.get('user_comment')),internal_notes:val(d.get('internal_notes'))};if(!payload.name){$('#placeError').textContent='Название обязательно';return}setBusy(true);try{let res;if(id){res=await db.from('app003_places').update(payload).eq('id',id)}else{payload.place_code=`LM-${String(settings.next_place_seq||1).padStart(4,'0')}`;res=await db.from('app003_places').insert(payload);if(!res.error){await db.from('app003_settings').update({next_place_seq:(settings.next_place_seq||1)+1}).eq('user_id',user.id)}}if(res.error)throw res.error;closeModal();await loadAll();toast('Место сохранено')}catch(err){$('#placeError').textContent=err.message}finally{setBusy(false)}}

async function toggleArchive(p){setBusy(true);const {error}=await db.from('app003_places').update({is_archived:!p.is_archived}).eq('id',p.id);setBusy(false);if(error){toast(error.message);return}closeModal();await loadAll();toast(p.is_archived?'Место восстановлено':'Место перемещено в архив')}
async function deletePlace(p){if(p.visits_count>0){toast('Место с историей посещений нельзя удалить');return}if(!confirm(`Удалить «${p.name}» навсегда?`))return;setBusy(true);const {error}=await db.from('app003_places').delete().eq('id',p.id);setBusy(false);if(error){toast(error.message);return}closeModal();await loadAll();toast('Место удалено')}

function openVisitForm(placeId,visitId=null){const p=placeById(placeId),v=visitId?visitById(visitId):{visit_date:new Date().toISOString().slice(0,10)};showModal(`<div class="modal-head"><div><div class="eyebrow">${visitId?'Редактирование Visit':'Новое посещение'}</div><h2>${esc(p?.name||'Посещение')}</h2></div><button class="icon-btn" id="closeModal">×</button></div><form id="visitForm"><div class="form-grid">
${field('Дата *','visit_date','date',v.visit_date,'required')}${field('Дорога в одну сторону, мин','actual_travel_minutes_one_way','number',v.actual_travel_minutes_one_way,'min="0"')}
${field('Фактически потрачено, ₽','actual_spent','number',v.actual_spent,'min="0"')}${field('Время на месте, мин','actual_duration_minutes','number',v.actual_duration_minutes,'min="0"')}
${selectField('Рад, что сходил?','glad_went',GROUP.glad,v.glad_went)}${selectField('Вердикт посещения','visit_verdict',GROUP.visitVerdict,v.visit_verdict)}
${selectField('Компания','companions',GROUP.companions,v.companions)}${selectField('Время суток','time_of_day',GROUP.time,v.time_of_day)}
${textField('Что сработало','what_worked',v.what_worked)}${textField('Что не сработало','what_failed',v.what_failed)}${textField('Комментарий','comment',v.comment)}
</div><div id="visitError" class="form-error"></div><div class="form-actions"><button type="button" class="secondary" id="cancelForm">Отмена</button><button type="submit" class="primary">Сохранить посещение</button></div></form>`);const f=$('#visitForm');setFormSelects(f,v,['glad_went','visit_verdict','companions','time_of_day']);$('#closeModal').onclick=$('#cancelForm').onclick=closeModal;f.onsubmit=e=>saveVisit(e,placeId,visitId)}
async function saveVisit(e,placeId,visitId){e.preventDefault();const d=new FormData(e.currentTarget);const payload={user_id:user.id,place_id:placeId,visit_date:d.get('visit_date'),actual_travel_minutes_one_way:num(d.get('actual_travel_minutes_one_way')),actual_spent:num(d.get('actual_spent')),actual_duration_minutes:num(d.get('actual_duration_minutes')),glad_went:val(d.get('glad_went')),visit_verdict:val(d.get('visit_verdict')),companions:val(d.get('companions')),time_of_day:val(d.get('time_of_day')),what_worked:val(d.get('what_worked')),what_failed:val(d.get('what_failed')),comment:val(d.get('comment'))};setBusy(true);try{let res;if(visitId){res=await db.from('app003_visits').update(payload).eq('id',visitId)}else{payload.visit_code=`VIS-${String(settings.next_visit_seq||1).padStart(6,'0')}`;res=await db.from('app003_visits').insert(payload);if(!res.error)await db.from('app003_settings').update({next_visit_seq:(settings.next_visit_seq||1)+1}).eq('user_id',user.id)}if(res.error)throw res.error;if(!visitId&&payload.visit_verdict&&confirm(`Обновить общий вердикт места на «${payload.visit_verdict}»?`))await db.from('app003_places').update({verdict:payload.visit_verdict}).eq('id',placeId);closeModal();await loadAll();toast('Посещение сохранено')}catch(err){$('#visitError').textContent=err.message}finally{setBusy(false)}}

function openVisit(id){const v=visitById(id),p=placeById(v?.place_id);if(!v)return;showModal(`<div class="modal-head"><div><div class="place-code">${esc(v.visit_code)}</div><h2>${esc(p?.name||'Посещение')}</h2><div class="muted">${fmtDate(v.visit_date)}</div></div><button class="icon-btn" id="closeModal">×</button></div><div class="detail-grid">${detailBlock('Факт',[['Дорога',v.actual_travel_minutes_one_way==null?null:v.actual_travel_minutes_one_way+' мин'],['Расходы',v.actual_spent==null?null:fmtMoney(v.actual_spent)],['На месте',fmtDuration(v.actual_duration_minutes)],['Рад, что сходил?',v.glad_went],['Вердикт',v.visit_verdict],['Компания',v.companions],['Время суток',v.time_of_day]])}${detailBlock('Опыт',[['Что сработало',v.what_worked],['Что не сработало',v.what_failed],['Комментарий',v.comment]])}</div><div class="detail-actions"><button class="primary" id="editVisit">Редактировать</button><button class="danger" id="deleteVisit">Удалить посещение</button></div>`);$('#closeModal').onclick=closeModal;$('#editVisit').onclick=()=>openVisitForm(v.place_id,v.id);$('#deleteVisit').onclick=()=>deleteVisit(v)}
async function deleteVisit(v){if(!confirm('Удалить это посещение? История будет пересчитана.'))return;setBusy(true);const {error}=await db.from('app003_visits').delete().eq('id',v.id);setBusy(false);if(error){toast(error.message);return}closeModal();await loadAll();toast('Посещение удалено')}

boot();
})();
