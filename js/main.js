// ================= BOOT / ERROR HANDLING =================
function showBootError(title, detail){
  const box = document.getElementById('bootError');
  box.style.display = 'block';
  box.textContent = "⚠ " + title + "\n" + detail;
  document.getElementById('loadingScreen').style.display = 'none';
  console.error(title, detail);
}
window.addEventListener('error', (e)=> showBootError("Script error", e.message + " (" + e.filename + ":" + e.lineno + ")"));

// ================= SUPABASE INIT =================
const SUPABASE_URL = "https://kedaqkrxtqsjmekiptvm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SZKoXv6qcxYKn_4hKbvcEA_MgEnSrDk";
let sb = null;
try{
  if(typeof window.supabase === 'undefined') throw new Error("Supabase library failed to load from CDN.");
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}catch(err){ showBootError("Failed to initialize Supabase", err.message); }

// ================= GLOBAL STATE =================
let currentUser = null;
let profile = null;
let accounts = [];
let categories = [];
let transactions = [];
let goals = [];
let currentPage = 'dashboard';
let txType = 'income';
let editingTxId = null;
const CURRENCY_SYMBOL = { BDT:'৳', USD:'$' };

const DEFAULT_CATEGORIES = [
  { name:"Salary", name_bn:"বেতন", type:"income", section:"personal", icon:"wallet", color:"#00D9A3" },
  { name:"Freelance", name_bn:"ফ্রিল্যান্স", type:"income", section:"personal", icon:"laptop", color:"#00D9A3" },
  { name:"Tuition Income", name_bn:"টিউশন আয়", type:"income", section:"student", icon:"book", color:"#00D9A3" },
  { name:"Business Income", name_bn:"ব্যবসার আয়", type:"income", section:"business", icon:"briefcase", color:"#00D9A3" },
  { name:"Other Income", name_bn:"অন্যান্য আয়", type:"income", section:"personal", icon:"plus-circle", color:"#00D9A3" },
  { name:"Food", name_bn:"খাবার", type:"expense", section:"personal", icon:"utensils", color:"#FF6B6B" },
  { name:"Transport", name_bn:"যাতায়াত", type:"expense", section:"personal", icon:"car", color:"#E8B95C" },
  { name:"Rent", name_bn:"বাড়ি ভাড়া", type:"expense", section:"personal", icon:"home", color:"#9C7AE6" },
  { name:"Utilities", name_bn:"ইউটিলিটি বিল", type:"expense", section:"personal", icon:"zap", color:"#5AC8FA" },
  { name:"Education", name_bn:"শিক্ষা খরচ", type:"expense", section:"student", icon:"book-open", color:"#5AC8FA" },
  { name:"Shopping", name_bn:"শপিং", type:"expense", section:"personal", icon:"shopping-bag", color:"#E8B95C" },
  { name:"Healthcare", name_bn:"স্বাস্থ্য", type:"expense", section:"personal", icon:"heart-pulse", color:"#FF6B6B" },
  { name:"Business Expense", name_bn:"ব্যবসার খরচ", type:"expense", section:"business", icon:"briefcase", color:"#FF6B6B" },
  { name:"Other Expense", name_bn:"অন্যান্য খরচ", type:"expense", section:"personal", icon:"more-horizontal", color:"#8B93A5" }
];

// ================= INIT FLOW =================
async function init(){
  if(!sb) return;
  try{
    const { data, error } = await sb.auth.getSession();
    if(error) throw error;
    if(!data.session){ window.location.href = 'index.html'; return; }
    currentUser = data.session.user;

    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    document.getElementById('contentArea').innerHTML = skeletonHTML();
    lucide.createIcons();

    await loadProfile();
    await ensureDefaultCategories();
    await Promise.all([loadAccounts(), loadCategories(), loadTransactions(), loadGoals()]);

    setupUserChip();
    applyTranslations();
    setLang(currentLang);
    document.getElementById('txDate').value = new Date().toISOString().slice(0,10);

    goPage('dashboard');
  }catch(err){
    showBootError("Failed to load app", err.message);
  }
}

function skeletonHTML(){
  return `
  <div class="stat-grid">
    <div class="skel skel-stat"></div><div class="skel skel-stat"></div>
    <div class="skel skel-stat"></div><div class="skel skel-stat"></div>
  </div>
  <div class="panel-box">
    <div class="skel skel-row"></div><div class="skel skel-row"></div><div class="skel skel-row"></div>
  </div>`;
}

async function loadProfile(){
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if(error && error.code !== 'PGRST116') console.warn(error);
  profile = data || { full_name: currentUser.email.split('@')[0], default_currency:'BDT', language:'en' };
  if(profile.language) { currentLang = profile.language; localStorage.setItem('finora_lang', currentLang); }
}

async function ensureDefaultCategories(){
  const { data, error } = await sb.from('categories').select('id').eq('user_id', currentUser.id).limit(1);
  if(error){ console.warn(error); return; }
  if(data && data.length === 0){
    const rows = DEFAULT_CATEGORIES.map(c=>({ ...c, user_id: currentUser.id, is_default:true }));
    await sb.from('categories').insert(rows);
  }
}

async function loadAccounts(){
  const { data, error } = await sb.from('accounts').select('*').eq('user_id', currentUser.id).order('created_at');
  if(error) throw error;
  accounts = data || [];
}
async function loadCategories(){
  const { data, error } = await sb.from('categories').select('*').eq('user_id', currentUser.id);
  if(error) throw error;
  categories = data || [];
}
async function loadTransactions(){
  const { data, error } = await sb.from('transactions').select('*').eq('user_id', currentUser.id).order('transaction_date', { ascending:false });
  if(error) throw error;
  transactions = data || [];
}
async function loadGoals(){
  const { data, error } = await sb.from('goals').select('*').eq('user_id', currentUser.id).order('created_at');
  if(error) throw error;
  goals = data || [];
}

function setupUserChip(){
  const name = profile.full_name || currentUser.email;
  document.getElementById('userNameChip').textContent = name;
  document.getElementById('userMailChip').textContent = currentUser.email;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
}

async function logout(){
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// ================= NAVIGATION =================
function goPage(page){
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el=> el.classList.toggle('active', el.dataset.page === page));
  document.getElementById('sidebar').classList.remove('open');
  renderCurrentPage();
}

function renderCurrentPage(){
  const titles = { dashboard:'nav.dashboard', personal:'nav.personal', student:'nav.student',
    business:'nav.business', savings:'nav.savings', goals:'nav.goals', reports:'nav.reports', settings:'nav.settings' };
  document.getElementById('pageTitle').textContent = t(titles[currentPage]);
  const area = document.getElementById('contentArea');
  area.style.opacity = '0';
  area.style.transform = 'translateY(6px)';

  setTimeout(()=>{
    if(currentPage === 'dashboard') area.innerHTML = renderDashboard();
    else if(['personal','student','business','savings'].includes(currentPage)) area.innerHTML = renderSection(currentPage);
    else if(currentPage === 'goals') area.innerHTML = renderGoalsPage();
    else if(currentPage === 'reports') area.innerHTML = renderReportsPage();
    else if(currentPage === 'settings') area.innerHTML = renderSettingsPage();

    lucide.createIcons();
    if(currentPage === 'dashboard') setTimeout(drawDashboardCharts, 30);

    area.style.transition = 'opacity .25s ease, transform .25s ease';
    requestAnimationFrame(()=>{ area.style.opacity = '1'; area.style.transform = 'translateY(0)'; });
  }, 80);
}

// ================= HELPERS =================
function fmtMoney(amount, currency){
  const sym = CURRENCY_SYMBOL[currency || profile.default_currency] || '';
  const num = Number(amount);
  if(currentLang === 'bn'){
    return sym + ' ' + toBengaliDigits(formatIndianStyle(num));
  }
  return sym + ' ' + num.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2});
}
function formatIndianStyle(num){
  const neg = num < 0; num = Math.abs(num);
  const fixed = num.toFixed(num % 1 === 0 ? 0 : 2);
  const [intPart, decPart] = fixed.split('.');
  let last3 = intPart.length > 3 ? intPart.slice(-3) : intPart;
  let other = intPart.length > 3 ? intPart.slice(0, -3) : '';
  if(other !== '') other = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const result = (other ? other + ',' : '') + last3;
  return (neg ? '-' : '') + result + (decPart ? '.' + decPart : '');
}
function toBengaliDigits(str){
  const map = {'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'};
  return str.replace(/[0-9]/g, d=>map[d]);
}
function catById(id){ return categories.find(c=>c.id===id); }
function accById(id){ return accounts.find(a=>a.id===id); }
function catLabel(cat){ if(!cat) return '—'; return currentLang==='bn' && cat.name_bn ? cat.name_bn : cat.name; }
function sumBy(list, type){ return list.filter(tx=>tx.type===type).reduce((s,tx)=>s+Number(tx.amount),0); }
function monthKey(d){ const dt=new Date(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); }

// ================= DASHBOARD =================
function renderDashboard(){
  const totalIncome = sumBy(transactions, 'income');
  const totalExpense = sumBy(transactions, 'expense');
  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netBalance/totalIncome)*100) : 0;

  const recent = transactions.slice(0,6);
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'greet.morning' : hour < 17 ? 'greet.afternoon' : 'greet.evening';
  const greetText = { 'greet.morning': currentLang==='bn'?'শুভ সকাল':'Good morning',
    'greet.afternoon': currentLang==='bn'?'শুভ অপরাহ্ন':'Good afternoon',
    'greet.evening': currentLang==='bn'?'শুভ সন্ধ্যা':'Good evening' }[greetKey];
  const dateStr = new Date().toLocaleDateString(currentLang==='bn' ? 'bn-BD' : 'en-US', { weekday:'long', day:'numeric', month:'long' });
  const insightText = netBalance >= 0
    ? (currentLang==='bn' ? `এই মাসে আপনি ভালো অবস্থানে আছেন — সঞ্চয়ের হার ${toBengaliDigits(String(savingsRate))}%` : `You're on track — savings rate is ${savingsRate}%`)
    : (currentLang==='bn' ? 'খরচ আয়ের চেয়ে বেশি হয়ে যাচ্ছে, একটু নজর দিন' : 'Expenses are exceeding income — keep an eye on it');

  return `
  <div class="hero-banner">
    <div class="hero-greeting">${greetText}, ${escapeHtml(profile.full_name || currentUser.email.split('@')[0])}</div>
    <div class="hero-name">${fmtMoney(netBalance)}</div>
    <div class="hero-insight"><i data-lucide="${netBalance>=0?'sparkles':'alert-circle'}" style="width:14px;height:14px;"></i> ${insightText}</div>
    <div class="hero-date" style="margin-top:8px;">${dateStr}</div>
  </div>

  <div class="stat-grid">
    ${statCard('trending-up', t('stat.income'), fmtMoney(totalIncome), 'var(--emerald)', 'var(--emerald-soft)')}
    ${statCard('trending-down', t('stat.expense'), fmtMoney(totalExpense), 'var(--danger)', 'var(--danger-dim)')}
    ${statCard('wallet', t('stat.balance'), fmtMoney(netBalance), 'var(--gold)', '#E8B95C18')}
    ${statCard('piggy-bank', t('stat.savings'), (currentLang==='bn'?toBengaliDigits(String(savingsRate)):savingsRate) + '%', 'var(--emerald)', 'var(--emerald-soft)')}
  </div>

  <div style="margin-bottom:18px;">
    <div class="panel-title" style="margin-bottom:10px;">${t('panel.accounts')}</div>
    <div class="accounts-row">
      ${accounts.map(a=>accountCard(a)).join('') || `<div class="empty-state" style="width:100%;"><p>${t('empty.accounts')}</p></div>`}
      <div class="account-card" style="display:flex; align-items:center; justify-content:center; cursor:pointer; border-style:dashed;" onclick="openAccModal()">
        <i data-lucide="plus" style="color:var(--text-dim);"></i>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="panel-box">
      <div class="panel-head"><div class="panel-title">${t('panel.trend')}</div></div>
      <canvas id="trendChart" height="200"></canvas>
    </div>
    <div class="panel-box">
      <div class="panel-head"><div class="panel-title">${t('panel.breakdown')}</div></div>
      <canvas id="breakdownChart" height="200"></canvas>
    </div>
  </div>

  <div class="panel-box">
    <div class="panel-head"><div class="panel-title">${t('panel.recent')}</div></div>
    ${recent.length ? recent.map(tx=>txRow(tx)).join('') : emptyState('inbox', t('empty.tx'))}
  </div>
  `;
}

function statCard(icon, label, value, color, bg){
  return `<div class="stat-card">
    <div class="stat-top">
      <div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>
      <div class="stat-icon" style="background:${bg}; color:${color};"><i data-lucide="${icon}"></i></div>
    </div>
  </div>`;
}

function accountCard(a){
  const typeLabel = { cash:t('acctype.cash'), bank:t('acctype.bank'), mobile_banking:t('acctype.mobile') }[a.type] || a.type;
  return `<div class="account-card" onclick="openAccModal('${a.id}')" style="cursor:pointer;">
    <div class="account-type">${typeLabel}</div>
    <div class="account-name">${a.name}</div>
    <div class="account-balance">${fmtMoney(a.balance, a.currency)}</div>
  </div>`;
}

function emptyState(icon, text){
  return `<div class="empty-state"><i data-lucide="${icon}"></i><p>${text}</p></div>`;
}

function txRow(tx){
  const cat = catById(tx.category_id);
  const acc = accById(tx.account_id);
  const color = tx.type === 'income' ? 'var(--emerald)' : 'var(--danger)';
  const bg = tx.type === 'income' ? 'var(--emerald-soft)' : 'var(--danger-dim)';
  const sign = tx.type === 'income' ? '+' : '−';
  return `<div class="tx-row">
    <div class="tx-icon" style="background:${bg}; color:${color};"><i data-lucide="${cat?.icon || 'circle'}"></i></div>
    <div class="tx-info">
      <div class="tx-name">${catLabel(cat)}${tx.description ? ' · '+escapeHtml(tx.description) : ''}</div>
      <div class="tx-meta">${tx.transaction_date} ${acc ? '· '+acc.name : ''}</div>
    </div>
    <div class="tx-amount" style="color:${color};">${sign} ${fmtMoney(tx.amount, tx.currency)}</div>
    <div class="tx-actions">
      <button onclick="openTxModal('${tx.id}')"><i data-lucide="pencil"></i></button>
      <button onclick="quickDeleteTx('${tx.id}')"><i data-lucide="trash-2"></i></button>
    </div>
  </div>`;
}
function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function drawDashboardCharts(){
  // Trend chart - last 6 months
  const months = [];
  const now = new Date();
  for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); months.push(monthKey(d)); }
  const incomeData = months.map(m=> transactions.filter(tx=>tx.type==='income' && monthKey(tx.transaction_date)===m).reduce((s,tx)=>s+Number(tx.amount),0));
  const expenseData = months.map(m=> transactions.filter(tx=>tx.type==='expense' && monthKey(tx.transaction_date)===m).reduce((s,tx)=>s+Number(tx.amount),0));

  const trendCanvas = document.getElementById('trendChart');
  if(trendCanvas){
    if(trendCanvas._chart) trendCanvas._chart.destroy();
    trendCanvas._chart = new Chart(trendCanvas, {
      type:'line',
      data:{ labels: months.map(m=>m.slice(5)+'/'+m.slice(2,4)),
        datasets:[
          { label:t('type.income'), data:incomeData, borderColor:'#00D9A3', backgroundColor:'#00D9A322', tension:.35, fill:true },
          { label:t('type.expense'), data:expenseData, borderColor:'#FF6B6B', backgroundColor:'#FF6B6B22', tension:.35, fill:true }
        ]},
      options:{ plugins:{legend:{labels:{color:'#8B93A5'}}}, scales:{
        x:{ticks:{color:'#8B93A5'}, grid:{color:'#232A38'}},
        y:{ticks:{color:'#8B93A5'}, grid:{color:'#232A38'}}
      }}
    });
  }

  // Breakdown - expense by category (doughnut)
  const expenseTx = transactions.filter(tx=>tx.type==='expense');
  const byCat = {};
  expenseTx.forEach(tx=>{ const cat=catById(tx.category_id); const key=catLabel(cat); byCat[key]=(byCat[key]||0)+Number(tx.amount); });
  const labels = Object.keys(byCat);
  const dataVals = Object.values(byCat);
  const palette = ['#00D9A3','#E8B95C','#FF6B6B','#9C7AE6','#5AC8FA','#8B93A5','#F2789F','#6FCF97'];

  const bdCanvas = document.getElementById('breakdownChart');
  if(bdCanvas){
    if(bdCanvas._chart) bdCanvas._chart.destroy();
    if(labels.length === 0){
      const ctx = bdCanvas.getContext('2d');
      ctx.clearRect(0,0,bdCanvas.width,bdCanvas.height);
    } else {
      bdCanvas._chart = new Chart(bdCanvas, {
        type:'doughnut',
        data:{ labels, datasets:[{ data:dataVals, backgroundColor:palette, borderWidth:0 }] },
        options:{ plugins:{legend:{position:'bottom', labels:{color:'#8B93A5', boxWidth:10, font:{size:11}}}} }
      });
    }
  }
}

// ================= SECTION PAGES =================
function renderSection(section){
  const sectionTx = transactions.filter(tx=>tx.section===section);
  const income = sumBy(sectionTx, 'income');
  const expense = sumBy(sectionTx, 'expense');
  return `
  <div class="stat-grid">
    ${statCard('trending-up', t('stat.income'), fmtMoney(income), 'var(--emerald)', 'var(--emerald-soft)')}
    ${statCard('trending-down', t('stat.expense'), fmtMoney(expense), 'var(--danger)', 'var(--danger-dim)')}
    ${statCard('wallet', t('stat.balance'), fmtMoney(income-expense), 'var(--gold)', '#E8B95C18')}
  </div>
  <div class="panel-box">
    <div class="panel-head">
      <div class="panel-title">${t('panel.transactions')}</div>
      <button class="btn-add" onclick="openTxModal(null,'${section}')"><i data-lucide="plus"></i><span>${t('btn.addtx')}</span></button>
    </div>
    ${sectionTx.length ? sectionTx.map(tx=>txRow(tx)).join('') : emptyState('inbox', t('empty.tx'))}
  </div>`;
}

// ================= GOALS PAGE =================
function renderGoalsPage(){
  return `
  <div class="panel-head" style="margin-bottom:16px;">
    <div></div>
    <button class="btn-add" onclick="openGoalModal()"><i data-lucide="plus"></i><span>${t('btn.addgoal')}</span></button>
  </div>
  ${goals.length ? goals.map(g=>goalCard(g)).join('') : emptyState('target', t('empty.goals'))}
  `;
}

function goalCard(g){
  const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
  return `<div class="goal-card">
    <div class="goal-top">
      <div>
        <div class="goal-name">${escapeHtml(g.title)}</div>
        ${g.deadline ? `<div class="goal-deadline">📅 ${g.deadline}</div>` : ''}
      </div>
      <div class="tx-actions">
        <button onclick="quickDeleteGoal('${g.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
    <div class="goal-foot">
      <span>${fmtMoney(g.current_amount, g.currency)} ${t('goal.of')} ${fmtMoney(g.target_amount, g.currency)}</span>
      <span style="color:var(--emerald); font-weight:600;">${pct}% ${t('goal.complete')}</span>
    </div>
  </div>`;
}

// ================= REPORTS PAGE =================
function renderReportsPage(){
  const today = new Date().toISOString().slice(0,10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  return `
  <div class="panel-box" style="margin-bottom:18px;">
    <div class="panel-title" style="margin-bottom:6px;">${t('reports.title')}</div>
    <div style="color:var(--text-dim); font-size:13px; margin-bottom:18px;">${t('reports.desc')}</div>
    <div class="grid-2" style="margin-bottom:14px;">
      <div class="field" style="margin:0;"><label>${t('reports.from')}</label><div class="input-box"><input type="date" id="reportFrom" value="${monthStart}"></div></div>
      <div class="field" style="margin:0;"><label>${t('reports.to')}</label><div class="input-box"><input type="date" id="reportTo" value="${today}"></div></div>
    </div>
    <button class="btn-primary" onclick="generateReport()">${t('reports.generate')}</button>
  </div>
  <div id="reportOutput"></div>
  `;
}

function generateReport(){
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  const filtered = transactions.filter(tx=> tx.transaction_date >= from && tx.transaction_date <= to);
  const income = sumBy(filtered, 'income');
  const expense = sumBy(filtered, 'expense');

  const html = `
  <div class="panel-box" id="printableReport">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
      <div>
        <div class="panel-title" style="font-size:18px;">Finora — Financial Report</div>
        <div style="color:var(--text-dim); font-size:12.5px;">${from} → ${to}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="icon-btn" onclick="printReport()" title="Print"><i data-lucide="printer"></i></button>
        <button class="icon-btn" onclick="exportPDF()" title="PDF"><i data-lucide="file-down"></i></button>
      </div>
    </div>
    <div class="stat-grid" style="margin-bottom:18px;">
      ${statCard('trending-up', t('stat.income'), fmtMoney(income), 'var(--emerald)', 'var(--emerald-soft)')}
      ${statCard('trending-down', t('stat.expense'), fmtMoney(expense), 'var(--danger)', 'var(--danger-dim)')}
      ${statCard('wallet', t('stat.balance'), fmtMoney(income-expense), 'var(--gold)', '#E8B95C18')}
    </div>
    ${filtered.length ? filtered.map(tx=>txRow(tx)).join('') : emptyState('inbox', t('empty.tx'))}
  </div>`;
  document.getElementById('reportOutput').innerHTML = html;
  lucide.createIcons();
}

function printReport(){ window.print(); }

function exportPDF(){
  const el = document.getElementById('printableReport') || document.getElementById('contentArea');
  const opt = { margin:10, filename:'Finora_Report.pdf', image:{type:'jpeg', quality:0.98}, html2canvas:{scale:2, backgroundColor:'#0A0E14'}, jsPDF:{unit:'mm', format:'a4', orientation:'portrait'} };
  if(window.html2pdf) html2pdf().set(opt).from(el).save();
  else alert('PDF library not loaded. Check your internet connection.');
}

// ================= SETTINGS PAGE =================
function renderSettingsPage(){
  return `
  <div class="panel-box" style="margin-bottom:18px;">
    <div class="panel-title" style="margin-bottom:14px;">${t('settings.profile')}</div>
    <div class="field"><label>${t('field.name')}</label><div class="input-box"><input type="text" id="settingsName" value="${escapeHtml(profile.full_name||'')}"></div></div>
    <div class="field"><label>${t('settings.currency')}</label>
      <div class="input-box"><select id="settingsCurrency">
        <option value="BDT" ${profile.default_currency==='BDT'?'selected':''}>BDT (৳)</option>
        <option value="USD" ${profile.default_currency==='USD'?'selected':''}>USD ($)</option>
      </select></div>
    </div>
    <button class="btn-primary" onclick="saveProfile()">${t('btn.save')}</button>
  </div>
  <div class="panel-box">
    <div class="panel-title" style="margin-bottom:10px; color:var(--danger);">${t('settings.danger')}</div>
    <div style="color:var(--text-dim); font-size:13px; margin-bottom:12px;">${t('settings.logoutdesc')}</div>
    <button class="btn-danger" onclick="logout()">${t('settings.logout')}</button>
  </div>`;
}

async function saveProfile(){
  const name = document.getElementById('settingsName').value.trim();
  const currency = document.getElementById('settingsCurrency').value;
  const { error } = await sb.from('profiles').update({ full_name:name, default_currency:currency }).eq('id', currentUser.id);
  if(!error){ profile.full_name = name; profile.default_currency = currency; setupUserChip(); renderCurrentPage(); }
}

// ================= TRANSACTION MODAL =================
function setTxType(type){
  txType = type;
  document.getElementById('typeIncomeBtn').classList.toggle('active', type==='income');
  document.getElementById('typeExpenseBtn').classList.toggle('active', type==='expense');
  populateCategorySelect();
}

function populateCategorySelect(){
  const section = document.getElementById('txSection').value;
  const sel = document.getElementById('txCategory');
  const filtered = categories.filter(c=>c.type===txType);
  sel.innerHTML = filtered.map(c=>`<option value="${c.id}">${catLabel(c)}</option>`).join('');
}
function populateAccountSelect(){
  const sel = document.getElementById('txAccount');
  sel.innerHTML = `<option value="">—</option>` + accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
}

function openTxModal(id, section){
  editingTxId = id || null;
  document.getElementById('txMsg').className = 'msg';
  populateAccountSelect();
  if(section) document.getElementById('txSection').value = section;

  if(id){
    const tx = transactions.find(t=>t.id===id);
    if(!tx) return;
    document.getElementById('txModalTitle').textContent = t('modal.edittx');
    setTxType(tx.type);
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txSection').value = tx.section;
    document.getElementById('txAccount').value = tx.account_id || '';
    populateCategorySelect();
    document.getElementById('txCategory').value = tx.category_id || '';
    document.getElementById('txDate').value = tx.transaction_date;
    document.getElementById('txNote').value = tx.description || '';
    document.getElementById('txDeleteBtn').style.display = 'block';
  } else {
    document.getElementById('txModalTitle').textContent = t('modal.addtx');
    document.getElementById('txForm').reset();
    setTxType('income');
    document.getElementById('txDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('txDeleteBtn').style.display = 'none';
  }
  document.getElementById('txModal').classList.add('open');
}
function closeTxModal(){ document.getElementById('txModal').classList.remove('open'); editingTxId = null; }

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('txSection').addEventListener('change', populateCategorySelect);

  document.getElementById('txForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      user_id: currentUser.id,
      type: txType,
      amount: parseFloat(document.getElementById('txAmount').value),
      section: document.getElementById('txSection').value,
      account_id: document.getElementById('txAccount').value || null,
      category_id: document.getElementById('txCategory').value || null,
      transaction_date: document.getElementById('txDate').value,
      description: document.getElementById('txNote').value.trim(),
      currency: profile.default_currency
    };
    try{
      if(editingTxId){
        const { error } = await sb.from('transactions').update(payload).eq('id', editingTxId);
        if(error) throw error;
      } else {
        const { error } = await sb.from('transactions').insert(payload);
        if(error) throw error;
      }
      await Promise.all([loadTransactions(), loadAccounts()]);
      closeTxModal();
      renderCurrentPage();
    }catch(err){
      const box = document.getElementById('txMsg');
      box.textContent = t('msg.error') + ' ' + err.message;
      box.className = 'msg error';
    }
  });

  document.getElementById('accForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      user_id: currentUser.id,
      name: document.getElementById('accName').value.trim(),
      type: document.getElementById('accType').value,
      balance: parseFloat(document.getElementById('accBalance').value) || 0,
      currency: profile.default_currency
    };
    try{
      const { error } = await sb.from('accounts').insert(payload);
      if(error) throw error;
      await loadAccounts();
      closeAccModal();
      renderCurrentPage();
    }catch(err){
      const box = document.getElementById('accMsg');
      box.textContent = t('msg.error') + ' ' + err.message;
      box.className = 'msg error';
    }
  });

  document.getElementById('goalForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      user_id: currentUser.id,
      title: document.getElementById('goalTitle').value.trim(),
      target_amount: parseFloat(document.getElementById('goalTarget').value),
      current_amount: parseFloat(document.getElementById('goalCurrent').value) || 0,
      deadline: document.getElementById('goalDeadline').value || null,
      currency: profile.default_currency
    };
    try{
      const { error } = await sb.from('goals').insert(payload);
      if(error) throw error;
      await loadGoals();
      closeGoalModal();
      renderCurrentPage();
    }catch(err){
      const box = document.getElementById('goalMsg');
      box.textContent = t('msg.error') + ' ' + err.message;
      box.className = 'msg error';
    }
  });

  init();
});

async function quickDeleteTx(id){
  if(!confirm(t('confirm.delete'))) return;
  await sb.from('transactions').delete().eq('id', id);
  await Promise.all([loadTransactions(), loadAccounts()]);
  renderCurrentPage();
}
async function deleteCurrentTx(){
  if(!editingTxId) return;
  if(!confirm(t('confirm.delete'))) return;
  await sb.from('transactions').delete().eq('id', editingTxId);
  await Promise.all([loadTransactions(), loadAccounts()]);
  closeTxModal();
  renderCurrentPage();
}
async function quickDeleteGoal(id){
  if(!confirm(t('confirm.delete'))) return;
  await sb.from('goals').delete().eq('id', id);
  await loadGoals();
  renderCurrentPage();
}

// ================= ACCOUNT MODAL =================
function openAccModal(){
  document.getElementById('accMsg').className = 'msg';
  document.getElementById('accForm').reset();
  document.getElementById('accModal').classList.add('open');
}
function closeAccModal(){ document.getElementById('accModal').classList.remove('open'); }

// ================= GOAL MODAL =================
function openGoalModal(){
  document.getElementById('goalMsg').className = 'msg';
  document.getElementById('goalForm').reset();
  document.getElementById('goalModal').classList.add('open');
}
function closeGoalModal(){ document.getElementById('goalModal').classList.remove('open'); }
