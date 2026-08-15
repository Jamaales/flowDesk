// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let tickers = JSON.parse(localStorage.getItem('fd_tickers') || 'null') || [
  {symbol:'NVDA',name:'NVIDIA Corporation',price:'',rsi:'',target:'',stop:'',earnings:'Aug 27',ema20:'',ema50:'',options:'gray',technical:'gray',momentum:'gray',notes:'AI infrastructure play. Watch for VWAP reclaim setups on daily. 20 EMA is key support level.'},
  {symbol:'PLTR',name:'Palantir Technologies',price:'',rsi:'',target:'',stop:'',earnings:'Aug 4',ema20:'',ema50:'',options:'gray',technical:'gray',momentum:'gray',notes:'Government/defense AI. Watch 20 EMA on daily for entries.'},
  {symbol:'AMD',name:'Advanced Micro Devices',price:'',rsi:'',target:'',stop:'',earnings:'Jul 29',ema20:'',ema50:'',options:'gray',technical:'gray',momentum:'gray',notes:'AI/datacenter growth play. Monitor options flow on Barchart.'},
  {symbol:'QCOM',name:'Qualcomm Inc.',price:'',rsi:'',target:'',stop:'',earnings:'Jul 23',ema20:'',ema50:'',options:'gray',technical:'gray',momentum:'gray',notes:'AI at the edge, mobile chips. Watch for EMA bounces.'},
];
let emaWatch = JSON.parse(localStorage.getItem('fd_ema_watch') || '{}');
let checklistState = JSON.parse(localStorage.getItem('fd_checklist') || '{}');
let trades = JSON.parse(localStorage.getItem('fd_journal') || '[]');
let btEntries = JSON.parse(localStorage.getItem('fd_backtest') || '[]');
let jfilter = 'all';
let selected = null;
let checklistMode = localStorage.getItem('fd_checklist_mode') || 'call';

const CHECKLIST_CALL = [
  {id:'c2',label:'Price above 50 EMA (daily)',hint:'TOS daily'},
  {id:'c3',label:'Price above 20 EMA (daily)',hint:'TOS daily'},
  {id:'c4',label:'Daily RSI between 50-65',hint:'TOS daily'},
  {id:'c5',label:'VWAP reclaim confirmed on 5min',hint:'TOS 5min'},
  {id:'c6',label:'Price holding above 9 EMA (5min)',hint:'TOS 5min'},
  {id:'c7',label:'5min RSI between 50-70',hint:'TOS 5min'},
  {id:'c8',label:'Volume increasing on reclaim candle',hint:'TOS'},
  {id:'c9',label:'No resistance within 2% above',hint:'Key levels'},
  {id:'c10',label:'After 9:45am entry window',hint:'Entry rule'},
  {id:'c11',label:'Stop loss defined before entry',hint:'Risk mgmt'},
];

const CHECKLIST_PUT = [
  {id:'p2',label:'Price below 50 EMA (daily)',hint:'TOS daily'},
  {id:'p3',label:'Price below 20 EMA (daily)',hint:'TOS daily'},
  {id:'p4',label:'Daily RSI between 35-50',hint:'TOS daily'},
  {id:'p5',label:'VWAP rejection confirmed on 5min',hint:'TOS 5min'},
  {id:'p6',label:'Price holding below 9 EMA (5min)',hint:'TOS 5min'},
  {id:'p7',label:'5min RSI between 30-50',hint:'TOS 5min'},
  {id:'p8',label:'Volume increasing on rejection candle',hint:'TOS'},
  {id:'p9',label:'No support within 2% below',hint:'Key levels'},
  {id:'p10',label:'After 9:45am entry window',hint:'Entry rule'},
  {id:'p11',label:'Stop loss defined before entry',hint:'Risk mgmt'},
];

// ════════════════════════════════════════
// SAVE HELPERS
// ════════════════════════════════════════
const save = () => localStorage.setItem('fd_tickers', JSON.stringify(tickers));
const saveJournal = () => localStorage.setItem('fd_journal', JSON.stringify(trades));
const saveBt = () => localStorage.setItem('fd_backtest', JSON.stringify(btEntries));

function saveEmaWatch(sym,field,val){
  if(!emaWatch[sym])emaWatch[sym]={};
  emaWatch[sym][field]=val;
  localStorage.setItem('fd_ema_watch',JSON.stringify(emaWatch));
  renderEmaBand();updateMetrics();
}

// ════════════════════════════════════════
// CLOCK + MARKET STATUS
// ════════════════════════════════════════
function tick(){
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  const et = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'}));
  const h=et.getHours(),m=et.getMinutes(),d=et.getDay();
  const wkday=d>0&&d<6,afterOpen=h>9||(h===9&&m>=30),beforeClose=h<16;
  const open=wkday&&afterOpen&&beforeClose;
  const badge=document.getElementById('mkt-badge');
  badge.textContent=open?'MARKET OPEN':'CLOSED';
  badge.className='market-badge '+(open?'market-open':'market-closed');
  const cd=document.getElementById('entry-cd');
  if(wkday&&h===9&&m>=30&&m<45){
    const s=(45-m-1)*60+(60-et.getSeconds());
    cd.textContent='Entry window in '+Math.floor(s/60)+'m '+s%60+'s';
    cd.style.color='var(--amber)';
  }else if(wkday&&(h>9||(h===9&&m>=45))&&h<16){
    cd.textContent='Entry window open';cd.style.color='var(--green)';
  }else{cd.textContent='Pre-market';cd.style.color='var(--hint)';}
}
setInterval(tick,1000);tick();

// ════════════════════════════════════════
// TAB SWITCH
// ════════════════════════════════════════
function switchTab(tab,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('page-'+tab).classList.add('active');
}

// ════════════════════════════════════════
// CHECKLIST
// ════════════════════════════════════════
function setChecklistMode(mode){
  checklistMode = mode;
  localStorage.setItem('fd_checklist_mode', mode);
  // update toggle buttons
  var callBtn = document.getElementById('cl-toggle-call');
  var putBtn = document.getElementById('cl-toggle-put');
  if(callBtn && putBtn){
    if(mode === 'call'){
      callBtn.style.background = 'var(--green-dim)';
      callBtn.style.color = 'var(--green)';
      callBtn.style.borderColor = 'var(--green-border)';
      putBtn.style.background = 'transparent';
      putBtn.style.color = 'var(--muted)';
      putBtn.style.borderColor = 'var(--border)';
    } else {
      putBtn.style.background = 'var(--red-dim)';
      putBtn.style.color = 'var(--red)';
      putBtn.style.borderColor = 'var(--red-border)';
      callBtn.style.background = 'transparent';
      callBtn.style.color = 'var(--muted)';
      callBtn.style.borderColor = 'var(--border)';
    }
  }
  renderChecklist();
}

function renderChecklist(){
  var list = checklistMode === 'call' ? CHECKLIST_CALL : CHECKLIST_PUT;
  var color = checklistMode === 'call' ? 'var(--green)' : 'var(--red)';
  document.getElementById('checklist-items').innerHTML = list.map(function(item){
    var done = !!checklistState[item.id];
    return '<div class="ci'+(done?' done':'')+'" onclick="toggleCheck(\''+item.id+'\')">'
      +'<div class="ci-box" style="'+(done?'background:var(--'+(checklistMode==='call'?'green':'red')+'-dim);border-color:var(--'+(checklistMode==='call'?'green':'red')+'-border);color:var(--'+(checklistMode==='call'?'green':'red')+')':'')+'">'+( done?'✓':'')+'</div>'
      +'<div class="ci-lbl">'+item.label+'</div>'
      +'<div class="ci-hint">'+item.hint+'</div>'
      +'</div>';
  }).join('');
}

function toggleCheck(id){
  checklistState[id]=!checklistState[id];
  localStorage.setItem('fd_checklist',JSON.stringify(checklistState));
  renderChecklist();
}

// ════════════════════════════════════════
// EMA BAND
// ════════════════════════════════════════
function emaBias(sym){
  const e=emaWatch[sym]||{};
  const p=parseFloat(e.price),e20=parseFloat(e.ema20),e50=parseFloat(e.ema50);
  if(!p||!e20||!e50) return 'none';
  if(p>e20&&e20>e50) return 'bull';
  if(p<e20&&e20<e50) return 'bear';
  return 'neutral';
}

function renderEmaBand(){
  const band=document.getElementById('ema-band');
  if(!band) return;
  band.innerHTML = tickers.map(function(t){
    const e=emaWatch[t.symbol]||{},b=emaBias(t.symbol);
    const cc=b==='bull'?'bull':b==='bear'?'bear':b==='neutral'?'neutral':'';
    const vc=b==='bull'?'v-bull':b==='bear'?'v-bear':b==='neutral'?'v-neutral':'v-none';
    const vt=b==='bull'?'Bullish':b==='bear'?'Bearish':b==='neutral'?'Neutral':'Not set';
    return '<div class="ema-card '+cc+'">'
      +'<div class="ema-sym">'+t.symbol+'</div>'
      +'<div class="ema-row"><span class="ema-lbl">Price</span><input class="ema-inp" placeholder="--" value="'+(e.price||'')+'" oninput="saveEmaWatch(\''+t.symbol+'\',\'price\',this.value)" onclick="event.stopPropagation()"/></div>'
      +'<div class="ema-row"><span class="ema-lbl">9 EMA</span><input class="ema-inp" style="color:var(--amber)" placeholder="--" value="'+(e.ema9||'')+'" oninput="saveEmaWatch(\''+t.symbol+'\',\'ema9\',this.value)" onclick="event.stopPropagation()"/></div>'
      +'<div class="ema-row"><span class="ema-lbl">20 EMA</span><input class="ema-inp" style="color:var(--cyan)" placeholder="--" value="'+(e.ema20||'')+'" oninput="saveEmaWatch(\''+t.symbol+'\',\'ema20\',this.value)" onclick="event.stopPropagation()"/></div>'
      +'<div class="ema-row"><span class="ema-lbl">50 EMA</span><input class="ema-inp" style="color:var(--purple)" placeholder="--" value="'+(e.ema50||'')+'" oninput="saveEmaWatch(\''+t.symbol+'\',\'ema50\',this.value)" onclick="event.stopPropagation()"/></div>'
      +'<span class="ema-verdict '+vc+'">'+vt+'</span>'
      +'</div>';
  }).join('');
}

// ════════════════════════════════════════
// WATCHLIST
// ════════════════════════════════════════
function scoreOf(t){
  const g=[t.options,t.technical,t.momentum].filter(s=>s==='green').length;
  const a=[t.options,t.technical,t.momentum].filter(s=>s==='amber').length;
  if(g===3)return'strong';
  if(g>=2||(g===1&&a>=1))return'watch';
  if(g===1||a>=1)return'weak';
  return'none';
}
function sigCls(v){return v==='green'?'sg':v==='red'?'sr':v==='amber'?'sa':'sn';}
function scoreMeta(s){
  if(s==='strong')return{t:'STRONG',c:'sc-strong'};
  if(s==='watch')return{t:'WATCH',c:'sc-watch'};
  if(s==='weak')return{t:'WEAK',c:'sc-weak'};
  return{t:'--',c:'sc-none'};
}
function updateMetrics(){
  document.getElementById('cnt-w').textContent=tickers.length;
  document.getElementById('cnt-s').textContent=tickers.filter(t=>scoreOf(t)==='strong').length;
  document.getElementById('cnt-c').textContent=tickers.filter(t=>scoreOf(t)==='watch').length;
  document.getElementById('cnt-ema').textContent=tickers.filter(t=>emaBias(t.symbol)==='bull').length;
}

function render(){
  const wl=document.getElementById('watchlist');
  if(!tickers.length){wl.innerHTML='<div class="empty">No tickers yet. Add one below.</div>';updateMetrics();return;}
  wl.innerHTML=tickers.map(function(t,i){
    const sm=scoreMeta(scoreOf(t));
    const preview=t.notes?t.notes.split('\n')[0].trim():'';
    return '<div class="ticker-row'+(selected===i?' selected':'')+(t._loading?' loading':'')+'" onclick="openDetail('+i+')">'
      +'<div class="t-sym">'+t.symbol+'</div>'
      +'<div class="t-name">'+(t._loading?'looking up...':t.name||'--')+'</div>'
      +'<div class="signals">'
      +'<div class="sig '+sigCls(t.options)+'" title="Options Flow">O</div>'
      +'<div class="sig '+sigCls(t.technical)+'" title="EMA/Technical">T</div>'
      +'<div class="sig '+sigCls(t.momentum)+'" title="Volume/Momentum">M</div>'
      +'</div>'
      +'<span class="score-badge '+sm.c+'">'+sm.t+'</span>'
      +'<button class="rm-btn" onclick="event.stopPropagation();removeTicker('+i+')">X</button>'
      +(preview?'<div class="t-note">'+preview+'</div>':'')
      +'</div>';
  }).join('');
  updateMetrics();renderEmaBand();
}

async function addTicker(sym){
  const inp=document.getElementById('t-input');
  if(!sym) sym=inp.value.trim().toUpperCase();
  if(!sym||tickers.find(t=>t.symbol===sym)){if(inp)inp.value='';return;}
  const idx=tickers.length;
  tickers.push({symbol:sym,name:'',price:'',rsi:'',target:'',stop:'',earnings:'',ema20:'',ema50:'',options:'gray',technical:'gray',momentum:'gray',notes:'',_loading:true});
  if(inp)inp.value='';
  render();
  await lookupTicker(sym,idx);
}

async function lookupTicker(sym,idx){
  const st=document.getElementById('lookup-status');
  const btn=document.querySelector('.add-row button');
  st.innerHTML='Looking up '+sym+'...';
  if(btn)btn.disabled=true;
  try{
    const res=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:sym})});
    const data=await res.json();
    if(data.error)throw new Error(data.error);
    const kept={stop:tickers[idx].stop||'',earnings:tickers[idx].earnings||'',notes:tickers[idx].notes||'',ema20:tickers[idx].ema20||'',ema50:tickers[idx].ema50||''};
    tickers[idx]=Object.assign({},data,kept,{options:'gray',technical:'gray',momentum:'gray',_loading:false});
    save();render();openDetail(idx);st.textContent='';
  }catch(err){
    tickers[idx]._loading=false;tickers[idx].name='Lookup failed';
    save();render();st.textContent='Error: '+err.message;
    setTimeout(function(){st.textContent='';},4000);
  }
  if(btn)btn.disabled=false;
}

async function refreshTicker(){
  if(selected===null)return;
  tickers[selected]._loading=true;render();
  await lookupTicker(tickers[selected].symbol,selected);
}

function removeTicker(i){
  if(selected===i)closeDetail();
  tickers.splice(i,1);
  if(selected!==null&&selected>i)selected--;
  save();render();
}

function openDetail(i){
  selected=i;
  const t=tickers[i];
  document.getElementById('d-sym').textContent=t.symbol;
  document.getElementById('d-price').textContent=t.price||'--';
  document.getElementById('d-rsi').textContent=t.rsi||'--';
  document.getElementById('d-target').textContent=t.target?'$'+t.target:'--';
  document.getElementById('d-stop').value=t.stop||'';
  document.getElementById('d-earnings').value=t.earnings||'';
  document.getElementById('d-notes').value=t.notes||'';
  document.getElementById('d-ema20').value=t.ema20||'';
  document.getElementById('d-ema50').value=t.ema50||'';
  document.getElementById('btn-fv').onclick=function(){window.open('https://finviz.com/quote.ashx?t='+t.symbol,'_blank');};
  document.getElementById('btn-bc').onclick=function(){window.open('https://www.barchart.com/stocks/quotes/'+t.symbol+'/options','_blank');};
  updateEmaBiasDisplay();
  updateToggles();
  document.getElementById('detail').classList.add('active');
  render();
}

function closeDetail(){
  selected=null;
  document.getElementById('detail').classList.remove('active');
  render();
}

function updateEmaBiasDisplay(){
  if(selected===null)return;
  const t=tickers[selected];
  const p=parseFloat(t.price);
  const e20=parseFloat(t.ema20);
  const e50=parseFloat(t.ema50);
  const biasEl=document.getElementById('d-ema-bias');
  const df20=document.getElementById('ema20-df');
  const df50=document.getElementById('ema50-df');
  df20.className='ema-df';df50.className='ema-df';
  if(!p||!e20||!e50){biasEl.textContent='--';biasEl.style.color='var(--hint)';return;}
  if(p>e20&&e20>e50){
    biasEl.textContent='Bullish';biasEl.style.color='var(--green)';
    df20.classList.add('above');df50.classList.add('above');
  }else if(p<e20&&e20<e50){
    biasEl.textContent='Bearish';biasEl.style.color='var(--red)';
    df20.classList.add('below');df50.classList.add('below');
  }else{
    biasEl.textContent='Neutral';biasEl.style.color='var(--amber)';
  }
  saveEmaWatch(t.symbol,'price',t.price);
  saveEmaWatch(t.symbol,'ema20',t.ema20);
  saveEmaWatch(t.symbol,'ema50',t.ema50);
}

function saveEma(field,val){
  if(selected===null)return;
  tickers[selected][field]=val;
  save();
  updateEmaBiasDisplay();
}

function updateToggles(){
  if(selected===null)return;
  const t=tickers[selected];
  ['options','technical','momentum'].forEach(function(k){
    const b=document.getElementById('tog-'+k);
    b.className='stog';
    if(t[k]==='green')b.classList.add('g');
    else if(t[k]==='amber')b.classList.add('a');
    else if(t[k]==='red')b.classList.add('r');
  });
}

function toggleSig(key){
  if(selected===null)return;
  const cycle={gray:'amber',amber:'green',green:'red',red:'gray'};
  tickers[selected][key]=cycle[tickers[selected][key]]||'gray';
  updateToggles();save();render();
}

function saveNotes(){
  if(selected!==null){tickers[selected].notes=document.getElementById('d-notes').value;save();render();}
}

function saveField(field,val){
  if(selected!==null){tickers[selected][field]=val;save();if(field==='price')updateEmaBiasDisplay();}
}

// ════════════════════════════════════════
// JOURNAL
// ════════════════════════════════════════
function jPnl(t){
  if(!t.exit||!t.entry||!t.size)return null;
  const d=t.type==='Short'||t.type==='Put'?t.entry-t.exit:t.exit-t.entry;
  return d*t.size*(t.type==='Call'||t.type==='Put'?100:1);
}
function jStatus(t){if(!t.exit)return'open';return jPnl(t)>=0?'win':'loss';}

function setJFilter(f,el){
  jfilter=f;
  document.querySelectorAll('.filt-btn').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
  renderJournal();
}

function updateJMetrics(){
  const closed=trades.filter(function(t){return t.exit;});
  const wins=closed.filter(function(t){return jPnl(t)>=0;});
  const totalPnl=closed.reduce(function(s,t){return s+(jPnl(t)||0);},0);
  document.getElementById('j-total').textContent=trades.length;
  document.getElementById('j-wr').textContent=closed.length?Math.round(wins.length/closed.length*100)+'%':'--';
  const pel=document.getElementById('j-pnl');
  pel.textContent=(totalPnl>=0?'+$':'-$')+Math.abs(totalPnl).toFixed(2);
  pel.style.color=totalPnl>0?'var(--green)':totalPnl<0?'var(--red)':'';
  document.getElementById('j-open').textContent=trades.filter(function(t){return !t.exit;}).length;
}

function renderJournal(){
  const list=document.getElementById('trades-list');
  const filtered=trades.filter(function(t){
    if(jfilter==='all')return true;
    if(jfilter==='open')return !t.exit;
    if(jfilter==='win')return t.exit&&jPnl(t)>=0;
    if(jfilter==='loss')return t.exit&&jPnl(t)<0;
    return true;
  });
  if(!filtered.length){list.innerHTML='<div class="empty">No trades logged yet.</div>';updateJMetrics();return;}
  list.innerHTML=filtered.map(function(t){
    const st=jStatus(t),p=jPnl(t),idx=trades.indexOf(t);
    const typeClass='tt-'+t.type.toLowerCase();
    const tags=['options','technical','momentum'].map(function(s){
      const on=t.signals&&t.signals.includes(s);
      const label=s==='options'?'Options Flow':s==='technical'?'EMA/Tech':'Volume';
      return '<span class="ttag'+(on?' on':'')+'">'+label+'</span>';
    }).join('');
    const vwapTag=t.vwap?'<span class="ttag on">VWAP</span>':'';
    const ruleTag=t.followed9_45?'<span class="ttag on">9:45</span>':'';
    return '<div class="trade-card '+st+'">'
      +'<div class="trade-top">'
      +'<div class="trade-sym">'+t.symbol+'</div>'
      +'<span class="ttype '+typeClass+'">'+t.type+'</span>'
      +(t.strike?'<span style="font-size:10px;color:var(--muted);font-family:monospace;">'+t.strike+'</span>':'')
      +(t.trigger?'<span style="font-size:10px;color:var(--hint);">'+t.trigger+'</span>':'')
      +'<span class="tstatus ts-'+st+'">'+st.toUpperCase()+'</span>'
      +'</div>'
      +'<div class="tgrid">'
      +'<div class="tf"><div class="tf-lbl">Entry</div><div class="tf-val">$'+t.entry+'</div></div>'
      +'<div class="tf"><div class="tf-lbl">Exit</div><div class="tf-val">'+(t.exit?'$'+t.exit:'--')+'</div></div>'
      +'<div class="tf"><div class="tf-lbl">Size</div><div class="tf-val">'+(t.size||'--')+'</div></div>'
      +'<div class="tf"><div class="tf-lbl">Strike</div><div class="tf-val">'+(t.strike||'--')+'</div></div>'
      +'<div class="tf"><div class="tf-lbl">P&L</div><div class="tf-val '+(p===null?'':(p>=0?'win':'loss'))+'">'+(p===null?'open':(p>=0?'+$':'-$')+Math.abs(p).toFixed(2))+'</div></div>'
      +'</div>'
      +'<div class="trade-tags">'+tags+vwapTag+ruleTag+'</div>'
      +(t.notes?'<div class="trade-notes-text">'+t.notes+'</div>':'')
      +'<div class="trade-actions">'
      +(!t.exit?'<button class="btn" onclick="closeTrade('+idx+')">Close Trade</button>':'')
      +'<button class="btn" onclick="deleteTrade('+idx+')">Remove</button>'
      +'</div>'
      +'</div>';
  }).join('');
  updateJMetrics();
}

function logTrade(){
  const sym=document.getElementById('jf-sym').value.trim().toUpperCase();
  const entry=parseFloat(document.getElementById('jf-entry').value);
  if(!sym||!entry){alert('Ticker and entry price required.');return;}
  const exit=parseFloat(document.getElementById('jf-exit').value)||null;
  const size=parseFloat(document.getElementById('jf-size').value)||null;
  const signals=[];
  if(document.getElementById('jf-so').checked)signals.push('options');
  if(document.getElementById('jf-st').checked)signals.push('technical');
  if(document.getElementById('jf-sm').checked)signals.push('momentum');
  trades.unshift({
    symbol:sym,type:document.getElementById('jf-type').value,
    entry:entry.toFixed(2),exit:exit?exit.toFixed(2):null,size:size,
    strike:document.getElementById('jf-strike').value||null,
    expiry:document.getElementById('jf-expiry').value||null,
    trigger:document.getElementById('jf-trigger').value||null,
    signals:signals,
    followed9_45:document.getElementById('jf-rule').checked,
    vwap:document.getElementById('jf-vwap').checked,
    notes:document.getElementById('jf-notes').value.trim(),
    entryDate:document.getElementById('jf-edate').value,
    exitDate:document.getElementById('jf-xdate').value
  });
  saveJournal();clearJForm();renderJournal();
}

function clearJForm(){
  ['jf-sym','jf-entry','jf-exit','jf-size','jf-notes','jf-edate','jf-xdate','jf-strike'].forEach(function(id){document.getElementById(id).value='';});
  ['jf-type','jf-trigger'].forEach(function(id){document.getElementById(id).selectedIndex=0;});
  ['jf-so','jf-st','jf-sm','jf-rule','jf-vwap'].forEach(function(id){document.getElementById(id).checked=false;});
  document.getElementById('jf-edate').value=new Date().toISOString().split('T')[0];
}

function closeTrade(i){
  const p=prompt('Exit price:');
  if(!p)return;
  trades[i].exit=parseFloat(p).toFixed(2);
  trades[i].exitDate=new Date().toISOString().split('T')[0];
  saveJournal();renderJournal();
}

function deleteTrade(i){trades.splice(i,1);saveJournal();renderJournal();}

// ════════════════════════════════════════
// BACKTEST
// ════════════════════════════════════════
var btMode = localStorage.getItem('fd_bt_mode') || 'call';

function setBtMode(mode){
  btMode = mode;
  localStorage.setItem('fd_bt_mode', mode);
  var callBtn = document.getElementById('bt-toggle-call');
  var putBtn = document.getElementById('bt-toggle-put');
  if(callBtn && putBtn){
    if(mode === 'call'){
      callBtn.style.background = 'var(--green-dim)';
      callBtn.style.color = 'var(--green)';
      callBtn.style.borderColor = 'var(--green-border)';
      putBtn.style.background = 'transparent';
      putBtn.style.color = 'var(--muted)';
      putBtn.style.borderColor = 'var(--border)';
    } else {
      putBtn.style.background = 'var(--red-dim)';
      putBtn.style.color = 'var(--red)';
      putBtn.style.borderColor = 'var(--red-border)';
      callBtn.style.background = 'transparent';
      callBtn.style.color = 'var(--muted)';
      callBtn.style.borderColor = 'var(--border)';
    }
  }
  renderBtChecklist();
}

function checkRSI(inp,warnId){
  document.getElementById(warnId).style.display=parseFloat(inp.value)>=70?'block':'none';
}

var BT_CALL = [
  {id:'bc1',label:'Price above 50 EMA (Daily)'},
  {id:'bc2',label:'Price above 20 EMA (Daily)'},
  {id:'bc3',label:'Price above 9 EMA (5min)'},
  {id:'bc4',label:'VWAP Reclaim Confirmed'},
  {id:'bc5',label:'After 9:45am'},
  {id:'bc6',label:'Volume Confirmed'},
  {id:'bc7',label:'Daily RSI 50-65'},
  {id:'bc8',label:'5min RSI 50-70'},
  {id:'bc9',label:'No Resistance Overhead'},
  {id:'bc10',label:'Stop Loss Defined'},
];

var BT_PUT = [
  {id:'bp1',label:'Price below 50 EMA (Daily)'},
  {id:'bp2',label:'Price below 20 EMA (Daily)'},
  {id:'bp3',label:'Price below 9 EMA (5min)'},
  {id:'bp4',label:'VWAP Rejection Confirmed'},
  {id:'bp5',label:'After 9:45am'},
  {id:'bp6',label:'Volume Confirmed'},
  {id:'bp7',label:'Daily RSI 35-50'},
  {id:'bp8',label:'5min RSI 30-50'},
  {id:'bp9',label:'No Support Below'},
  {id:'bp10',label:'Stop Loss Defined'},
];

var btCheckState = {};

function renderBtChecklist(){
  var list = btMode === 'call' ? BT_CALL : BT_PUT;
  var el = document.getElementById('bt-checklist-items');
  if(!el) return;
  el.innerHTML = list.map(function(item){
    var checked = !!btCheckState[item.id];
    return '<label class="bt-check" style="'+(checked?'border-color:var(--'+(btMode==='call'?'green':'red')+'-border);background:var(--'+(btMode==='call'?'green':'red')+'-dim);':'')+'">'
      +'<input type="checkbox" '+(checked?'checked':'')+' onchange="toggleBtCheck(\''+item.id+'\',this.checked)"> '+item.label
      +'</label>';
  }).join('');
}

function toggleBtCheck(id, checked){
  btCheckState[id] = checked;
  renderBtChecklist();
}

function getBtChecklist(){
  var list = btMode === 'call' ? BT_CALL : BT_PUT;
  var result = {mode: btMode};
  list.forEach(function(item){ result[item.id] = !!btCheckState[item.id]; });
  return result;
}

function clScore(c){
  var keys = Object.keys(c).filter(function(k){ return k !== 'mode'; });
  var passed = keys.filter(function(k){ return c[k]; }).length;
  return passed + '/' + keys.length;
}

function addBtEntry(){
  const date=document.getElementById('bf-date').value;
  const stock=document.getElementById('bf-stock').value;
  const result=document.getElementById('bf-result').value;
  if(!date||!stock||!result){alert('Date, stock, and result required.');return;}
  btEntries.unshift({
    id:Date.now(),date:date,stock:stock,
    time:document.getElementById('bf-time').value,
    rsiD:document.getElementById('bf-rsid').value,
    rsi5:document.getElementById('bf-rsi5').value,
    entry:document.getElementById('bf-entry').value,
    stop:document.getElementById('bf-stop').value,
    target:document.getElementById('bf-target').value,
    exit:document.getElementById('bf-exit').value,
    strike:document.getElementById('bf-strike').value,
    expiry:document.getElementById('bf-expiry').value,
    result:result,
    checklist:getBtChecklist(),
    notes:document.getElementById('bf-notes').value
  });
  saveBt();clearBtForm();renderBtTable();updateBtStats();
}

function clearBtForm(){
  ['bf-date','bf-time','bf-rsid','bf-rsi5','bf-entry','bf-stop','bf-target','bf-exit','bf-strike','bf-expiry','bf-notes'].forEach(function(id){document.getElementById(id).value='';});
  ['bf-stock','bf-result'].forEach(function(id){document.getElementById(id).selectedIndex=0;});
  ['rsi-d-warn','rsi-5-warn'].forEach(function(id){document.getElementById(id).style.display='none';});
  btCheckState = {};
  renderBtChecklist();
  document.getElementById('bf-date').value=new Date().toISOString().split('T')[0];
}

function deleteBtEntry(id){
  btEntries=btEntries.filter(function(e){return e.id!==id;});
  saveBt();renderBtTable();updateBtStats();
}

function updateBtStats(){
  const total=btEntries.length;
  const wins=btEntries.filter(function(e){return e.result==='Win';}).length;
  const losses=btEntries.filter(function(e){return e.result==='Loss';}).length;
  const skips=btEntries.filter(function(e){return e.result==='Skip';}).length;
  const traded=wins+losses;
  document.getElementById('bt-total').textContent=total;
  document.getElementById('bt-wins').textContent=wins;
  document.getElementById('bt-losses').textContent=losses;
  document.getElementById('bt-skips').textContent=skips;
  document.getElementById('bt-wr').textContent=traded>0?Math.round(wins/traded*100)+'%':'--';
}

function renderBtTable(){
  var fs=document.getElementById('bt-filt-stock').value;
  var fr=document.getElementById('bt-filt-result').value;
  var filtered=btEntries.filter(function(e){return(!fs||e.stock===fs)&&(!fr||e.result===fr);});
  var tbody=document.getElementById('bt-tbody');
  var empty=document.getElementById('bt-empty');
  if(!filtered.length){tbody.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  function badgeClass(r){return r==='Win'?'sc-strong':r==='Loss'?'sc-weak':'sc-watch';}
  tbody.innerHTML=filtered.map(function(e){
    var sc=clScore(e.checklist);
    var scNum=parseInt(sc);
    var scColor=scNum>=7?'var(--green)':scNum>=5?'var(--cyan)':'var(--amber)';
    var hasLesson = e.lessons ? 'border-left:3px solid var(--cyan);' : '';
    return '<tr style="cursor:pointer;'+hasLesson+'" onclick="openBtDetail('+e.id+')">'
      +'<td style="font-family:monospace;font-size:11px;">'+e.date+'</td>'
      +'<td><span class="ticker-mono">'+e.stock+'</span></td>'
      +'<td style="font-family:monospace;font-size:11px;">'+(e.time||'--')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:'+scColor+'">'+sc+'</td>'
      +'<td style="font-family:monospace;font-size:11px;">'+(e.rsiD||'--')+' / '+(e.rsi5||'--')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;">'+(e.entry?'$'+e.entry:'--')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:var(--red)">'+(e.stop?'$'+e.stop:'--')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:var(--green)">'+(e.target?'$'+e.target:'--')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;">'+(e.exit?'$'+e.exit:'--')+'</td>'
      +'<td><span class="score-badge '+badgeClass(e.result)+'">'+e.result+'</span></td>'
      +'<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--hint);">'+(e.lessons?'📝 ':'')+(e.notes||'--')+'</td>'
      +'<td><button class="btn" style="font-size:10px;padding:3px 8px;color:var(--red);border-color:transparent;" onclick="event.stopPropagation();deleteBtEntry('+e.id+')">X</button></td>'
      +'</tr>';
  }).join('');
}

function openBtDetail(id){
  var e = btEntries.find(function(x){return x.id===id;});
  if(!e) return;
  var modal = document.getElementById('bt-detail-modal');
  var badgeClass = e.result==='Win'?'sc-strong':e.result==='Loss'?'sc-weak':'sc-watch';
  var modeLabel = e.checklist && e.checklist.mode ? e.checklist.mode.toUpperCase() : '--';
  var modeBadgeColor = modeLabel==='CALL'?'var(--green)':'var(--red)';

  // build checklist review
  var clHTML = '';
  if(e.checklist){
    var keys = Object.keys(e.checklist).filter(function(k){return k!=='mode';});
    var allItems = BT_CALL.concat(BT_PUT);
    clHTML = keys.map(function(k){
      var item = allItems.find(function(x){return x.id===k;});
      var passed = e.checklist[k];
      var label = item ? item.label : k;
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">'
        +'<div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;'
        +(passed?'background:var(--green-dim);border:1px solid var(--green-border);color:var(--green);':'background:var(--surface2);border:1px solid var(--border);color:var(--hint);')
        +'">'+(passed?'✓':'')+'</div>'
        +'<span style="font-size:12px;color:'+(passed?'var(--text)':'var(--hint)')+';">'+label+'</span>'
        +'</div>';
    }).join('');
  }

  modal.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="closeBtDetail(event)">'
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding:20px;" onclick="event.stopPropagation()">'

    // header
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">'
    +'<div style="display:flex;align-items:center;gap:10px;">'
    +'<span style="font-family:monospace;font-size:18px;font-weight:700;color:var(--cyan);">'+e.stock+'</span>'
    +'<span class="score-badge '+badgeClass+'">'+e.result+'</span>'
    +'<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid;color:'+modeBadgeColor+';border-color:'+modeBadgeColor+';background:transparent;">'+modeLabel+'</span>'
    +'</div>'
    +'<div style="display:flex;gap:6px;">'
    +'<button class="btn" onclick="saveBtDetail('+id+')" style="color:var(--green);border-color:var(--green-border);background:var(--green-dim);">Save</button>'
    +'<button class="btn" onclick="closeBtDetail()">✕ Close</button>'
    +'</div>'
    +'</div>'

    // stats grid
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Date</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+e.date+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Time</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+(e.time||'--')+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">RSI D/5m</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+(e.rsiD||'--')+' / '+(e.rsi5||'--')+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Checklist</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+clScore(e.checklist)+'</div></div>'
    +'</div>'

    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Entry</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+(e.entry?'$'+e.entry:'--')+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Stop</div><div style="font-family:monospace;font-size:12px;font-weight:600;color:var(--red);">'+(e.stop?'$'+e.stop:'--')+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Target</div><div style="font-family:monospace;font-size:12px;font-weight:600;color:var(--green);">'+(e.target?'$'+e.target:'--')+'</div></div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:9px 11px;"><div style="font-size:9px;color:var(--muted);margin-bottom:3px;font-family:monospace;text-transform:uppercase;">Exit</div><div style="font-family:monospace;font-size:12px;font-weight:600;">'+(e.exit?'$'+e.exit:'--')+'</div></div>'
    +'</div>'

    // checklist review
    +(clHTML?'<div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-family:monospace;">Checklist Review</div>'
    +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:16px;">'+clHTML+'</div>':'')

    // notes
    +'<div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-family:monospace;">Setup Notes</div>'
    +'<textarea id="bt-detail-notes" style="width:100%;font-size:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);resize:vertical;min-height:80px;font-family:sans-serif;outline:none;line-height:1.6;margin-bottom:14px;" placeholder="Setup notes...">'+(e.notes||'')+'</textarea>'

    // lessons learned
    +'<div style="font-size:10px;font-weight:600;color:var(--cyan);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;font-family:monospace;">Lessons Learned</div>'
    +'<textarea id="bt-detail-lessons" style="width:100%;font-size:12px;padding:10px 12px;border:1px solid var(--cyan-border);border-radius:8px;background:var(--cyan-dim);color:var(--text);resize:vertical;min-height:80px;font-family:sans-serif;outline:none;line-height:1.6;" placeholder="What did this trade teach you? What would you do differently? What did you do well?">'+(e.lessons||'')+'</textarea>'

    +'</div>'
    +'</div>';

  modal.style.display='block';
}

function closeBtDetail(event){
  if(event && event.target !== document.querySelector('#bt-detail-modal > div')) return;
  document.getElementById('bt-detail-modal').style.display='none';
}

function saveBtDetail(id){
  var e = btEntries.find(function(x){return x.id===id;});
  if(!e) return;
  e.notes = document.getElementById('bt-detail-notes').value;
  e.lessons = document.getElementById('bt-detail-lessons').value;
  saveBt();
  renderBtTable();
  document.getElementById('bt-detail-modal').style.display='none';
}

function exportBtCSV(){
  if(!btEntries.length){alert('No entries to export.');return;}
  const headers=['Date','Stock','Time','Checklist','RSI Daily','RSI 5min','Entry','Stop','Target','Exit','Strike','Expiry','Result','Notes'];
  const rows=btEntries.map(function(e){
    return [e.date,e.stock,e.time,clScore(e.checklist),e.rsiD,e.rsi5,e.entry,e.stop,e.target,e.exit,e.strike,e.expiry,e.result,'"'+(e.notes||'').replace(/"/g,'""')+'"'];
  });
  const csv=[headers].concat(rows).map(function(r){return r.join(',');}).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='flowdesk_backtest.csv';
  a.click();
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
render();
clearJForm();
renderJournal();
setChecklistMode(checklistMode);
updateBtStats();
renderBtTable();
clearBtForm();
setBtMode(btMode);
