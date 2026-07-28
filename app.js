(() => {
  const cfg = window.ALMIRFA_CONFIG || {};
  const TYPES = ['animals','births','health','feed','production','breeding','trees','tasks','finance'];
  const state = { records: [], worker: localStorage.getItem('almirfa_worker') || '', online: false, client: null };
  const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const fmtDate = v => v ? new Intl.DateTimeFormat('ar-AE',{dateStyle:'medium'}).format(new Date(v+'T00:00:00')) : '—';
  const money = v => `${new Intl.NumberFormat('ar-AE',{maximumFractionDigits:2}).format(Number(v)||0)} د.إ`;
  const monthKey = d => String(d||'').slice(0,7); const currentMonth = monthKey(today());
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
  function localLoad(){try{return JSON.parse(localStorage.getItem('almirfa_records')||'[]')}catch{return []}}
  function localSave(){localStorage.setItem('almirfa_records',JSON.stringify(state.records))}
  function configured(){return cfg.supabaseUrl?.startsWith('https://') && cfg.supabaseAnonKey && window.supabase}
  async function connect(){
    if(!configured()){state.records=localLoad();$('#setupBanner').hidden=false;setSync(false,'حفظ محلي');render();return}
    try{state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);await loadCloud();state.online=true;setSync(true,'متصل بالسحابة');state.client.channel('almirfa-live').on('postgres_changes',{event:'*',schema:'public',table:'almirfa_records'},loadCloud).subscribe();}
    catch(e){console.error(e);state.records=localLoad();$('#setupBanner').hidden=false;setSync(false,'تعذر الاتصال - حفظ محلي');render()}
  }
  function setSync(on,text){$('#syncDot').classList.toggle('online',on);$('#syncText').textContent=text}
  async function loadCloud(){const {data,error}=await state.client.from('almirfa_records').select('*').eq('farm_id',cfg.farmId).order('created_at',{ascending:false});if(error)throw error;state.records=(data||[]).map(r=>({id:r.id,type:r.record_type,worker:r.worker_name,createdAt:r.created_at,...r.data}));localSave();render()}
  async function saveRecord(type,data,id){
    const payload={farm_id:cfg.farmId,record_type:type,data,worker_name:state.worker,updated_at:new Date().toISOString()};
    if(state.online){let q=id?state.client.from('almirfa_records').update(payload).eq('id',id):state.client.from('almirfa_records').insert(payload);const {error}=await q;if(error)throw error;await loadCloud()}
    else{if(id){const i=state.records.findIndex(r=>r.id===id);state.records[i]={...state.records[i],...data,type,worker:state.worker}}else state.records.unshift({id:crypto.randomUUID(),type,worker:state.worker,createdAt:new Date().toISOString(),...data});localSave();render()}
  }
  async function deleteRecord(id){if(!confirm('هل تريد حذف هذا السجل؟'))return;if(state.online){const {error}=await state.client.from('almirfa_records').delete().eq('id',id);if(error)throw error;await loadCloud()}else{state.records=state.records.filter(r=>r.id!==id);localSave();render()}toast('تم حذف السجل')}
  function records(type){return state.records.filter(r=>r.type===type)}
  function formData(form){const o=Object.fromEntries(new FormData(form).entries());Object.keys(o).forEach(k=>{if(o[k]==='')delete o[k]});return o}
  function rowActions(r){return `<button class="action-btn" data-edit="${r.id}" data-type="${r.type}">تعديل</button><button class="action-btn delete" data-delete="${r.id}">حذف</button>`}
  const cols={
    animals:r=>[fmtDate(r.date),r.species,r.category||'—',r.count,r.location||'—',r.worker],
    births:r=>[fmtDate(r.date),r.event,r.species,r.count,r.reason||'—',r.worker],
    health:r=>[fmtDate(r.date),r.species,r.action,r.medicine||'—',fmtDate(r.nextDate),r.worker],
    feed:r=>[r.item,r.category||'—',`${r.quantity||0} ${r.unit||''}`,r.minimum||'0',r.supplier||'—',r.worker],
    production:r=>[fmtDate(r.date),r.product,`${r.quantity||0} ${r.unit||''}`,r.used||'0',r.waste||'0',r.worker],
    breeding:r=>[fmtDate(r.date),r.species,r.action,r.group||'—',fmtDate(r.expectedDate),r.worker],
    trees:r=>[fmtDate(r.date),r.variety,r.count,r.zone||'—',r.action||'—',r.worker],
    tasks:r=>[r.task,r.assignedTo||'—',fmtDate(r.dueDate),r.priority,r.status,r.worker],
    finance:r=>[fmtDate(r.date),r.flow,r.category,r.description,money(r.amount),r.worker]
  };
  function renderTable(type){const body=$(`#${type}Table`);if(!body)return;const rs=records(type);body.innerHTML=rs.length?rs.map(r=>`<tr>${cols[type](r).map(v=>`<td>${esc(v)}</td>`).join('')}<td>${rowActions(r)}</td></tr>`).join(''):`<tr><td colspan="8" class="empty-state">لا توجد سجلات.</td></tr>`}
  function latestAnimalTotal(){const latest={};records('animals').forEach(r=>{const key=`${r.species}|${r.category||''}|${r.location||''}`;if(!latest[key]||String(r.date)>String(latest[key].date))latest[key]=r});return Object.values(latest).reduce((s,r)=>s+(Number(r.count)||0),0)}
  function renderDashboard(){
    $('#statAnimals').textContent=latestAnimalTotal();
    $('#statEggs').textContent=records('production').filter(r=>monthKey(r.date)===currentMonth&&String(r.product).includes('بيض')).reduce((s,r)=>s+(Number(r.quantity)||0),0);
    const in14=new Date();in14.setDate(in14.getDate()+14);$('#statVaccines').textContent=records('health').filter(r=>r.nextDate&&new Date(r.nextDate+'T23:59:59')<=in14).length;
    $('#statDeaths').textContent=records('births').filter(r=>r.event==='نفوق'&&monthKey(r.date)===currentMonth).reduce((s,r)=>s+(Number(r.count)||0),0);
    $('#statLowFeed').textContent=records('feed').filter(r=>Number(r.quantity)<=Number(r.minimum||0)).length;
    const open=records('tasks').filter(r=>r.status!=='مكتملة');$('#statTasks').textContent=open.length;$('#statUrgent').textContent=`${open.filter(r=>['عالية','عاجلة'].includes(r.priority)).length} عالية الأولوية`;
    const alerts=[];records('feed').filter(r=>Number(r.quantity)<=Number(r.minimum||0)).slice(0,4).forEach(r=>alerts.push({t:`مخزون منخفض: ${r.item}`,s:`المتوفر ${r.quantity} ${r.unit||''}`}));records('health').filter(r=>r.nextDate&&new Date(r.nextDate+'T23:59:59')<=in14).slice(0,4).forEach(r=>alerts.push({t:`موعد صحي قريب: ${r.species}`,s:`${r.action} في ${fmtDate(r.nextDate)}`}));open.filter(r=>r.dueDate&&new Date(r.dueDate+'T23:59:59')<new Date()).slice(0,4).forEach(r=>alerts.push({t:`مهمة متأخرة: ${r.task}`,s:r.assignedTo||'غير محدد'}));
    $('#alertsList').innerHTML=alerts.length?alerts.map(a=>`<div class="activity-item"><strong>${esc(a.t)}</strong><small>${esc(a.s)}</small></div>`).join(''):'لا توجد تنبيهات حالياً.';
    $('#recentList').innerHTML=state.records.slice(0,8).map(r=>`<div class="activity-item"><strong>${esc(labelType(r.type))}</strong><small>${esc(r.worker)} · ${fmtDate((r.date||r.createdAt||'').slice(0,10))}</small></div>`).join('')||'لا توجد سجلات حتى الآن.';
  }
  function labelType(t){return({animals:'تحديث أعداد الحيوانات',births:'ولادة أو نفوق',health:'سجل صحي',feed:'تحديث مخزون',production:'إنتاج يومي',breeding:'تزاوج أو تفريخ',trees:'أشجار وري',tasks:'مهمة أو صيانة',finance:'عملية مالية'})[t]||t}
  function renderReports(){const f=records('finance');const income=f.filter(r=>r.flow!=='مصروف').reduce((s,r)=>s+(Number(r.amount)||0),0),exp=f.filter(r=>r.flow==='مصروف').reduce((s,r)=>s+(Number(r.amount)||0),0);$('#reportIncome').textContent=money(income);$('#reportExpenses').textContent=money(exp);$('#reportNet').textContent=money(income-exp)}
  function render(){TYPES.forEach(renderTable);renderDashboard();renderReports()}
  function editRecord(type,id){const r=state.records.find(x=>x.id===id),form=$(`#${type}Form`);if(!r||!form)return;Object.entries(r).forEach(([k,v])=>{const el=form.elements[k];if(el)el.value=v??''});form.elements.id.value=id;showSection(type);window.scrollTo({top:0,behavior:'smooth'});toast('يمكنك تعديل السجل الآن')}
  function showSection(id){$$('.page-section').forEach(s=>s.classList.toggle('active',s.id===id));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.section===id));$('#pageTitle').textContent=$(`.nav-item[data-section="${id}"]`)?.textContent||'لوحة التحكم';$('#sidebar').classList.remove('open')}
  function exportCsv(){const keys=['type','worker','date','species','category','event','action','item','product','quantity','count','amount','notes'];const lines=[keys.join(',')].concat(state.records.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(',')));download('\ufeff'+lines.join('\n'),'almirfa-records.csv','text/csv;charset=utf-8')}
  function download(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
  function initForms(){TYPES.forEach(type=>{const form=$(`#${type}Form`);if(!form)return;const d=form.elements.date;if(d&&!d.value)d.value=today();form.addEventListener('submit',async e=>{e.preventDefault();const data=formData(form),id=data.id;delete data.id;try{await saveRecord(type,data,id);form.reset();if(form.elements.date)form.elements.date.value=today();toast(id?'تم تحديث السجل':'تم حفظ السجل')}catch(err){console.error(err);toast('تعذر الحفظ')}})})}
  document.addEventListener('click',e=>{const del=e.target.closest('[data-delete]'),edit=e.target.closest('[data-edit]');if(del)deleteRecord(del.dataset.delete);if(edit)editRecord(edit.dataset.type,edit.dataset.edit)});
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));$('#menuButton').onclick=()=>$('#sidebar').classList.toggle('open');$('#syncButton').onclick=()=>state.online?loadCloud():render();$('#logoutButton').onclick=()=>{localStorage.removeItem('almirfa_worker');location.reload()};
  $('#loginForm').addEventListener('submit',e=>{e.preventDefault();const d=formData(e.currentTarget);if(d.pin!==String(cfg.accessPin||'7788')){$('#loginMessage').textContent='رمز المزرعة غير صحيح.';return}state.worker=d.workerName.trim();localStorage.setItem('almirfa_worker',state.worker);$('#workerNameText').textContent=state.worker;$('#loginScreen').classList.add('hidden')});
  $('#exportCsv').onclick=exportCsv;$('#exportBackup').onclick=()=>download(JSON.stringify(state.records,null,2),'almirfa-backup.json','application/json');$('#importBackup').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data))throw 0;state.records=data;localSave();render();toast('تمت استعادة النسخة محلياً')}catch{toast('ملف النسخة غير صالح')}};
  $('#farmNameSide').textContent=cfg.farmName||'مزرعة المرفأ';$('#todayText').textContent=new Intl.DateTimeFormat('ar-AE',{dateStyle:'full'}).format(new Date());initForms();if(state.worker){$('#workerNameText').textContent=state.worker;$('#loginScreen').classList.add('hidden')}connect();
})();
