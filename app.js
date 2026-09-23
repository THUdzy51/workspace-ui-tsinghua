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

function renderHeader(){const now=new Date();$('#page-kicker').textContent='';$('#page-title').textContent='个人工作空间';$('#header-gregorian').textContent=now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});$('#header-lunar').textContent=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{dateStyle:'long'}).format(now)+' · '+now.toLocaleDateString('zh-CN',{weekday:'long'});$('#server-time').textContent='本地 UI · 独立运行'}

async function initialize(){renderHeader();state.viewMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);const [schedule,todos,hydration]=await Promise.all([api('/api/schedule'),api('/api/todos'),api('/api/hydration')]);state.events=schedule.events||[];state.todos=todos.items||[];renderHydration(hydration);renderCalendar();loadBingBackground();loadWeather()}
initialize().catch(error=>toast(`数据读取失败：${error.message}`));
