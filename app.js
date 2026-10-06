const APP_NAME="SigmaSpace";
const DB="STAR_MAP_MVP5";
const DATA_VERSION=7;
const BACKUP_DB="STAR_MAP_BACKUP_V1";
const $=s=>document.querySelector(s);
const I18N=window.SIGMA_LOCALE?.en||{};
const ALWAYS_BILINGUAL=window.SIGMA_ALWAYS_BILINGUAL||{};
function t(s){
  s=String(s??"");
  if(Object.prototype.hasOwnProperty.call(ALWAYS_BILINGUAL,s))return ALWAYS_BILINGUAL[s];
  if(state?.settings?.language!=="en")return s;
  if(Object.prototype.hasOwnProperty.call(I18N,s))return I18N[s];
  const rules=[
    [/^Тип планеты удалён: /,"Planet type removed: "],[/^Ресурс удалён: /,"Resource removed: "],[/^Моб удалён: /,"Mob removed: "],
    [/^Тип планеты добавлен: /,"Planet type added: "],[/^Ресурс добавлен: /,"Resource added: "],[/^Моб добавлен: /,"Mob added: "],
    [/^Конвертировано: /,"Converted: "],[/^Обновлено тел: /,"Bodies updated: "],[/^Ресурс «/,'Resource “'],[/^Выбери /,"Select "],
    [/^Ошибка: /,"Error: "],[/^Дубликат: уже есть /,"Duplicate: already exists "],[/^Снято отметок \(!\): /,"(!) marks removed: "],
    [/^Звезда не найдена\.$/,"Star not found."],[/^Код скопирован: /,"Code copied: "],[/^Код скопирован в буфер обмена\.$/,"Code copied to clipboard."],
    [/^Ошибка кода: /,"Code error: "],[/^Ошибка импорта: /,"Import error: "],[/^Код импортирован: /,"Code imported: "],
    [/^Экспорт: /,"Export: "],[/^Импорт: /,"Import: "],[/^Сохранено /,"Saved "],[/^Радиус звезды изменён на/ ,"Star radius changed to"],[/^Радиус скана изменён на/ ,"Scan radius changed to"],
    [/^Версия /,"Version "],[/^Координаты скрыты$/,"Coordinates hidden"],[/^секрет/ ,"classified"],[/^засекречено/,"classified"],[/^скопление \(/,"cluster ("],[/^Скан (\d+|—)$/,"Scan $1"],[/^скан (\d+|—)$/,"scan $1"],[/^без названия$/,"unnamed"],[/^\(скрыто\)$/,"(hidden)"],
    [/^Система перепривязана/,"System rebound"],[/^Линейка: /,"Ruler: "],[/^Расстояние: /,"Distance: "],[/^Масштаб подобран: /,"Scale fitted: "],
    [/^Радиус должен быть от /,"Radius must be between "],[/^Сохранение:/,"Save:"],[/^Резервная копия:/,"Backup:"],[/^Версия данных:/,"Data version:"]
  ];
  for(const [re,repl] of rules)if(re.test(s))return s.replace(re,repl);
  return s;
}
function localizedBuiltIn(v){return state?.settings?.language==="en"&&((DEFAULT_PLANET_TYPES||[]).includes(v)||(DEFAULT_RESOURCE_TYPES||[]).includes(v))?t(v):v}
function applyLanguage(){
  const root=document.body;if(!root)return;
  const en=state?.settings?.language==="en";
  root.querySelectorAll("[placeholder]").forEach(el=>{
    if(!el.dataset.sigmaPlaceholderRu)el.dataset.sigmaPlaceholderRu=el.getAttribute("placeholder")||"";
    const ru=el.dataset.sigmaPlaceholderRu;if(en&&I18N[ru])el.setAttribute("placeholder",I18N[ru]);else el.setAttribute("placeholder",ru);
  });
  root.querySelectorAll("[title]").forEach(el=>{
    if(!el.dataset.sigmaTitleRu)el.dataset.sigmaTitleRu=el.getAttribute("title")||"";
    const ru=el.dataset.sigmaTitleRu;if(en&&I18N[ru])el.setAttribute("title",I18N[ru]);else el.setAttribute("title",ru);
  });
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const n of nodes){
    if(!n.parentElement||/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName))continue;
    if(!n.__sigmaRu)n.__sigmaRu=n.nodeValue;
    const ru=n.__sigmaRu;
    if(!ru.trim())continue;
    const trimmed=ru.trim();
    if(Object.prototype.hasOwnProperty.call(ALWAYS_BILINGUAL,trimmed)){
      const fixed=ALWAYS_BILINGUAL[trimmed];
      if(fixed!==trimmed)n.nodeValue=ru.replace(trimmed,fixed);
    }else if(en){
      const translated=I18N[trimmed]||t(trimmed);
      if(translated!==trimmed)n.nodeValue=ru.replace(trimmed,translated);
    }else n.nodeValue=ru;
  }
  document.documentElement.lang=en?"en":"ru";
  document.title=en?"SigmaSpace — Star Map":"SigmaSpace — Звёздная карта";
}


const canvas=$("#map"),ctx=canvas.getContext("2d");

const DEFAULT_PLANET_TYPES=["Земная","Джунгли","Вулканическая","Кислотная","Каменистая"];
const DEFAULT_RESOURCE_TYPES=["Уголь","Железная руда","Медная руда","Нитрокалит","Свинцовая руда","Титановая руда","Урановая руда","Сера","Серебрянная руда","Золотая руда","Соль","Кобальт","Вольфрам","Платина","Омикрониум","Ксириум","Плутоний","Фаунитрон","Протонит","Иридий","Электрониум","Эпсилон-металл","Вулканит"];
const STAR_TYPES=[
  ["red","Красная"],["orange","Оранжевая"],["yellow","Жёлтая"],["white","Белая"],["blue","Синяя"]
];
const DEEP_RADIUS=1000;
const GALAXY_RADIUS=350;
const DEFAULT_SCAN_RADIUS=18000;
const DEFAULT_STAR_RADIUS=3000;

let PATCH_NOTES=[];
let PATCH_NOTES_EN={};
let patchNotesLoadPromise=null;
async function loadPatchNotes(){
  if(window.__sigmaPatchNotesLoaded){PATCH_NOTES=window.SIGMA_PATCH_NOTES||[];PATCH_NOTES_EN=window.SIGMA_PATCH_NOTES_EN||{};return true;}
  if(patchNotesLoadPromise)return patchNotesLoadPromise;
  patchNotesLoadPromise=new Promise(resolve=>{
    const s=document.createElement("script");
    s.src="PATCH_NOTES.js";
    s.onload=()=>{window.__sigmaPatchNotesLoaded=true;PATCH_NOTES=window.SIGMA_PATCH_NOTES||[];PATCH_NOTES_EN=window.SIGMA_PATCH_NOTES_EN||{};resolve(true)};
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
  return patchNotesLoadPromise;
}
let state={objects:[],planetTypes:[...DEFAULT_PLANET_TYPES],resourceTypes:[...DEFAULT_RESOURCE_TYPES],mobTypes:[],settings:{scanDisplay:"radius",importDisplay:"show",exportFavorites:"show",privacyMode:"none",starRadius:DEFAULT_STAR_RADIUS,scanRadius:DEFAULT_SCAN_RADIUS,language:"ru"},meta:{dataVersion:DATA_VERSION,updatedAt:0}};
let persistenceDBPromise=null,persistenceQueue=Promise.resolve(),backupTimer=null,backupDirHandle=null,backupWriting=false,backupQueued=false;
let layer="clusters",starId=null,clusterId=null,selected=null,adding=false;
let rulerMode=false,rulerPoints=[];
const treeCollapsedIds=new Set();
let view={x:0,y:0,scale:1},drag=null,last=performance.now(),fps=0;
const undoStack=[];
const redoStack=[];
const UNDO_LIMIT=50;
function ensureSettings(){
  state.settings=state.settings&&typeof state.settings==="object"?state.settings:{};
  if(!["none","radius","center"].includes(state.settings.scanDisplay))state.settings.scanDisplay="radius";
  if(!["show","hide"].includes(state.settings.importDisplay))state.settings.importDisplay="show";
  if(!["show","hide"].includes(state.settings.exportFavorites))state.settings.exportFavorites="show";
  if(!["none","hideStarGalaxy","planetNamesOnly"].includes(state.settings.privacyMode))state.settings.privacyMode="none";
  if(!["ru","en"].includes(state.settings.language))state.settings.language="ru";
  const starRadius=Number(state.settings.starRadius);
  const scanRadius=Number(state.settings.scanRadius);
  state.settings.starRadius=Number.isFinite(starRadius)&&starRadius>0?Math.min(1000000,Math.round(starRadius)):DEFAULT_STAR_RADIUS;
  state.settings.scanRadius=Number.isFinite(scanRadius)&&scanRadius>0?Math.min(1000000,Math.round(scanRadius)):DEFAULT_SCAN_RADIUS;
}
function starRadius(){return Number(state.settings.starRadius)||DEFAULT_STAR_RADIUS}
function scanRadius(){return Number(state.settings.scanRadius)||DEFAULT_SCAN_RADIUS}
function privacyMode(){return state.settings.privacyMode||"none"}
function isPrivacyStrict(){return privacyMode()==="planetNamesOnly"}
function isPrivacyStarOnly(){return privacyMode()==="hideStarGalaxy"}
function hideCoords(o){return isPrivacyStrict()||((isPrivacyStarOnly())&&["galaxy","star"].includes(o?.kind))}
function secretLabel(o){return `${prefixLabel(o.kind)} (засекречено)`}
function displayObjectName(o){
  if(!o)return "";
  if(o.kind==="cluster")return `${t("скопление")} (${clusterBodyCount(o.id)})`;
  if(isPrivacyStrict()&&!(["planet","moon","asteroid"].includes(o.kind)))return secretLabel(o);
  if(isPrivacyStarOnly()&&["galaxy","star"].includes(o.kind))return secretLabel(o);
  return o.name||t("без названия");
}
function displayLabelHtml(o){
  const text=displayObjectName(o);
  return `${o.imported?`<span class="importMark">(!)</span>`:""}${esc(text)}`;
}
function coordText(o){return hideCoords(o)?"(скрыто)":`(${o.x}, ${o.y})`}
function markerVisible(o){
  if(o.kind!=="marker")return true;
  if(o.markerLayer==="clusters")return layer==="clusters";
  if(o.markerLayer==="stars")return layer==="stars";
  return (layer==="deep"||layer==="middle")&&o.starId===starId;
}
function isBodyKind(k){return ["planet","moon","asteroid"].includes(k)}
function roundSizeUp8(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)return "";return String(Math.ceil(n/8)*8)}
function normalizeLifeValue(life){
  if(Array.isArray(life))return life.map(x=>({aggressive:!!x?.aggressive,mob:String(x?.mob||x?.hp||"").trim()})).filter(x=>x.mob);
  if(life&&typeof life==="object"&&(life.aggressive||life.mob||life.hp))return [{aggressive:!!life.aggressive,mob:String(life.mob||life.hp||"").trim()}].filter(x=>x.mob);
  return [];
}
function uniqLife(items){
  const seen=new Set();
  return (items||[]).filter(x=>x&&x.mob).map(x=>({aggressive:!!x.aggressive,mob:String(x.mob)})).filter(x=>{const k=x.mob+"\u0000"+(x.aggressive?1:0);if(seen.has(k))return false;seen.add(k);return true});
}
function getLife(o){return normalizeLifeValue(o?.life)}
function isSystemObject(o,sid){return !!o&&(o.starId===sid||(o.kind==="marker"&&o.markerLayer==="system"&&o.starId===sid))}
function isShown(o){return state.settings.importDisplay!=="hide"||!o.imported}
function nextScanNumber(starId,ignoreId=null){
  const used=new Set(state.objects.filter(o=>o.kind==="scan"&&(o.starId||null)===(starId||null)&&o.id!==ignoreId).map(o=>Number(o.scanNumber)).filter(n=>Number.isInteger(n)&&n>0));
  let n=1;while(used.has(n))n++;return n;
}
function normalizeScanNumbers(){
  const groups=new Map();
  for(const scan of state.objects.filter(o=>o.kind==="scan")){
    scan.name="";scan.radius=scanRadius();
    const key=scan.starId||"__unbound__";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(scan);
  }
  for(const scans of groups.values()){
    const used=new Set();
    for(const scan of scans){
      const n=Number(scan.scanNumber);
      if(Number.isInteger(n)&&n>0&&!used.has(n)){scan.scanNumber=n;used.add(n)}
      else{let next=1;while(used.has(next))next++;scan.scanNumber=next;used.add(next)}
    }
  }
}
function uid(){return(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()).toString()}
function esc(v){return String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function snapshotState(){return JSON.stringify(state)}
function updateBackupStatus(text,error=false){const el=$("#backupStatus");if(!el)return;el.textContent=text;el.classList.toggle("backupError",!!error)}
function updateSaveStatus(text,error=false){const el=$("#saveStatus");if(!el)return;el.textContent=text;el.classList.toggle("backupError",!!error)}
function updateDataVersionStatus(){const el=$("#dataVersionStatus");if(el)el.textContent=`v${DATA_VERSION}`}
function openPersistenceDB(){
  if(!("indexedDB"in window))return Promise.resolve(null);
  if(persistenceDBPromise)return persistenceDBPromise;
  persistenceDBPromise=new Promise(resolve=>{
    const req=indexedDB.open(BACKUP_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("data"))db.createObjectStore("data");if(!db.objectStoreNames.contains("config"))db.createObjectStore("config")};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
  });
  return persistenceDBPromise;
}
function idbGet(store,key){return openPersistenceDB().then(db=>new Promise(resolve=>{if(!db)return resolve(null);const tx=db.transaction(store,"readonly"),req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>resolve(null)}))}
function idbPut(store,key,value){return openPersistenceDB().then(db=>new Promise(resolve=>{if(!db)return resolve(false);const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false)}))}
function queueIndexedSave(serialized,savedAt){persistenceQueue=persistenceQueue.then(()=>idbPut("data","latest",{savedAt,state:serialized})).catch(()=>false)}
function save(){
  state.meta=state.meta&&typeof state.meta==="object"?state.meta:{};state.meta.dataVersion=DATA_VERSION;state.meta.updatedAt=Date.now();
  const serialized=snapshotState(),savedAt=state.meta.updatedAt;let localOk=true;
  try{localStorage.setItem(DB,serialized)}catch(e){localOk=false}
  queueIndexedSave(serialized,savedAt);scheduleExternalBackup();
  const saveTime=new Date(savedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  updateSaveStatus(localOk?`Сохранено ${saveTime}`:"Ошибка localStorage",!localOk);updateBackupStatus(backupDirHandle?"Подключён":"Не подключён");updateDataVersionStatus();
}
function makeBackupPayload(){return{format:"STAR_MAP",version:12,dataVersion:DATA_VERSION,backup:true,exportedAt:new Date().toISOString(),planetTypes:[...state.planetTypes],resourceTypes:[...state.resourceTypes],mobTypes:[...state.mobTypes],settings:{...state.settings},objects:state.objects.map(o=>({...o}) )}}
function backupText(){return JSON.stringify(makeBackupPayload(),null,2)}
function scheduleExternalBackup(){if(!backupDirHandle)return;clearTimeout(backupTimer);backupTimer=setTimeout(()=>performExternalBackup(),1000)}
async function hasBackupPermission(handle,request=false){try{const p=await handle.queryPermission({mode:"readwrite"});if(p==="granted")return true;if(!request)return false;return(await handle.requestPermission({mode:"readwrite"}))==="granted"}catch(e){return false}}
async function writeBackupFile(name,text){const file=await backupDirHandle.getFileHandle(name,{create:true});const w=await file.createWritable();await w.write(text);await w.close()}
async function performExternalBackup(){if(!backupDirHandle||backupWriting)return;if(!(await hasBackupPermission(backupDirHandle)))return;backupWriting=true;try{await writeBackupFile("SigmaSpace-backup.starmap",backupText());updateBackupStatus("Резервная копия сохранена")}catch(e){updateBackupStatus("Ошибка резервной копии",true)}finally{backupWriting=false}}
async function selectBackupFolder(){if(!window.showDirectoryPicker){toast("Выбор папки резервной копии не поддерживается этим браузером.");return}try{backupDirHandle=await window.showDirectoryPicker({mode:"readwrite"});if(await hasBackupPermission(backupDirHandle,true)){await idbPut("config","backupDir",backupDirHandle);await performExternalBackup();toast("Папка резервной копии подключена.")}else{backupDirHandle=null;toast("Доступ к папке не предоставлен.")}}catch(e){toast("Выбор папки отменён.")}}
async function restoreBackupDirectory(){try{const h=await idbGet("config","backupDir");if(h&&typeof h.getFileHandle==="function"){backupDirHandle=h;updateBackupStatus("Подключён")}}catch(e){}}
async function hydrateFromIndexedDB(){try{const rec=await idbGet("data","latest");if(!rec?.state)return;const localTime=Number(state.meta?.updatedAt)||0;if(Number(rec.savedAt)>localTime){const loaded=migrateData(JSON.parse(rec.state));if(loaded&&Array.isArray(loaded.objects)){state=loaded;normalizeLoadedState();save();refreshTypeLists();refreshCreationFields();refreshMigrationControls();renderFilters();render();toast("Восстановлена более свежая локальная копия.")}}}catch(e){}}
function cloneState(){return JSON.parse(JSON.stringify(state))}
function historySnapshot(){return{state:cloneState(),layer,starId,clusterId,selectedId:selected?.id||null,view:{...view}}}
function restoreHistorySnapshot(snap){
  state=snap.state;layer=snap.layer;starId=snap.starId;clusterId=snap.clusterId;view={...snap.view};
  selected=snap.selectedId?state.objects.find(o=>o.id===snap.selectedId)||null:null;
  normalizeScanNumbers();ensureGalaxies();ensureDeepClusters();save();
  if(selected)show(selected);else show(null);
  refreshTypeLists();refreshCreationFields();refreshMigrationControls();renderFilters();render();updateHistoryButtons();
}
function checkpoint(){undoStack.push(historySnapshot());if(undoStack.length>UNDO_LIMIT)undoStack.shift();redoStack.length=0;updateHistoryButtons()}
function updateHistoryButtons(){const u=$("#undoBtn"),r=$("#redoBtn");if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length}
function updateUndoButton(){updateHistoryButtons()}
function undo(){
  const snap=undoStack.pop();
  if(!snap){toast("Отменять больше нечего");updateHistoryButtons();return}
  redoStack.push(historySnapshot());if(redoStack.length>UNDO_LIMIT)redoStack.shift();
  restoreHistorySnapshot(snap);toast("Последнее изменение отменено");
}
function redo(){
  const snap=redoStack.pop();
  if(!snap){toast("Возвращать больше нечего");updateHistoryButtons();return}
  undoStack.push(historySnapshot());if(undoStack.length>UNDO_LIMIT)undoStack.shift();
  restoreHistorySnapshot(snap);toast("Отменённое изменение возвращено");
}
function uniqStrings(a){return[...new Set((Array.isArray(a)?a:[]).map(String).map(x=>x.trim()).filter(Boolean))]}
function mobKey(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("ru-RU")}
function chooseMobLabel(a,b){const aa=String(a||""),bb=String(b||"");if(!aa)return bb;if(!bb)return aa;if(aa===bb)return aa;if(/^[а-яё]/.test(aa)&&/^[А-ЯЁ]/.test(bb))return bb;return aa}
function fmt(v){const n=Math.round(v);return(n<0?"−":"+")+Math.abs(n).toLocaleString("ru-RU")}
function cleanCoord(v){return Math.round(Number(v))}
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}
function starColor(t){return({red:"#ff4040",orange:"#ff8a00",yellow:"#ffe600",white:"#fff",blue:"#32baff"}[t]||"#ffe600")}
function color(o){
  if(o.kind==="scan")return"#b86cff";
  if(o.kind==="galaxy")return"#ffe600";
  if(o.kind==="cluster")return"#24baff";
  if(o.kind==="planet")return"#24baff";
  if(o.kind==="moon")return"#ff4040";
  if(o.kind==="asteroid")return"#aeb7bf";
  if(o.kind==="marker")return"#39ff5a";
  return starColor(o.starType);
}
function kindLabel(k){return t(({marker:"Метка",galaxy:"Галактика",star:"Звезда",cluster:"Скопление",planet:"Планета",moon:"Спутник",asteroid:"Астероид",scan:"Скан"}[k]||k))}
function prefixLabel(k){return t(({galaxy:"галактика",star:"звезда",cluster:"скопление",planet:"планета",moon:"спутник",asteroid:"астероид",marker:"метка",scan:"скан"}[k]||kindLabel(k).toLowerCase()))}
function namedLabel(o){
  if(!o)return "";
  const text=displayObjectName(o);
  if(o.kind==="cluster"||text===secretLabel(o))return text;
  return `${prefixLabel(o.kind)} ${text}`;
}
function importedLabel(o){return o.imported?`<span class="importMark">(!)</span>${esc(namedLabel(o))}`:esc(namedLabel(o))}
function readableName(o){return `${o.imported?"(!) ":""}${namedLabel(o)}`}

function normalizeLoadedState(){
  state.objects=Array.isArray(state.objects)?state.objects:[];ensureSettings();
  state.planetTypes=uniqStrings([...(Array.isArray(state.planetTypes)?state.planetTypes:[]),...DEFAULT_PLANET_TYPES]);
  state.resourceTypes=uniqStrings([...(Array.isArray(state.resourceTypes)?state.resourceTypes:[]),...DEFAULT_RESOURCE_TYPES]);
  state.mobTypes=uniqStrings(Array.isArray(state.mobTypes)?state.mobTypes:[]);
  if(!state.planetTypes.length)state.planetTypes=[...DEFAULT_PLANET_TYPES];if(!state.resourceTypes.length)state.resourceTypes=[...DEFAULT_RESOURCE_TYPES];
  state.meta=state.meta&&typeof state.meta==="object"?state.meta:{};state.meta.dataVersion=DATA_VERSION;state.meta.updatedAt=Number(state.meta.updatedAt)||0;
  for(const o of state.objects){
    o.favorite=!!o.favorite;o.imported=!!o.imported;o.manualBinding=!!o.manualBinding;if(o.kind==="star"){const hadGalaxyBinding=Object.prototype.hasOwnProperty.call(o,"galaxyManualBinding");o.galaxyManualBinding=hadGalaxyBinding?!!o.galaxyManualBinding:!!o.galaxyId}
    if(o.kind==="marker"){if(!o.markerLayer)o.markerLayer=o.starId?"system":"clusters";if(o.markerLayer==="system"&&!o.starId)o.markerLayer="clusters"}
    if(o.kind==="scan")o.radius=scanRadius();
    if(isBodyKind(o.kind)){
      o.resources=uniqStrings(o.resources);if(o.kind!=="asteroid"){o.isMoon=o.kind==="moon";if(!String(o.planetType||"").trim())o.planetType=state.planetTypes[0]||"";if(o.planetType&&!state.planetTypes.includes(o.planetType))state.planetTypes.push(o.planetType)}
      o.size=roundSizeUp8(o.size);o.life=uniqLife(normalizeLifeValue(o.life).concat(Array.isArray(o.mobs)?o.mobs.map(m=>({mob:m,aggressive:false})):[]));delete o.mobs;if(!o.life.length)delete o.life;
      for(const life of o.life)if(life.mob&&!state.mobTypes.includes(life.mob))state.mobTypes.push(life.mob);for(const r of o.resources)if(!state.resourceTypes.includes(r))state.resourceTypes.push(r);
    }
  }
  normalizeScanNumbers();migrateOldSystemClusters();normalizeAsteroidParents();
}
function normalizeAsteroidParents(sid=null){
  for(const a of state.objects.filter(o=>o.kind==="asteroid"&&(!sid||o.starId===sid))){
    const candidates=state.objects.filter(o=>o.kind==="planet"&&o.starId===a.starId);
    candidates.sort((x,y)=>dist2(x,a)-dist2(y,a));
    const parent=candidates[0]&&dist2(candidates[0],a)<=DEEP_RADIUS**2?candidates[0]:null;
    if(parent){a.parentPlanetId=parent.id;a.clusterId=parent.clusterId||null}
    else a.parentPlanetId=null;
  }
}

function migrateData(raw){
  let s=raw&&typeof raw==="object"?raw:{};
  if(s.state&&s.format==="STAR_MAP_LOCAL")s=s.state;
  let v=Number(s?.meta?.dataVersion||1);
  if(v<2){
    s.meta={...(s.meta||{}),dataVersion:2,updatedAt:Number(s.meta?.updatedAt)||0};
    v=2;
  }
  if(v<3){
    s.settings={...(s.settings||{}),starRadius:Number(s.settings?.starRadius)||DEFAULT_STAR_RADIUS,scanRadius:Number(s.settings?.scanRadius)||DEFAULT_SCAN_RADIUS};
    s.meta={...(s.meta||{}),dataVersion:3,updatedAt:Number(s.meta?.updatedAt)||0};
    v=3;
  }
  if(v<4){
    s.lifeHpTypes=uniqStrings([...(Array.isArray(s.lifeHpTypes)?s.lifeHpTypes:[]),...Array.from({length:10},(_,i)=>`${(i+1)*10}к хп`),...Array.from({length:5},(_,i)=>`${120+i*20}к хп`)]);
    s.mobTypes=uniqStrings(Array.isArray(s.mobTypes)?s.mobTypes:[]);
    s.settings={...(s.settings||{}),privacyMode:s.settings?.privacyMode||"none"};
    s.meta={...(s.meta||{}),dataVersion:4,updatedAt:Number(s.meta?.updatedAt)||0};
    v=4;
  }
  if(v<5){
    s.objects=Array.isArray(s.objects)?s.objects:[];
    for(const o of s.objects){if(isBodyKind(o.kind)){const life=normalizeLifeValue(o.life);if(life.length)o.life=life;else delete o.life;}}
    s.meta={...(s.meta||{}),dataVersion:5,updatedAt:Number(s.meta?.updatedAt)||0};
    v=5;
  }
  if(v<6){
    s.objects=Array.isArray(s.objects)?s.objects:[];
    s.mobTypes=uniqStrings(Array.isArray(s.mobTypes)?s.mobTypes:[]);
    const map=new Map();
    for(const raw of s.mobTypes){const clean=String(raw).trim().replace(/\s+/g," ");if(!clean)continue;const key=mobKey(clean);map.set(key,chooseMobLabel(map.get(key),clean))}
    s.mobTypes=[...map.values()];
    for(const o of s.objects)if(Array.isArray(o.mobs))o.mobs=uniqStrings(o.mobs.map(m=>map.get(mobKey(m))||String(m).trim().replace(/\s+/g," ")));
    s.meta={...(s.meta||{}),dataVersion:6,updatedAt:Number(s.meta?.updatedAt)||0};
    v=6;
  }
  if(v<7){
    s.objects=Array.isArray(s.objects)?s.objects:[];const oldLifeHp=uniqStrings(Array.isArray(s.lifeHpTypes)?s.lifeHpTypes:[]),mobs=uniqStrings(Array.isArray(s.mobTypes)?s.mobTypes:[]),hpToMob=new Map();
    for(const hp of oldLifeHp){const mob=`Мобы ${hp}`;hpToMob.set(hp,mob);if(!mobs.some(x=>mobKey(x)===mobKey(mob)))mobs.push(mob)}
    for(const o of s.objects)if(isBodyKind(o.kind)){const life=normalizeLifeValue(o.life).map(x=>({aggressive:x.aggressive,mob:hpToMob.get(x.mob)||x.mob})),legacy=Array.isArray(o.mobs)?o.mobs.map(m=>({aggressive:false,mob:String(m)})):[],merged=uniqLife([...life,...legacy]);if(merged.length)o.life=merged;else delete o.life;delete o.mobs;for(const x of merged)if(x.mob&&!mobs.some(m=>mobKey(m)===mobKey(x.mob)))mobs.push(x.mob)}
    s.mobTypes=uniqStrings(mobs);delete s.lifeHpTypes;s.meta={...(s.meta||{}),dataVersion:7,updatedAt:Number(s.meta?.updatedAt)||0};v=7;
  }
  return s;
}
function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(DB)||"null");
    const loaded=migrateData(raw);
    if(loaded&&Array.isArray(loaded.objects))state=loaded;
  }catch(e){}
  normalizeLoadedState();
}
function migrateOldSystemClusters(){
  const old=state.objects.filter(o=>o.kind==="cluster"&&o.clusterRole==="system");
  if(!old.length)return;
  const ids=new Set(old.map(o=>o.id));
  for(const o of state.objects)if((o.kind==="planet"||o.kind==="moon")&&ids.has(o.clusterId)){o.clusterId=null;o.manualBinding=false}
  for(const s of state.objects.filter(o=>o.kind==="star"))if(ids.has(s.clusterId))delete s.clusterId;
  state.objects=state.objects.filter(o=>!ids.has(o.id));
}
function size(){const r=canvas.getBoundingClientRect();return{w:r.width,h:r.height}}
let canvasDpr=devicePixelRatio||1;
function resize(){
  const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;
  if(r.width<=0||r.height<=0)return;
  const bw=Math.max(1,Math.round(r.width*d)),bh=Math.max(1,Math.round(r.height*d));
  if(canvas.width!==bw||canvas.height!==bh||canvasDpr!==d){
    canvas.width=bw;canvas.height=bh;canvasDpr=d;
  }
  ctx.setTransform(d,0,0,d,0,0);
  render();
}
function worldFromScreen(sx,sy){const{w,h}=size();return{x:(sx-w/2-view.x)/view.scale,y:(h/2+view.y-sy)/view.scale}}
function screenFromWorld(x,y){const{w,h}=size();return{x:w/2+view.x+x*view.scale,y:h/2+view.y-y*view.scale}}
function step(){const target=110/view.scale,p=10**Math.floor(Math.log10(Math.max(target,1e-9)));for(const m of[1,2,5,10])if(m*p>=target)return m*p;return 10*p}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function recenterObject(o){if(!o)return;view.x=-o.x*view.scale;view.y=o.y*view.scale}
function focusStarSystem(){
  const {w,h}=size();
  if(w<20||h<20){view.x=0;view.y=0;view.scale=.005;return}
  const targetRadius=60000;
  view.scale=Math.max(.005,Math.min(100,Math.min(w,h)/(targetRadius*2)));
  view.x=0;view.y=0;
}
function focusMiddleAround(o,targetRadius=1500){
  if(!o)return;
  const {w,h}=size();
  if(w<20||h<20){recenterObject(o);return}
  view.scale=Math.max(.005,Math.min(100,Math.min(w,h)/(targetRadius*2)));
  recenterObject(o);
}
function fitToObjects(objects,padding=70){
  const items=(objects||[]).filter(o=>o&&Number.isFinite(Number(o.x))&&Number.isFinite(Number(o.y)));
  if(!items.length){toast("Нет объектов для масштабирования");return false}
  const {w,h}=size();
  if(w<20||h<20)return false;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const o of items){
    minX=Math.min(minX,o.x);maxX=Math.max(maxX,o.x);
    minY=Math.min(minY,o.y);maxY=Math.max(maxY,o.y);
  }
  const spanX=Math.max(maxX-minX,1),spanY=Math.max(maxY-minY,1);
  const usableW=Math.max(40,w-padding*2),usableH=Math.max(40,h-padding*2);
  const scale=Math.max(.005,Math.min(100,Math.min(usableW/spanX,usableH/spanY)));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  view.scale=scale;
  view.x=-cx*scale;
  view.y=cy*scale;
  return true;
}
function fitCurrentContext(){
  const source=state.objects.filter(isShown);
  let items=[];
  if(layer==="clusters")items=source.filter(o=>o.kind==="galaxy");
  else if(layer==="stars")items=source.filter(o=>o.kind==="star"&&(!state.currentGalaxyId||o.galaxyId===state.currentGalaxyId));
  else if(layer==="deep")items=source.filter(o=>(o.kind==="cluster"&&o.starId===starId)||(o.kind==="scan"&&o.starId===starId&&state.settings.scanDisplay!=="none"));
  else if(layer==="middle")items=source.filter(o=>(isBodyKind(o.kind)&&o.starId===starId)||(o.kind==="scan"&&o.starId===starId&&state.settings.scanDisplay!=="none"));
  if(!items.length&&selected)items=[selected];
  if(fitToObjects(items)){render();toast(`Масштаб подобран: ${items.length} объект${items.length===1?"":"ов"}`)}
}

function visible(){
  const source=state.objects.filter(isShown);
  if(layer==="clusters")return source.filter(o=>o.kind==="galaxy"||(o.kind==="marker"&&markerVisible(o)));
  if(layer==="stars")return source.filter(o=>o.kind==="star"||(o.kind==="marker"&&markerVisible(o)));
  if(layer==="deep")return source.filter(o=>(o.kind==="cluster"&&o.starId===starId)||(o.kind==="scan"&&o.starId===starId&&state.settings.scanDisplay!=="none")||(o.kind==="marker"&&markerVisible(o)));
  if(layer==="middle")return source.filter(o=>(isBodyKind(o.kind)&&o.starId===starId)||(o.kind==="scan"&&o.starId===starId&&state.settings.scanDisplay!=="none")||(o.kind==="marker"&&markerVisible(o)));
  return[];
}
function drawGrid(w,h){
  const s=step(),a=worldFromScreen(0,h),b=worldFromScreen(w,0),minX=Math.floor(a.x/s)*s,maxX=Math.ceil(b.x/s)*s,minY=Math.floor(a.y/s)*s,maxY=Math.ceil(b.y/s)*s;
  const yl=$("#yLabels"),xl=$("#xLabels");yl.innerHTML="";xl.innerHTML="";
  const d=devicePixelRatio||1;
  ctx.strokeStyle="#2d3d48";ctx.lineWidth=1/d;
  for(let x=minX;x<=maxX;x+=s){const p=screenFromWorld(x,0);ctx.beginPath();ctx.moveTo(Math.round(p.x)+.5/d,0);ctx.lineTo(Math.round(p.x)+.5/d,h);ctx.stroke()}
  for(let y=minY;y<=maxY;y+=s){const p=screenFromWorld(0,y);ctx.beginPath();ctx.moveTo(0,Math.round(p.y)+.5/d);ctx.lineTo(w,Math.round(p.y)+.5/d);ctx.stroke()}
  if(isPrivacyStrict()||(isPrivacyStarOnly()&&(layer==="clusters"||layer==="stars")))return;const px=s*view.scale,every=Math.max(1,Math.ceil(100/Math.max(px,1)));let i=0;
  for(let y=minY;y<=maxY;y+=s){const p=screenFromWorld(0,y);if(i++%every===0&&p.y>=12&&p.y<=h-12){const e=document.createElement("div");e.className="coordLabel";e.style.top=p.y+"px";e.textContent=fmt(y);yl.appendChild(e)}}
  i=0;for(let x=minX;x<=maxX;x+=s){const p=screenFromWorld(x,0);if(i++%every===0&&p.x>=2&&p.x<=w-75){const e=document.createElement("div");e.className="coordLabel";e.style.left=p.x+"px";e.textContent=fmt(x);xl.appendChild(e)}}
}
function drawScanZones(){
  if(layer!=="deep"&&layer!=="middle")return;
  if(state.settings.scanDisplay==="none")return;
  const scans=state.objects.filter(o=>o.kind==="scan"&&o.starId===starId&&isShown(o));if(!scans.length)return;
  const R=scanRadius();
  const {w,h}=size();
  const r=R*view.scale;
  ctx.save();
  ctx.fillStyle="#b86cff";
  ctx.globalAlpha=.045;
  ctx.beginPath();
  for(const s of scans){
    const p=screenFromWorld(s.x,s.y);
    if(p.x+r<-10||p.x-r>w+10||p.y+r<-10||p.y-r>h+10)continue;
    ctx.moveTo(p.x+r,p.y);
    ctx.arc(p.x,p.y,r,0,Math.PI*2);
  }
  ctx.fill();
  if(state.settings.scanDisplay==="center"){
    ctx.globalAlpha=.75;ctx.fillStyle="#b86cff";
    for(const s of scans){
      const p=screenFromWorld(s.x,s.y);if(p.x<-10||p.x>w+10||p.y<-10||p.y>h+10)continue;
      ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

function drawStarVisual(){
  if((layer!=="deep"&&layer!=="middle")||!starId)return;
  const star=state.objects.find(o=>o.kind==="star"&&o.id===starId);if(!star)return;
  const p=screenFromWorld(0,0),r=starRadius()*view.scale,c=starColor(star.starType);
  ctx.save();ctx.globalAlpha=.08;ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.38;ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=.65;ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,Math.min(14,r*.06)),0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawRuler(){
  if(!rulerPoints.length)return;
  ctx.save();ctx.lineWidth=2;ctx.strokeStyle="#39ffda";ctx.fillStyle="#39ffda";ctx.setLineDash([7,5]);
  if(rulerPoints.length===2){const a=screenFromWorld(rulerPoints[0].x,rulerPoints[0].y),b=screenFromWorld(rulerPoints[1].x,rulerPoints[1].y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.setLineDash([]);
  for(const p of rulerPoints){const q=screenFromWorld(p.x,p.y);ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function updateRulerResult(){
  const el=$("#rulerResult");if(!el)return;
  if(!rulerMode&&!rulerPoints.length){el.textContent=t("Линейка выключена.");return}
  if(rulerPoints.length===1){el.textContent=t("Выбери вторую точку или объект.");return}
  if(rulerPoints.length===2){const d=Math.hypot(rulerPoints[1].x-rulerPoints[0].x,rulerPoints[1].y-rulerPoints[0].y);el.textContent=`${t("Расстояние:")} ${Math.round(d).toLocaleString("ru-RU")} ${t("ед.")}`;return}
}
function render(){
  const{w,h}=size();ctx.clearRect(0,0,w,h);ctx.fillStyle="#202c36";ctx.fillRect(0,0,w,h);drawGrid(w,h);drawScanZones();drawStarVisual();drawRuler();
  let n=0;for(const o of visible()){const p=screenFromWorld(o.x,o.y);if(p.x<-20||p.x>w+20||p.y<-20||p.y>h+20)continue;n++;if(o.kind==="scan")continue;ctx.fillStyle=color(o);const r=o.kind==="star"?7:6;ctx.beginPath();ctx.arc(p.x,p.y,r/2,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle="#39ff5a";ctx.font="22px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("＋",w/2+view.x,h/2+view.y);
  $("#totalCount").textContent=state.objects.length;$("#visibleCount").textContent=n;
  const universeStats={
    star:0,planet:0,moon:0,asteroid:0,scan:0,marker:0
  };
  for(const o of state.objects)if(Object.prototype.hasOwnProperty.call(universeStats,o.kind))universeStats[o.kind]++;
  $("#statStars").textContent=universeStats.star;
  $("#statPlanets").textContent=universeStats.planet;
  $("#statMoons").textContent=universeStats.moon;
  $("#statAsteroids").textContent=universeStats.asteroid;
  $("#statScans").textContent=universeStats.scan;
  $("#statMarkers").textContent=universeStats.marker;
  const c=worldFromScreen(w/2,h/2),centerText=isPrivacyStrict()?"скрыто":`X ${fmt(c.x)}, Y ${fmt(c.y)}`;$("#status").textContent=`Центр: ${centerText}   Zoom ${view.scale<.1?view.scale.toFixed(3):view.scale.toFixed(2)}×`;$("#centerCoords").textContent=centerText;
  updateLayerContext();renderTree();renderSystemBodies();renderMarkers();renderScans();renderFilters();refreshMigrationControls();updateRulerResult();
  applyLanguage();
}
function updateLayerContext(){
  document.querySelectorAll(".layers button").forEach(b=>b.classList.toggle("active",b.dataset.layer===layer));
  const star=starId?state.objects.find(o=>o.kind==="star"&&o.id===starId):null;
  const cluster=clusterId?state.objects.find(o=>o.kind==="cluster"&&o.id===clusterId):null;
  $("#crumbs").textContent=star?`Вселенная / ${namedLabel(star)}${cluster?` / ${namedLabel(cluster)}`:""}`:"Вселенная";
  refreshObjectTypes();updateStarContext(star);
}
function updateStarContext(star){
  const header=$("#selectedStarHeader"),hint=$("#selectedStarHint"),body=$("#selectedStarBody");
  body.querySelector(".starRebind")?.remove();
  if(!star){
    header.textContent="Звезда не выбрана";
    hint.textContent="Выбери звезду на слое звёзд или в дереве.";
    return;
  }
  const label=displayObjectName(star),coords=hideCoords(star)?"":" (x "+star.x+", y "+star.y+")";
  header.textContent=`${star.imported?"(!) ":""}${prefixLabel(star.kind)} ${label}${coords}`;
  const status=star.imported?"Перенесена из другой карты. ":"";
  hint.textContent=status+`Тип: ${STAR_TYPES.find(x=>x[0]===star.starType)?.[1]||star.starType||"—"}`;
  const targets=state.objects.filter(o=>o.kind==="star"&&o.id!==star.id);
  const rebind=document.createElement("div");
  rebind.className="starRebind";
  rebind.innerHTML=`<div class="hint bindingHint">Перепривязать всю систему к другой звезде</div>
    <select id="rebindToStar"><option value="">— целевая звезда —</option>${targets.map(x=>`<option value="${x.id}">${esc(displayObjectName(x))}</option>`).join("")}</select>
    <button id="rebindStarBtn" type="button">Перенести систему и удалить эту звезду</button>`;
  body.appendChild(rebind);
  $("#rebindStarBtn")?.addEventListener("click",mergeStarSystem);
}

function toast(msg){msg=t(msg);const toastEl=$("#toast");toastEl.textContent=msg;toastEl.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove("show"),2600)}

function objectKey(o){
  if(o.kind==="marker")return null;
  if(o.kind==="galaxy"||o.kind==="star")return`${o.kind}|${Math.round(o.x)}|${Math.round(o.y)}`;
  if(o.kind==="scan")return`${o.kind}|${o.starId||"root"}|${Math.round(o.x)}|${Math.round(o.y)}`;
  if(o.kind==="cluster")return`${o.kind}|${o.starId||"root"}|${Math.round(o.x)}|${Math.round(o.y)}`;
  return`${o.kind}|${o.starId||"root"}|${Math.round(o.x)}|${Math.round(o.y)}|${o.parentPlanetId||""}`;
}
function findDuplicate(o){const k=objectKey(o);return k&&state.objects.find(x=>objectKey(x)===k)}
function buildBodyGroups(bodies){
  const remaining=new Set(bodies.map(b=>b.id)),groups=[];
  while(remaining.size){
    const firstId=remaining.values().next().value,queue=[firstId];remaining.delete(firstId);const group=[];
    while(queue.length){const id=queue.pop(),body=bodies.find(b=>b.id===id);if(!body)continue;group.push(body);for(const other of bodies){if(!remaining.has(other.id))continue;if(dist2(body,other)<=DEEP_RADIUS**2){remaining.delete(other.id);queue.push(other.id)}}}
    const cx=group.reduce((a,o)=>a+o.x,0)/group.length,cy=group.reduce((a,o)=>a+o.y,0)/group.length;groups.push({group,cx,cy});
  }
  return groups;
}
function buildGroupsByRadius(objects,radius){
  const remaining=new Set(objects.map(o=>o.id)),groups=[];
  while(remaining.size){
    const firstId=remaining.values().next().value,queue=[firstId];remaining.delete(firstId);const group=[];
    while(queue.length){const id=queue.pop(),obj=objects.find(o=>o.id===id);if(!obj)continue;group.push(obj);for(const other of objects){if(!remaining.has(other.id))continue;if(dist2(obj,other)<=radius**2){remaining.delete(other.id);queue.push(other.id)}}}
    const cx=group.reduce((a,o)=>a+o.x,0)/group.length,cy=group.reduce((a,o)=>a+o.y,0)/group.length;groups.push({group,cx,cy});
  }
  return groups;
}
function ensureGalaxies(){
  normalizeBrokenBindings();
  const stars=state.objects.filter(o=>o.kind==="star"),galaxies=state.objects.filter(o=>o.kind==="galaxy"),validIds=new Set(galaxies.map(g=>g.id));
  const autoStars=stars.filter(s=>!(s.galaxyManualBinding&&s.galaxyId&&validIds.has(s.galaxyId)));
  const groups=buildGroupsByRadius(autoStars,GALAXY_RADIUS),keep=new Set(),usedGalaxies=new Set();
  for(const item of groups){
    const candidates=state.objects.filter(g=>g.kind==="galaxy"&&g.auto&&!g.galaxyManualBinding&&!usedGalaxies.has(g.id));
    candidates.sort((a,b)=>dist2(a,{x:item.cx,y:item.cy})-dist2(b,{x:item.cx,y:item.cy}));
    let galaxy=candidates.find(g=>dist2(g,{x:item.cx,y:item.cy})<=GALAXY_RADIUS**2);
    if(!galaxy)galaxy=candidates.find(g=>item.group.some(st=>st.galaxyId===g.id));
    if(!galaxy){galaxy={id:uid(),kind:"galaxy",x:Math.round(item.cx),y:Math.round(item.cy),name:"",auto:true,galaxyManualBinding:false,favorite:false,imported:false};state.objects.push(galaxy)}
    galaxy.x=Math.round(item.cx);galaxy.y=Math.round(item.cy);galaxy.auto=true;galaxy.galaxyManualBinding=false;keep.add(galaxy.id);usedGalaxies.add(galaxy.id);
    for(const star of item.group){star.galaxyId=galaxy.id;star.galaxyManualBinding=false}
  }
  const referenced=new Set(stars.map(s=>s.galaxyId).filter(Boolean));
  const stale=state.objects.filter(g=>g.kind==="galaxy"&&g.auto&&!g.galaxyManualBinding&&!keep.has(g.id)&&!referenced.has(g.id));
  if(stale.length)state.objects=state.objects.filter(o=>!stale.some(g=>g.id===o.id));
  if(state.currentGalaxyId&&!state.objects.some(o=>o.kind==="galaxy"&&o.id===state.currentGalaxyId))state.currentGalaxyId=null;
}
function ensureDeepClusters(){
  normalizeBrokenBindings();
  for(const star of state.objects.filter(o=>o.kind==="star")){
    const bodies=state.objects.filter(o=>isBodyKind(o.kind)&&o.starId===star.id);
    const validClusters=state.objects.filter(o=>o.kind==="cluster"&&o.starId===star.id);
    const autoBodies=bodies.filter(b=>!(b.manualBinding&&validClusters.some(c=>c.id===b.clusterId)));
    const groups=buildBodyGroups(autoBodies),keepIds=new Set();

    for(const item of groups){
      let cluster=state.objects.find(c=>c.kind==="cluster"&&c.starId===star.id&&c.auto&&item.group.some(b=>b.clusterId===c.id));
      if(!cluster)cluster=state.objects.find(c=>c.kind==="cluster"&&c.starId===star.id&&c.auto&&!c.manualBinding&&dist2(c,{x:item.cx,y:item.cy})<=DEEP_RADIUS**2);
      if(!cluster){cluster={id:uid(),kind:"cluster",x:Math.round(item.cx),y:Math.round(item.cy),name:"",starId:star.id,clusterRole:"planet-group",auto:true,manualBinding:false, favorite:false, imported:false};state.objects.push(cluster)}
      cluster.x=Math.round(item.cx);cluster.y=Math.round(item.cy);cluster.clusterRole="planet-group";cluster.auto=true;cluster.name="";cluster.starId=star.id;keepIds.add(cluster.id);
      for(const b of item.group){if(!b.manualBinding)b.clusterId=cluster.id}
    }

    const referenced=new Set(bodies.map(b=>b.clusterId).filter(Boolean));
    const stale=state.objects.filter(c=>c.kind==="cluster"&&c.starId===star.id&&c.auto&&!c.manualBinding&&!keepIds.has(c.id)&&!referenced.has(c.id));
    if(stale.length)state.objects=state.objects.filter(o=>!stale.some(c=>c.id===o.id));
    normalizeMoonParents(star.id);normalizeAsteroidParents(star.id);
  }
  if(clusterId&&!state.objects.some(o=>o.kind==="cluster"&&o.id===clusterId))clusterId=null;
}
function normalizeBrokenBindings(){
  const ids=new Set(state.objects.map(o=>o.id));
  for(const o of state.objects){
    if(o.kind==="star"&&o.galaxyId&&!ids.has(o.galaxyId))o.galaxyId=null;
    if(o.kind==="cluster"&&o.starId&&!ids.has(o.starId)){o.starId=null;o.manualBinding=false}
    if(isBodyKind(o.kind)&&o.starId&&!ids.has(o.starId)){o.starId=null;o.clusterId=null;o.manualBinding=false}
    if(isBodyKind(o.kind)&&o.clusterId&&!ids.has(o.clusterId)){o.clusterId=null;o.manualBinding=false}
    if((o.kind==="moon"||o.kind==="asteroid")&&o.parentPlanetId&&!ids.has(o.parentPlanetId))o.parentPlanetId=null;
  }
}
function normalizeMoonParents(sid){
  for(const moon of state.objects.filter(o=>o.kind==="moon"&&(!sid||o.starId===sid))){
    const parent=moon.parentPlanetId&&state.objects.find(o=>o.kind==="planet"&&o.id===moon.parentPlanetId&&o.clusterId===moon.clusterId&&o.starId===moon.starId);
    if(parent)continue;
    const candidates=state.objects.filter(o=>o.kind==="planet"&&o.clusterId===moon.clusterId&&o.starId===moon.starId);
    if(candidates.length){candidates.sort((a,b)=>dist2(a,moon)-dist2(b,moon));moon.parentPlanetId=candidates[0].id}
    else moon.parentPlanetId=null;
  }
}

function allowedKinds(){
  if(layer==="clusters")return["marker"];
  if(layer==="stars")return["marker","star"];
  if(layer==="deep"||layer==="middle")return["marker","planet","moon","asteroid","scan"];
  return["marker"];
}
function refreshObjectTypes(){
  const select=$("#objectType");if(!select)return;const allowed=allowedKinds(),current=select.value;
  select.innerHTML=allowed.map(k=>`<option value="${k}">${kindLabel(k)}</option>`).join("");select.value=allowed.includes(current)?current:allowed[0];
  $("#addHint").textContent=layer==="clusters"?"Слой галактик: галактики создаются автоматически по радиусу 350 вокруг звёзд; вручную доступны только метки.":layer==="stars"?"Слой звёзд: только звёзды и метки.":"Deep и Middle: планеты, спутники, астероиды, сканы и метки; скопления создаются автоматически по радиусу 1000.";
  refreshCreationFields();
}
function resourcePickerHtml(id,selected=[]){
  const picked=new Set(selected||[]),preset=DEFAULT_RESOURCE_TYPES,custom=state.resourceTypes.filter(r=>!preset.includes(r));
  const btns=list=>list.map(r=>`<button type="button" class="resourceChoice ${picked.has(r)?"active":""}" data-resource-picker="${id}" data-resource="${esc(r)}">${esc(localizedBuiltIn(r))}</button>`).join("");
  return `<div id="${id}" class="resourcePicker" data-picker-root="${id}">
    <div class="resourcePresetGrid">${btns(preset)}</div>
    ${custom.length?`<div class="hint resourceCustomHint">Добавленные пользователем</div><div class="resourceCustomList">${btns(custom)}</div>`:""}
  </div>`;
}
function bindResourcePicker(id){
  const root=$("#"+id);if(!root)return;
  root.querySelectorAll("[data-resource-picker]").forEach(btn=>btn.onclick=()=>btn.classList.toggle("active"));
  root.querySelectorAll(".resourceCustomList").forEach(list=>list.addEventListener("wheel",e=>{e.preventDefault();list.scrollTop+=Math.sign(e.deltaY)*32},{passive:false}));
}
function selectedValues(id){return Array.from(document.querySelectorAll(`#${id} [data-resource]:not(.resourceCustomHint)`)).filter(b=>b.classList.contains("active")).map(b=>b.dataset.resource)}
function lifePickerHtml(id,life=null){
  const items=normalizeLifeValue(life);const rowHtml=(item={})=>`<div class="lifeVariant" data-life-variant><label class="lifeAggressive"><input type="checkbox" data-life-aggressive ${item.aggressive?"checked":""}><span data-life-aggressive-label>${item.aggressive?"Есть агрессивная":"Нет агрессивной"}</span></label><select data-life-mob><option value="">— не указано —</option>${state.mobTypes.map(x=>`<option value="${esc(x)}" ${item.mob===x?"selected":""}>${esc(x)}</option>`).join("")}</select><button type="button" class="lifeRemove" data-life-remove title="Удалить вариант">×</button></div>`;
  return `<div class="lifePicker" id="${id}"><label class="hint">Мобы (можно несколько вариантов)</label><div class="lifeVariants">${items.map(rowHtml).join("")}</div><button type="button" class="lifeAdd" data-life-add>+ Добавить вариант</button></div>`;
}
function readLife(id){const root=$("#"+id);if(!root)return [];return uniqLife(Array.from(root.querySelectorAll("[data-life-variant]")).map(row=>({aggressive:!!row.querySelector("[data-life-aggressive]")?.checked,mob:row.querySelector("[data-life-mob]")?.value||""})))}
function bindLifePicker(id){const root=$("#"+id);if(!root||root.dataset.lifeBound==="1")return;root.dataset.lifeBound="1";root.addEventListener("click",e=>{const add=e.target.closest("[data-life-add]");if(add){const variants=root.querySelector(".lifeVariants"),row=document.createElement("div");row.className="lifeVariant";row.dataset.lifeVariant="";row.innerHTML=`<label class="lifeAggressive"><input type="checkbox" data-life-aggressive><span data-life-aggressive-label>Нет агрессивной</span></label><select data-life-mob><option value="">— не указано —</option>${state.mobTypes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select><button type="button" class="lifeRemove" data-life-remove title="Удалить вариант">×</button>`;variants?.appendChild(row);return}const remove=e.target.closest("[data-life-remove]");if(remove){remove.closest("[data-life-variant]")?.remove();return}const aggressive=e.target.closest("[data-life-aggressive]");if(aggressive){const label=aggressive.closest(".lifeAggressive")?.querySelector("[data-life-aggressive-label]");if(label)label.textContent=aggressive.checked?"Есть агрессивная":"Нет агрессивной"}})}

function refreshCreationFields(){
  const kind=$("#objectType")?.value,sw=$("#createStarTypeWrap"),pw=$("#createPlanetTypeWrap"),rw=$("#createResourcesWrap"),lw=$("#createLifeWrap");if(!sw)return;
  const bodyKind=isBodyKind(kind);
  sw.style.display=kind==="star"?"block":"none";
  pw.style.display=bodyKind?"block":"none";
  rw.style.display=bodyKind?"block":"none";
  if(lw)lw.style.display=bodyKind?"block":"none";
  const nameInput=$("#objectName");if(nameInput){nameInput.style.display=kind==="scan"?"none":"block";if(kind==="scan")nameInput.value="";}
  const sizeInput=$("#createSize");
  const planetWrap=$("#createPlanetTypeField");
  if(planetWrap)planetWrap.style.display=(kind==="planet"||kind==="moon")?"block":"none";
  if(sizeInput)sizeInput.parentElement.style.display=bodyKind?"block":"none";
  if(kind==="star"){const st=$("#createStarType"),prev=st.value;st.innerHTML=STAR_TYPES.map(([v,l])=>`<option value="${v}">${esc(t(l))}</option>`).join("");st.value=STAR_TYPES.some(x=>x[0]===prev)?prev:"yellow"}
  if(kind==="planet"||kind==="moon"){
    const ps=$("#createPlanetType"),prevType=ps.value;ps.innerHTML=state.planetTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");ps.value=state.planetTypes.includes(prevType)?prevType:(state.planetTypes[0]||"");
  }
  const selected=selectedValues("createResources");
  if(rw)rw.innerHTML=`<label class="hint">Ресурсы</label>${resourcePickerHtml("createResources",selected)}`;
  bindResourcePicker("createResources");
  const life=readLife("createLife");if(lw)lw.innerHTML=bodyKind?lifePickerHtml("createLife",life):"";
  bindLifePicker("createLife");
}
function resetCreateFields(){
  ["#createSize","#objectName","#coordX","#coordY"].forEach(id=>{const e=$(id);if(e)e.value=""});
  document.querySelectorAll("#createResources [data-resource]").forEach(b=>b.classList.remove("active"));
  const life=$("#createLifeWrap");if(life){life.innerHTML=lifePickerHtml("createLife",[]);bindLifePicker("createLife")}
}
function addObject(kind,x,y,name){
  const nx=Number(x),ny=Number(y);if(!Number.isFinite(nx)||!Number.isFinite(ny)){toast("Ошибка: X и Y должны быть числами.");return null}
  if(!allowedKinds().includes(kind)){toast("Этот тип объекта недоступен на текущем слое.");return null}
  if((isBodyKind(kind)||kind==="scan")&&!starId){toast("Сначала открой звезду.");return null}
  const o={id:uid(),kind,x:cleanCoord(nx),y:cleanCoord(ny),name:String(name||"").trim(),favorite:false,imported:false,manualBinding:false,galaxyManualBinding:false};
  if(kind==="marker"){
    o.markerLayer=layer==="clusters"?"clusters":layer==="stars"?"stars":"system";
    if(o.markerLayer==="system")o.starId=starId;
  }
  if(kind==="star"){o.starType=$("#createStarType")?.value||"yellow";if(selected?.kind==="galaxy")o.galaxyId=selected.id;else if(state.currentGalaxyId)o.galaxyId=state.currentGalaxyId}
  if(kind==="scan"){o.radius=scanRadius();o.starId=starId;o.scanNumber=nextScanNumber(starId);o.name=""}
  if(isBodyKind(kind)){
    o.starId=starId;
    if(kind!=="asteroid")o.planetType=$("#createPlanetType")?.value||state.planetTypes[0]||"";
    o.size=roundSizeUp8($("#createSize")?.value.trim()||"");
    o.resources=selectedValues("createResources");
    const life=readLife("createLife");if(life.length)o.life=life;
    o.isMoon=kind==="moon";
  }
  const d=findDuplicate(o);if(d){selected=d;show(d);toast(`Дубликат: уже есть ${namedLabel(d)} в X=${d.x}, Y=${d.y}`);return null}
  checkpoint();state.objects.push(o);
  if(kind==="galaxy"){state.objects.pop();toast("Галактики создаются автоматически по радиусу 350 вокруг звёзд.");return null}
  else if(kind==="star"){ensureGalaxies();starId=o.id;state.currentGalaxyId=o.galaxyId||null;clusterId=null;layer="stars"}
  else if(isBodyKind(kind)){ensureDeepClusters();if(kind==="moon")normalizeMoonParents(starId);normalizeAsteroidParents(starId);clusterId=o.clusterId||null;layer="middle"}
  else if(kind==="scan"){layer=layer==="middle"?"middle":"deep"}
  selected=o;recenterObject(o);save();show(o);render();resetCreateFields();toast(`${kindLabel(kind)} добавлен: X=${o.x}, Y=${o.y}`);return o;
}

function galaxyOptions(selectedId,ownOnly=false){return state.objects.filter(o=>o.kind==="galaxy"&&(!ownOnly||!o.imported)).map(g=>`<option value="${g.id}" ${g.id===selectedId?"selected":""}>${esc(displayObjectName(g))}${hideCoords(g)?"":" (x "+g.x+", y "+g.y+")"}</option>`).join("")}
function starOptions(selectedId,ownOnly=false){return state.objects.filter(o=>o.kind==="star"&&(!ownOnly||!o.imported)).map(s=>`<option value="${s.id}" ${s.id===selectedId?"selected":""}>${esc(displayObjectName(s))}</option>`).join("")}
function clusterOptions(selectedId,starFilter=null,ownOnly=false){return state.objects.filter(o=>o.kind==="cluster"&&(!starFilter||o.starId===starFilter)&&(!ownOnly||!o.imported)).map(c=>`<option value="${c.id}" ${c.id===selectedId?"selected":""}>${esc(displayObjectName(c))}${hideCoords(c)?"":" (x "+c.x+", y "+c.y+")"}</option>`).join("")}
function planetOptions(selectedId,starFilter=null,ownOnly=false){return state.objects.filter(o=>o.kind==="planet"&&(!starFilter||o.starId===starFilter)&&(!ownOnly||!o.imported)).map(p=>`<option value="${p.id}" ${p.id===selectedId?"selected":""}>${esc(displayObjectName(p))} · ${esc(p.planetType||"")}</option>`).join("")}
function importedVerificationHtml(o){
  if(!o.imported)return"";
  return `<button id="clearImportedMark" type="button">Снять отметку (!)</button>`;
}
function bindingHtml(o){
  if(!o.imported&&o.kind!=="star")return"";
  let label="",html="";
  if(o.kind==="star"){label="Привязать звезду к вашей галактике";html=`<select id="editParentId"><option value="">— без галактики —</option>${galaxyOptions(o.galaxyId,true)}</select>`}
  if(o.kind==="cluster"){label="Привязать скопление к вашей звезде";html=`<select id="editParentId"><option value="">— без звезды —</option>${starOptions(o.starId,true)}</select>`}
  if(o.kind==="planet"){label="Привязать планету к вашему скоплению";html=`<select id="editParentId"><option value="">— без скопления —</option>${clusterOptions(o.clusterId,o.starId,true)}</select>`}
  if(o.kind==="moon"){label="Привязать спутник к вашей планете";html=`<select id="editParentId"><option value="">— без планеты —</option>${planetOptions(o.parentPlanetId,o.starId,true)}</select>`}
  if(!o.imported)return `<div class="importSection"><div class="hint bindingHint">${label}</div>${html}<button id="applyBinding" type="button">Применить привязку</button></div>`;
  return `<div class="importSection"><div class="importBadge">(!) Информация из другой карты</div>${label?`<div class="hint bindingHint">${label}</div>${html}<button id="applyBinding" type="button">Применить привязку</button>`:""}<div class="row importActions">${importedVerificationHtml(o)}</div></div>`;
}
function editableNameHtml(o){
  const hidden=isPrivacyStrict()&&!(["planet","moon","asteroid"].includes(o.kind)) || (isPrivacyStarOnly()&&["galaxy","star"].includes(o.kind));
  if(hidden)return `<div class="hint privacyMaskNote">Название скрыто режимом публикации.</div>`;
  return `<label class="hint">Название</label><input id="editName" value="${esc(o.name||"")}" placeholder="Без названия">`;
}
function coordEditHtml(o){
  if(hideCoords(o))return `<div class="hint privacyMaskNote">Координаты скрыты режимом публикации.</div>`;
  return `<label class="hint">Координаты</label><div class="row coordEditRow"><input id="editX" type="number" step="1" value="${o.x}"><input id="editY" type="number" step="1" value="${o.y}"></div>`;
}
function clearImportedMark(o){
  if(!o||!o.imported)return;
  checkpoint();
  o.imported=false;
  delete o.importedAt;
  save();
  selected=o;
  show(o);
  render();
  toast("Отметка (!) снята — данные подтверждены.");
}
function show(o){
  if(!o){$("#detailsBody").innerHTML="<div class='muted'>Выбери точку на карте или тело в дереве.</div>";return}
  if(o.kind==="scan"){
    const coords=hideCoords(o)?`<div class="hint privacyMaskNote">Координаты скрыты режимом публикации.</div>`:`<label class="hint">Координаты</label><div class="row coordEditRow"><input id="editX" type="number" step="1" value="${o.x}"><input id="editY" type="number" step="1" value="${o.y}"></div>`;
    $("#detailsBody").innerHTML=`<h3>Скан ${o.scanNumber||"—"}</h3><div class="detailsRow"><span>Тип объекта</span><b>Скан</b></div><div class="detailsRow"><span>Номер на звезде</span><b>${o.scanNumber||"—"}</b></div><div class="detailsRow"><span>Радиус</span><b>${scanRadius()}</b></div>${o.imported?`<div class="importSection"><div class="importBadge">(!) Информация из другой карты</div><div class="row importActions"><button id="clearImportedMark" type="button">Снять отметку (!)</button></div></div>`:""}${coords}<div class="row"><button id="saveEdit" type="button">Сохранить изменения</button><button id="deleteBtn" class="danger" type="button">Удалить</button></div>`;
    $("#saveEdit").onclick=()=>{
      const nx=$("#editX")?Number($("#editX").value):o.x,ny=$("#editY")?Number($("#editY").value):o.y;
      if(!Number.isFinite(nx)||!Number.isFinite(ny)){toast("Ошибка: X и Y должны быть числами.");return}
      checkpoint();o.name="";o.radius=scanRadius();if(!hideCoords(o)){o.x=cleanCoord(nx);o.y=cleanCoord(ny)}save();selected=o;recenterObject(o);show(o);render();toast("Изменения сохранены")
    };
    $("#clearImportedMark")?.addEventListener("click",()=>clearImportedMark(o));
    $("#deleteBtn").onclick=()=>{checkpoint();state.objects=state.objects.filter(x=>x.id!==o.id);selected=null;save();show(null);render();toast("Скан удалён")};
    return;
  }
  const bodyKind=isBodyKind(o.kind);
  const starTypeHtml=o.kind==="star"?`<label class="hint">Тип звезды</label><select id="editStarType">${STAR_TYPES.map(([v,l])=>`<option value="${v}" ${o.starType===v?"selected":""}>${esc(t(l))}</option>`).join("")}</select>`:"";
  const planetTypeHtml=(o.kind==="planet"||o.kind==="moon")?`<label class="hint">Тип планеты</label><select id="editPlanetType">${state.planetTypes.map(x=>`<option value="${esc(x)}" ${o.planetType===x?"selected":""}>${esc(localizedBuiltIn(x))}</option>`).join("")}</select>`:"";
  const resourcesHtml=bodyKind?`<label class="hint">Ресурсы</label>${resourcePickerHtml("editResources",o.resources||[])}`:"";
  const sizeHtml=bodyKind?`<label class="hint">Размер (информационный)</label><input id="editSize" value="${esc(o.size||"")}">`:"";
  const lifeHtml=bodyKind?lifePickerHtml("editLife",getLife(o)):"";
  const favHtml=["star","planet","moon","asteroid"].includes(o.kind)?`<label class="favoriteToggle"><input id="editFavorite" type="checkbox" ${o.favorite?"checked":""}><span>★ Избранное</span></label>`:"";
  const galaxyHtml=o.kind==="star"?`<label class="hint">Галактика</label><select id="editGalaxyId"><option value="">— без галактики —</option>${galaxyOptions(o.galaxyId,false)}</select>`:"";
  $("#detailsBody").innerHTML=`<h3>${importedLabel(o)}</h3>${editableNameHtml(o)}
    <div class="detailsRow"><span>Тип объекта</span><b>${kindLabel(o.kind)}</b></div>
    ${coordEditHtml(o)}
    ${galaxyHtml}${starTypeHtml}${planetTypeHtml}${resourcesHtml}${sizeHtml}${lifeHtml}${favHtml}${bindingHtml(o)}
    <div class="shareActions"><button id="copyShareCode" type="button">Скопировать код</button><button id="pasteShareCode" type="button">Вставить код</button></div>
    <div class="row"><button id="saveEdit" type="button">Сохранить изменения</button><button id="deleteBtn" class="danger" type="button" ${o.kind==="galaxy"&&o.auto?"disabled title='Галактики создаются автоматически'":""}>Удалить</button></div>`;
  bindResourcePicker("editResources");
  bindLifePicker("editLife");
  $("#copyShareCode")?.addEventListener("click",()=>copyShareCode(o));
  $("#pasteShareCode")?.addEventListener("click",pasteShareCode);
  $("#saveEdit").onclick=()=>{
    const nx=$("#editX")?Number($("#editX").value):o.x,ny=$("#editY")?Number($("#editY").value):o.y;
    if(!Number.isFinite(nx)||!Number.isFinite(ny)){toast("Ошибка: X и Y должны быть числами.");return}
    checkpoint();
    if($("#editName"))o.name=$("#editName").value.trim();
    if(!hideCoords(o)){o.x=cleanCoord(nx);o.y=cleanCoord(ny)}
    if($("#editStarType"))o.starType=$("#editStarType").value;
    if($("#editPlanetType"))o.planetType=$("#editPlanetType").value;
    if($("#editResources"))o.resources=selectedValues("editResources");
    if($("#editSize"))o.size=roundSizeUp8($("#editSize").value.trim());
    if($("#editLife")){const life=readLife("editLife");if(life.length)o.life=life;else delete o.life}
    if($("#editFavorite"))o.favorite=$("#editFavorite").checked;
    if($("#editGalaxyId")&&o.kind==="star"){o.galaxyId=$("#editGalaxyId").value||null;o.galaxyManualBinding=!!o.galaxyId;state.currentGalaxyId=o.galaxyId||null}
    if(o.kind==="star")ensureGalaxies();if(bodyKind){ensureDeepClusters();normalizeAsteroidParents(starId)}
    save();selected=o;recenterObject(o);show(o);render();toast("Изменения сохранены");
  };
  $("#clearImportedMark")?.addEventListener("click",()=>clearImportedMark(o));
  const bind=$("#applyBinding");if(bind)bind.onclick=()=>{
    const parentId=$("#editParentId").value||null;checkpoint();
    if(o.kind==="star"){o.galaxyId=parentId;o.galaxyManualBinding=!!parentId;state.currentGalaxyId=parentId}
    else if(o.kind==="cluster"){o.starId=parentId;o.manualBinding=!!parentId}
    else if(o.kind==="planet"){const p=parentId&&state.objects.find(x=>x.kind==="cluster"&&x.id===parentId);o.clusterId=parentId;o.starId=p?.starId||null;o.manualBinding=!!parentId}
    else if(o.kind==="moon"){const p=parentId&&state.objects.find(x=>x.kind==="planet"&&x.id===parentId);o.parentPlanetId=parentId;o.clusterId=p?.clusterId||null;o.starId=p?.starId||null;o.manualBinding=!!parentId}
    ensureDeepClusters();save();show(o);render();toast("Привязка обновлена");
  };
  $("#deleteBtn").onclick=()=>{
    checkpoint();const id=o.id;state.objects=state.objects.filter(x=>x.id!==id);
    for(const x of state.objects){if(x.clusterId===id){x.clusterId=null;x.manualBinding=false}if(x.starId===id&&["planet","moon","asteroid","cluster","scan"].includes(x.kind)){x.starId=null;x.clusterId=null;x.manualBinding=false}if(x.galaxyId===id&&x.kind==="star")x.galaxyId=null;if(x.parentPlanetId===id&&(x.kind==="moon"||x.kind==="asteroid"))x.parentPlanetId=null}
    if(starId===id)starId=null;if(clusterId===id)clusterId=null;if(state.currentGalaxyId===id)state.currentGalaxyId=null;selected=null;ensureGalaxies();ensureDeepClusters();save();show(null);render();toast("Объект удалён");
  };
}

function treeChildren(parentId){return state.objects.filter(o=>isShown(o)&&o.kind==="star"&&o.galaxyId===parentId)}
function clustersForStar(sid){return state.objects.filter(o=>isShown(o)&&o.kind==="cluster"&&o.starId===sid)}
function moonChildren(pid){return state.objects.filter(o=>isShown(o)&&(o.kind==="moon"||o.kind==="asteroid")&&o.parentPlanetId===pid)}
function primaryBodiesForCluster(cid){return state.objects.filter(o=>isShown(o)&&((o.kind==="planet"||o.kind==="asteroid")&&o.clusterId===cid&&!o.parentPlanetId))}
function clusterTreeChildren(cid){const p=primaryBodiesForCluster(cid),ids=new Set(p.map(x=>x.id));return[...p,...state.objects.filter(o=>isShown(o)&&o.kind==="moon"&&o.clusterId===cid&&!ids.has(o.parentPlanetId)&&!o.parentPlanetId)]}
function starBodyCount(sid){return state.objects.filter(o=>isShown(o)&&isBodyKind(o.kind)&&o.starId===sid).length}
function starScanCount(sid){return state.objects.filter(o=>isShown(o)&&o.kind==="scan"&&o.starId===sid).length}
function clusterBodyCount(cid){return state.objects.filter(o=>isBodyKind(o.kind)&&o.clusterId===cid).length}
function treeDisplayLabel(o){
  if(o.kind==="cluster")return `${o.imported?`<span class="importMark">(!)</span>`:""}скопление <span class="clusterCounts">(${clusterBodyCount(o.id)})</span>`;
  const base=displayLabelHtml(o);
  if(o.kind!=="star")return base;
  return `${base} <span class="starCounts">(${starBodyCount(o.id)}/${starScanCount(o.id)})</span>`;
}

function treePathIds(o){
  const ids=new Set();let cur=o,guard=0;
  while(cur&&guard++<20){
    let parentId=null;
    if(cur.kind==="galaxy")break;
    if(cur.kind==="star")parentId=cur.galaxyId||null;
    else if(cur.kind==="cluster")parentId=cur.starId||null;
    else if(cur.kind==="planet")parentId=cur.clusterId||null;
    else if(cur.kind==="moon"||cur.kind==="asteroid")parentId=cur.parentPlanetId||cur.clusterId||null;
    if(!parentId)break;
    const parent=state.objects.find(x=>x.id===parentId);if(!parent)break;
    ids.add(parent.id);cur=parent;
  }
  return ids;
}
function treeNode(o,children){
  const has=children?.length,collapsed=treeCollapsedIds.has(o.id),pathIds=selected?treePathIds(selected):new Set(),isSelected=selected?.id===o.id,isParent=pathIds.has(o.id);
  const starDot=o.kind==="star"?`<span class="starDot treeStarDot" style="--star-color:${starColor(o.starType)}" aria-hidden="true"></span>`:"";
  const btn=has?`<button class="treeToggle ${o.kind==="star"?"starToggle":""}" data-toggle="${o.id}" type="button">${collapsed?"+":"−"}</button>`:(`<span class="treeToggleSpacer ${o.kind==="star"?"starToggleSpacer":""}"></span>`);
  const fav=["star","planet","moon"].includes(o.kind)&&o.favorite?' <span class="favStar">★</span>':"";
  const openable=["galaxy","star","cluster"].includes(o.kind);
  const openBtn=openable?`<button class="treeOpen" data-open-layer="${o.id}" type="button" title="Открыть слой">↗</button>`:"";
  let h=`<li class="treeItem"><div class="treeLine ${isSelected?"treeSelected ":""}${isParent?"treeParentActive":""}">${starDot}${btn}<button class="treeName treeNav" data-center="${o.id}" type="button">${treeDisplayLabel(o)}${fav}</button>${openBtn}<button class="treeCoord" data-jump="${o.id}" type="button">${hideCoords(o)?"(скрыто)":"("+o.x+", "+o.y+")"}</button></div>`;
  if(has){h+=`<ul class="treeChildren" data-children="${o.id}" style="display:${collapsed?"none":"block"}">`;for(const c of children){const cc=c.kind==="star"?clustersForStar(c.id):c.kind==="cluster"?clusterTreeChildren(c.id):c.kind==="planet"?moonChildren(c.id):[];h+=treeNode(c,cc)}h+=`</ul>`}
  return h+"</li>";
}
function renderTree(){
  const root=$("#bodyTree");if(!root)return;const galaxies=state.objects.filter(o=>isShown(o)&&o.kind==="galaxy"),orphanStars=state.objects.filter(o=>isShown(o)&&o.kind==="star"&&!o.galaxyId),orphanClusters=[];
  let html='<ul class="treeRoot">';
  if(!galaxies.length&&!orphanStars.length&&!orphanClusters.length)html+='<li class="treeEmpty">Пока нет небесных тел.</li>';
  for(const g of galaxies)html+=treeNode(g,treeChildren(g.id));
  if(orphanStars.length){html+='<li class="treeItem virtualGroup"><div class="treeLine"><span class="treeToggleSpacer"></span><span class="treeName">галактика без привязки</span></div><ul class="treeChildren">';for(const s of orphanStars)html+=treeNode(s,clustersForStar(s.id));html+='</ul></li>'}
  const looseClusters=state.objects.filter(o=>isShown(o)&&o.kind==="cluster"&&(!o.starId||!state.objects.some(s=>s.kind==="star"&&s.id===o.starId)));if(looseClusters.length){html+='<li class="treeItem virtualGroup"><div class="treeLine"><span class="treeToggleSpacer"></span><span class="treeName">звезда без привязки</span></div><ul class="treeChildren">';for(const c of looseClusters)html+=treeNode(c,clusterTreeChildren(c.id));html+='</ul></li>'}
  html+='</ul>';root.innerHTML=html;
  root.querySelectorAll("[data-toggle]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.toggle,el=root.querySelector(`[data-children="${id}"]`);if(!el)return;const hidden=el.style.display==="none";el.style.display=hidden?"block":"none";btn.textContent=hidden?"−":"+";if(hidden)treeCollapsedIds.delete(id);else treeCollapsedIds.add(id)});
  root.querySelectorAll("[data-center]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.center);if(o)navigateFromList(o)});
  root.querySelectorAll("[data-open-layer]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.openLayer);if(o)openFromTreeName(o)});
  root.querySelectorAll("[data-jump]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.jump);if(o)navigateFromList(o)});
}
function renderSystemBodies(){
  const root=$("#systemBodies"),title=$("#systemBodiesTitle");if(!root)return;
  if(selected?.kind==="galaxy"){
    const gid=selected.id,stars=state.objects.filter(o=>isShown(o)&&o.kind==="star"&&o.galaxyId===gid);
    if(title)title.textContent="Звёзды галактики";
    if(!stars.length){root.innerHTML='<div class="treeEmpty">В этой галактике пока нет звёзд.</div>';return}
    root.innerHTML=stars.map(s=>`<div class="systemBody"><button class="miniNav" data-galaxy-star="${s.id}" type="button">${s.imported?"(!) ":""}${esc(displayObjectName(s))}</button><span class="systemBodyCoord">${hideCoords(s)?"(скрыто)":"("+s.x+", "+s.y+")"}</span><button class="treeCoord" data-galaxy-jump="${s.id}" type="button">↗</button></div>`).join('');
    root.querySelectorAll("[data-galaxy-star]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.galaxyStar);if(o)navigateFromList(o)});
    root.querySelectorAll("[data-galaxy-jump]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.galaxyJump);if(o)navigateFromList(o)});return;
  }
  if(title)title.textContent="Тела звёздной системы";
  const bodies=starId?state.objects.filter(o=>isShown(o)&&isBodyKind(o.kind)&&o.starId===starId):[];
  if(!starId||!bodies.length){root.innerHTML=`<div class="treeEmpty">${starId?"На слое этой звезды пока нет планет, спутников и астероидов.":"Выбери звезду, чтобы увидеть её тела."}</div>`;return}
  const clusters=state.objects.filter(o=>isShown(o)&&o.kind==="cluster"&&o.starId===starId);let html="";
  for(const c of clusters){const group=bodies.filter(o=>o.clusterId===c.id);if(!group.length)continue;html+=`<div class="systemGroup"><div class="systemGroupTitle">скопление (${clusterBodyCount(c.id)})</div>`;for(const b of group){html+=`<div class="systemBody"><button class="miniNav" data-system-open="${b.id}" type="button">${b.imported?"(!) ":""}${esc(displayObjectName(b))}</button><span class="systemBodyCoord">${hideCoords(b)?"(скрыто)":"("+b.x+", "+b.y+")"}</span><button class="treeCoord" data-system-jump="${b.id}" type="button">↗</button></div>`}html+='</div>'}
  const ungrouped=bodies.filter(o=>!o.clusterId);if(ungrouped.length){html+='<div class="systemGroup"><div class="systemGroupTitle">Без скопления</div>';for(const b of ungrouped)html+=`<div class="systemBody"><button class="miniNav" data-system-open="${b.id}" type="button">${b.imported?"(!) ":""}${esc(displayObjectName(b))}</button><span class="systemBodyCoord">${hideCoords(b)?"(скрыто)":"("+b.x+", "+b.y+")"}</span><button class="treeCoord" data-system-jump="${b.id}" type="button">↗</button></div>`;html+='</div>'}
  root.innerHTML=html;
  root.querySelectorAll("[data-system-open]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.systemOpen);if(o)navigateFromList(o)});
  root.querySelectorAll("[data-system-jump]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.systemJump);if(o)navigateFromList(o)});
}

function renderMarkers(){
  const root=$("#markerList");if(!root)return;
  const markers=state.objects.filter(o=>isShown(o)&&o.kind==="marker"&&markerVisible(o));
  if(!markers.length){root.innerHTML='<div class="scanEmpty">На этом слое меток пока нет.</div>';return}
  root.innerHTML=markers.map(m=>`<div class="markerItem"><button class="miniNav markerName" data-marker-open="${m.id}" type="button">${m.imported?"(!) ":""}${esc(displayObjectName(m))}</button><span class="markerCoord">${hideCoords(m)?"(скрыто)":"("+m.x+", "+m.y+")"}</span><button class="treeCoord tinyJump" data-marker-jump="${m.id}" type="button" title="Центрировать">↗</button></div>`).join('');
  root.querySelectorAll("[data-marker-open]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.markerOpen);if(o){selected=o;recenterObject(o);show(o);render()}});
  root.querySelectorAll("[data-marker-jump]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.markerJump);if(o)jumpByCoordinate(o)});
}
function renderScans(){
  const root=$("#scanList");if(!root)return;const scans=starId?state.objects.filter(o=>isShown(o)&&o.kind==="scan"&&o.starId===starId):[];
  if(!scans.length){root.innerHTML='<div class="scanEmpty">Сканов пока нет.</div>';return}
  root.innerHTML=scans.map(s=>`<div class="scanItem"><button class="miniNav scanName" data-scan-open="${s.id}" type="button">${s.imported?"(!) ":""}${isPrivacyStrict()?"скан (засекречено)":"Скан "+(s.scanNumber||"—")}</button><span class="scanCoord">${hideCoords(s)?"(скрыто)":"("+s.x+", "+s.y+")"}</span><button class="treeCoord tinyJump" data-scan-jump="${s.id}" type="button" title="Центрировать">↗</button></div>`).join('');
  root.querySelectorAll("[data-scan-open]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.scanOpen);if(o){selected=o;clusterId=null;recenterObject(o);show(o);render()}});
  root.querySelectorAll("[data-scan-jump]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.scanJump);if(o)jumpByCoordinate(o)});
}

function openFromTreeName(o){
  if(!o)return;
  selected=o;
  if(o.kind==="galaxy"){
    state.currentGalaxyId=o.id;
    starId=null;
    clusterId=null;
    layer="stars";
    recenterObject(o);
  }else if(o.kind==="star"){
    starId=o.id;
    state.currentGalaxyId=o.galaxyId||null;
    clusterId=null;
    layer="deep";
    focusStarSystem();
  }else if(o.kind==="cluster"){
    starId=o.starId||starId;
    clusterId=o.id;
    layer="middle";
    recenterObject(o);
  }else{
    navigateToObjectLayer(o);
    return;
  }
  show(o);
  render();
}

function navigateFromList(o){
  if(!o)return;
  selected=o;
  if(o.kind==="galaxy"){
    state.currentGalaxyId=o.id;starId=null;clusterId=null;layer="clusters";
    recenterObject(o);
  }else if(o.kind==="star"){
    state.currentGalaxyId=o.galaxyId||null;starId=o.id;clusterId=null;layer="stars";
    recenterObject(o);
  }else if(o.kind==="cluster"){
    starId=o.starId||starId;clusterId=o.id;layer="deep";
    recenterObject(o);
  }else if(o.kind==="planet"||o.kind==="moon"){
    starId=o.starId||starId;clusterId=null;layer="middle";
    recenterObject(o);
  }else if(o.kind==="scan"){
    starId=o.starId||starId;clusterId=null;
    if(layer!=="deep"&&layer!=="middle")layer="deep";
    recenterObject(o);
  }
  show(o);render();
}

function navigateFromMap(o){
  if(!o)return;
  selected=o;
  if(o.kind==="galaxy"){
    state.currentGalaxyId=o.id;starId=null;clusterId=null;layer="stars";
    recenterObject(o);
  }else if(o.kind==="star"){
    state.currentGalaxyId=o.galaxyId||null;starId=o.id;clusterId=null;layer="deep";
    focusStarSystem();
  }else if(o.kind==="cluster"){
    starId=o.starId||starId;clusterId=null;layer="middle";
    focusMiddleAround(o,1500);
  }else if(o.kind==="planet"||o.kind==="moon"){
    starId=o.starId||starId;clusterId=null;layer="middle";
    recenterObject(o);
  }else if(o.kind==="scan"){
    starId=o.starId||starId;clusterId=null;
    if(layer!=="deep"&&layer!=="middle")layer="deep";
    recenterObject(o);
  }
  show(o);render();
}

function jumpByCoordinate(o){navigateFromList(o)}
function objectGalaxyId(o){
  if(!o)return null;
  if(o.kind==="galaxy")return o.id;
  if(o.kind==="star")return o.galaxyId||null;
  if(isBodyKind(o.kind)||o.kind==="scan"||o.kind==="cluster"){
    const star=o.starId?state.objects.find(x=>x.kind==="star"&&x.id===o.starId):null;
    return star?.galaxyId||null;
  }
  return null;
}
function filterMatch(o){
  const fType=$("#filterPlanetType")?.value||"all",fRes=$("#filterResource")?.value||"all",fMob=$("#filterMob")?.value||"all",fav=$("#filterFavorite")?.checked||false;
  const bodyNameQuery=($("#filterBodyName")?.value||"").trim().toLocaleLowerCase("ru-RU");
  const galaxyQuery=($("#filterGalaxyName")?.value||"").trim().toLocaleLowerCase("ru-RU");
  const sizeOp=$("#filterSizeOp")?.value||"";const sizeValue=Number($("#filterSize")?.value);
  if(fav&&!o.favorite)return false;
  if(fType!=="all"&&(o.kind!=="planet"&&o.kind!=="moon"))return false;
  if(fType!=="all"&&o.planetType!==fType)return false;
  if(fRes!=="all"&&!(o.resources||[]).includes(fRes))return false;
  if(fMob!=="all"&&!getLife(o).some(x=>x.mob===fMob))return false;
  if(fav&&!(["star","planet","moon","asteroid"].includes(o.kind)))return false;
  if(bodyNameQuery&&!(o.name||"").toLocaleLowerCase("ru-RU").includes(bodyNameQuery))return false;
  if(sizeOp&&String($("#filterSize")?.value||"").trim()!==""&&Number.isFinite(sizeValue)&&isBodyKind(o.kind)){
    const size=Number(o.size);if(!Number.isFinite(size))return false;
    if(sizeOp==="gt"&&!(size>sizeValue))return false;
    if(sizeOp==="lt"&&!(size<sizeValue))return false;
  }else if(sizeOp&&String($("#filterSize")?.value||"").trim()!==""&&Number.isFinite(sizeValue)&&!isBodyKind(o.kind))return false;
  if(galaxyQuery){
    const gid=objectGalaxyId(o),galaxy=gid?state.objects.find(x=>x.kind==="galaxy"&&x.id===gid):null;
    const name=(galaxy?.name||"").toLocaleLowerCase("ru-RU");if(!name.includes(galaxyQuery))return false;
  }
  return true;
}
function renderFilters(){
  const pt=$("#filterPlanetType"),rs=$("#filterResource"),results=$("#filterResults");if(!pt||!rs||!results)return;
  const pNow=pt.value,rNow=rs.value,mNow=$("#filterMob")?.value||"all",bodyNameQuery=$("#filterBodyName")?.value||"",galaxyQuery=$("#filterGalaxyName")?.value||"",sizeOp=$("#filterSizeOp")?.value||"",sizeValue=$("#filterSize")?.value||"";
  pt.innerHTML=`<option value="all">${esc(t("Все типы планет"))}</option>`+state.planetTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");pt.value=state.planetTypes.includes(pNow)?pNow:"all";
  rs.innerHTML=`<option value="all">${esc(t("Все ресурсы"))}</option>`+state.resourceTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");rs.value=state.resourceTypes.includes(rNow)?rNow:"all";
  if($("#filterMob")){ $("#filterMob").innerHTML=`<option value="all">${esc(t("Все мобы"))}</option>`+state.mobTypes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""); $("#filterMob").value=state.mobTypes.includes(mNow)?mNow:"all"; }
  if($("#filterSizeOp"))$("#filterSizeOp").value=sizeOp;if($("#filterSize"))$("#filterSize").value=sizeValue;
  const active=pt.value!=="all"||rs.value!=="all"||($("#filterMob")?.value||"all")!=="all"||$("#filterFavorite").checked||!!bodyNameQuery.trim()||!!galaxyQuery.trim()||(sizeOp&&String(sizeValue).trim()!==""),pool=state.objects.filter(o=>["galaxy","star","planet","moon","asteroid"].includes(o.kind)),matches=pool.filter(filterMatch);
  if(!active){results.innerHTML='<div class="muted">Выбери название тела, галактику, тип планеты, ресурс, моба, размер или «Только избранное».</div>';return}
  if(!matches.length){results.innerHTML='<div class="muted">Ничего не найдено.</div>';return}
  results.innerHTML=matches.map(o=>{
    const gid=objectGalaxyId(o),g=gid?state.objects.find(x=>x.kind==="galaxy"&&x.id===gid):null;
    const galaxyMeta=g?` · ${esc(displayObjectName(g))}`:"";
    const sizeMeta=isBodyKind(o.kind)&&o.size?` · ${esc(o.size)}`:"";
    return `<div class="filterResult" data-result="${o.id}"><div class="filterResultName">${importedLabel(o)}${o.favorite?' <span class="favStar">★</span>':''}</div><div class="filterResultMeta">${hideCoords(o)?"Координаты скрыты":`X ${o.x}, Y ${o.y}`}${o.kind==="star"?"":o.planetType?` · ${esc(o.planetType)}`:""}${sizeMeta}${galaxyMeta}</div></div>`;
  }).join("");
  results.querySelectorAll("[data-result]").forEach(el=>el.onclick=()=>{const o=state.objects.find(x=>x.id===el.dataset.result);if(o)jumpByCoordinate(o)});
}

function refreshTypeLists(){
  const root=$("#planetTypes");if(root){root.innerHTML=state.planetTypes.map((x,i)=>`<span class="tag"><span>${esc(localizedBuiltIn(x))}</span><button class="tagDelete" data-index="${i}" title="Удалить тип" type="button">×</button></span>`).join("")||'<div class="muted">Типов пока нет.</div>';root.querySelectorAll(".tagDelete").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.index),removed=state.planetTypes[i];if(removed===undefined)return;checkpoint();state.planetTypes.splice(i,1);for(const o of state.objects)if(isBodyKind(o.kind)&&o.planetType===removed)o.planetType="";save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();if(selected)show(selected);toast(`Тип планеты удалён: ${removed}`)})}
  const rr=$("#resourceTypes");if(rr){rr.innerHTML=state.resourceTypes.map((x,i)=>`<span class="tag"><span>${esc(localizedBuiltIn(x))}</span><button class="tagDelete resourceDelete" data-index="${i}" title="Удалить ресурс" type="button">×</button></span>`).join("")||'<div class="muted">Ресурсов пока нет.</div>';rr.querySelectorAll(".resourceDelete").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.index),removed=state.resourceTypes[i];if(removed===undefined)return;checkpoint();state.resourceTypes.splice(i,1);for(const o of state.objects)if(Array.isArray(o.resources))o.resources=o.resources.filter(x=>x!==removed);save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();if(selected)show(selected);toast(`Ресурс удалён: ${removed}`)})}
  const mt=$("#mobTypes");if(mt){mt.innerHTML=state.mobTypes.map((x,i)=>`<span class="tag"><span>${isPrivacyStrict()?"моб (засекречено)":esc(x)}</span><button class="tagDelete mobDelete" data-index="${i}" title="Удалить моба" type="button">×</button></span>`).join("")||'<div class="muted">Мобов пока нет.</div>';mt.querySelectorAll(".mobDelete").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.index),removed=state.mobTypes[i];if(removed===undefined)return;checkpoint();state.mobTypes.splice(i,1);for(const o of state.objects)if(Array.isArray(o.life))o.life=o.life.filter(x=>x.mob!==removed);save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();if(selected)show(selected);toast(`Моб удалён: ${removed}`)})}
}

function refreshMigrationControls(){
  const pf=$("#convertPlanetFrom"),pt=$("#convertPlanetTo"),rf=$("#convertResourceFrom"),rt=$("#convertResourceTo");if(!pf||!pt||!rf||!rt)return;
  const vals=[pf.value,pt.value,rf.value,rt.value];
  pf.innerHTML=state.planetTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");pt.innerHTML=state.planetTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");rf.innerHTML=state.resourceTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");rt.innerHTML=state.resourceTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("");
  if(state.planetTypes.includes(vals[0]))pf.value=vals[0];if(state.planetTypes.includes(vals[1])&&vals[1]!==pf.value)pt.value=vals[1];else if(state.planetTypes.length>1)pt.value=state.planetTypes.find(x=>x!==pf.value)||state.planetTypes[0];
  if(state.resourceTypes.includes(vals[2]))rf.value=vals[2];if(state.resourceTypes.includes(vals[3])&&vals[3]!==rf.value)rt.value=vals[3];else if(state.resourceTypes.length>1)rt.value=state.resourceTypes.find(x=>x!==rf.value)||state.resourceTypes[0];
  const mob=$("#convertResourceToMobFrom"),mobTo=$("#convertResourceToMobTo");
  if(mob){const cur=mob.value;mob.innerHTML=state.resourceTypes.map(x=>`<option value="${esc(x)}">${esc(localizedBuiltIn(x))}</option>`).join("")||"<option value=\"\">Нет ресурсов</option>";if(state.resourceTypes.includes(cur))mob.value=cur}
  if(mobTo){const cur=mobTo.value;mobTo.innerHTML=state.mobTypes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")||"<option value=\"\">Нет мобов</option>";if(state.mobTypes.includes(cur))mobTo.value=cur}
  const g=$("#massVerifyGalaxy"),st=$("#massVerifyStar"),a=$("#rebindFromStar"),b=$("#rebindToStar");
  const gs=state.objects.filter(o=>o.kind==="galaxy"),stars=state.objects.filter(o=>o.kind==="star");
  if(g){const cur=g.value;g.innerHTML='<option value="">— выбери галактику —</option>'+gs.map(x=>`<option value="${x.id}">${esc(displayObjectName(x))}</option>`).join("");if(gs.some(x=>x.id===cur))g.value=cur}
  if(st){const cur=st.value;st.innerHTML='<option value="">— выбери звезду —</option>'+stars.map(x=>`<option value="${x.id}">${esc(displayObjectName(x))}</option>`).join("");if(stars.some(x=>x.id===cur))st.value=cur}
  if(a){const cur=a.value;a.innerHTML='<option value="">— исходная звезда —</option>'+stars.map(x=>`<option value="${x.id}">${esc(displayObjectName(x))}</option>`).join("");if(stars.some(x=>x.id===cur))a.value=cur}
  if(b){const cur=b.value;b.innerHTML='<option value="">— целевая звезда —</option>'+stars.map(x=>`<option value="${x.id}">${esc(displayObjectName(x))}</option>`).join("");if(stars.some(x=>x.id===cur))b.value=cur}
}
function convertPlanetType(){const from=$("#convertPlanetFrom").value,to=$("#convertPlanetTo").value;if(!from||!to||from===to){toast("Выбери разные типы планет.");return}checkpoint();let n=0;for(const o of state.objects)if((o.kind==="planet"||o.kind==="moon")&&o.planetType===from){o.planetType=to;n++}save();if(selected)show(selected);render();toast(`Конвертировано: ${n}. «${from}» → «${to}».`)}
function convertResource(){const from=$("#convertResourceFrom").value,to=$("#convertResourceTo").value;if(!from||!to||from===to){toast("Выбери разные ресурсы.");return}checkpoint();let n=0;for(const o of state.objects)if(Array.isArray(o.resources)&&o.resources.includes(from)){o.resources=[...new Set(o.resources.map(r=>r===from?to:r))];n++}save();if(selected)show(selected);render();toast(`Обновлено тел: ${n}. «${from}» → «${to}».`)}
function convertResourceToMob(){
  const from=$("#convertResourceToMobFrom")?.value,to=$("#convertResourceToMobTo")?.value;
  if(!from||!to||from===to){toast("Выбери ресурс-источник и существующий тип моба.");return}
  if(!state.mobTypes.includes(to)){toast("Тип моба не найден.");return}
  checkpoint();let n=0;
  for(const o of state.objects)if(isBodyKind(o.kind)&&Array.isArray(o.resources)&&o.resources.includes(from)){o.resources=o.resources.filter(r=>r!==from);o.life=uniqLife([...(o.life||[]),{mob:to,aggressive:false}]);n++}
  state.resourceTypes=state.resourceTypes.filter(r=>r!==from);
  save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();if(selected)show(selected);render();toast(`Ресурс «${from}» преобразован в моба «${to}». Затронуто тел: ${n}.`);
}
function massClearImported(scope,id){if(!id){toast("Выбери объект.");return}checkpoint();let n=0;for(const o of state.objects){const match=scope==="star"?(o.id===id||o.starId===id||(o.kind==="marker"&&o.markerLayer==="system"&&o.starId===id)):(o.id===id||objectGalaxyId(o)===id);if(match&&o.imported){o.imported=false;delete o.importedAt;n++}}save();render();if(selected)show(selected);toast(`Снято отметок (!): ${n}`)}
function mergeStarSystem(){
  const from=selected?.kind==="star"?selected.id:starId,to=$("#rebindToStar")?.value;
  if(!from||!to||from===to){toast("Выбери целевую звезду.");return}
  const source=state.objects.find(o=>o.kind==="star"&&o.id===from),target=state.objects.find(o=>o.kind==="star"&&o.id===to);
  if(!source||!target){toast("Звезда не найдена.");return}
  if(!confirm(`Перенести всю систему «${displayObjectName(source)}» к звезде «${displayObjectName(target)}» и удалить исходную звезду?`))return;
  checkpoint();
  const moving=state.objects.filter(o=>o.id!==source.id&&isSystemObject(o,source.id));
  state.objects=state.objects.filter(o=>o.id!==source.id&&!moving.some(m=>m.id===o.id));
  const idMap=new Map(),ids=new Set(state.objects.map(o=>o.id));
  const order={cluster:1,planet:2,asteroid:3,moon:4,scan:5,marker:6};
  for(const src of [...moving].sort((a,b)=>(order[a.kind]||99)-(order[b.kind]||99))){
    const o={...src};o.starId=target.id;
    if(o.clusterId&&idMap.has(o.clusterId))o.clusterId=idMap.get(o.clusterId);
    if(o.parentPlanetId&&idMap.has(o.parentPlanetId))o.parentPlanetId=idMap.get(o.parentPlanetId);
    if(o.kind==="cluster"){
      const dup=state.objects.find(x=>x.kind==="cluster"&&x.starId===target.id&&Math.round(x.x)===Math.round(o.x)&&Math.round(x.y)===Math.round(o.y));
      if(dup){idMap.set(src.id,dup.id);continue}
    }
    if(isBodyKind(o.kind)||o.kind==="scan"){
      const dup=findDuplicate(o);if(dup){idMap.set(src.id,dup.id);continue}
    }
    if(o.kind==="marker")o.markerLayer="system";
    if(ids.has(o.id))o.id=uid();ids.add(o.id);idMap.set(src.id,o.id);state.objects.push(o);
  }
  ensureGalaxies();ensureDeepClusters();
  selected=target;starId=target.id;clusterId=null;layer="stars";recenterObject(target);save();refreshMigrationControls();show(target);render();toast("Система перепривязана. Исходная звезда удалена.");
}

function setLayer(next){
  layer=next;if(layer==="clusters"){starId=null;clusterId=null}else if(layer==="stars"){clusterId=null}else if(layer==="deep"){clusterId=null}else if(layer==="middle"&&!starId){layer="clusters";toast("Сначала выбери звезду.")}
  selected=null;rulerPoints=[];show(null);refreshObjectTypes();render();
}

function updateMapTooltip(p){
  const tip=$("#mapTooltip");if(!tip)return;
  if(adding){tip.classList.remove("show");tip.setAttribute("aria-hidden","true");return}
  const o=hit(p);
  if(!o||o.kind==="scan"){tip.classList.remove("show");tip.setAttribute("aria-hidden","true");return}
  tip.textContent=displayObjectName(o);
  tip.style.left=Math.min(p.x+14,Math.max(8,size().w-268))+"px";
  tip.style.top=Math.min(p.y+14,Math.max(8,size().h-32))+"px";
  tip.classList.add("show");tip.setAttribute("aria-hidden","false");
}
canvas.addEventListener("mousemove",e=>{const p=point(e);updateMouseCoords(p.x,p.y);updateMapTooltip(p);if(adding){const cross=$("#crosshair");cross.style.left=p.x+"px";cross.style.top=p.y+"px"}});
canvas.addEventListener("mouseleave",()=>{$("#mouseCoords").textContent="X —, Y —";const tip=$("#mapTooltip");if(tip){tip.classList.remove("show");tip.setAttribute("aria-hidden","true")}});
canvas.addEventListener("mousedown",e=>{if(adding)return;const p=point(e);drag={x:p.x,y:p.y,vx:view.x,vy:view.y};canvas.classList.add("dragging")});
window.addEventListener("mousemove",e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top};view.x=drag.vx+p.x-drag.x;view.y=drag.vy+p.y-drag.y;render();updateMouseCoords(p.x,p.y)});
window.addEventListener("mouseup",()=>{drag=null;canvas.classList.remove("dragging")});
canvas.addEventListener("click",e=>{
  const p=point(e),c=worldFromScreen(p.x,p.y);
  if(rulerMode){
    const o=hit(p);
    rulerPoints.push({x:o?o.x:Math.round(c.x),y:o?o.y:Math.round(c.y),objectId:o?.id||null});
    if(rulerPoints.length>2)rulerPoints=[rulerPoints[1]];
    render();return;
  }
  if(adding){const o=addObject($("#objectType").value,Math.round(c.x),Math.round(c.y),$("#objectName").value);if(o){adding=false;$("#clickModeBtn").textContent="＋ Режим добавления кликом";$("#mapPanel").classList.remove("adding");$("#crosshair").style.display="none"}return}
  const o=hit(p);if(!o)return;
  navigateFromMap(o);
  const tip=$("#mapTooltip");if(tip){tip.classList.remove("show");tip.setAttribute("aria-hidden","true")}
});
function hit(p){
  const items=visible().slice().reverse();
  return items.find(o=>{const q=screenFromWorld(o.x,o.y),d=Math.hypot(q.x-p.x,q.y-p.y);if(o.kind!=="scan")return d<=11;const r=scanRadius()*view.scale;return d<=11||Math.abs(d-r)<=8});
}
function updateMouseCoords(sx,sy){if(isPrivacyStrict()){$("#mouseCoords").textContent="Координаты скрыты";return}const c=worldFromScreen(sx,sy);$("#mouseCoords").textContent=`X ${fmt(c.x)}, Y ${fmt(c.y)}`}
canvas.addEventListener("wheel",e=>{e.preventDefault();const p=point(e),{w,h}=size(),before=worldFromScreen(p.x,p.y),factor=Math.exp(-e.deltaY*.001),newScale=Math.max(.005,Math.min(100,view.scale*factor));view.scale=newScale;view.x=p.x-w/2-before.x*newScale;view.y=p.y-h/2+before.y*newScale;render();updateMouseCoords(p.x,p.y)},{passive:false});

$("#rulerBtn")?.addEventListener("click",()=>{rulerMode=!rulerMode;if(rulerMode){if(adding){adding=false;$("#clickModeBtn").textContent="＋ Режим добавления кликом";$("#mapPanel").classList.remove("adding");$("#crosshair").style.display="none"}rulerPoints=[];$("#rulerBtn").textContent=t("✕ Выключить линейку");toast("Линейка: кликни две произвольные точки или два объекта.")}else{$("#rulerBtn").textContent=t("📏 Линейка");rulerPoints=[];render()}});
$("#rulerClearBtn")?.addEventListener("click",()=>{rulerPoints=[];render();toast("Измерение сброшено.")});
$("#objectType").addEventListener("change",refreshCreationFields);
$("#addCoordsBtn").addEventListener("click",()=>addObject($("#objectType").value,$("#coordX").value,$("#coordY").value,$("#objectName").value));
$("#clickModeBtn").addEventListener("click",()=>{adding=!adding;$("#clickModeBtn").textContent=adding?"✕ Отмена добавления":"＋ Режим добавления кликом";$("#mapPanel").classList.toggle("adding",adding);$("#crosshair").style.display=adding?"block":"none";toast(adding?"Кликни в нужной точке карты":"Режим добавления отменён")});
document.querySelectorAll(".layers button").forEach(b=>b.addEventListener("click",()=>setLayer(b.dataset.layer)));
$("#fitObjectsBtn")?.addEventListener("click",fitCurrentContext);
window.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="f"&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&document.activeElement?.tagName!=="INPUT"&&document.activeElement?.tagName!=="SELECT"&&document.activeElement?.tagName!=="TEXTAREA"){e.preventDefault();fitCurrentContext()}});
function addDictionaryValue(inputId,arr,after,msg){const v=$(inputId).value.trim();if(!v){toast("Введите название.");return}if(arr.includes(v)){toast("Такое значение уже существует.");return}arr.push(v);$(inputId).value="";save();after();toast(msg+v)}
$("#addPlanetType").addEventListener("click",()=>addDictionaryValue("#newPlanetType",state.planetTypes,()=>{refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();render()},"Тип планеты добавлен: "));
$("#addResource").addEventListener("click",()=>addDictionaryValue("#newResource",state.resourceTypes,()=>{refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();render()},"Ресурс добавлен: "));
$("#addMob").addEventListener("click",()=>{
  const input=$("#newMob"),v=input.value.trim().replace(/\s+/g," ");
  if(!v){toast("Введите название.");return}
  if(state.mobTypes.some(x=>mobKey(x)===mobKey(v))){toast("Такой тип моба уже существует.");return}
  checkpoint();state.mobTypes.push(v);input.value="";save();refreshTypeLists();refreshMigrationControls();renderFilters();if(selected)show(selected);render();toast("Моб добавлен: "+v);
});
$("#resetCreateBtn").addEventListener("click",()=>{resetCreateFields();toast("Поля нового объекта сброшены.")});
$("#newPlanetType").addEventListener("keydown",e=>{if(e.key==="Enter")$("#addPlanetType").click()});
$("#newResource").addEventListener("keydown",e=>{if(e.key==="Enter")$("#addResource").click()});$("#newMob").addEventListener("keydown",e=>{if(e.key==="Enter")$("#addMob").click()});
$("#filterBodyName").addEventListener("input",renderFilters);$("#filterGalaxyName").addEventListener("input",renderFilters);$("#filterPlanetType").addEventListener("change",renderFilters);$("#filterResource").addEventListener("change",renderFilters);$("#filterMob").addEventListener("change",renderFilters);$("#filterFavorite").addEventListener("change",renderFilters);$("#filterSizeOp").addEventListener("change",renderFilters);$("#filterSize").addEventListener("input",renderFilters);
$("#clearFilters").addEventListener("click",()=>{$("#filterBodyName").value="";$("#filterGalaxyName").value="";$("#filterPlanetType").value="all";$("#filterResource").value="all";$("#filterMob").value="all";$("#filterSizeOp").value="";$("#filterSize").value="";$("#filterFavorite").checked=false;renderFilters()});
$("#convertPlanetBtn").addEventListener("click",convertPlanetType);$("#convertResourceBtn").addEventListener("click",convertResource);$("#convertResourceToMobBtn").addEventListener("click",convertResourceToMob);$("#massVerifyGalaxyBtn").addEventListener("click",()=>massClearImported("galaxy",$("#massVerifyGalaxy").value));$("#massVerifyStarBtn").addEventListener("click",()=>massClearImported("star",$("#massVerifyStar").value));

function patchItems(note){return state.settings.language==="en"?(PATCH_NOTES_EN[note.version]||note.itemsEn||note.items):note.items}
function renderPatchNotes(){
  const root=$("#patchNotesList");if(!root)return;
  if(!PATCH_NOTES.length){root.innerHTML=`<div class="muted">${esc(t("Патчноуты пока недоступны."))}</div>`;return;}
  root.innerHTML=PATCH_NOTES.map(note=>`<section class="patchNote"><h3>${state.settings.language==="en"?"Version":"Версия"} ${esc(note.version)}${note.date?` <span>${esc(note.date)}</span>`:""}</h3><ul>${patchItems(note).map(item=>`<li>${esc(item)}</li>`).join("")}</ul></section>`).join("");
}
function setupPatchNotes(){
  const modal=$("#patchNotesModal"),openBtn=$("#patchNotesBtn"),closeBtn=$("#patchNotesCloseBtn");
  if(!modal||!openBtn||!closeBtn||modal.dataset.logicBound==="1")return;
  modal.dataset.logicBound="1";
  const open=async()=>{modal.classList.add("open");modal.setAttribute("aria-hidden","false");const ok=await loadPatchNotes();if(!ok){PATCH_NOTES=[];PATCH_NOTES_EN={};rootPatchUnavailable=true;}renderPatchNotes();applyLanguage()};
  const close=()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true")};
  openBtn.addEventListener("click",open);closeBtn.addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close()});
}
let rootPatchUnavailable=false;
setupPatchNotes();
applyLanguage();


function setupSettings(){
  ensureSettings();
  const starRadiusInput=$("#starRadiusSetting"),scanRadiusInput=$("#scanRadiusSetting"),scanSelect=$("#scanDisplayMode"),importSelect=$("#importDisplayMode"),exportFavSelect=$("#exportFavoritesMode"),privacySelect=$("#privacyMode");
  const languageSelect=$("#languageSetting");if(languageSelect)languageSelect.value=state.settings.language;
  if(!starRadiusInput||!scanRadiusInput||!scanSelect||!importSelect||!exportFavSelect)return;
  starRadiusInput.value=starRadius();scanRadiusInput.value=scanRadius();scanSelect.value=state.settings.scanDisplay;importSelect.value=state.settings.importDisplay;exportFavSelect.value=state.settings.exportFavorites;if(privacySelect)privacySelect.value=privacyMode();
  function applyRadius(input,key,kindLabelText){
    const value=Math.round(Number(input.value));if(!Number.isFinite(value)||value<1||value>1000000){input.value=state.settings[key];toast("Радиус должен быть от 1 до 1 000 000.");return}
    if(value===state.settings[key])return;checkpoint();state.settings[key]=value;if(key==="scanRadius")for(const o of state.objects)if(o.kind==="scan")o.radius=value;save();show(selected);render();toast(`${kindLabelText}: ${value.toLocaleString("ru-RU")}`)
  }
  starRadiusInput.onchange=()=>applyRadius(starRadiusInput,"starRadius","Радиус звезды изменён на");
  scanRadiusInput.onchange=()=>applyRadius(scanRadiusInput,"scanRadius","Радиус скана изменён на");
  scanSelect.onchange=()=>{checkpoint();state.settings.scanDisplay=scanSelect.value;save();render()};
  importSelect.onchange=()=>{checkpoint();state.settings.importDisplay=importSelect.value;save();render()};
  exportFavSelect.onchange=()=>{checkpoint();state.settings.exportFavorites=exportFavSelect.value;save();toast(exportFavSelect.value==="hide"?"Избранное будет скрыто при экспорте.":"Избранное будет передаваться при экспорте.")};
  privacySelect?.addEventListener("change",()=>{checkpoint();state.settings.privacyMode=privacySelect.value;save();show(selected);render();toast(privacySelect.value==="none"?"Обычный режим отображения.":"Режим публикации включён: данные маскируются только в интерфейсе.")});
  languageSelect?.addEventListener("change",()=>{if(languageSelect.value===state.settings.language)return;checkpoint();state.settings.language=languageSelect.value;save();refreshTypeLists();refreshCreationFields();refreshMigrationControls();renderFilters();render();applyLanguage();renderPatchNotes();if(languageSelect)languageSelect.value=state.settings.language;});
  const modal=$("#settingsModal"),open=()=>{modal.classList.add("open");modal.setAttribute("aria-hidden","false")},close=()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true")};
  if(modal?.dataset.logicBound==="1"){return}
  modal?.setAttribute("data-logic-bound","1");
  $("#settingsBtn")?.addEventListener("click",open);$("#settingsCloseBtn")?.addEventListener("click",close);modal?.addEventListener("click",e=>{if(e.target===modal)close()});window.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal?.classList.contains("open"))close()});
}

try{setupSettings()}catch(e){}

function setupCollapsible(toggleId,bodyId,iconId){
  const toggle=$("#"+toggleId),body=$("#"+bodyId),icon=$("#"+iconId);
  if(!toggle||!body||!icon)return;
  toggle.addEventListener("click",()=>{
    const hidden=body.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded",String(!hidden));
    icon.textContent=hidden?"+":"−";
  });
}
$("#createToggle").addEventListener("click",()=>{const body=$("#createBody"),hidden=body.classList.toggle("collapsed");$("#createToggle").setAttribute("aria-expanded",String(!hidden));$("#createToggleIcon").textContent=hidden?"+":"−"});
setupCollapsible("selectedStarToggle","selectedStarBody","selectedStarToggleIcon");
setupCollapsible("detailsToggle","detailsBody","detailsToggleIcon");
setupCollapsible("systemBodiesToggle","systemBodiesBody","systemBodiesToggleIcon");
setupCollapsible("markersToggle","markersBody","markersToggleIcon");
setupCollapsible("scansToggle","scansBody","scansToggleIcon");
setupCollapsible("bodiesToggle","bodiesBody","bodiesToggleIcon");
setupCollapsible("filtersToggle","filtersBody","filtersToggleIcon");
setupCollapsible("typesToggle","typesBody","typesToggleIcon");
setupCollapsible("migrationToggle","migrationBody","migrationToggleIcon");

function exportObjects(){
  if(state.settings.exportFavorites!=="hide")return state.objects;
  const hidden=new Set();
  const byId=id=>state.objects.find(o=>o.id===id);
  const addStarSecret=star=>{
    hidden.add(star.id);
    for(const o of state.objects)if(o.starId===star.id)hidden.add(o.id);
  };
  for(const o of state.objects){
    if(!o.favorite)continue;
    if(o.kind==="star")addStarSecret(o);
    else hidden.add(o.id);
  }
  let changed=true;
  while(changed){
    changed=false;
    for(const o of state.objects){
      if(hidden.has(o.id))continue;
      if(((o.kind==="moon"||o.kind==="asteroid")&&o.parentPlanetId&&hidden.has(o.parentPlanetId)) ||
         (isBodyKind(o.kind)&&o.clusterId&&hidden.has(o.clusterId))){hidden.add(o.id);changed=true}
    }
  }
  return state.objects.filter(o=>!hidden.has(o.id));
}
function shareObjectsFor(root){
  if(!root)return[];
  const ids=new Set([root.id]);
  const add=(o)=>{if(o&&o.id)ids.add(o.id)};
  let parent=root;
  for(let guard=0;guard<8;guard++){
    if(parent.kind==="moon"||parent.kind==="asteroid"){parent=state.objects.find(x=>x.id===parent.parentPlanetId);add(parent);continue}
    if(parent.kind==="planet"){parent=state.objects.find(x=>x.id===parent.clusterId);add(parent);continue}
    if(parent.kind==="cluster"){parent=state.objects.find(x=>x.id===parent.starId);add(parent);continue}
    if(parent.kind==="star"){if(root.kind==="star"||root.kind==="galaxy"){parent=state.objects.find(x=>x.id===parent.galaxyId);add(parent);continue}break}
    break;
  }
  const rootContext=[...ids];
  let changed=true;while(changed){changed=false;
    for(const o of state.objects){
      if(ids.has(o.id))continue;
      if(root.kind==="galaxy"&&((o.kind==="star"&&o.galaxyId===root.id)||(o.starId&&rootContext.some(id=>state.objects.find(x=>x.id===id)?.kind==="star"&&id===o.starId)))){ids.add(o.id);changed=true;continue}
      if(root.kind==="star"&&(o.starId===root.id||(o.kind==="marker"&&o.markerLayer==="system"&&o.starId===root.id))){ids.add(o.id);changed=true;continue}
      if(root.kind==="cluster"&&(o.clusterId===root.id||o.parentPlanetId&&ids.has(o.parentPlanetId))){ids.add(o.id);changed=true;continue}
      if(isBodyKind(root.kind)&&o.parentPlanetId===root.id){ids.add(o.id);changed=true}
    }
  }
  return state.objects.filter(o=>ids.has(o.id));
}
function bytesToBase64(bytes){let bin="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function base64ToBytes(str){const b64=str.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-str.length%4)%4),bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function makeShareCode(o){const objects=shareObjectsFor(o);const payload={kind:"SIGMA_SHARE",version:1,sourceKind:o.kind,planetTypes:state.planetTypes.filter(x=>objects.some(q=>q.planetType===x)),resourceTypes:state.resourceTypes.filter(x=>objects.some(q=>(q.resources||[]).includes(x))),mobTypes:state.mobTypes.filter(x=>objects.some(q=>normalizeLifeValue(q.life).some(l=>l.mob===x)||Array.isArray(q.mobs)&&q.mobs.includes(x))),objects};return `SIGMA1.${bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)))}`}

function decodeShareCode(code){const raw=String(code||"").trim();if(!raw.startsWith("SIGMA1."))throw new Error("Это не код SigmaSpace.");return JSON.parse(new TextDecoder().decode(base64ToBytes(raw.slice(7))))}
async function copyShareCode(o){try{const code=makeShareCode(o);await navigator.clipboard.writeText(code);toast(`Код скопирован: ${code.length.toLocaleString("ru-RU")} символов.`)}catch(e){const ta=document.createElement("textarea");ta.value=makeShareCode(o);document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();toast("Код скопирован в буфер обмена.")}}
function pasteShareCode(){const code=prompt("Вставь код SigmaSpace:");if(!code)return;try{const inc=decodeShareCode(code);checkpoint();const incomingObjects=Array.isArray(inc.objects)?inc.objects:[],oldHp=uniqStrings(inc.lifeHpTypes||[]),hpToMob=new Map(oldHp.map(h=>[h,`Мобы ${h}`]));for(const t of uniqStrings(inc.planetTypes||[]))if(!state.planetTypes.includes(t))state.planetTypes.push(t);for(const r of uniqStrings(inc.resourceTypes||[]))if(!state.resourceTypes.includes(r))state.resourceTypes.push(r);for(const m of uniqStrings(inc.mobTypes||[]))if(!state.mobTypes.some(x=>mobKey(x)===mobKey(m)))state.mobTypes.push(m);for(const o of incomingObjects)if(isBodyKind(o.kind)){o.life=uniqLife(normalizeLifeValue(o.life).map(x=>({mob:hpToMob.get(x.mob)||x.mob,aggressive:x.aggressive})).concat(Array.isArray(o.mobs)?o.mobs.map(m=>({mob:String(m),aggressive:false})):[]));delete o.mobs}const res=importObjects(inc);normalizeScanNumbers();ensureGalaxies();ensureDeepClusters();save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();render();toast(`Код импортирован: добавлено ${res.addedCount}, дубликатов пропущено ${res.dup}.`)}catch(e){toast("Ошибка кода: "+e.message)}}

$("#pasteShareBtn")?.addEventListener("click",pasteShareCode);
$("#exportBtn").addEventListener("click",()=>{
  const objects=exportObjects();
  const payload={format:"STAR_MAP",version:12,dataVersion:DATA_VERSION,exportedAt:new Date().toISOString(),planetTypes:[...state.planetTypes],resourceTypes:[...state.resourceTypes],mobTypes:[...state.mobTypes],settings:{...state.settings},objects};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download="SigmaSpace.starmap";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(`Экспорт: передано объектов ${objects.length} из ${state.objects.length}.`);
});
function importObjects(inc){
  const incoming=Array.isArray(inc.objects)?inc.objects:[],ids=new Set(state.objects.map(o=>o.id)),idMap=new Map();let addedCount=0,dup=0;
  const order={galaxy:1,star:2,cluster:3,planet:4,asteroid:5,moon:6,scan:7,marker:8};
  for(const src of [...incoming].sort((a,b)=>(order[a.kind]||99)-(order[b.kind]||99))){
    let o={...src,imported:true,importedAt:new Date().toISOString(),manualBinding:!!src.manualBinding,galaxyManualBinding:!!src.galaxyManualBinding};
    if(o.kind==="star"&&o.galaxyId)o.galaxyManualBinding=true;
    if(o.galaxyId&&idMap.has(o.galaxyId))o.galaxyId=idMap.get(o.galaxyId);if(o.starId&&idMap.has(o.starId))o.starId=idMap.get(o.starId);if(o.clusterId&&idMap.has(o.clusterId))o.clusterId=idMap.get(o.clusterId);if(o.parentPlanetId&&idMap.has(o.parentPlanetId))o.parentPlanetId=idMap.get(o.parentPlanetId);
    if(o.kind==="star"&&o.galaxyId&&!state.objects.some(x=>x.kind==="galaxy"&&x.id===o.galaxyId)&&!idMap.has(src.galaxyId)){o.galaxyId=null;o.galaxyManualBinding=false}
    if(isBodyKind(o.kind)){o.resources=uniqStrings(o.resources);if(o.size)o.size=roundSizeUp8(o.size);o.life=uniqLife(normalizeLifeValue(o.life).concat(Array.isArray(o.mobs)?o.mobs.map(m=>({mob:m,aggressive:false})):[]));delete o.mobs;if(!o.life.length)delete o.life;}
    if(o.kind==="scan"){o.name="";o.radius=scanRadius();}
    if(o.kind==="marker"&&!o.markerLayer)o.markerLayer=o.starId?"system":"clusters";
    const sameId=state.objects.find(x=>x.id===o.id),sameObject=findDuplicate(o);if(sameObject){idMap.set(src.id,sameObject.id);dup++;continue}
    if(sameId||!o.id||ids.has(o.id))o.id=uid();ids.add(o.id);idMap.set(src.id,o.id);state.objects.push(o);addedCount++;
  }
  return{addedCount,dup};
}
$("#importInput").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const inc=JSON.parse(await f.text()),incomingObjects=Array.isArray(inc.objects)?inc.objects:[];
    checkpoint();
    const incomingPlanetTypes=uniqStrings([...(inc.planetTypes||[]),...incomingObjects.filter(o=>o.kind==="planet"||o.kind==="moon").map(o=>o.planetType)]);
    const incomingResources=uniqStrings([...(inc.resourceTypes||[]),...incomingObjects.flatMap(o=>Array.isArray(o.resources)?o.resources:[])]);
    const oldHp=uniqStrings(inc.lifeHpTypes||[]),hpToMob=new Map(oldHp.map(h=>[h,`Мобы ${h}`]));
    const incomingMobs=uniqStrings([...(inc.mobTypes||[]),...incomingObjects.flatMap(o=>Array.isArray(o.mobs)?o.mobs:[]),...incomingObjects.flatMap(o=>normalizeLifeValue(o.life).map(x=>hpToMob.get(x.mob)||x.mob))]);
    for(const t of incomingPlanetTypes)if(!state.planetTypes.includes(t))state.planetTypes.push(t);for(const r of incomingResources)if(!state.resourceTypes.includes(r))state.resourceTypes.push(r);for(const m of incomingMobs)if(!state.mobTypes.some(x=>mobKey(x)===mobKey(m)))state.mobTypes.push(m);
    for(const o of incomingObjects)if(isBodyKind(o.kind)){o.life=uniqLife(normalizeLifeValue(o.life).map(x=>({mob:hpToMob.get(x.mob)||x.mob,aggressive:x.aggressive})).concat(Array.isArray(o.mobs)?o.mobs.map(m=>({mob:String(m),aggressive:false})):[]));delete o.mobs}
    const res=importObjects(inc);normalizeScanNumbers();ensureGalaxies();ensureDeepClusters();save();refreshTypeLists();refreshCreationFields();renderFilters();refreshMigrationControls();render();toast(`Импорт: добавлено ${res.addedCount}, дубликатов пропущено ${res.dup}. Новые тела помечены (!) — их можно вручную привязать к вашей структуре.`);
  }catch(err){toast("Ошибка импорта: "+err.message)}
  e.target.value="";
});
$("#undoBtn")?.addEventListener("click",undo);$("#redoBtn")?.addEventListener("click",redo);
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="z"){e.preventDefault();redo()}});
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!e.shiftKey){if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||""))return;e.preventDefault();undo()}});
$("#newBtn").addEventListener("click",()=>{
  const count=state.objects.length;
  const message=count?`Текущая карта содержит ${count} объектов.\n\nВсе несохранённые изменения и текущая карта будут заменены новой пустой картой.\n\nПродолжить?`:`Создать новую пустую карту?`;
  if(!confirm(message))return;
  checkpoint();state={objects:[],planetTypes:[...DEFAULT_PLANET_TYPES],resourceTypes:[...DEFAULT_RESOURCE_TYPES],mobTypes:[],settings:{scanDisplay:"radius",importDisplay:"show",exportFavorites:"show",privacyMode:"none",starRadius:DEFAULT_STAR_RADIUS,scanRadius:DEFAULT_SCAN_RADIUS,language:"ru"},meta:{dataVersion:DATA_VERSION,updatedAt:0}};layer="clusters";starId=null;clusterId=null;selected=null;view={x:0,y:0,scale:1};rulerMode=false;rulerPoints=[];save();refreshTypeLists();refreshCreationFields();refreshMigrationControls();show(null);render();
});

$("#backupNowBtn")?.addEventListener("click",async()=>{
  if(backupDirHandle){await performExternalBackup();toast("Резервная копия сохранена во внешнюю папку.");}
  else{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([backupText()],{type:"application/json"}));a.download="SigmaSpace-backup.starmap";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Резервная копия скачана.");}
});
$("#backupFolderBtn")?.addEventListener("click",selectBackupFolder);
window.addEventListener("resize",resize);
if(window.ResizeObserver){
  const ro=new ResizeObserver(()=>requestAnimationFrame(resize));
  ro.observe(document.querySelector(".mapPanel"));
}
let lastKnownDpr=devicePixelRatio||1;
setInterval(()=>{
  const d=devicePixelRatio||1;
  if(d!==lastKnownDpr){lastKnownDpr=d;resize()}
  $("#fps").textContent=Math.round(fps);
},500);function loop(t){const dt=t-last;last=t;if(dt>0)fps=1000/dt;requestAnimationFrame(loop)}
load();try{setupSettings()}catch(e){};ensureGalaxies();ensureDeepClusters();refreshTypeLists();refreshCreationFields();refreshMigrationControls();$("#mouseCoords").textContent="X —, Y —";updateDataVersionStatus();updateSaveStatus(state.meta?.updatedAt?`Сохранено ${new Date(state.meta.updatedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"—");updateBackupStatus("Не подключён");render();applyLanguage();updateHistoryButtons();restoreBackupDirectory();hydrateFromIndexedDB();requestAnimationFrame(loop);
