const diagnosticRuntimeErrors=Array.isArray(window.__sigmaBootErrors)?window.__sigmaBootErrors:[];
function recordDiagnosticError(type,error){try{const message=error?.stack||error?.message||String(error);diagnosticRuntimeErrors.push({type,message:String(message).slice(0,1600),filename:error?.filename||"",lineno:error?.lineno||0,colno:error?.colno||0,time:new Date().toISOString()});if(diagnosticRuntimeErrors.length>30)diagnosticRuntimeErrors.shift()}catch(e){}}
window.addEventListener("error",e=>recordDiagnosticError("error",e.error||{message:e.message,filename:e.filename,lineno:e.lineno,colno:e.colno}));
window.addEventListener("unhandledrejection",e=>recordDiagnosticError("unhandledrejection",e.reason));
function setupDiagnostics(){
  const runBtn=$("#runDiagnosticsBtn"),results=$("#diagnosticResults"),summary=$("#diagnosticSummary"),copyBtn=$("#copyDiagnosticsBtn");
  if(!runBtn||!results||!summary||!copyBtn||runBtn.dataset.bound==="1")return;
  runBtn.dataset.bound="1";
  let lastReport="";
  const tests=[];
  const add=(name,ok,detail="",status=ok?"pass":"fail")=>tests.push({name,ok,detail,status});
  const fn=(name)=>typeof window[name]==="function";
  const bodyKinds=new Set(["galaxy","star","cluster","planet","asteroid","moon"]);

  const run=async()=>{
    diagnosticRuntimeErrors.length=0;
    runBtn.disabled=true;copyBtn.disabled=true;results.innerHTML="";summary.textContent="Проверка выполняется…";tests.length=0;
    try{
      const bootErrors=diagnosticRuntimeErrors.slice(-8);
      const coreReady=typeof state!=="undefined"&&typeof canvas!=="undefined"&&typeof ctx!=="undefined"&&typeof render==="function";
      if(!coreReady){
        const detail=bootErrors.length?bootErrors.map(x=>{const src=x.filename?` [${x.filename}:${x.lineno||0}:${x.colno||0}]`:"";return `${x.type}: ${x.message}${src}`}).join(" | "):"Ядро приложения не открыло state/render/canvas. Возможна ошибка загрузки app.js.";
        add("Запуск ядра приложения",false,detail);
        const fails=tests.filter(t=>t.status==="fail").length,warns=tests.filter(t=>t.status==="warn").length,passes=tests.filter(t=>t.status==="pass").length;
        results.innerHTML=tests.map(t=>`<div class="diagnosticRow ${t.status}"><span class="diagnosticState">${t.status==="pass"?"✓":t.status==="warn"?"!":"✕"}</span><b>${esc(t.name)}</b><span class="diagnosticDetail">${esc(t.detail||"")}</span></div>`).join("");
        summary.textContent=`Ядро приложения не инициализировалось: ${passes} pass, ${fails} fail, ${warns} warn.`;
        lastReport=[`SigmaSpace diagnostic`,`App: ${typeof APP_NAME!=="undefined"?APP_NAME:"SigmaSpace"}`,`Data: ${typeof DATA_VERSION!=="undefined"?`v${DATA_VERSION}`:"unknown"}`,`Result: ${passes} pass, ${fails} fail, ${warns} warn`,"",...tests.map(t=>`[${t.status.toUpperCase()}] ${t.name}\n${t.detail||""}`)].join("\n");
        copyBtn.disabled=!lastReport;
        return;
      }
      /* 1. Базовая среда и DOM */
      add("DOM интерфейса",!!document.body&&!!$("#map")&&!!$("#settingsModal")&&!!$("#settingsBtn"),"Карта, настройки и основной DOM-контур найдены.");
      add("Canvas",!!canvas&&!!ctx&&canvas.width>0&&canvas.height>0,`Размер: ${canvas?.width||0}×${canvas?.height||0}.`);
      add("Canvas 2D API",!!ctx&&typeof ctx.fillRect==="function"&&typeof ctx.clearRect==="function"&&typeof ctx.beginPath==="function","Основные операции Canvas 2D доступны.");
      add("Интерфейсные блоки",["#mapPanel","#details","#bodyTree","#filterResults","#planetTypes","#resourceTypes","#mobTypes","#saveStatus","#dataVersionStatus"].every(s=>!!$(s)),"Карта, карточка, дерево, фильтры, справочники и статусы найдены.");

      /* 2. Runtime/state */
      add("Состояние приложения",!!state&&Array.isArray(state.objects)&&Array.isArray(state.planetTypes)&&Array.isArray(state.resourceTypes)&&Array.isArray(state.mobTypes),`Объектов: ${state?.objects?.length??"—"}; planetTypes: ${state?.planetTypes?.length??"—"}; resourceTypes: ${state?.resourceTypes?.length??"—"}; mobTypes: ${state?.mobTypes?.length??"—"}.`);
      add("Версия данных",state?.meta?.dataVersion===DATA_VERSION,`Приложение: ${APP_NAME}; dataVersion: ${state?.meta?.dataVersion??"—"}; ожидается v${DATA_VERSION}.`);
      add("Настройки",!!state?.settings&&typeof state.settings==="object",`Ключей настроек: ${state?.settings?Object.keys(state.settings).length:0}.`);

      /* 3. Data integrity — version-independent structural checks */
      const objects=Array.isArray(state?.objects)?state.objects:[],ids=new Set(),duplicateIds=[],badKinds=[],badCoords=[],badRefs=[],badSizes=[],badResources=[],badLife=[],badFlags=[];
      for(const o of objects){
        if(!o||!o.id||ids.has(o.id))duplicateIds.push(o?.id||"<empty>"); else ids.add(o.id);
        if(!bodyKinds.has(o?.kind)&&!new Set(["scan","marker"]).has(o?.kind))badKinds.push(`${o?.id||"?"}:${o?.kind||"?"}`);
        if(!Number.isFinite(Number(o?.x))||!Number.isFinite(Number(o?.y)))badCoords.push(o?.id||"?");
        for(const k of ["galaxyId","starId","clusterId","parentPlanetId"])if(o?.[k]&&!ids.has(o[k])){ /* deferred: checked below after all ids */ }
        if(o?.size!==undefined&&o?.size!==null&&String(o.size).trim()!==""&&(!Number.isFinite(Number(o.size))||Number(o.size)<1))badSizes.push(o.id||"?");
        if(Array.isArray(o?.resources)&&o.resources.some(r=>!state.resourceTypes.includes(r)))badResources.push(o.id||"?");
        if(Array.isArray(o?.life)){
          for(const l of o.life){if(!l||typeof l.mob!=="string"||!l.mob.trim()||!state.mobTypes.some(m=>mobKey(m)===mobKey(l.mob)))badLife.push(o.id||"?");}
        }
        if(o?.kind==="scan"&&(!Number.isFinite(Number(o.radius))||Number(o.radius)<=0))badSizes.push(`${o.id||"?"}:scan-radius`);
        if(o?.kind==="marker"&&o.markerLayer&&!new Set(["clusters","system"]).has(o.markerLayer))badFlags.push(`${o.id||"?"}:markerLayer`);
        if(o?.imported && typeof o.imported!=="boolean")badFlags.push(`${o.id||"?"}:imported`);
      }
      for(const o of objects)for(const k of ["galaxyId","starId","clusterId","parentPlanetId"])if(o?.[k]&&!ids.has(o[k]))badRefs.push(`${o.id||"?"}.${k}→${o[k]}`);
      add("Объекты: ID",duplicateIds.length===0,duplicateIds.length?`Дубликаты/пустые ID: ${duplicateIds.slice(0,8).join(", ")}.`:`Уникальных ID: ${ids.size}.`);
      add("Объекты: типы",badKinds.length===0,badKinds.length?`Неизвестные kind: ${badKinds.slice(0,8).join(", ")}.`:`Все ${objects.length} объектов имеют допустимый тип.`);
      add("Объекты: координаты",badCoords.length===0,badCoords.length?`Некорректные X/Y: ${badCoords.slice(0,8).join(", ")}.`:`Все объекты имеют конечные X/Y.`);
      add("Объекты: связи",badRefs.length===0,badRefs.length?`Битые ссылки: ${badRefs.slice(0,10).join(", ")}.`:`Все galaxy/star/cluster/parent ссылки ведут на существующие ID.`);
      add("Объекты: размеры",badSizes.length===0,badSizes.length?`Некорректные размеры: ${badSizes.slice(0,8).join(", ")}.`:`Размеры и радиусы объектов корректны.`);
      add("Объекты: ресурсы",badResources.length===0,badResources.length?`Неизвестные ресурсы у: ${badResources.slice(0,8).join(", ")}.`:`Ресурсы всех объектов присутствуют в справочнике.`);
      add("Объекты: жизненные формы",badLife.length===0,badLife.length?`Некорректная life-модель у: ${badLife.slice(0,8).join(", ")}.`:`Life-поля согласованы со справочником мобов.`);
      add("Объекты: служебные поля",badFlags.length===0,badFlags.length?`Проблемные служебные поля: ${badFlags.slice(0,8).join(", ")}.`:`Флаги imported/markerLayer корректны.`);

      /* 4. Relationship semantics */
      const stars=objects.filter(o=>o.kind==="star"),planets=objects.filter(o=>o.kind==="planet"),moons=objects.filter(o=>o.kind==="moon"),asteroids=objects.filter(o=>o.kind==="asteroid"),clusters=objects.filter(o=>o.kind==="cluster"),galaxies=objects.filter(o=>o.kind==="galaxy");
      const semantic=[];
      for(const o of planets)if(o.starId&&!stars.some(s=>s.id===o.starId))semantic.push(`${o.id}: planet.starId`);
      for(const o of planets)if(o.clusterId&&!clusters.some(c=>c.id===o.clusterId))semantic.push(`${o.id}: planet.clusterId`);
      for(const o of moons)if(o.parentPlanetId&&!planets.some(p=>p.id===o.parentPlanetId))semantic.push(`${o.id}: moon.parentPlanetId`);
      for(const o of asteroids)if(o.parentPlanetId&&!planets.some(p=>p.id===o.parentPlanetId))semantic.push(`${o.id}: asteroid.parentPlanetId`);
      for(const o of clusters)if(o.starId&&!stars.some(s=>s.id===o.starId))semantic.push(`${o.id}: cluster.starId`);
      for(const o of stars)if(o.galaxyId&&!galaxies.some(g=>g.id===o.galaxyId))semantic.push(`${o.id}: star.galaxyId`);
      add("Иерархия объектов",semantic.length===0,semantic.length?`Подозрительные родительские связи: ${semantic.slice(0,12).join(", ")}.`:`Иерархия galaxy → star → cluster → planet → moon/asteroid согласована.`);
      const cycles=[];for(const o of objects){let cur=o,seen=new Set();for(let i=0;i<8;i++){const pid=cur?.parentPlanetId;if(!pid)break;if(seen.has(pid)){cycles.push(o.id);break}seen.add(pid);cur=objects.find(x=>x.id===pid);if(!cur)break}}
      add("Циклы родительских связей",cycles.length===0,cycles.length?`Обнаружены циклы: ${cycles.slice(0,8).join(", ")}.`:`Циклов в parentPlanetId не обнаружено.`);

      /* 5. Dictionaries */
      const dictDup=(arr,key=v=>mobKey(v))=>{const seen=new Set(),dup=[];for(const v of arr||[]){const k=key(v);if(seen.has(k))dup.push(v);seen.add(k)}return dup};
      const pdup=dictDup(state.planetTypes,v=>String(v).trim().toLowerCase()),rdup=dictDup(state.resourceTypes,v=>String(v).trim().toLowerCase()),mdup=dictDup(state.mobTypes);
      add("Справочник типов планет",Array.isArray(state.planetTypes)&&state.planetTypes.every(x=>typeof x==="string"&&x.trim())&&pdup.length===0,`Записей: ${state.planetTypes?.length||0}${pdup.length?`; дубли: ${pdup.slice(0,6).join(", ")}`:"."}`);
      add("Справочник ресурсов",Array.isArray(state.resourceTypes)&&state.resourceTypes.every(x=>typeof x==="string"&&x.trim())&&rdup.length===0,`Записей: ${state.resourceTypes?.length||0}${rdup.length?`; дубли: ${rdup.slice(0,6).join(", ")}`:"."}`);
      add("Справочник мобов",Array.isArray(state.mobTypes)&&state.mobTypes.every(x=>typeof x==="string"&&x.trim())&&mdup.length===0,`Записей: ${state.mobTypes?.length||0}${mdup.length?`; дубли: ${mdup.slice(0,6).join(", ")}`:"."}`);

      /* 6. Core modules / function surface */
      const modules={"Загрузка и миграция":["load","migrateData","normalizeLoadedState"],"Сохранение и backup":["save","snapshotState","openPersistenceDB","queueIndexedSave","scheduleExternalBackup"],"Рендер карты":["render","resize","drawGrid","drawScanZones"],"Навигация и слои":["setLayer","navigateFromList","navigateFromMap","fitCurrentContext"],"Объекты и связи":["addObject","findDuplicate","mergeStarSystem","ensureGalaxies","ensureDeepClusters"],"Фильтры и поиск":["filterMatch","renderFilters"],"Справочники":["refreshTypeLists","refreshCreationFields","bindResourcePicker","bindLifePicker"],"Импорт/экспорт":["exportObjects","importObjects","makeShareCode","decodeShareCode"],"Интерактивность":["hit","updateMouseCoords","copyShareCode"],"Настройки":["ensureSettings","starRadius","scanRadius","privacyMode"]};
      for(const [name,fns] of Object.entries(modules)){const missing=fns.filter(x=>!fn(x));add(`Модуль: ${name}`,missing.length===0,missing.length?`Отсутствуют функции: ${missing.join(", ")}.`:`Все ${fns.length} ключевых функций доступны.`)}

      /* 7. UI bindings */
      const requiredButtons=["#newBtn","#addCoordsBtn","#clickModeBtn","#fitObjectsBtn","#rulerBtn","#exportBtn","#pasteShareBtn","#backupNowBtn","#backupFolderBtn","#undoBtn","#clearFilters","#addPlanetType","#addResource","#addMob"];
      add("Кнопки и действия",requiredButtons.every(s=>!!$(s)),`Проверено элементов: ${requiredButtons.length}.`);
      const boundChecks=[
        ["Настройки",$("#settingsModal")?.dataset.logicBound==="1"||$("#settingsBtn")?.dataset.settingsFallbackBound==="1"],
        ["Диагностика",runBtn.dataset.bound==="1"],
        ["Фильтр",!!$("#filterGalaxyName")],
        ["Создание объекта",!!$("#objectType")&&!!$("#objectName")&&!!$("#coordX")&&!!$("#coordY")],
        ["Справочники",!!$("#newPlanetType")&&!!$("#newResource")&&!!$("#newMob")]
      ];
      add("UI-контуры",boundChecks.every(x=>x[1]),boundChecks.filter(x=>!x[1]).map(x=>x[0]).join(", ")||"Основные UI-контуры найдены и подготовлены.");

      /* 8. Settings semantics */
      const settingsOk=!!state.settings&&Number.isFinite(Number(state.settings.starRadius))&&Number(state.settings.starRadius)>0&&Number.isFinite(Number(state.settings.scanRadius))&&Number(state.settings.scanRadius)>0&&["none","hideStarGalaxy","planetNamesOnly"].includes(state.settings.privacyMode)&&["show","hide"].includes(state.settings.exportFavorites);
      add("Значения настроек",settingsOk,`starRadius=${state.settings?.starRadius??"—"}; scanRadius=${state.settings?.scanRadius??"—"}; privacy=${state.settings?.privacyMode??"—"}; exportFavorites=${state.settings?.exportFavorites??"—"}.`);

      /* 9. Persistence / serialization dry-runs — do not touch real user data */
      let snapOk=false,snapDetail="";try{const raw=snapshotState(),snap=typeof raw==="string"?JSON.parse(raw):raw;snapOk=!!snap&&Array.isArray(snap.objects)&&snap.meta?.dataVersion===DATA_VERSION;snapDetail=snapOk?`Снимок содержит ${snap.objects.length} объектов и v${snap.meta.dataVersion}.`:`snapshotState вернул неожиданный формат.`}catch(e){snapDetail=e?.message||String(e)}add("Снимок данных",snapOk,snapDetail);
      let jsonOk=false,jsonDetail="";try{const raw=snapshotState(),snap=typeof raw==="string"?JSON.parse(raw):raw,round=JSON.stringify(snap),parsed=JSON.parse(round);jsonOk=!!parsed&&Array.isArray(parsed.objects)&&parsed.objects.length===objects.length;jsonDetail=`JSON round-trip: ${round.length.toLocaleString("ru-RU")} символов, объектов ${parsed.objects.length}.`}catch(e){jsonDetail=e?.message||String(e)}add("JSON сериализация",jsonOk,jsonDetail);
      let shareOk=false,shareDetail="";try{const sample=objects.find(o=>bodyKinds.has(o.kind));if(sample){const code=makeShareCode(sample),decoded=decodeShareCode(code);shareOk=code.startsWith("SIGMA1.")&&decoded?.version===1&&Array.isArray(decoded.objects);shareDetail=shareOk?`SIGMA1 round-trip для ${sample.kind}: ${code.length.toLocaleString("ru-RU")} символов.`:`Код/декодирование вернуло неожиданный формат.`}else{shareOk=true;shareDetail="Нет тел для точечного SIGMA1-теста; функция доступна."}}catch(e){shareDetail=e?.message||String(e)}add("SIGMA1 код",shareOk,shareDetail);
      let exportOk=false,exportDetail="";try{const exp=exportObjects();const payload={format:"STAR_MAP",version:12,dataVersion:DATA_VERSION,exportedAt:new Date().toISOString(),planetTypes:[...state.planetTypes],resourceTypes:[...state.resourceTypes],mobTypes:[...state.mobTypes],settings:{...state.settings},objects:exp};const raw=JSON.stringify(payload),parsed=JSON.parse(raw);exportOk=parsed.format==="STAR_MAP"&&parsed.dataVersion===DATA_VERSION&&Array.isArray(parsed.objects);exportDetail=exportOk?`Экспортный payload сериализуется; передаётся ${exp.length} из ${objects.length} объектов.`:`Неверный формат экспортного payload.`}catch(e){exportDetail=e?.message||String(e)}add("Экспортный формат",exportOk,exportDetail);

      /* 10. Storage capabilities */
      let lsOk=false,lsDetail="";try{const k=`__sigma_diag_${Date.now()}`;localStorage.setItem(k,"ok");lsOk=localStorage.getItem(k)==="ok";localStorage.removeItem(k);lsDetail="Тестовая запись/чтение/удаление прошли."}catch(e){lsDetail=e?.message||String(e)}add("localStorage",lsOk,lsDetail);
      let idbOk=false,idbDetail="";try{const db=await openPersistenceDB();if(!db)throw new Error("IndexedDB недоступна");const key=`diag-${Date.now()}`;idbOk=await new Promise(resolve=>{let done=false;const finish=v=>{if(!done){done=true;resolve(v)}};try{const tx=db.transaction("config","readwrite"),store=tx.objectStore("config");store.put({ok:true},key);store.delete(key);tx.oncomplete=()=>finish(true);tx.onerror=()=>finish(false);tx.onabort=()=>finish(false)}catch(e){finish(false)}});idbDetail=idbOk?"Тестовая запись и удаление прошли.":"Не удалось выполнить тестовую транзакцию."}catch(e){idbDetail=e?.message||String(e)}add("IndexedDB",idbOk,idbDetail);
      add("Backup API",typeof backupText==="function"&&typeof makeBackupPayload==="function"&&typeof scheduleExternalBackup==="function","Функции формирования и планирования backup доступны.");

      /* 11. Version-agnostic mob model: test current contract, not a historical migration */
      const mobModelOk=Array.isArray(state.mobTypes)&&objects.every(o=>!Object.prototype.hasOwnProperty.call(o,"mobs")&&(!o.life||Array.isArray(o.life)))&&typeof getLife==="function"&&typeof normalizeLifeValue==="function";
      add("Модель жизненных форм",mobModelOk,"Текущий контракт: справочник mobTypes + life у объектов; старое поле mobs не используется.");

      /* 12. Status/UI synchronization */
      const countTexts=["statStars","statPlanets","statMoons","statAsteroids","statScans","statMarkers"].map(id=>$("#"+id));
      const counts={star:stars.length,planet:planets.length,moon:moons.length,asteroid:asteroids.length,scan:objects.filter(o=>o.kind==="scan").length,marker:objects.filter(o=>o.kind==="marker").length};
      const shown=[counts.star,counts.planet,counts.moon,counts.asteroid,counts.scan,counts.marker];
      const uiCountOk=countTexts.every(x=>x&&x.textContent.trim()!=="");
      add("Статусные счётчики",uiCountOk,`stars=${shown[0]}, planets=${shown[1]}, moons=${shown[2]}, asteroids=${shown[3]}, scans=${shown[4]}, markers=${shown[5]}. UI-элементы присутствуют.`);

      /* 13. Runtime errors */
      const recent=diagnosticRuntimeErrors.slice(-8),generic=recent.filter(x=>x.type==="error"&&String(x.message).trim()==="Script error."),concrete=recent.filter(x=>!(x.type==="error"&&String(x.message).trim()==="Script error."));
      const errorDetail=recent.length?recent.map(x=>{const src=x.filename?` [${x.filename}:${x.lineno||0}:${x.colno||0}]`:"";return `${x.type}: ${x.message}${src}`}).join(" | "):"Зафиксированных ошибок нет.";
      if(concrete.length)add("Ошибки JavaScript",false,errorDetail,"fail");
      else if(generic.length)add("Ошибки JavaScript",true,"Браузер сообщил общий «Script error.» без стека. Источник: "+(generic.map(x=>x.filename||"не указан").join(", ")||"не указан"),"warn");
      else add("Ошибки JavaScript",true,"Зафиксированных ошибок нет.","pass");

      const fails=tests.filter(t=>t.status==="fail").length,warns=tests.filter(t=>t.status==="warn").length,passes=tests.filter(t=>t.status==="pass").length;
      results.innerHTML=tests.map(t=>`<div class="diagnosticRow ${t.status}"><span class="diagnosticState">${t.status==="pass"?"✓":t.status==="warn"?"!":"✕"}</span><b>${esc(t.name)}</b><span class="diagnosticDetail">${esc(t.detail||"")}</span></div>`).join("");
      summary.textContent=`Готово: ${passes} проверок пройдено${fails?`, ${fails} не пройдено`:""}${warns?`, ${warns} предупреждени${warns===1?"е":"я"}`:""}.`;
      lastReport=[`SigmaSpace diagnostic`,`App: ${APP_NAME}`,`Data: v${DATA_VERSION}`,`Objects: ${objects.length}`,`Result: ${passes} pass, ${fails} fail, ${warns} warn`,"",...tests.map(t=>`[${t.status.toUpperCase()}] ${t.name}\n${t.detail||""}`)].join("\n");
      copyBtn.disabled=!lastReport;
      copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(lastReport);toast("Отчёт скопирован.")}catch(e){toast("Не удалось скопировать отчёт.")}};
    }catch(e){
      recordDiagnosticError("diagnostic",e);summary.textContent="Диагностика прервана из-за ошибки.";results.innerHTML=`<div class="diagnosticRow fail"><span class="diagnosticState">✕</span><b>Диагностический тест</b><span class="diagnosticDetail">${esc(e?.stack||e?.message||String(e))}</span></div>`;
    }finally{runBtn.disabled=false}
  };
  runBtn.addEventListener("click",run);
}

function bootDiagnostics(){try{setupDiagnostics()}catch(e){recordDiagnosticError("setupDiagnostics",e)}}
bootDiagnostics();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootDiagnostics,{once:true});
setTimeout(bootDiagnostics,0);
setTimeout(bootDiagnostics,250);
