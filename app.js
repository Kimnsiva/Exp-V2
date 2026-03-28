const SUPABASE_URL = 'https://zgwrpgsklpdtjbpnflxi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AgNZLYmkW82MKfvprNM9Ig_O0J5201q';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const BANKS = ['KTC','Kbank','SP','SCB','BBL'];
const COLORS = ['#34C759','#007AFF','#FF3B30','#AF52DE','#FF9500','#5AC8FA','#FF2D55','#5856D6']; // ปรับสี Default นิดหน่อยให้เป็น System Colors

let profiles = [];
let currentProfile = null;
let transactions = [];
let credits = [];
let editTxnId = null;
let editCreditId = null;
let pinBuffer = '';
let pinTarget = null;
let saving = false;

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  initSelects();
  initColorSwatches();
  await loadProfiles();
  renderProfileList();
  applyTheme(localStorage.getItem('theme') || 'light');
});

function initSelects() {
  const now = new Date();
  const yr = now.getFullYear();
  ['sel-year','f-year','cf-year'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') { el.value = yr; return; }
    el.innerHTML = '';
    for (let y = yr - 2; y <= yr + 1; y++) el.innerHTML += `<option value="${y}"${y===yr?' selected':''}>${y}</option>`;
  });
  ['sel-month','f-month','cf-month'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = MONTHS.map((m,i) => `<option value="${i+1}"${i===now.getMonth()?' selected':''}>${m}</option>`).join('');
  });
}

function initColorSwatches() {
  const row = document.getElementById('color-row');
  row.innerHTML = COLORS.map((c,i) => `<div class="color-swatch${i===0?' sel':''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`).join('');
}

function selectColor(el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
}

// ── PROFILES ──
async function loadProfiles() {
  try {
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    if (error) throw error;
    const pins = JSON.parse(localStorage.getItem('profile_pins') || '{}');
    profiles = (data || []).map(p => ({ ...p, pin: pins[p.id] || '' }));
  } catch(e) {
    console.error('loadProfiles error:', e);
    profiles = [];
  }
}

function savePinsLocal() {
  const pins = {};
  profiles.forEach(p => { if (p.pin) pins[p.id] = p.pin; });
  localStorage.setItem('profile_pins', JSON.stringify(pins));
}

function renderProfileList() {
  const list = document.getElementById('profile-list');
  if (profiles.length === 0) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text3);margin-bottom:12px">ยังไม่มีโปรไฟล์ กรุณาสร้างใหม่</p>';
    return;
  }
  list.innerHTML = profiles.map(p => `
    <div class="profile-row" onclick="selectProfile('${p.id}')">
      <div class="p-avatar" style="background:${p.color}">${p.name.slice(0,2).toUpperCase()}</div>
      <span class="p-name">${p.name}</span>
      <span class="p-arrow">›</span>
    </div>
  `).join('');
}

function selectProfile(id) {
  pinTarget = profiles.find(p => p.id === id);
  if (!pinTarget) return;
  pinBuffer = '';
  document.getElementById('pin-who').textContent = pinTarget.name;
  document.getElementById('pin-error').textContent = '';
  document.getElementById('profile-list').style.display = 'none';
  document.querySelector('.login-sub').style.display = 'none';
  document.getElementById('pin-section').style.display = 'block';
  renderPinDots();
  renderPinPad();
}

function backToProfiles() {
  document.getElementById('pin-section').style.display = 'none';
  document.getElementById('profile-list').style.display = 'flex';
  document.querySelector('.login-sub').style.display = 'block';
  pinTarget = null; pinBuffer = '';
}

function renderPinDots() {
  const len = pinTarget?.pin?.length || 4;
  document.getElementById('pin-dots').innerHTML = Array.from({length:len},(_,i) => `<div class="pin-dot${i<pinBuffer.length?' filled':''}"></div>`).join('');
}

function renderPinPad() {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  document.getElementById('pin-pad').innerHTML = keys.map(k => k === '' ? '<div></div>' : `<button class="pin-key${k==='⌫'?' del':''}" onclick="pinPress('${k}')">${k}</button>`).join('');
}

function pinPress(key) {
  if (key === '⌫') { pinBuffer = pinBuffer.slice(0,-1); }
  else if (pinBuffer.length < (pinTarget?.pin?.length || 6)) { pinBuffer += key; }
  renderPinDots();
  if (pinBuffer.length === pinTarget.pin.length) {
    setTimeout(() => checkPin(), 150);
  }
}

function checkPin() {
  if (pinBuffer === pinTarget.pin) {
    currentProfile = pinTarget;
    enterApp();
  } else {
    document.getElementById('pin-error').textContent = 'PIN ไม่ถูกต้อง ลองใหม่';
    document.querySelectorAll('.pin-dot').forEach(d => { d.classList.add('error'); d.classList.remove('filled'); });
    setTimeout(() => { pinBuffer = ''; renderPinDots(); document.getElementById('pin-error').textContent = ''; }, 800);
  }
}

function enterApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  const av = document.getElementById('tb-avatar');
  av.textContent = currentProfile.name.slice(0,2).toUpperCase();
  av.style.background = currentProfile.color;
  document.getElementById('tb-uname').textContent = currentProfile.name;
  loadData();
}

function logout() {
  currentProfile = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  backToProfiles();
  renderProfileList();
}

// ── NEW PROFILE MODAL ──
function showNewProfileModal() {
  document.getElementById('np-name').value = '';
  document.getElementById('np-pin').value = '';
  initColorSwatches();
  openOverlay('newprofile-overlay');
}

async function saveNewProfile() {
  const name = document.getElementById('np-name').value.trim();
  const pin = document.getElementById('np-pin').value.trim();
  if (!name || !pin || pin.length < 4) return alert('กรุณากรอกชื่อและ PIN อย่างน้อย 4 หลัก');
  const color = document.querySelector('.color-swatch.sel')?.dataset.color || COLORS[0];
  const id = crypto.randomUUID();
  setSaving(true);
  try {
    const { error } = await sb.from('profiles').insert({ id, name, color });
    if (error) throw error;
    const p = { id, name, pin, color };
    profiles.push(p);
    savePinsLocal();
    closeOverlay('newprofile-overlay');
    renderProfileList();
    if (currentAdmin) admRefresh();
  } catch(e) { alert(e.message); } finally { setSaving(false); }
}

// ── PROFILE MANAGER ──
function showProfileMgr() {
  const list = document.getElementById('pm-list');
  list.innerHTML = profiles.map(p => `
    <div class="pm-item">
      <div class="pm-av" style="background:${p.color}">${p.name.slice(0,2).toUpperCase()}</div>
      <span style="flex:1;font-size:13px">${p.name}</span>
      <button class="act-btn d" onclick="deleteProfile('${p.id}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
    </div>
  `).join('') || '<p style="font-size:13px;color:var(--text3)">ไม่มีโปรไฟล์</p>';
  openOverlay('profilemgr-overlay');
}

async function deleteProfile(id) {
  if (!confirm('ลบโปรไฟล์นี้?')) return;
  try {
    const { error } = await sb.from('profiles').delete().eq('id', id);
    if (error) throw error;
    profiles = profiles.filter(p => p.id !== id);
    savePinsLocal();
    showProfileMgr();
  } catch(e) { alert(e.message); }
}

// ── DATA ──
async function loadData() {
  document.getElementById('page-loader').style.display = 'flex';
  document.getElementById('page-content').style.display = 'none';
  const year = +document.getElementById('sel-year').value;
  const month = +document.getElementById('sel-month').value;
  try {
    const [{ data: txData }, { data: crData }] = await Promise.all([
      sb.from('transactions').select('*').eq('profile_id', currentProfile.id),
      sb.from('credit_installments').select('*').eq('profile_id', currentProfile.id)
    ]);
    transactions = txData || [];
    credits = crData || [];
    renderDashboard(year, month);
    renderCredit();
  } catch(e) { alert('โหลดไม่ได้: ' + e.message); }
  document.getElementById('page-loader').style.display = 'none';
  document.getElementById('page-content').style.display = 'block';
}

function getMonthData(year, month) {
  const txns = transactions.filter(t => t.year === year && t.month === month);
  
  const crs = credits.filter(c => {
    const startDate = new Date(c.year, c.month - 1);
    const targetDate = new Date(year, month - 1);
    const diffMonths = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
    return diffMonths >= 0 && diffMonths < (c.total_installments || 0);
  });

  const crAsTxn = crs.map(c => {
    const startDate = new Date(c.year, c.month - 1);
    const targetDate = new Date(year, month - 1);
    const currentInstallment = ((targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth())) + 1;
    
    return { 
      id: 'cr-'+c.id, 
      item: `${c.item} (${c.bank}) [งวด ${currentInstallment}/${c.total_installments}]`, 
      income: 0, 
      outcome: c.amount, 
      isCredit: true, 
      _cr: c 
    };
  });
  
  return [...txns, ...crAsTxn];
}

function renderDashboard(year, month) {
  let balanceForward = 0;
  
  const allDates = [...transactions, ...credits].map(i => new Date(i.year, i.month - 1));
  if (allDates.length > 0) {
    const oldestDate = new Date(Math.min(...allDates));
    const targetDate = new Date(year, month - 1);
    
    let tempDate = new Date(oldestDate);
    while (tempDate < targetDate) {
      const d = getMonthData(tempDate.getFullYear(), tempDate.getMonth() + 1);
      balanceForward += d.reduce((s, t) => s + (t.income || 0) - (t.outcome || 0), 0);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
  }

  const data = getMonthData(year, month);
  const income = data.reduce((s,t) => s+(t.income||0), 0);
  const outcome = data.reduce((s,t) => s+(t.outcome||0), 0);
  const monthlyBalance = income - outcome;
  const totalBalance = balanceForward + monthlyBalance;

  document.getElementById('m-income').textContent = '฿' + income.toLocaleString();
  document.getElementById('m-outcome').textContent = '฿' + outcome.toLocaleString();
  
  const mbal = document.getElementById('m-balance');
  mbal.textContent = '฿' + totalBalance.toLocaleString();
  mbal.className = 'metric-val ' + (totalBalance >= 0 ? 'green' : 'red');
  
  document.getElementById('table-title').innerHTML = `รายการ ${MONTHS[month-1]} ${year} <br> <small style="font-weight:400; color:var(--text2)"> (ยอดยกมา: ฿${balanceForward.toLocaleString()})</small>`;
  
  renderChart(year, month);
  renderTxnTable(data, balanceForward);
}

function renderChart(year, month) {
  const bars = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    if (m <= 0) { m += 12; y--; }
    const data = getMonthData(y, m);
    bars.push({ lbl: MONTHS[m-1].slice(0,3), income: data.reduce((s,t)=>s+(t.income||0),0), outcome: data.reduce((s,t)=>s+(t.outcome||0),0) });
  }
  const maxV = Math.max(...bars.map(b => Math.max(b.income, b.outcome)), 1);
  document.getElementById('chart-bars').innerHTML = bars.map(b => `
    <div class="bar-grp">
      <div class="bars">
        <div class="bar bar-g" style="height:${Math.max(4,b.income/maxV*80)}px" title="รายรับ ฿${b.income.toLocaleString()}"></div>
        <div class="bar bar-r" style="height:${Math.max(4,b.outcome/maxV*80)}px" title="รายจ่าย ฿${b.outcome.toLocaleString()}"></div>
      </div>
      <div class="bar-lbl">${b.lbl}</div>
    </div>
  `).join('');
}

function renderTxnTable(data, balanceForward = 0) {
  const body = document.getElementById('txn-body');
  if (!data.length && balanceForward === 0) { 
    body.innerHTML = '<tr class="empty-row"><td colspan="6">ไม่มีข้อมูลในเดือนนี้</td></tr>'; 
    return; 
  }

  let running = balanceForward;
  let rowsHtml = '';

  if (balanceForward !== 0) {
    rowsHtml += `<tr style="background:var(--surface2)">
      <td colspan="4" style="font-weight:500">ยอดยกมาจากเดือนก่อน</td>
      <td class="r mono ${balanceForward >= 0 ? 'green' : 'red'}">฿${balanceForward.toLocaleString()}</td>
      <td></td>
    </tr>`;
  }

  rowsHtml += data.map(item => {
    running += (item.income||0) - (item.outcome||0);
    return `<tr>
      <td>${item.item}${item.source==='line_slip'?` <span class="badge badge-line">LINE</span>`:''}</td>
      <td>${item.isCredit?'<span class="badge badge-blue">บัตรเครดิต</span>':'<span class="badge badge-gray">ทั่วไป</span>'}</td>
      <td class="r mono">${(item.income||0)>0?`<span class="green">฿${item.income.toLocaleString()}</span>`:'<span class="muted">-</span>'}</td>
      <td class="r mono">${(item.outcome||0)>0?`<span class="red">฿${item.outcome.toLocaleString()}</span>`:'<span class="muted">-</span>'}</td>
      <td class="r mono"><span class="${running>=0?'green':'red'}">฿${running.toLocaleString()}</span></td>
      <td class="c">
        ${!item.isCredit ? `
        <button class="act-btn e" onclick="openEditTxn('${item.id}')" title="แก้ไข"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
        <button class="act-btn d" onclick="deleteTxnItem('${item.id}')" title="ลบ"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        ` : `<span class="muted" style="font-size:10px">จัดการที่แท็บบัตรเครดิต</span>`}
      </td>
    </tr>`;
  }).join('');
  
  body.innerHTML = rowsHtml;
}

function renderCredit() {
  const bankGrid = document.getElementById('bank-grid');
  const bankTotals = {};
  credits.forEach(c => { bankTotals[c.bank] = (bankTotals[c.bank]||0) + c.amount; });
  const cards = BANKS.filter(b => bankTotals[b]).map(b => `<div class="bank-card"><div class="bank-name">${b}</div><div class="bank-total">฿${bankTotals[b].toLocaleString()}</div></div>`).join('');
  bankGrid.innerHTML = cards || '';
  const body = document.getElementById('credit-body');
  if (!credits.length) { body.innerHTML = '<tr class="empty-row"><td colspan="7">ไม่มีรายการผ่อน</td></tr>'; return; }
  body.innerHTML = credits.sort((a,b)=>a.year-b.year||a.month-b.month).map(c => {
    const paid = c.paid_installments || 0;
    const total = c.total_installments || 0;
    const remaining = total ? total - paid : null;
    const installmentBadge = total
      ? `<span title="จ่ายแล้ว ${paid}/${total} งวด, เหลือ ${remaining} งวด" style="font-size:11px;font-family:var(--mono);color:var(--text2)">${paid}/${total}</span>${remaining===0?` <span class="badge badge-line">หมดแล้ว</span>`:''}`
      : '<span class="muted">-</span>';
    return `<tr>
    <td>${MONTHS[c.month-1]} ${c.year}</td>
    <td><span class="badge badge-blue">${c.bank}</span></td>
    <td>${c.item}</td>
    <td class="r mono red">฿${c.amount.toLocaleString()}</td>
    <td class="r mono">${(c.interest||0)>0?`<span class="red">฿${(c.interest).toLocaleString()}</span>`:'<span class="muted">-</span>'}</td>
    <td class="c">${installmentBadge}</td>
    <td class="c">
      <button class="act-btn e" onclick="openEditCredit('${c.id}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
      <button class="act-btn d" onclick="deleteCreditItem('${c.id}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
    </td>
  </tr>`;
  }).join('');
}

// ── TXN CRUD ──
function openTxnForm() {
  editTxnId = null;
  document.getElementById('txn-modal-title').textContent = 'เพิ่มรายการ';
  document.getElementById('txn-save-btn').textContent = 'บันทึก';
  const y = +document.getElementById('sel-year').value;
  const m = +document.getElementById('sel-month').value;
  document.getElementById('f-year').value = y;
  document.getElementById('f-month').value = m;
  document.getElementById('f-item').value = '';
  document.getElementById('f-income').value = '';
  document.getElementById('f-outcome').value = '';
  openOverlay('txn-overlay');
}

function openEditTxn(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;
  editTxnId = id;
  document.getElementById('txn-modal-title').textContent = 'แก้ไขรายการ';
  document.getElementById('txn-save-btn').textContent = 'อัปเดต';
  document.getElementById('f-year').value = t.year;
  document.getElementById('f-month').value = t.month;
  document.getElementById('f-item').value = t.item;
  document.getElementById('f-income').value = t.income || '';
  document.getElementById('f-outcome').value = t.outcome || '';
  openOverlay('txn-overlay');
}

async function saveTxn() {
  const item = document.getElementById('f-item').value.trim();
  if (!item) return alert('กรุณากรอกรายการ');
  const data = { year: +document.getElementById('f-year').value, month: +document.getElementById('f-month').value, item, income: +document.getElementById('f-income').value||0, outcome: +document.getElementById('f-outcome').value||0, profile_id: currentProfile.id };
  setSaving(true);
  try {
    if (editTxnId) {
      const { error } = await sb.from('transactions').update(data).eq('id', editTxnId);
      if (error) throw error;
      transactions = transactions.map(t => t.id === editTxnId ? { ...t, ...data } : t);
    } else {
      const { data: d, error } = await sb.from('transactions').insert(data).select().single();
      if (error) throw error;
      transactions.push(d);
    }
    closeOverlay('txn-overlay');
    renderDashboard(+document.getElementById('sel-year').value, +document.getElementById('sel-month').value);
  } catch(e) { alert(e.message); } finally { setSaving(false); }
}

async function deleteTxnItem(id) {
  if (!confirm('ลบรายการนี้?')) return;
  setSaving(true);
  try {
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) throw error;
    transactions = transactions.filter(t => t.id !== id);
    renderDashboard(+document.getElementById('sel-year').value, +document.getElementById('sel-month').value);
  } catch(e) { alert(e.message); } finally { setSaving(false); }
}

// ── CREDIT CRUD ──
function calcMonthlyPayment() {
  const principal = +document.getElementById('cf-principal').value || 0;
  const rate = +document.getElementById('cf-interest-rate').value || 0;
  const total = +document.getElementById('cf-total-installments').value || 0;
  if (principal > 0 && total > 0) {
    const totalInterest = principal * (rate / 100);
    const totalAmount = principal + totalInterest;
    const monthly = totalAmount / total;
    const monthlyInterest = totalInterest / total;
    document.getElementById('cf-amount').value = monthly.toFixed(2);
    document.getElementById('cf-interest').value = monthlyInterest.toFixed(2);
  } else {
    document.getElementById('cf-amount').value = '';
    document.getElementById('cf-interest').value = '';
  }
}

function openCreditForm() {
  editCreditId = null;
  document.getElementById('credit-modal-title').textContent = 'เพิ่มรายการผ่อน';
  document.getElementById('credit-save-btn').textContent = 'บันทึก';
  document.getElementById('cf-year').value = +document.getElementById('sel-year').value;
  document.getElementById('cf-month').value = +document.getElementById('sel-month').value;
  document.getElementById('cf-bank').value = '';
  document.getElementById('cf-item').value = '';
  document.getElementById('cf-principal').value = '';
  document.getElementById('cf-interest-rate').value = '0';
  document.getElementById('cf-amount').value = '';
  document.getElementById('cf-interest').value = '';
  document.getElementById('cf-paid-installments').value = '';
  document.getElementById('cf-total-installments').value = '';
  openOverlay('credit-overlay');
}

function openEditCredit(id) {
  const c = credits.find(c => c.id === id);
  if (!c) return;
  editCreditId = id;
  document.getElementById('credit-modal-title').textContent = 'แก้ไขรายการผ่อน';
  document.getElementById('credit-save-btn').textContent = 'อัปเดต';
  document.getElementById('cf-year').value = c.year;
  document.getElementById('cf-month').value = c.month;
  document.getElementById('cf-bank').value = c.bank;
  document.getElementById('cf-item').value = c.item;
  document.getElementById('cf-principal').value = c.principal || '';
  document.getElementById('cf-interest-rate').value = c.interest_rate || 0;
  document.getElementById('cf-total-installments').value = c.total_installments || '';
  document.getElementById('cf-paid-installments').value = c.paid_installments || '';
  document.getElementById('cf-amount').value = c.amount || '';
  document.getElementById('cf-interest').value = c.interest || '';
  openOverlay('credit-overlay');
}

async function saveCredit() {
  const bank = document.getElementById('cf-bank').value;
  const item = document.getElementById('cf-item').value.trim();
  const principal = +document.getElementById('cf-principal').value || 0;
  const interest_rate = +document.getElementById('cf-interest-rate').value || 0;
  const amount = +document.getElementById('cf-amount').value;
  const interest = +document.getElementById('cf-interest').value || 0;
  const paid_installments = +document.getElementById('cf-paid-installments').value || 0;
  const total_installments = +document.getElementById('cf-total-installments').value || 0;
  if (!bank || !item || !principal || !total_installments) return alert('กรุณากรอกยอดเต็มและจำนวนงวดให้ครบ');
  const data = { year: +document.getElementById('cf-year').value, month: +document.getElementById('cf-month').value, bank, item, principal, interest_rate, amount, interest, paid_installments, total_installments, profile_id: currentProfile.id };
  setSaving(true);
  try {
    if (editCreditId) {
      const { error } = await sb.from('credit_installments').update(data).eq('id', editCreditId);
      if (error) throw error;
      credits = credits.map(c => c.id === editCreditId ? { ...c, ...data } : c);
    } else {
      const { data: d, error } = await sb.from('credit_installments').insert(data).select().single();
      if (error) throw error;
      credits.push(d);
    }
    closeOverlay('credit-overlay');
    renderDashboard(+document.getElementById('sel-year').value, +document.getElementById('sel-month').value);
    renderCredit();
  } catch(e) { alert(e.message); } finally { setSaving(false); }
}

async function deleteCreditItem(id) {
  if (!confirm('ลบรายการนี้?')) return;
  setSaving(true);
  try {
    const { error } = await sb.from('credit_installments').delete().eq('id', id);
    if (error) throw error;
    credits = credits.filter(c => c.id !== id);
    renderDashboard(+document.getElementById('sel-year').value, +document.getElementById('sel-month').value);
    renderCredit();
  } catch(e) { alert(e.message); } finally { setSaving(false); }
}

// ── ADMIN ──
let currentAdmin = null;
let admProfiles = [];
let resetPinTargetId = null;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function showAdminChangePass() {
  document.getElementById('cp-old').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-error').textContent = '';
  openOverlay('admin-changepass-overlay');
}

async function confirmChangePass() {
  const oldPass = document.getElementById('cp-old').value.trim();
  const newPass = document.getElementById('cp-new').value.trim();
  const confirm = document.getElementById('cp-confirm').value.trim();
  const err = document.getElementById('cp-error');
  if (!oldPass || !newPass || !confirm) { err.textContent = 'กรุณากรอกให้ครบ'; return; }
  const hashedOld = await sha256(oldPass);
  if (hashedOld !== currentAdmin.password) { err.textContent = 'Password ปัจจุบันไม่ถูกต้อง'; return; }
  if (newPass.length < 6) { err.textContent = 'Password ใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
  if (newPass !== confirm) { err.textContent = 'Password ใหม่ไม่ตรงกัน'; return; }
  try {
    err.textContent = 'กำลังบันทึก...';
    const hashed = await sha256(newPass);
    const { error } = await sb.from('admins').update({ password: hashed }).eq('id', currentAdmin.id);
    if (error) throw error;
    currentAdmin.password = hashed;
    closeOverlay('admin-changepass-overlay');
    alert('เปลี่ยน Password สำเร็จแล้ว ✅');
  } catch(e) { err.textContent = e.message; }
}

function showAdminLogin() {
  document.getElementById('adm-user').value = '';
  document.getElementById('adm-pass').value = '';
  document.getElementById('adm-error').textContent = '';
  openOverlay('admin-login-overlay');
}

async function loginAdmin() {
  const username = document.getElementById('adm-user').value.trim();
  const password = document.getElementById('adm-pass').value.trim();
  if (!username || !password) return;
  document.getElementById('adm-error').textContent = '';
  try {
    const { data, error } = await sb.from('admins').select('*').eq('username', username).single();
    if (error || !data) { document.getElementById('adm-error').textContent = 'Username หรือ Password ไม่ถูกต้อง'; return; }
    const hashed = await sha256(password);
    if (hashed !== data.password) { document.getElementById('adm-error').textContent = 'Username หรือ Password ไม่ถูกต้อง'; return; }
    currentAdmin = data;
    closeOverlay('admin-login-overlay');
    enterAdminPanel();
  } catch(e) { document.getElementById('adm-error').textContent = e.message; }
}

function enterAdminPanel() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('admin-screen').classList.add('active');
  document.getElementById('adm-who').textContent = currentAdmin.username;
  admRefresh();
}

function logoutAdmin() {
  currentAdmin = null;
  document.getElementById('admin-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
}

async function admRefresh() {
  const list = document.getElementById('adm-profile-list');
  list.innerHTML = '<div style="font-size:13px;color:var(--text2);padding:16px 0">กำลังโหลด...</div>';
  try {
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    if (error) throw error;
    admProfiles = data || [];
    if (!admProfiles.length) { list.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:16px 0">ไม่มีโปรไฟล์</div>'; return; }
    list.innerHTML = admProfiles.map(p => `
    <div class="pm-item-admin">
      <div class="pm-av" style="background:${p.color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${p.name.slice(0,2).toUpperCase()}</div>
      <div>
        <div style="font-size:13px;font-weight:500">${p.name}</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">id: ${p.id.slice(0,8)}...</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <button class="pm-reset-btn" onclick="showResetPin('${p.id}','${p.name}')">Reset PIN</button>
        <button class="act-btn d" onclick="admDeleteProfile('${p.id}','${p.name}')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `).join('');
  } catch(e) { list.innerHTML = '<div style="color:var(--red);font-size:13px">' + e.message + '</div>'; }
}

function admDeleteProfile(id, name) {
  if (!confirm('ลบโปรไฟล์ "' + name + '" และข้อมูลทั้งหมด?')) return;
  let all = JSON.parse(localStorage.getItem('profiles') || '[]');
  all = all.filter(p => p.id !== id);
  sb.from('profiles').delete().eq('id', id).then(({ error }) => {
    if (error) { alert(error.message); return; }
    const pins = JSON.parse(localStorage.getItem('profile_pins') || '{}');
    delete pins[id];
    localStorage.setItem('profile_pins', JSON.stringify(pins));
    admRefresh();
  });
}

function showResetPin(id, name) {
  resetPinTargetId = id;
  document.getElementById('rp-name').textContent = name;
  document.getElementById('rp-pin').value = '';
  openOverlay('admin-resetpin-overlay');
}

function confirmResetPin() {
  const newPin = document.getElementById('rp-pin').value.trim();
  if (!newPin || newPin.length < 4) return alert('PIN ต้องมีอย่างน้อย 4 หลัก');
  const pins = JSON.parse(localStorage.getItem('profile_pins') || '{}');
  pins[resetPinTargetId] = newPin;
  localStorage.setItem('profile_pins', JSON.stringify(pins));
  profiles = profiles.map(p => p.id === resetPinTargetId ? { ...p, pin: newPin } : p);
  closeOverlay('admin-resetpin-overlay');
  alert('Reset PIN สำเร็จแล้ว ✅');
  admRefresh();
}

// ── UI HELPERS ──
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-dashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('tab-credit').style.display = tab === 'credit' ? 'block' : 'none';
}

function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));

function setSaving(v) {
  saving = v;
  document.getElementById('saving-ind').style.display = v ? 'flex' : 'none';
}

function toggleTheme() {
  const cur = document.body.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function applyTheme(t) {
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const icon = document.getElementById('theme-icon');
  icon.innerHTML = t === 'dark'
    ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
    : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
}
