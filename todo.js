import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
import { getDatabase, ref, push, remove, update, onValue } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCkUMLIB_5D2gXrOv05mHySbyC9J9yRHQ",
  authDomain: "ssam-todo.firebaseapp.com",
  projectId: "ssam-todo",
  storageBucket: "ssam-todo.firebasestorage.app",
  messagingSenderId: "7516078529",
  appId: "1:7516078529:web:826c1694a939b8ea352f40",
  measurementId: "G-8LC9WGWNZ0",
  databaseURL: "https://ssam-todo-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const tasksRef = ref(db, 'todos');

// ── 상태 ───────────────────────────────
let tasks      = {};
let activeTab    = 'list';
let activeFilter = 'all';
let calYear    = new Date().getFullYear();
let calMonth   = new Date().getMonth();   // 0-indexed
let calSelected  = todayStr();
let editKey    = null;
let selPriority  = 'medium';
let selLabel     = 'work';

// ── 유틸 ───────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatDateKR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatTimeRange(s, e) {
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
}

function getStatus(task) {
  if (task.done) return 'completed';
  return (task.date || todayStr()) > todayStr() ? 'upcoming' : 'ongoing';
}

const LABEL_KR    = { work:'업무', personal:'개인', meeting:'미팅', study:'학습', health:'건강' };
const PRIORITY_KR = { high:'높음', medium:'보통', low:'낮음' };

// ── Firebase ────────────────────────────
onValue(tasksRef, snap => {
  tasks = snap.val() || {};
  rerender();
}, err => console.error('[Firebase] 읽기 실패:', err.message));

function dbAdd(data) {
  push(tasksRef, data).catch(e => console.error('[Firebase] 추가 실패:', e.message));
}

function dbUpdate(key, data) {
  update(ref(db, `todos/${key}`), data).catch(e => console.error('[Firebase] 수정 실패:', e.message));
}

function dbRemove(key) {
  remove(ref(db, `todos/${key}`)).catch(e => console.error('[Firebase] 삭제 실패:', e.message));
}

// ── 렌더 진입점 ─────────────────────────
function rerender() {
  if (activeTab === 'list') renderList();
  else renderCalendar();
}

// ── 카드 생성 ───────────────────────────
function createCard(key, task) {
  const el = document.createElement('article');
  el.className = `card priority-${task.priority || 'medium'}${task.done ? ' card--done' : ''}`;

  const timeStr  = formatTimeRange(task.startTime, task.endTime);
  const label    = task.label    || 'work';
  const labelKR  = LABEL_KR[label]  || label;

  el.innerHTML = `
    <div class="card-top">
      <span class="label-chip label-${label}">${labelKR}</span>
      ${timeStr ? `<span class="time-chip">${timeStr}</span>` : ''}
    </div>
    <p class="card-name${task.done ? ' card-name--done' : ''}">${escHtml(task.text)}</p>
    ${task.location ? `<p class="card-meta"><span>📍</span>${escHtml(task.location)}</p>` : ''}
    ${task.desc     ? `<p class="card-desc">${escHtml(task.desc)}</p>`                   : ''}
    <div class="card-actions">
      <label class="done-label">
        <input type="checkbox" class="done-cb"${task.done ? ' checked' : ''}/>
        <span class="done-text">${task.done ? '완료' : '미완료'}</span>
      </label>
      <div class="card-btns">
        <button class="card-btn edit-btn" title="수정">✎</button>
        <button class="card-btn del-btn"  title="삭제">✕</button>
      </div>
    </div>`;

  el.querySelector('.done-cb').addEventListener('change', () => dbUpdate(key, { done: !task.done }));
  el.querySelector('.edit-btn').addEventListener('click', () => openModal(key));
  el.querySelector('.del-btn').addEventListener('click', () => dbRemove(key));

  return el;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 목록 탭 ─────────────────────────────
function renderList() {
  const feed  = document.getElementById('listFeed');
  const empty = document.getElementById('listEmpty');
  feed.innerHTML = '';

  let entries = Object.entries(tasks);

  // 상태 필터
  if (activeFilter !== 'all') {
    entries = entries.filter(([, t]) => getStatus(t) === activeFilter);
  }

  // 날짜순 정렬
  entries.sort((a, b) => (a[1].date || todayStr()).localeCompare(b[1].date || todayStr()));

  if (entries.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // 날짜별 그룹핑
  const groups = {};
  entries.forEach(([k, t]) => {
    const d = t.date || todayStr();
    (groups[d] = groups[d] || []).push([k, t]);
  });

  const today = todayStr();
  Object.entries(groups).forEach(([date, items]) => {
    const group  = document.createElement('div');
    group.className = 'date-group';

    const header = document.createElement('p');
    header.className = 'date-header';
    header.textContent = formatDateKR(date);
    if (date === today) {
      const badge = document.createElement('span');
      badge.className = 'today-badge';
      badge.textContent = '오늘';
      header.appendChild(badge);
    }
    group.appendChild(header);
    items.forEach(([k, t]) => group.appendChild(createCard(k, t)));
    feed.appendChild(group);
  });
}

// ── 달력 탭 ─────────────────────────────
function renderCalendar() {
  document.getElementById('calLabel').textContent = `${calYear}년 ${calMonth + 1}월`;

  const grid      = document.getElementById('calGrid');
  grid.innerHTML  = '';
  const today     = todayStr();
  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMon = new Date(calYear, calMonth + 1, 0).getDate();

  // 빈 셀
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  // 날짜 셀
  for (let d = 1; d <= daysInMon; d++) {
    const dateStr  = `${calYear}-${pad(calMonth+1)}-${pad(d)}`;
    const hasTasks = Object.values(tasks).some(t => t.date === dateStr);
    const isToday  = dateStr === today;
    const isSel    = dateStr === calSelected;

    const cell = document.createElement('div');
    cell.className = `cal-cell${isToday ? ' cal-today' : ''}${isSel ? ' cal-selected' : ''}`;
    cell.innerHTML = `<span class="cal-day-num">${d}</span>${hasTasks ? '<span class="cal-dot"></span>' : ''}`;
    cell.addEventListener('click', () => {
      calSelected = dateStr;
      renderCalendar();
    });
    grid.appendChild(cell);
  }

  renderCalTasks();
}

function renderCalTasks() {
  const feed  = document.getElementById('calFeed');
  const empty = document.getElementById('calEmpty');
  const label = document.getElementById('calSelLabel');

  label.textContent = calSelected ? formatDateKR(calSelected) : '';
  feed.innerHTML = '';

  const entries = Object.entries(tasks).filter(([, t]) => t.date === calSelected);
  if (entries.length === 0) { empty.hidden = false; return; }
  empty.hidden = true;
  entries.forEach(([k, t]) => feed.appendChild(createCard(k, t)));
}

// ── 모달 ─────────────────────────────────
function openModal(key = null) {
  editKey = key;
  const isEdit = key && tasks[key];

  document.getElementById('sheetTitle').textContent = isEdit ? '할 일 수정' : '할 일 만들기';
  document.getElementById('submitBtn').textContent  = isEdit ? '수정 완료'   : '할 일 만들기';

  if (isEdit) {
    const t = tasks[key];
    document.getElementById('fName').value     = t.text      || '';
    document.getElementById('fDate').value     = t.date      || '';
    document.getElementById('fStart').value    = t.startTime || '';
    document.getElementById('fEnd').value      = t.endTime   || '';
    document.getElementById('fLocation').value = t.location  || '';
    document.getElementById('fDesc').value     = t.desc      || '';
    selPriority = t.priority || 'medium';
    selLabel    = t.label    || 'work';
  } else {
    document.getElementById('fName').value     = '';
    document.getElementById('fDate').value     = todayStr();
    document.getElementById('fStart').value    = '';
    document.getElementById('fEnd').value      = '';
    document.getElementById('fLocation').value = '';
    document.getElementById('fDesc').value     = '';
    selPriority = 'medium';
    selLabel    = 'work';
  }

  syncPriorityUI();
  syncLabelUI();
  document.getElementById('backdrop').classList.add('open');
  setTimeout(() => document.getElementById('fName').focus(), 350);
}

function closeModal() {
  document.getElementById('backdrop').classList.remove('open');
  editKey = null;
}

function syncPriorityUI() {
  document.querySelectorAll('#priorityGroup .seg').forEach(b =>
    b.classList.toggle('active', b.dataset.p === selPriority));
}

function syncLabelUI() {
  document.querySelectorAll('#labelGroup .chip').forEach(b =>
    b.classList.toggle('active', b.dataset.l === selLabel));
}

function submitTask() {
  const name = document.getElementById('fName').value.trim();
  if (!name) { document.getElementById('fName').focus(); return; }

  const data = {
    text:      name,
    date:      document.getElementById('fDate').value     || todayStr(),
    startTime: document.getElementById('fStart').value    || '',
    endTime:   document.getElementById('fEnd').value      || '',
    location:  document.getElementById('fLocation').value.trim(),
    desc:      document.getElementById('fDesc').value.trim(),
    priority:  selPriority,
    label:     selLabel,
    done: editKey && tasks[editKey] ? tasks[editKey].done : false,
  };

  if (editKey) dbUpdate(editKey, data);
  else         dbAdd(data);

  closeModal();
}

// ── 이벤트 ───────────────────────────────

// 메인 탭
document.querySelectorAll('.main-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`pane-${activeTab}`).classList.add('active');
    rerender();
  });
});

// 상태 필터
document.querySelectorAll('.status-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.s;
    document.querySelectorAll('.status-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderList();
  });
});

// 달력 이전/다음 달
document.getElementById('prevMonth').addEventListener('click', () => {
  if (--calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  if (++calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// FAB / 모달 닫기
document.getElementById('fab').addEventListener('click', () => openModal());
document.getElementById('sheetClose').addEventListener('click', closeModal);
document.getElementById('backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('backdrop')) closeModal();
});

// 중요도 선택
document.querySelectorAll('#priorityGroup .seg').forEach(btn => {
  btn.addEventListener('click', () => { selPriority = btn.dataset.p; syncPriorityUI(); });
});

// 레이블 선택
document.querySelectorAll('#labelGroup .chip').forEach(btn => {
  btn.addEventListener('click', () => { selLabel = btn.dataset.l; syncLabelUI(); });
});

// 제출
document.getElementById('submitBtn').addEventListener('click', submitTask);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
