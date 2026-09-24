const state={viewMonth:new Date(),selectedDate:new Date(),events:[],todos:[],hydration:null};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHtml=(value='')=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const formatNumber=value=>Number(value||0).toLocaleString('zh-CN');
const dateKey=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;

async function api(path,options={}){
  const response=await fetch(path,{headers:{'Content-Type':'application/json'},...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data;
}

function toast(message){const element=$('#toast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),3000)}
function sameDay(a,b){return dateKey(a)===dateKey(b)}

function renderCalendarDots(){
  $$('.calendar-day').forEach(day=>{
    const key=day.dataset.date;
    const schedules=state.events.filter(item=>item.date===key).length;
    const todos=state.todos.filter(item=>item.date===key).length;
    let dots=day.querySelector('small');
    if(!schedules&&!todos){dots?.remove();return}
    if(!dots){dots=document.createElement('small');day.appendChild(dots)}
    dots.innerHTML=Array.from({length:schedules},()=>'<i class="dot schedule-dot"></i>').join('')+Array.from({length:todos},()=>'<i class="dot todo-dot"></i>').join('');
  });
}

function renderAgenda(){
  const key=dateKey(state.selectedDate);
  const items=state.events.filter(item=>item.date===key).sort((a,b)=>a.time.localeCompare(b.time));
  $('#agenda-date').textContent=state.selectedDate.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  $('#agenda-list').innerHTML=items.length?items.map(item=>`<div class="agenda-item"><time>${escapeHtml(item.time)}</time><span>${escapeHtml(item.title)}</span><button data-id="${escapeHtml(item.id)}" aria-label="删除日程">×</button></div>`).join(''):'<p class="agenda-empty">这一天还没有安排。</p>';
  $$('.agenda-item button').forEach(button=>button.onclick=async()=>{state.events=(await api(`/api/schedule/${button.dataset.id}`,{method:'DELETE'})).events;renderCalendar();toast('日程已删除')});
}

function renderTodos(){
  const selected=dateKey(state.selectedDate);
  const items=state.todos.filter(item=>item.date===selected);
  const completed=items.filter(item=>item.done).length;
  $('#todo-date').textContent=state.selectedDate.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
  $('#todo-progress').textContent=`${completed}/${items.length} 已完成`;
  $('#todo-list').innerHTML=items.length?items.map(item=>`<label class="todo-item${item.done?' done':''}"><input type="checkbox" data-todo-id="${escapeHtml(item.id)}" ${item.done?'checked':''}><span>${escapeHtml(item.title)}</span><button type="button" data-todo-delete="${escapeHtml(item.id)}">×</button></label>`).join(''):'<p class="todo-empty">这一天还没有待办事项。</p>';
  $$('[data-todo-id]').forEach(input=>input.onchange=async()=>{state.todos=(await api('/api/todos',{method:'POST',body:JSON.stringify({action:'toggle',id:input.dataset.todoId})})).items;renderCalendar();renderTodos()});
  $$('[data-todo-delete]').forEach(button=>button.onclick=async()=>{state.todos=(await api('/api/todos',{method:'POST',body:JSON.stringify({action:'delete',id:button.dataset.todoDelete})})).items;renderCalendar();renderTodos()});
}

function renderCalendar(){
  const year=state.viewMonth.getFullYear(),month=state.viewMonth.getMonth();
  $('#calendar-month').textContent=`${year} 年 ${month+1} 月`;
  const first=new Date(year,month,1),start=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate(),previousDays=new Date(year,month,0).getDate();
  let html='';
  for(let index=0;index<42;index++){
    let day,muted=false;
    if(index<start){day=new Date(year,month-1,previousDays-start+index+1);muted=true}
    else if(index>=start+days){day=new Date(year,month+1,index-start-days+1);muted=true}
    else day=new Date(year,month,index-start+1);
    html+=`<button class="calendar-day${muted?' muted':''}${sameDay(day,new Date())?' today':''}${sameDay(day,state.selectedDate)?' selected':''}" data-date="${dateKey(day)}"><span>${day.getDate()}</span></button>`;
  }
  $('#calendar-grid').innerHTML=html;
  $$('.calendar-day').forEach(button=>button.onclick=()=>{const [yearValue,monthValue,dayValue]=button.dataset.date.split('-').map(Number);state.selectedDate=new Date(yearValue,monthValue-1,dayValue);if(state.selectedDate.getMonth()!==state.viewMonth.getMonth())state.viewMonth=new Date(yearValue,monthValue-1,1);renderCalendar()});
  renderAgenda();renderTodos();renderCalendarDots();
}

function renderHydration(data){
  state.hydration=data;$('#water-goal').value=data.goal_ml;$('#water-amount').textContent=formatNumber(data.amount_ml);$('#water-target').textContent=formatNumber(data.goal_ml);$('#water-remaining').textContent=formatNumber(data.remaining_ml);$('#water-percent').textContent=`${data.percent}% COMPLETED`;$('#water-liquid').style.height=`${Math.max(0,Math.min(data.percent,100))}%`;
}

async function updateHydration(payload){try{renderHydration(await api('/api/hydration',{method:'POST',body:JSON.stringify(payload)}))}catch(error){toast(error.message)}}

async function loadBingBackground(){try{const data=await api(`/api/bing-background?day=${dateKey(new Date())}`);$('#daily-banner').style.backgroundImage=`url("${String(data.image_url).replace(/"/g,'%22')}")`;$('#bing-banner-title').textContent=data.title||'Daily background'}catch{}}
async function loadWeather(){try{const data=await api('/api/weather');const labels={0:'晴',1:'少云',2:'晴间多云',3:'阴',45:'雾',51:'小雨',61:'小雨',63:'中雨',65:'大雨',80:'阵雨',95:'雷雨'};$('#header-weather').textContent=data.temperature==null?'深圳 · 天气暂不可用':`深圳 ${data.temperature}°C · ${labels[data.code]||'天气'}`}catch{$('#header-weather').textContent='深圳 · 天气暂不可用'}}

$('#schedule-form').onsubmit=async event=>{event.preventDefault();const title=$('#schedule-title').value.trim();if(!title)return;state.events=(await api('/api/schedule',{method:'POST',body:JSON.stringify({date:dateKey(state.selectedDate),time:$('#schedule-time').value||'09:00',title})})).events;$('#schedule-title').value='';renderCalendar();toast('日程已保存')};
$('#todo-form').onsubmit=async event=>{event.preventDefault();const title=$('#todo-title').value.trim();if(!title)return;state.todos=(await api('/api/todos',{method:'POST',body:JSON.stringify({action:'add',date:dateKey(state.selectedDate),title})})).items;$('#todo-title').value='';renderCalendar()};
$$('[data-agenda-view]').forEach(button=>button.onclick=()=>{const view=button.dataset.agendaView;$$('[data-agenda-view]').forEach(item=>item.classList.toggle('active',item===button));$('#todo-view').classList.toggle('active',view==='todos');$('#schedule-view').classList.toggle('active',view==='schedule')});
$('#month-prev').onclick=()=>{state.viewMonth=new Date(state.viewMonth.getFullYear(),state.viewMonth.getMonth()-1,1);renderCalendar()};
$('#month-next').onclick=()=>{state.viewMonth=new Date(state.viewMonth.getFullYear(),state.viewMonth.getMonth()+1,1);renderCalendar()};
$('#calendar-today').onclick=()=>{state.viewMonth=new Date();state.selectedDate=new Date();renderCalendar()};
$('#water-goal-form').onsubmit=event=>{event.preventDefault();updateHydration({action:'set_goal',goal_ml:+$('#water-goal').value})};
$$('[data-water]').forEach(button=>button.onclick=()=>updateHydration({action:'add',amount_ml:+button.dataset.water}));
$('#water-reset').onclick=()=>updateHydration({action:'reset'});
$('#water-cup').onclick=async()=>{const current=state.hydration?.goal_ml||2000;const value=window.prompt('设置每日饮水目标（100–10000 ml）',String(current));if(value===null)return;const goal=Math.round(Number(value));if(!Number.isFinite(goal)||goal<100||goal>10000){toast('目标需为 100–10000 ml 之间的数字');return}await updateHydration({action:'set_goal',goal_ml:goal})};

const WORD_BOOK_FILES={academic:'assets/wordbooks/academic.json',ngsl:'assets/wordbooks/ngsl.json',ielts:'assets/wordbooks/ielts.json'};
const WORD_BOOKS={};
const WORD_STORE='personal-workspace-vocabulary-v1';
function readWordState(){try{return JSON.parse(localStorage.getItem(WORD_STORE))||{}}catch{return {}}}
function writeWordState(value){localStorage.setItem(WORD_STORE,JSON.stringify(value))}
function normalizeWordEntry(entry){const pieces=(Array.isArray(entry.trans)?entry.trans:[entry.trans||'']).flatMap(value=>String(value||'').split(/\r?\n/)).map(value=>value.trim()).filter(Boolean),meaning=pieces[0]||'暂无释义',detail=pieces.slice(1).join(' ');return {word:String(entry.name||entry.word||'').trim(),phonetic:String(entry.usphone||entry.ukphone||entry.phonetic||'').replace(/^\[|\]$/g,''),meaning,example:detail||meaning}}
async function loadWordBook(book){if(WORD_BOOKS[book])return WORD_BOOKS[book];$('#daily-word').textContent='读取中…';$('#word-phonetic').textContent='';$('#word-meaning').textContent='';$('#word-example').textContent='';const response=await fetch(WORD_BOOK_FILES[book]);if(!response.ok)throw new Error(`词书读取失败：HTTP ${response.status}`);const raw=await response.json(),list=raw.map(normalizeWordEntry).filter(item=>item.word);if(!list.length)throw new Error('词书内容为空');WORD_BOOKS[book]=list;return list}
function renderWord(){const saved=readWordState(),book=$('#word-book').value,list=WORD_BOOKS[book];if(!list?.length)return;const index=((saved.index?.[book]||0)%list.length+list.length)%list.length,item=list[index],mastered=[...new Set(saved.mastered?.[book]||[])].filter(word=>list.some(entry=>entry.word===word)),learned=mastered.length,percent=Math.round(learned/list.length*100),track=$('.word-progress-track');$('#daily-word').textContent=item.word;$('#word-phonetic').textContent=item.phonetic?`/${item.phonetic.replace(/^\/|\/$/g,'')}/`:'';$('#word-meaning').textContent=item.meaning;$('#word-example').textContent=item.example;$('#word-progress-count').textContent=`${learned} / ${list.length}`;$('#word-progress-fill').style.width=`${percent}%`;track.setAttribute('aria-valuemax',String(list.length));track.setAttribute('aria-valuenow',String(learned));$('#word-known').textContent=mastered.includes(item.word)?'已掌握 ✓':'已掌握'}
function randomWord(){const saved=readWordState(),book=$('#word-book').value,list=WORD_BOOKS[book];if(!list?.length)return;const current=((saved.index?.[book]||0)%list.length+list.length)%list.length;let next=current;if(list.length>1)while(next===current)next=Math.floor(Math.random()*list.length);saved.book=book;saved.index={...(saved.index||{}),[book]:next};writeWordState(saved);renderWord()}
async function selectWordBook(){const book=$('#word-book').value,current=readWordState();current.book=book;writeWordState(current);try{await loadWordBook(book);renderWord()}catch(error){$('#daily-word').textContent='无法读取词书';$('#word-example').textContent=error.message}}
async function initVocabulary(){const saved=readWordState();$('#word-book').value=WORD_BOOK_FILES[saved.book]?saved.book:'academic';$('#word-book').onchange=selectWordBook;$('#word-next').onclick=randomWord;$('#word-known').onclick=()=>{const current=readWordState(),book=$('#word-book').value,list=WORD_BOOKS[book];if(!list?.length)return;const index=((current.index?.[book]||0)%list.length+list.length)%list.length,item=list[index];current.mastered={...(current.mastered||{})};const set=new Set(current.mastered[book]||[]);set.has(item.word)?set.delete(item.word):set.add(item.word);current.mastered[book]=[...set];writeWordState(current);renderWord()};await selectWordBook()}

const TAURUS_FORTUNES=[
  {stars:'★★★★☆',summary:'节奏稳定，适合把复杂任务拆成清晰步骤，逐项推进会比临时加速更有效。',suitable:'写作 · 复盘',color:'鼠尾草绿',hex:'#789f90',number:'6',tip:'先完成最重要的一件事，再处理零散任务。'},
  {stars:'★★★★★',summary:'思路较为清晰，适合集中处理需要耐心和判断力的研究工作。',suitable:'分析 · 定稿',color:'雾霭蓝',hex:'#6f91ad',number:'8',tip:'把关键判断记录下来，今天的思路值得保留。'},
  {stars:'★★★★☆',summary:'沟通状态平稳，适合讨论方案、核对细节，并为下一阶段预留余量。',suitable:'讨论 · 核验',color:'清华紫',hex:'#67307c',number:'4',tip:'重要结论多核对一次，稳妥会带来更高效率。'},
  {stars:'★★★☆☆',summary:'注意力容易被小事分散，减少任务切换后，进展会明显顺畅。',suitable:'整理 · 阅读',color:'暖杏色',hex:'#c88f62',number:'2',tip:'给自己留出连续而安静的一小时。'},
  {stars:'★★★★☆',summary:'适合回到长期目标，修正近期安排，并完成一项拖延已久的任务。',suitable:'规划 · 收尾',color:'松石青',hex:'#438f91',number:'9',tip:'不必追求一次完成，持续推进就是今天的好运。'}
];
function renderFortune(){const key=dateKey(new Date()).replaceAll('-',''),index=[...key].reduce((sum,value)=>sum+Number(value),0)%TAURUS_FORTUNES.length,fortune=TAURUS_FORTUNES[index];$('#fortune-stars').textContent=fortune.stars;$('#fortune-summary').textContent=fortune.summary;$('#fortune-suitable').textContent=fortune.suitable;$('#fortune-color').textContent=fortune.color;$('#fortune-color-dot').style.background=fortune.hex;$('#fortune-number').textContent=fortune.number;$('#fortune-tip').textContent=fortune.tip}

function renderHeader(){const now=new Date();$('#page-kicker').textContent='';$('#page-title').textContent='个人工作空间';$('#header-gregorian').textContent=now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});$('#header-lunar').textContent=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{dateStyle:'long'}).format(now)+' · '+now.toLocaleDateString('zh-CN',{weekday:'long'});$('#server-time').textContent='本地 UI · 独立运行'}

async function initialize(){renderHeader();initVocabulary();renderFortune();state.viewMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);const [schedule,todos,hydration]=await Promise.all([api('/api/schedule'),api('/api/todos'),api('/api/hydration')]);state.events=schedule.events||[];state.todos=todos.items||[];renderHydration(hydration);renderCalendar();loadBingBackground();loadWeather()}
initialize().catch(error=>toast(`数据读取失败：${error.message}`));
