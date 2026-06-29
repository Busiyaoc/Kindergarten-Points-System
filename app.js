const STORAGE_KEY = "kindergarten-points-v1";

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultState = {
  selectedClassId: null,
  activeTab: "students",
  classes: [],
  behaviors: [
    { id: createId(), type: "positive", name: "认真听讲", points: 2 },
    { id: createId(), type: "positive", name: "帮助同伴", points: 3 },
    { id: createId(), type: "positive", name: "主动收拾", points: 2 },
    { id: createId(), type: "positive", name: "勇敢表达", points: 2 },
    { id: createId(), type: "negative", name: "推挤同伴", points: -2 },
    { id: createId(), type: "negative", name: "不爱护物品", points: -1 },
  ],
  rewards: [
    { id: createId(), name: "优先选游戏", cost: 15 },
    { id: createId(), name: "小贴纸", cost: 20 },
    { id: createId(), name: "小老师体验", cost: 30 },
  ],
};

let state = loadState();
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const classList = $("#classList");
const topbar = $("#topbar");
const workspace = $("#workspace");
const tabs = document.querySelectorAll(".tab");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return clone(defaultState);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...clone(defaultState),
      ...parsed,
      behaviors: parsed.behaviors?.length ? parsed.behaviors : clone(defaultState.behaviors),
      rewards: parsed.rewards?.length ? parsed.rewards : clone(defaultState.rewards),
      classes: parsed.classes || [],
    };
  } catch {
    return clone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentClass() {
  return state.classes.find((item) => item.id === state.selectedClassId) || null;
}

function getInitial(name) {
  const clean = (name || "?").trim();
  return clean ? clean.slice(0, 1).toUpperCase() : "?";
}

function petProfile(points) {
  if (points >= 120) {
    return {
      stage: "legendary",
      title: "星辉守护精灵",
      level: "Lv.5",
      description: "形态完全成熟，拥有礼冠、星杖和披风。",
      next: "已达到最高形态",
      progress: 100,
    };
  }

  if (points >= 80) {
    return {
      stage: "hero",
      title: "闪耀伙伴精灵",
      level: "Lv.4",
      description: "长出勇气翅膀，装备星星披风。",
      next: `距最终形态还差 ${120 - points} 分`,
      progress: Math.round(((points - 80) / 40) * 100),
    };
  }

  if (points >= 45) {
    return {
      stage: "grown",
      title: "成长精灵",
      level: "Lv.3",
      description: "戴上小徽章，开始守护自己的好习惯。",
      next: `距闪耀形态还差 ${80 - points} 分`,
      progress: Math.round(((points - 45) / 35) * 100),
    };
  }

  if (points >= 20) {
    return {
      stage: "sprout",
      title: "萌芽精灵",
      level: "Lv.2",
      description: "获得小围巾，正在慢慢长大。",
      next: `距成长形态还差 ${45 - points} 分`,
      progress: Math.round(((points - 20) / 25) * 100),
    };
  }

  return {
    stage: "baby",
    title: "蛋壳精灵",
    level: "Lv.1",
    description: "刚刚被好习惯唤醒。",
    next: `距萌芽形态还差 ${20 - points} 分`,
    progress: Math.round((points / 20) * 100),
  };
}

function petMarkup(points) {
  const pet = petProfile(points);
  return `
    <div class="pet-panel stage-${pet.stage}">
      <div class="pet-scene" aria-hidden="true">
        <div class="pet-aura"></div>
        <div class="pet-wing left"></div>
        <div class="pet-wing right"></div>
        <div class="pet-body">
          <div class="pet-crown"></div>
          <div class="pet-ear left"></div>
          <div class="pet-ear right"></div>
          <div class="pet-face">
            <span class="pet-eye"></span>
            <span class="pet-eye"></span>
          </div>
          <div class="pet-badge"></div>
          <div class="pet-scarf"></div>
        </div>
        <div class="pet-staff"></div>
      </div>
      <div class="pet-info">
        <div class="pet-title-row">
          <strong>${pet.title}</strong>
          <span>${pet.level}</span>
        </div>
        <p>${pet.description}</p>
        <div class="pet-progress" aria-label="${pet.next}">
          <span style="width: ${pet.progress}%"></span>
        </div>
        <small>${pet.next}</small>
      </div>
    </div>
  `;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function render() {
  if (!state.selectedClassId && state.classes[0]) {
    state.selectedClassId = state.classes[0].id;
  }

  renderClasses();
  renderTopbar();
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.activeTab));

  const selected = currentClass();
  if (!selected) {
    workspace.innerHTML = `
      <div class="empty-state">
        <h2>先建立一个班级</h2>
        <p>班级建立后，就可以添加小朋友、记录行为积分、设置奖励兑换。</p>
      </div>
    `;
    return;
  }

  if (state.activeTab === "students") renderStudents(selected);
  if (state.activeTab === "behaviors") renderBehaviors();
  if (state.activeTab === "rewards") renderRewards(selected);
  if (state.activeTab === "records") renderRecords(selected);
}

function renderClasses() {
  if (!state.classes.length) {
    classList.innerHTML = "";
    return;
  }

  classList.innerHTML = state.classes
    .map((item) => {
      const total = item.students.reduce((sum, student) => sum + student.points, 0);
      return `
        <button class="class-item ${item.id === state.selectedClassId ? "active" : ""}" data-select-class="${item.id}">
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${item.students.length} 名幼儿</span>
          </span>
          <span>${total} 分</span>
        </button>
      `;
    })
    .join("");
}

function renderTopbar() {
  const selected = currentClass();
  if (!selected) {
    topbar.innerHTML = `
      <div class="title-block">
        <h2>班级积分系统</h2>
        <p>为孩子的积极行为留下清晰、温和的反馈。</p>
      </div>
    `;
    return;
  }

  const total = selected.students.reduce((sum, student) => sum + student.points, 0);
  const topStudent = [...selected.students].sort((a, b) => b.points - a.points)[0];

  topbar.innerHTML = `
    <div class="title-block">
      <h2>${escapeHtml(selected.name)}</h2>
      <p>${topStudent ? `当前最高分：${escapeHtml(topStudent.name)} ${topStudent.points} 分` : "还没有添加幼儿"}</p>
    </div>
    <div class="metrics">
      <div class="metric"><strong>${selected.students.length}</strong><span>幼儿</span></div>
      <div class="metric"><strong>${total}</strong><span>班级总分</span></div>
      <button class="text-button danger" data-delete-class="${selected.id}">删除班级</button>
    </div>
  `;
}

function avatarMarkup(student) {
  if (student.avatar) {
    return `<div class="avatar"><img src="${student.avatar}" alt="${escapeHtml(student.name)}头像" /></div>`;
  }
  return `<div class="avatar" aria-hidden="true">${escapeHtml(getInitial(student.name))}</div>`;
}

function renderStudents(selected) {
  const positives = state.behaviors.filter((item) => item.type === "positive");
  const negatives = state.behaviors.filter((item) => item.type === "negative");

  workspace.innerHTML = `
    <div class="section-grid">
      <div class="panel">
        <div class="panel-header"><h3>添加幼儿</h3></div>
        <div class="panel-body">
          <form class="form-block" id="studentForm">
            <div class="field">
              <label for="studentName">幼儿姓名</label>
              <input id="studentName" name="studentName" maxlength="18" required />
            </div>
            <div class="field">
              <label for="studentAvatar">幼儿头像</label>
              <input id="studentAvatar" name="studentAvatar" type="file" accept="image/*" />
            </div>
            <button class="text-button primary" type="submit">添加幼儿</button>
          </form>
        </div>
      </div>

      <div class="student-grid">
        ${
          selected.students.length
            ? selected.students.map((student) => studentCard(student, positives, negatives)).join("")
            : `<div class="empty-state"><h3>暂无幼儿</h3><p>添加幼儿后，这里会显示积分、行为记录和精灵养成状态。</p></div>`
        }
      </div>
    </div>
  `;
}

function studentCard(student, positives, negatives) {
  const history = [...(student.history || [])].slice(-4).reverse();

  return `
    <article class="student-card">
      <div class="student-head">
        ${avatarMarkup(student)}
        <div class="student-name">
          <strong>${escapeHtml(student.name)}</strong>
          <span>${student.history?.length || 0} 条记录</span>
        </div>
        <div class="points">${student.points} 分</div>
      </div>

      ${petMarkup(student.points)}

      <div class="action-columns">
        <div>
          <p class="subhead">正反馈加分</p>
          <div class="chip-list">
            ${positives.map((item) => `<button class="chip positive" data-score="${student.id}" data-behavior="${item.id}">+${item.points} ${escapeHtml(item.name)}</button>`).join("")}
          </div>
        </div>
        <div>
          <p class="subhead">负面行为减分</p>
          <div class="chip-list">
            ${negatives.map((item) => `<button class="chip negative" data-score="${student.id}" data-behavior="${item.id}">${item.points} ${escapeHtml(item.name)}</button>`).join("")}
          </div>
        </div>
      </div>

      <div class="history">
        <p class="subhead">最近记录</p>
        ${
          history.length
            ? history.map((item) => historyRow(item)).join("")
            : `<div class="history-row"><span>暂无记录</span><span></span></div>`
        }
      </div>
      <button class="text-button danger" data-delete-student="${student.id}">删除幼儿</button>
    </article>
  `;
}

function historyRow(item) {
  const deltaClass = item.points >= 0 ? "delta-plus" : "delta-minus";
  const sign = item.points >= 0 ? "+" : "";
  return `
    <div class="history-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <span class="${deltaClass}">${sign}${item.points}</span>
    </div>
  `;
}

function renderBehaviors() {
  const positives = state.behaviors.filter((item) => item.type === "positive");
  const negatives = state.behaviors.filter((item) => item.type === "negative");

  workspace.innerHTML = `
    <div class="section-grid">
      <div class="panel">
        <div class="panel-header"><h3>新建行为规则</h3></div>
        <div class="panel-body">
          <form class="form-block" id="behaviorForm">
            <div class="field">
              <label for="behaviorName">行为名称</label>
              <input id="behaviorName" name="behaviorName" maxlength="24" required />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="behaviorType">类型</label>
                <select id="behaviorType" name="behaviorType">
                  <option value="positive">正反馈加分</option>
                  <option value="negative">负面行为减分</option>
                </select>
              </div>
              <div class="field">
                <label for="behaviorPoints">分值</label>
                <input id="behaviorPoints" name="behaviorPoints" type="number" min="1" max="99" value="1" required />
              </div>
            </div>
            <button class="text-button primary" type="submit">保存规则</button>
          </form>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>行为规则</h3></div>
        <div class="panel-body action-columns">
          <div>
            <p class="subhead">正反馈</p>
            <div class="rule-list">${positives.map((item) => ruleRow(item)).join("")}</div>
          </div>
          <div>
            <p class="subhead">负面行为</p>
            <div class="rule-list">${negatives.map((item) => ruleRow(item)).join("")}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function ruleRow(item) {
  const points = item.points > 0 ? `+${item.points}` : item.points;
  return `
    <div class="list-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${points} 分</span>
      </div>
      <button class="icon-button danger" title="删除规则" aria-label="删除规则" data-delete-behavior="${item.id}">×</button>
    </div>
  `;
}

function renderRewards(selected) {
  workspace.innerHTML = `
    <div class="store-grid">
      <div class="panel">
        <div class="panel-header"><h3>新建奖励</h3></div>
        <div class="panel-body">
          <form class="form-block" id="rewardForm">
            <div class="field">
              <label for="rewardName">奖励名称</label>
              <input id="rewardName" name="rewardName" maxlength="24" required />
            </div>
            <div class="field">
              <label for="rewardCost">兑换分值</label>
              <input id="rewardCost" name="rewardCost" type="number" min="1" max="999" value="10" required />
            </div>
            <button class="text-button primary" type="submit">上架奖励</button>
          </form>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>奖励商店</h3></div>
        <div class="panel-body">
          <div class="reward-list">
            ${
              state.rewards.length
                ? state.rewards.map((item) => rewardRow(item)).join("")
                : `<div class="empty-state"><h3>暂无奖励</h3><p>新建奖励后，幼儿可用积分兑换。</p></div>`
            }
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>积分兑换</h3></div>
      <div class="panel-body">
        <form class="redeem-form" id="redeemForm">
          <div class="field">
            <label for="redeemStudent">幼儿</label>
            <select id="redeemStudent" name="redeemStudent" required>
              <option value="">选择幼儿</option>
              ${selected.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}（${student.points}分）</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="redeemReward">奖励</label>
            <select id="redeemReward" name="redeemReward" required>
              <option value="">选择奖励</option>
              ${state.rewards.map((reward) => `<option value="${reward.id}">${escapeHtml(reward.name)}（${reward.cost}分）</option>`).join("")}
            </select>
          </div>
          <button class="text-button primary" type="submit">兑换</button>
        </form>
      </div>
    </div>
  `;
}

function rewardRow(item) {
  return `
    <div class="list-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.cost} 分</span>
      </div>
      <button class="icon-button danger" title="下架奖励" aria-label="下架奖励" data-delete-reward="${item.id}">×</button>
    </div>
  `;
}

function renderRecords(selected) {
  const records = [...(selected.redemptions || [])].reverse();

  workspace.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h3>兑换记录</h3></div>
      <div class="panel-body">
        <div class="record-list">
          ${
            records.length
              ? records.map((record) => `
                  <div class="list-row">
                    <div>
                      <strong>${escapeHtml(record.studentName)} 兑换 ${escapeHtml(record.rewardName)}</strong>
                      <span>${formatDate(record.createdAt)}</span>
                    </div>
                    <span class="delta-minus">-${record.cost}</span>
                  </div>
                `).join("")
              : `<div class="empty-state"><h3>暂无兑换记录</h3><p>完成奖励兑换后，这里会保留记录。</p></div>`
          }
        </div>
      </div>
    </div>
  `;
}

async function fileToDataUrl(file) {
  if (!file || !file.size) return "";

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addHistory(student, name, points) {
  student.history = student.history || [];
  student.history.push({
    id: createId(),
    name,
    points,
    createdAt: Date.now(),
  });
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "classForm") {
    const data = new FormData(event.target);
    const name = data.get("className").trim();
    if (!name) return;

    const newClass = {
      id: createId(),
      name,
      students: [],
      redemptions: [],
    };
    state.classes.push(newClass);
    state.selectedClassId = newClass.id;
    state.activeTab = "students";
    event.target.reset();
    saveState();
    render();
    showToast("班级已新建");
  }

  if (event.target.id === "studentForm") {
    const selected = currentClass();
    const data = new FormData(event.target);
    const name = data.get("studentName").trim();
    if (!selected || !name) return;

    const avatar = await fileToDataUrl(data.get("studentAvatar"));
    selected.students.push({
      id: createId(),
      name,
      avatar,
      points: 0,
      history: [],
    });

    event.target.reset();
    saveState();
    render();
    showToast("幼儿已添加");
  }

  if (event.target.id === "behaviorForm") {
    const data = new FormData(event.target);
    const type = data.get("behaviorType");
    const rawPoints = Number(data.get("behaviorPoints"));
    const points = type === "negative" ? -Math.abs(rawPoints) : Math.abs(rawPoints);

    state.behaviors.push({
      id: createId(),
      type,
      name: data.get("behaviorName").trim(),
      points,
    });

    event.target.reset();
    saveState();
    render();
    showToast("规则已保存");
  }

  if (event.target.id === "rewardForm") {
    const data = new FormData(event.target);
    state.rewards.push({
      id: createId(),
      name: data.get("rewardName").trim(),
      cost: Math.abs(Number(data.get("rewardCost"))),
    });

    event.target.reset();
    saveState();
    render();
    showToast("奖励已上架");
  }

  if (event.target.id === "redeemForm") {
    const selected = currentClass();
    const data = new FormData(event.target);
    const student = selected?.students.find((item) => item.id === data.get("redeemStudent"));
    const reward = state.rewards.find((item) => item.id === data.get("redeemReward"));
    if (!selected || !student || !reward) return;

    if (student.points < reward.cost) {
      showToast(`${student.name} 当前积分不足`);
      return;
    }

    student.points -= reward.cost;
    addHistory(student, `兑换：${reward.name}`, -reward.cost);
    selected.redemptions = selected.redemptions || [];
    selected.redemptions.push({
      id: createId(),
      studentName: student.name,
      rewardName: reward.name,
      cost: reward.cost,
      createdAt: Date.now(),
    });

    event.target.reset();
    saveState();
    render();
    showToast("兑换成功");
  }
});

document.addEventListener("click", (event) => {
  const classButton = event.target.closest("[data-select-class]");
  if (classButton) {
    state.selectedClassId = classButton.dataset.selectClass;
    state.activeTab = "students";
    saveState();
    render();
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.activeTab = tab.dataset.tab;
    saveState();
    render();
    return;
  }

  const scoreButton = event.target.closest("[data-score]");
  if (scoreButton) {
    const selected = currentClass();
    const student = selected?.students.find((item) => item.id === scoreButton.dataset.score);
    const behavior = state.behaviors.find((item) => item.id === scoreButton.dataset.behavior);
    if (!student || !behavior) return;

    const before = student.points;
    const after = Math.max(0, before + behavior.points);
    const actualDelta = after - before;
    student.points = after;
    addHistory(student, behavior.name, actualDelta);
    saveState();
    render();
    showToast(actualDelta === 0 ? `${student.name} 已是 0 分` : `${student.name} ${actualDelta > 0 ? "增加" : "减少"} ${Math.abs(actualDelta)} 分`);
    return;
  }

  const deleteStudent = event.target.closest("[data-delete-student]");
  if (deleteStudent && confirm("确定删除这个幼儿吗？")) {
    const selected = currentClass();
    selected.students = selected.students.filter((item) => item.id !== deleteStudent.dataset.deleteStudent);
    saveState();
    render();
    showToast("幼儿已删除");
    return;
  }

  const deleteClass = event.target.closest("[data-delete-class]");
  if (deleteClass && confirm("确定删除这个班级吗？")) {
    state.classes = state.classes.filter((item) => item.id !== deleteClass.dataset.deleteClass);
    state.selectedClassId = state.classes[0]?.id || null;
    saveState();
    render();
    showToast("班级已删除");
    return;
  }

  const deleteBehavior = event.target.closest("[data-delete-behavior]");
  if (deleteBehavior && confirm("确定删除这条规则吗？")) {
    state.behaviors = state.behaviors.filter((item) => item.id !== deleteBehavior.dataset.deleteBehavior);
    saveState();
    render();
    showToast("规则已删除");
    return;
  }

  const deleteReward = event.target.closest("[data-delete-reward]");
  if (deleteReward && confirm("确定下架这个奖励吗？")) {
    state.rewards = state.rewards.filter((item) => item.id !== deleteReward.dataset.deleteReward);
    saveState();
    render();
    showToast("奖励已下架");
  }
});

render();
