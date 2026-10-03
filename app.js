// app.js - Terminal Theme Controller for Personal Task Tracker
let appData = {
  categories: [],
  publications: [],
  courses: [],
  exams: [],
  companies: [],
  tasks: []
};

// Force fetch from data.json if tasks are missing or cached with < 800 items
window.addEventListener('DOMContentLoaded', async () => {
  const cached = localStorage.getItem('personal_task_tracker_data');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.tasks && parsed.tasks.length > 50) {
        appData = parsed;
      } else {
        await reloadFromJSON();
        return;
      }
    } catch (e) {
      await reloadFromJSON();
      return;
    }
  } else {
    await reloadFromJSON();
    return;
  }

  initUI();
});

async function reloadFromJSON() {
  try {
    const resp = await fetch('data.json?nocache=' + Date.now());
    appData = await resp.json();
    persistData();
    initUI();
  } catch (err) {
    console.error("Failed to load data.json:", err);
  }
}

function initUI() {
  populateCategoryDropdowns();
  updateCounters();
  renderTasks();
  renderPublications();
  renderCoursesAndExams();
  renderCompanies();
}

function persistData() {
  localStorage.setItem('personal_task_tracker_data', JSON.stringify(appData));
  updateCounters();
}

function updateCounters() {
  document.getElementById('taskCount').innerText = (appData.tasks || []).length;
  document.getElementById('pubCount').innerText = (appData.publications || []).length;
  document.getElementById('examCount').innerText = ((appData.exams || []).length + (appData.courses || []).length);
  document.getElementById('compCount').innerText = (appData.companies || []).length;
  const catCount = document.getElementById('catCount');
  if (catCount) catCount.innerText = (appData.categories || []).length;
}

function switchView(viewId) {
  ['tasksView', 'publicationsView', 'coursesExamsView', 'companiesView'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
    const navBtn = document.getElementById('nav-' + id);
    navBtn.classList.remove('border-emerald-500', 'text-emerald-400');
    navBtn.classList.add('border-transparent', 'text-emerald-600/70');
  });

  document.getElementById(viewId).classList.remove('hidden');
  const activeBtn = document.getElementById('nav-' + viewId);
  activeBtn.classList.add('border-emerald-500', 'text-emerald-400');
  activeBtn.classList.remove('border-transparent', 'text-emerald-600/70');
}

function populateCategoryDropdowns() {
  const filter = document.getElementById('headFilter');
  const modalSelect = document.getElementById('modalTaskHead');
  const manageList = document.getElementById('categoryListManage');
  if (!filter || !modalSelect) return;

  filter.innerHTML = '<option value="ALL">All Categories (15 Heads)</option>';
  modalSelect.innerHTML = '';
  if (manageList) manageList.innerHTML = '';

  (appData.categories || []).forEach(cat => {
    // Dropdown options
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    filter.appendChild(opt);

    const modalOpt = document.createElement('option');
    modalOpt.value = cat.name;
    modalOpt.textContent = cat.name;
    modalSelect.appendChild(modalOpt);

    // Manage list row with delete button
    if (manageList) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between bg-[#060908] border border-emerald-950 p-2 rounded text-xs';
      row.innerHTML = `
        <span class="text-emerald-300 truncate max-w-[400px]">${cat.name}</span>
        <button onclick="deleteCategory('${cat.id}')" class="text-emerald-700 hover:text-red-400 text-xs px-2 py-0.5" title="Delete category">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      `;
      manageList.appendChild(row);
    }
  });

  const catCount = document.getElementById('catCount');
  if (catCount) catCount.innerText = (appData.categories || []).length;
}

function deleteCategory(catId) {
  const cat = appData.categories.find(c => c.id === catId);
  if (!cat) return;
  if (confirm(`Delete category "${cat.name}"? Tasks with this head will not be deleted.`)) {
    appData.categories = appData.categories.filter(c => c.id !== catId);
    persistData();
    populateCategoryDropdowns();
    renderTasks();
  }
}

function saveCategory() {
  const name = document.getElementById('modalCatName').value.trim();
  if (!name) return alert('Enter category name');

  appData.categories.push({ id: `head_${Date.now()}`, name, subAreas: [] });
  persistData();
  populateCategoryDropdowns();
  document.getElementById('modalCatName').value = '';
}

// Render Tasks
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;

  const search = (document.getElementById('taskSearch')?.value || '').toLowerCase();
  const selectedHead = document.getElementById('headFilter')?.value || 'ALL';
  const selectedStatus = document.getElementById('statusFilter')?.value || 'ALL';

  const filtered = (appData.tasks || []).filter(t => {
    const matchSearch = (t.title || '').toLowerCase().includes(search) || 
                         (t.subArea || '').toLowerCase().includes(search);
    const matchHead = selectedHead === 'ALL' || t.majorHead === selectedHead;
    const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
    return matchSearch && matchHead && matchStatus;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="col-span-full py-12 text-center text-emerald-800 text-xs font-mono">// No tasks match filter</div>`;
    return;
  }

  list.innerHTML = filtered.slice(0, 150).map(t => `
    <div class="bg-[#0b100e] border border-emerald-950/90 rounded-lg p-3.5 flex flex-col justify-between hover:border-emerald-800/80 transition shadow-sm">
      <div>
        <div class="flex items-center justify-between text-[10px] mb-2 gap-2">
          <span class="text-emerald-400 font-mono px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-900/50 rounded truncate max-w-[210px]" title="${t.majorHead}">
            ${t.majorHead}
          </span>
          <span class="text-emerald-600 truncate text-[10px]">${t.subArea || ''}</span>
        </div>
        <p class="text-xs text-emerald-200 leading-snug mb-3">${t.title}</p>
        ${t.link ? `<a href="${t.link}" target="_blank" class="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1 mb-2 font-mono"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Resource</a>` : ''}
      </div>
      <div class="flex items-center justify-between pt-2.5 border-t border-emerald-950">
        <select onchange="updateTaskStatus('${t.id}', this.value)" class="text-[11px] bg-[#060908] border border-emerald-900/60 text-emerald-300 rounded px-2 py-0.5 focus:outline-none">
          <option value="Todo" ${t.status === 'Todo' ? 'selected' : ''}>Todo</option>
          <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Done" ${t.status === 'Done' ? 'selected' : ''}>Done</option>
        </select>
        <button onclick="deleteTask('${t.id}')" class="text-emerald-700 hover:text-red-400 text-xs px-2 py-1 transition" title="Delete Task">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function updateTaskStatus(id, newStatus) {
  const task = appData.tasks.find(t => t.id === id);
  if (task) {
    task.status = newStatus;
    persistData();
  }
}

function deleteTask(id) {
  appData.tasks = appData.tasks.filter(t => t.id !== id);
  persistData();
  renderTasks();
}

function saveTask() {
  const title = document.getElementById('modalTaskTitle').value.trim();
  const majorHead = document.getElementById('modalTaskHead').value;
  const subArea = document.getElementById('modalTaskSubArea').value.trim() || 'General';
  const link = document.getElementById('modalTaskLink').value.trim();

  if (!title) return alert('Enter task title');

  appData.tasks.unshift({
    id: `task_${Date.now()}`,
    title,
    majorHead,
    subArea,
    link,
    status: 'Todo'
  });

  persistData();
  closeModal('taskModal');
  document.getElementById('modalTaskTitle').value = '';
  document.getElementById('modalTaskSubArea').value = '';
  document.getElementById('modalTaskLink').value = '';
  renderTasks();
}

// Publications
function renderPublications() {
  const tbody = document.getElementById('pubTableBody');
  if (!tbody) return;

  tbody.innerHTML = (appData.publications || []).map(p => `
    <tr class="hover:bg-emerald-950/20">
      <td class="p-3 font-medium text-emerald-200">
        <div>${p.title}</div>
        ${p.cfpLink ? `<a href="${p.cfpLink}" target="_blank" class="text-[11px] text-emerald-400 hover:underline">CFP Link</a>` : ''}
      </td>
      <td class="p-3 text-emerald-500">${p.association || '-'}</td>
      <td class="p-3 text-emerald-300 font-mono text-[11px]">${p.proposalDeadline || '-'}</td>
      <td class="p-3 text-emerald-300 font-mono text-[11px]">${p.fullPaperDeadline || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 text-[10px] rounded bg-emerald-950/80 text-emerald-300 border border-emerald-900">${p.status || 'Pending'}</span>
      </td>
      <td class="p-3 text-right">
        <button onclick="deletePublication('${p.id}')" class="text-emerald-700 hover:text-red-400 text-xs" title="Delete">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function deletePublication(id) {
  appData.publications = appData.publications.filter(p => p.id !== id);
  persistData();
  renderPublications();
}

// Courses and Exams
function renderCoursesAndExams() {
  const courseList = document.getElementById('courseList');
  const examList = document.getElementById('examList');

  if (courseList) {
    courseList.innerHTML = (appData.courses || []).map(c => `
      <div class="bg-[#060908] p-2.5 rounded border border-emerald-950 flex justify-between items-center text-xs">
        <span class="font-medium text-emerald-200">${c.name}</span>
        <span class="bg-[#0f1713] text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-900/60">${c.status || 'Active'}</span>
      </div>
    `).join('');
  }

  if (examList) {
    examList.innerHTML = (appData.exams || []).map(e => `
      <div class="bg-[#060908] p-2.5 rounded border border-emerald-950 flex justify-between items-center text-xs">
        <div>
          <div class="font-medium text-emerald-200">${e.name}</div>
          <div class="text-[10px] text-emerald-600 font-mono mt-0.5">${e.date || 'TBD'}</div>
        </div>
        <span class="bg-emerald-950/80 text-emerald-300 border border-emerald-900 px-2 py-0.5 rounded text-[10px]">${e.status || 'Planned'}</span>
      </div>
    `).join('');
  }
}

// Companies
function renderCompanies() {
  const compGrid = document.getElementById('companyGrid');
  if (!compGrid) return;

  compGrid.innerHTML = (appData.companies || []).map(comp => `
    <div class="bg-[#0b100e] border border-emerald-950 rounded-lg p-4 space-y-2">
      <h3 class="text-xs font-bold text-emerald-300 uppercase tracking-wider">${comp.name}</h3>
      <div class="text-xs space-y-1 text-emerald-500/90 font-mono">
        ${Object.entries(comp.attributes || {}).slice(0, 5).map(([k, v]) => `
          <div class="flex justify-between gap-2 border-b border-emerald-950/50 pb-1">
            <span class="text-emerald-700 text-[10px]">${k}:</span> 
            <span class="text-emerald-300 text-[10px] truncate max-w-[170px] text-right" title="${v}">${v}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "data.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openModal(id) { 
  const modal = document.getElementById(id);
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeModal(id) { 
  const modal = document.getElementById(id);
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}