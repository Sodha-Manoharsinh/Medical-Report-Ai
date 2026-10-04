/* ============================================================
   Medical Report AI — Application State & API Layer
   ============================================================ */

const API = {
  base: "/api",
  token: null,
  user: null,

  headers() {
    const h = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  },

  async post(path, body) {
    const r = await fetch(this.base + path, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return r;
  },

  async get(path) {
    const r = await fetch(this.base + path, {
      method: "GET",
      headers: this.headers(),
    });
    return r;
  },

  async delete(path) {
    const r = await fetch(this.base + path, {
      method: "DELETE",
      headers: this.headers(),
    });
    return r;
  },

  async uploadFile(path, formData) {
    const headers = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const r = await fetch(this.base + path, {
      method: "POST",
      headers,
      body: formData,
    });
    return r;
  },
};

// ============================================================
// Toast notifications
// ============================================================
function showToast(msg, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ============================================================
// Page routing
// ============================================================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === pageId);
  });
  document.querySelectorAll(".mobile-nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === pageId);
  });

  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Load data for pages
  if (pageId === "dashboard") loadDashboard();
  if (pageId === "documents") loadDocuments();
  if (pageId === "summary") loadSummaryPage();
  if (pageId === "symptoms") loadSymptomsHistory();
  if (pageId === "qa") loadQAHistory();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) {
    const isOpen = sidebar.classList.toggle("mobile-open");
    if (backdrop) backdrop.classList.toggle("active", isOpen);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (backdrop) backdrop.classList.remove("active");
}

// ============================================================
// AUTH & PATIENT PROFILE
// ============================================================
let _loginUserId = null;

function calculateAgeFromDob(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 && age <= 130 ? age : '';
}

function onDobChanged() {
  const dobEl = document.getElementById("login-dob");
  const ageEl = document.getElementById("login-age");
  if (dobEl && ageEl && dobEl.value) {
    const calculated = calculateAgeFromDob(dobEl.value);
    if (calculated !== '') {
      ageEl.value = calculated;
    }
  }
}

function fillDemoPatient() {
  const nameEl = document.getElementById("login-name");
  const dobEl = document.getElementById("login-dob");
  const ageEl = document.getElementById("login-age");
  const emailEl = document.getElementById("login-email");
  const phoneEl = document.getElementById("login-phone");
  const genderEl = document.getElementById("login-gender");

  if (nameEl) nameEl.value = "Eleanor Vance";
  if (dobEl) dobEl.value = "1994-06-18";
  if (ageEl) ageEl.value = "32";
  if (emailEl) emailEl.value = "eleanor.vance@medicalportal.org";
  if (phoneEl) phoneEl.value = "+1 (555) 349-8120";
  if (genderEl) genderEl.value = "Female";

  showToast("Demo patient details auto-filled.", "info", 2000);
}

function insertDevOtp() {
  const devVal = document.getElementById("dev-otp-value")?.textContent?.trim();
  if (devVal && devVal !== "——") {
    const inputs = document.querySelectorAll(".otp-inputs input");
    [...devVal].forEach((ch, i) => {
      if (inputs[i]) inputs[i].value = ch;
    });
    if (inputs[inputs.length - 1]) inputs[inputs.length - 1].focus();
    showToast("Verification code pasted.", "info", 1800);
  }
}

function backToLogin() {
  document.getElementById("screen-otp").style.display = "none";
  document.getElementById("screen-login").style.display = "block";
}

async function doLogin(e) {
  e.preventDefault();
  const name = document.getElementById("login-name")?.value.trim() || "";
  const dob = document.getElementById("login-dob")?.value.trim() || "";
  const age = document.getElementById("login-age")?.value.trim() || "";
  const email = document.getElementById("login-email").value.trim();
  const phone = document.getElementById("login-phone").value.trim();
  const gender = document.getElementById("login-gender")?.value || "";
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("btn-continue");

  if (!email || !phone) {
    errEl.textContent = "Please enter your email and phone number.";
    errEl.style.display = "block";
    return;
  }
  if (!name) {
    errEl.textContent = "Please enter the patient's full name.";
    errEl.style.display = "block";
    return;
  }
  if (!dob || !age) {
    errEl.textContent = "Please enter Date of Birth and Age.";
    errEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Generating Security Code…';
  errEl.style.display = "none";

  try {
    const r = await API.post("/auth/login", {
      email,
      phone,
      full_name: name,
      dob,
      age,
      gender,
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || "Login failed.";
      errEl.style.display = "block";
      return;
    }
    _loginUserId = data.user_id;

    // Show OTP screen
    document.getElementById("screen-login").style.display = "none";
    document.getElementById("screen-otp").style.display = "block";

    const targetDisplay = document.getElementById("otp-target-display");
    if (targetDisplay) {
      targetDisplay.textContent = `${name} (${phone})`;
    }

    // Dev OTP display
    if (data.dev_otp) {
      const devBox = document.getElementById("dev-otp-box");
      devBox.style.display = "block";
      document.getElementById("dev-otp-value").textContent = data.dev_otp;
      // Auto-fill OTP inputs
      const inputs = document.querySelectorAll(".otp-inputs input");
      [...data.dev_otp].forEach((ch, i) => {
        if (inputs[i]) inputs[i].value = ch;
      });
      if (inputs[0]) inputs[0].focus();
    }
  } catch (err) {
    errEl.textContent = "Network error. Is the server running?";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Continue to Secure Verification</span><span class="btn-arrow">→</span>';
  }
}

function getOtpValue() {
  return [...document.querySelectorAll(".otp-inputs input")].map((i) => i.value).join("");
}

async function doVerifyOtp(e) {
  e.preventDefault();
  const otp = getOtpValue();
  const errEl = document.getElementById("otp-error");
  const btn = document.getElementById("btn-verify");

  if (otp.length < 6) {
    errEl.textContent = "Please enter the complete 6-digit OTP code.";
    errEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Verifying Security Code…';
  errEl.style.display = "none";

  try {
    const r = await API.post("/auth/verify-otp", { user_id: _loginUserId, otp });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || "OTP verification failed.";
      errEl.style.display = "block";
      return;
    }
    // Store session
    API.token = data.token;
    API.user = data.user;
    localStorage.setItem("med_token", data.token);
    localStorage.setItem("med_user", JSON.stringify(data.user));

    // Show app
    showApp();
  } catch (err) {
    errEl.textContent = "Network error.";
    errEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Verify &amp; Open Medical Portal</span><span class="btn-arrow">→</span>';
  }
}

function showApp() {
  document.getElementById("auth-root").style.display = "none";
  const app = document.getElementById("app");
  app.classList.add("visible");

  // Set user display
  const email = API.user?.email || "";
  const name = API.user?.full_name || "";
  const initials = (name || email).substring(0, 2).toUpperCase();
  document.getElementById("user-initials").textContent = initials;
  document.getElementById("user-email-display").textContent = name ? `${name} (${email})` : email;

  // Immediately render initial patient profile card if patient details are stored
  const profileCard = document.getElementById("patient-profile-card");
  if (profileCard && (name || API.user?.age || API.user?.date_of_birth || API.user?.abha_id)) {
    profileCard.style.display = "block";
    if (name) document.getElementById("prof-name").textContent = name;
    if (API.user?.age) document.getElementById("prof-age").textContent = API.user.age;
    if (API.user?.gender) document.getElementById("prof-gender").textContent = API.user.gender;
    if (API.user?.date_of_birth) document.getElementById("prof-dob").textContent = API.user.date_of_birth;

    const abhaContainer = document.getElementById("prof-abha-container");
    const abhaEl = document.getElementById("prof-abha");
    if (abhaContainer && abhaEl) {
      if (API.user?.abha_id && API.user.abha_id.trim()) {
        abhaContainer.style.display = "block";
        abhaEl.textContent = API.user.abha_id.trim();
      } else {
        abhaContainer.style.display = "none";
      }
    }
  }

  showPage("dashboard");
}

async function doLogout() {
  promptLogout();
}

function promptLogout() {
  const modal = document.getElementById("logout-modal");
  if (modal) modal.style.display = "flex";
}

function closeLogoutModal() {
  const modal = document.getElementById("logout-modal");
  if (modal) modal.style.display = "none";
  const btn = document.getElementById("btn-confirm-logout");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "<span>Yes, Log Out</span>";
  }
}

async function executeLogout() {
  const btn = document.getElementById("btn-confirm-logout");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Logging out…';
  }
  try {
    await API.post("/auth/logout", {});
  } catch (e) {
    // ignore
  }
  API.token = null;
  API.user = null;
  localStorage.removeItem("med_token");
  localStorage.removeItem("med_user");
  location.reload();
}

// ============================================================
// ACCOUNT HOLDER DETAILS MODAL
// ============================================================
async function showAccountDetailsModal() {
  const modal = document.getElementById("account-details-modal");
  const bodyEl = document.getElementById("modal-account-body");
  const avatarEl = document.getElementById("modal-account-avatar");
  if (!modal || !bodyEl) return;

  modal.style.display = "flex";

  const user = API.user || {};
  const prof = _cache.patientData?.profile || {};
  const displayName = prof.full_name || user.full_name || user.email || "Patient";
  const initials = displayName.substring(0, 2).toUpperCase();
  if (avatarEl) avatarEl.textContent = initials;

  // Immediate render from current active session state
  renderAccountDetailsContent(user, prof);

  // Background refresh to pull latest user profile, document counts, and facts
  try {
    const [meRes, patRes, docRes] = await Promise.all([
      API.get("/auth/me").catch(() => null),
      API.get("/summary/patient-data").catch(() => null),
      API.get("/documents/").catch(() => null),
    ]);

    if (meRes && meRes.ok) {
      const meData = await meRes.json();
      if (meData.user) {
        API.user = { ...API.user, ...meData.user };
        localStorage.setItem("med_user", JSON.stringify(API.user));
      }
    }
    if (patRes && patRes.ok) {
      const patData = await patRes.json();
      _cache.patientData = patData;
    }
    if (docRes && docRes.ok) {
      const docData = await docRes.json();
      _cache.docs = docData.documents || [];
    }
    renderAccountDetailsContent(API.user || user, _cache.patientData?.profile || prof);
  } catch (err) {
    console.error("Account refresh error:", err);
  }
}

function closeAccountDetailsModal() {
  const modal = document.getElementById("account-details-modal");
  if (modal) modal.style.display = "none";
}

function copyAccountId(id) {
  if (!id) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(() => {
      showToast("Account ID copied to clipboard", "success");
    }).catch(() => {
      showToast(`Account ID: ${id}`, "info");
    });
  } else {
    showToast(`Account ID: ${id}`, "info");
  }
}

function renderAccountDetailsContent(user, prof) {
  const bodyEl = document.getElementById("modal-account-body");
  if (!bodyEl) return;

  const fullName = prof.full_name || user.full_name || "Patient Account";
  const email = user.email || "Not recorded";
  const phone = user.phone || "Not recorded";
  const age = user.age || prof.age || null;
  const dob = user.date_of_birth || prof.date_of_birth || null;
  const gender = user.gender || prof.gender || null;
  const bloodGroup = prof.blood_group || user.blood_group || null;
  const abhaId = prof.abha_id || user.abha_id || null;
  const userId = user.id || "Active-Session";
  const docCount = (_cache.docs?.length ?? user.documents_count ?? 0);
  const labCount = (_cache.patientData?.lab_results?.length || 0);
  const medCount = (_cache.patientData?.medications?.length || 0);
  const initials = fullName.substring(0, 2).toUpperCase();

  bodyEl.innerHTML = `
    <!-- Hero Profile -->
    <div class="account-hero-card">
      <div class="account-hero-avatar">${escHtml(initials)}</div>
      <div class="account-hero-info">
        <div class="account-hero-name">
          <span>${escHtml(fullName)}</span>
          <span class="account-verified-tag">✓ Verified Patient</span>
        </div>
        <div class="account-hero-sub">
          <span class="account-status-dot"></span>
          <span>Active Authenticated Session</span>
          <span>·</span>
          <span>Encrypted Vault</span>
        </div>
      </div>
    </div>

    <!-- Storage / Records Overview Strip -->
    <div class="account-records-strip">
      <div class="account-stat-item">
        <div class="account-stat-num">${docCount}</div>
        <div class="account-stat-lbl">Records On File</div>
      </div>
      <div style="width:1px;height:28px;background:var(--border)"></div>
      <div class="account-stat-item">
        <div class="account-stat-num">${labCount}</div>
        <div class="account-stat-lbl">Labs Tracked</div>
      </div>
      <div style="width:1px;height:28px;background:var(--border)"></div>
      <div class="account-stat-item">
        <div class="account-stat-num">${medCount}</div>
        <div class="account-stat-lbl">Active Meds</div>
      </div>
    </div>

    <!-- Account Details Grid -->
    <div class="account-details-grid">
      <div class="account-info-tile">
        <span class="account-tile-label">✉️ Email Address</span>
        <span class="account-tile-val">${escHtml(email)}</span>
      </div>

      <div class="account-info-tile">
        <span class="account-tile-label">📱 Mobile Phone</span>
        <span class="account-tile-val">${escHtml(phone)}</span>
      </div>

      <div class="account-info-tile">
        <span class="account-tile-label">🎂 Age &amp; Birthdate</span>
        <span class="account-tile-val">
          ${age ? `${escHtml(age)} Yrs` : ''} ${dob ? `(${escHtml(dob)})` : (age ? '' : 'Not specified')}
        </span>
      </div>

      <div class="account-info-tile">
        <span class="account-tile-label">⚧ Gender &amp; Blood Group</span>
        <span class="account-tile-val">
          ${gender ? escHtml(gender) : 'Unspecified'} ${bloodGroup ? `· ${escHtml(bloodGroup)}` : ''}
        </span>
      </div>

      <div class="account-info-tile span-full">
        <span class="account-tile-label">🆔 ABHA Health ID</span>
        <span class="account-tile-val">
          ${abhaId ? `<code style="font-family:monospace;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-size:12.5px">${escHtml(abhaId)}</code>` : '<span style="color:var(--text-muted);font-weight:400;font-size:12.5px">Not linked to digital health card</span>'}
        </span>
      </div>

      <div class="account-info-tile span-full" style="background:#f8fafc">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="account-tile-label">🔑 Patient Account ID</span>
          <button type="button" class="btn-secondary" onclick="copyAccountId('${escHtml(userId)}')" style="font-size:11px;padding:2px 8px" title="Copy Account ID">
            📋 Copy ID
          </button>
        </div>
        <span class="account-tile-val" style="font-size:12px;font-family:monospace;color:var(--text-muted)">${escHtml(userId)}</span>
      </div>
    </div>

    <!-- Security & Isolation Banner -->
    <div class="account-security-banner">
      <span style="font-size:18px">🛡️</span>
      <div>
        <strong style="color:#14532d">AES-256 Grade Vault Isolation Active</strong>
        <div style="color:#15803d;font-size:11.5px;margin-top:2px">
          All uploaded diagnostic documents, vitals, and physician notes are strictly isolated to your verified session.
        </div>
      </div>
    </div>

    <!-- Modal Actions -->
    <div class="account-modal-actions">
      <button type="button" class="btn-secondary" onclick="closeAccountDetailsModal();showPage('documents');" style="margin-right:auto">
        📂 View Documents (${docCount})
      </button>
      <button type="button" class="btn-danger btn-sm" onclick="closeAccountDetailsModal();promptLogout();">
        🚪 Log Out
      </button>
      <button type="button" class="btn-primary" onclick="closeAccountDetailsModal()">
        Done
      </button>
    </div>`;
}

// ============================================================
// CLIENT CACHE (Fast navigation & performance)
// ============================================================
const _cache = {
  docs: null,
  patientData: null,
  summariesByType: {},
  symptomsHistory: null,
};

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard(forceRefresh = false) {
  // Instant render from cache if available
  if (!forceRefresh && _cache.docs && _cache.patientData) {
    renderDashboardStats(_cache.docs, _cache.patientData);
  }

  try {
    const [docsR, patR] = await Promise.all([
      API.get("/documents/"),
      API.get("/summary/patient-data"),
    ]);
    const docs = docsR.ok ? (await docsR.json()).documents : (_cache.docs || []);
    const pat = patR.ok ? await patR.json() : (_cache.patientData || {});

    _cache.docs = docs;
    _cache.patientData = pat;
    renderDashboardStats(docs, pat);
  } catch (e) {
    console.error("Dashboard load error:", e);
  }
}

function renderDashboardStats(docs, pat) {
  document.getElementById("stat-docs").textContent = docs.length;
  document.getElementById("stat-labs").textContent = (pat.lab_results || []).length;
  document.getElementById("stat-meds").textContent = (pat.medications || []).length;
  document.getElementById("stat-diags").textContent = (pat.diagnoses || []).length;

  // Extracted Patient Profile Card
  const profileCard = document.getElementById("patient-profile-card");
  if (profileCard) {
    const prof = pat.profile || {};
    if (prof.full_name || prof.age || prof.gender || prof.date_of_birth || prof.abha_id) {
      profileCard.style.display = "block";
      document.getElementById("prof-name").textContent = prof.full_name || "Not recorded";
      document.getElementById("prof-age").textContent = prof.age || "Not recorded";
      document.getElementById("prof-gender").textContent = prof.gender || "Not recorded";
      document.getElementById("prof-dob").textContent = prof.date_of_birth || (prof.age ? "Not specified in report" : "Not recorded");

      // ABHA Health ID: show only if provided in reports
      const abhaContainer = document.getElementById("prof-abha-container");
      const abhaEl = document.getElementById("prof-abha");
      if (abhaContainer && abhaEl) {
        if (prof.abha_id && prof.abha_id.trim()) {
          abhaContainer.style.display = "block";
          abhaEl.textContent = prof.abha_id.trim();
        } else {
          abhaContainer.style.display = "none";
          abhaEl.textContent = "—";
        }
      }
    } else {
      profileCard.style.display = "none";
    }
  }

  // Recent documents
  const recentList = document.getElementById("recent-docs-list");
  if (docs.length === 0) {
    recentList.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><h3>No documents yet</h3><p>Upload your first medical document to get started.</p></div>`;
  } else {
    recentList.innerHTML = docs.slice(0, 4).map(docHtml).join("");
  }
}

// ============================================================
// DOCUMENTS
// ============================================================
let _uploadQueue = [];

function docIcon(type) {
  const icons = { pdf: "📄", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", docx: "📝", doc: "📝", txt: "📋" };
  return icons[type] || "📁";
}

function docHtml(doc) {
  const badge = {
    extracted: '<span class="doc-badge badge-extracted">✓ Extracted</span>',
    processing: '<span class="doc-badge badge-processing">⏳ Processing</span>',
    error: '<span class="doc-badge badge-error">✗ Error</span>',
    pending: '<span class="doc-badge badge-pending">Pending</span>',
  }[doc.upload_status] || "";
  const size = doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB` : "";
  const date = doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "";
  const safeFilename = escHtml(doc.original_filename);
  return `
    <li class="doc-item" data-id="${doc.id}">
      <div class="doc-main-row">
        <span class="doc-icon">${docIcon(doc.file_type)}</span>
        <div class="doc-info">
          <div class="doc-name" title="${safeFilename}">${safeFilename}</div>
          <div class="doc-meta">${size}${size && date ? " · " : ""}${date}</div>
        </div>
        ${badge}
      </div>
      <div class="doc-actions-row">
        <button type="button" class="btn-primary btn-sm btn-doc-action" onclick="viewDocumentFile('${doc.id}', '${safeFilename}')">
          <span>👁️ View File</span>
        </button>
        <button type="button" class="btn-secondary btn-sm btn-doc-action" onclick="viewDocFacts('${doc.id}')">
          <span>🔍 Data</span>
        </button>
        <button type="button" class="btn-danger btn-delete-doc btn-sm btn-doc-action" data-doc-id="${doc.id}" data-doc-name="${safeFilename}">
          <span>🗑️ Delete</span>
        </button>
      </div>
    </li>`;
}

async function loadDocuments(forceRefresh = false) {
  const listEl = document.getElementById("docs-list");

  if (!forceRefresh && _cache.docs) {
    renderDocumentsList(_cache.docs);
  } else {
    listEl.innerHTML = `<div class="loading-overlay"><span class="loader loader-dark"></span> Loading documents…</div>`;
  }

  try {
    const r = await API.get("/documents/");
    if (!r.ok) throw new Error("Failed to load");
    const { documents } = await r.json();
    _cache.docs = documents;
    renderDocumentsList(documents);
  } catch (e) {
    if (!_cache.docs) {
      listEl.innerHTML = `<div class="alert alert-error">Failed to load documents.</div>`;
    }
  }
}

function renderDocumentsList(documents) {
  const listEl = document.getElementById("docs-list");
  if (documents.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><h3>No documents yet</h3><p>Upload your medical documents above.</p></div>`;
  } else {
    listEl.innerHTML = `<ul class="doc-list">${documents.map(docHtml).join("")}</ul>`;
  }
}

async function viewDocFacts(docId) {
  const modal = document.getElementById("doc-facts-modal");
  const titleEl = document.getElementById("modal-doc-title");
  const contentEl = document.getElementById("modal-doc-facts-content");

  modal.style.display = "flex";
  contentEl.innerHTML = `<div class="loading-overlay"><span class="loader loader-dark"></span> Loading extracted details…</div>`;

  try {
    const r = await API.get(`/documents/${docId}/facts`);
    if (!r.ok) throw new Error("Failed to load");
    const { document: doc, facts } = await r.json();

    titleEl.textContent = `📋 Extracted Facts — ${doc.original_filename}`;

    if (!facts || facts.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <p>No structured parameters were detected in this document.</p>
        </div>`;
      return;
    }

    // Group facts by category
    const byCategory = {};
    for (const f of facts) {
      const cat = f.category || "other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(f);
    }

    const prof = _cache.patientData?.profile || {};
    let html = `
      <div style="margin-bottom:14px;padding:12px 16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px">
          <div><strong>Document:</strong> ${escHtml(doc.original_filename)}</div>
          <div><strong>Uploaded:</strong> ${new Date(doc.uploaded_at).toLocaleString()}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding-top:8px;border-top:1px dashed var(--border)">
          <div>👤 <strong>Patient:</strong> ${escHtml(prof.full_name || 'Not recorded')}</div>
          <div>🎂 <strong>Age:</strong> ${escHtml(prof.age || 'Not recorded')}</div>
          <div>⚧ <strong>Gender:</strong> ${escHtml(prof.gender || 'Not recorded')}</div>
          <div>📅 <strong>DOB:</strong> ${escHtml(prof.date_of_birth || 'Not recorded')}</div>
          ${prof.abha_id ? `<div>🆔 <strong>ABHA ID:</strong> ${escHtml(prof.abha_id)}</div>` : ''}
        </div>
      </div>`;

    for (const [cat, items] of Object.entries(byCategory)) {
      const catTitles = {
        lab_result: "🧪 Laboratory Results",
        vital_sign: "💓 Vital Signs",
        diagnosis: "🩺 Diagnoses & Impressions",
        medication: "💊 Medications",
        allergy: "⚠️ Allergies",
        symptom: "🤒 Symptoms",
      };

      html += `<h4 style="color:var(--primary);margin:16px 0 8px;font-size:14px">${catTitles[cat] || cat}</h4>`;
      html += `
        <table class="data-table" style="margin-bottom:14px">
          <thead>
            <tr>
              <th>Parameter / Name</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Reference Range</th>
              <th>Status / Flag</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const flagClass = it.flag ? `flag-${it.flag}` : '';
              const flagBadge = it.flag ? `<span class="flag-badge ${flagClass}">${escHtml(it.flag)}</span>` : (it.status || 'found');
              return `
                <tr>
                  <td><strong>${escHtml(it.field_name)}</strong></td>
                  <td>${escHtml(it.field_value || '—')}</td>
                  <td>${escHtml(it.unit || '—')}</td>
                  <td>${escHtml(it.reference_range || '—')}</td>
                  <td>${flagBadge}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>`;
    }

    contentEl.innerHTML = html;
  } catch (err) {
    contentEl.innerHTML = `<div class="alert alert-error">Failed to load extracted facts for this document.</div>`;
  }
}

function closeDocFactsModal() {
  document.getElementById("doc-facts-modal").style.display = "none";
}

// ============================================================
// DOCUMENT FILE VIEWER
// ============================================================
async function viewDocumentFile(docId, filename) {
  const modal = document.getElementById("doc-view-modal");
  const titleEl = document.getElementById("modal-view-doc-title");
  const metaEl = document.getElementById("modal-view-doc-meta");
  const contentEl = document.getElementById("modal-doc-view-content");
  const downloadBtn = document.getElementById("modal-view-download-btn");

  if (!modal) return;
  modal.style.display = "flex";
  if (titleEl) titleEl.textContent = filename || "Document Preview";
  if (metaEl) metaEl.textContent = "Loading file…";
  if (contentEl) {
    contentEl.innerHTML = `<div class="loading-overlay" style="height:100%"><span class="loader loader-dark"></span> Loading document preview…</div>`;
  }

  const viewUrl = `/api/documents/${docId}/view?token=${encodeURIComponent(API.token || '')}`;
  if (downloadBtn) {
    downloadBtn.href = viewUrl;
    downloadBtn.download = filename || "document";
  }

  try {
    const r = await API.get(`/documents/${docId}/content`);
    const data = r.ok ? await r.json() : null;
    const doc = data?.document || {};
    const ext = (doc.file_type || filename?.split('.').pop() || '').toLowerCase();
    const sizeStr = doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB` : '';
    if (metaEl) {
      metaEl.textContent = `Type: ${ext.toUpperCase()}${sizeStr ? ` • Size: ${sizeStr}` : ''} • Uploaded: ${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : ''}`;
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
      contentEl.innerHTML = `
        <div style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a">
          <img src="${viewUrl}" alt="${escHtml(filename)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.6)" />
        </div>`;
    } else if (ext === 'pdf') {
      contentEl.innerHTML = `
        <iframe src="${viewUrl}" style="width:100%;height:100%;border:none;flex:1" title="${escHtml(filename)}"></iframe>`;
    } else {
      const text = data?.text || 'No text content detected in this file.';
      contentEl.innerHTML = `
        <div style="flex:1;overflow:auto;padding:20px 24px;background:#ffffff">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
            <span style="font-weight:700;color:var(--primary);font-size:13px">📄 Document Text Content</span>
            <span style="font-size:12px;color:var(--text-muted)">${text.length} characters</span>
          </div>
          <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;line-height:1.65;color:#1e293b;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:0">${escHtml(text)}</pre>
        </div>`;
    }
  } catch (err) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="padding:40px;text-align:center">
          <p style="color:var(--error);margin-bottom:14px">Preview cannot be rendered in browser frame.</p>
          <a href="${viewUrl}" target="_blank" download class="btn-primary" style="display:inline-block;text-decoration:none;padding:8px 18px">Download / Open Original File</a>
        </div>`;
    }
  }
}

function closeDocViewModal() {
  const modal = document.getElementById("doc-view-modal");
  if (modal) modal.style.display = "none";
}

// ============================================================
// DOCUMENT DELETION (Accessible Permission Modal & Immediate Action)
// ============================================================
let _docToDeleteId = null;

function ensureDocDeleteModal() {
  let modal = document.getElementById("doc-delete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "doc-delete-modal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width:480px">
        <div class="modal-header" style="background:#fef2f2;border-bottom:1px solid #fecaca">
          <h3 style="color:#b91c1c;display:flex;align-items:center;gap:8px">
            <span>🗑️</span> Permission to Delete Record
          </h3>
          <button type="button" class="modal-close" onclick="closeDocDeleteModal()">&times;</button>
        </div>
        <div class="modal-body" style="padding:22px">
          <p style="font-size:14px;color:var(--text);margin-bottom:12px;line-height:1.5">
            Do you give permission to permanently delete this record?
          </p>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">📄</span>
            <strong id="delete-doc-filename" style="color:var(--primary);font-size:14px;word-break:break-all">document</strong>
          </div>
          <div style="background:#fff1f2;border:1px solid #ffe4e6;border-radius:8px;padding:12px 14px;font-size:12.5px;color:#9f1239;margin-bottom:20px;line-height:1.5">
            ⚠️ <strong>Notice:</strong> If you select <strong>Yes</strong>, this medical record and all its associated laboratory results, vitals, and diagnoses will be permanently erased.
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn-secondary" onclick="closeDocDeleteModal()">Cancel</button>
            <button type="button" class="btn-danger" id="btn-confirm-delete" onclick="executeDocDelete()" style="background:#dc2626;color:#fff;border-color:#b91c1c;padding:9px 18px;font-weight:600">
              <span>Yes, Delete Record</span>
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeDocDeleteModal();
    });
  }
  return modal;
}

function handleDocDeleteKeyDown(e) {
  if (e.key === "Escape") {
    closeDocDeleteModal();
  }
}

function promptDeleteDoc(id, filename) {
  if (!id) return;
  _docToDeleteId = id;
  const modal = ensureDocDeleteModal();
  const filenameEl = document.getElementById("delete-doc-filename");
  if (filenameEl) {
    filenameEl.textContent = filename || "this record";
  }
  modal.style.display = "flex";
  window.addEventListener("keydown", handleDocDeleteKeyDown);
}

function closeDocDeleteModal() {
  const modal = document.getElementById("doc-delete-modal");
  if (modal) {
    modal.style.display = "none";
  }
  _docToDeleteId = null;
  window.removeEventListener("keydown", handleDocDeleteKeyDown);
  const btn = document.getElementById("btn-confirm-delete");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "<span>Yes, Delete Record</span>";
  }
}

async function executeDocDelete() {
  if (!_docToDeleteId) return;
  const btn = document.getElementById("btn-confirm-delete");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Deleting record…';
  }

  const deletingId = _docToDeleteId;

  try {
    const r = await API.delete(`/documents/${deletingId}`);
    if (r.ok) {
      showToast("Record and extracted medical data deleted successfully.", "success");
      // Instant optimistic removal from DOM
      document.querySelectorAll(`.doc-item[data-id="${deletingId}"]`).forEach((el) => el.remove());

      // Update cached docs list
      if (_cache.docs) {
        _cache.docs = _cache.docs.filter((d) => d.id !== deletingId);
      }
      _cache.patientData = null;
      _cache.summariesByType = {};
      closeDocDeleteModal();
      loadDocuments(true);
      loadDashboard(true);
    } else {
      const err = await r.json().catch(() => ({}));
      showToast(err.error || "Failed to delete record.", "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "<span>Yes, Delete Record</span>";
      }
    }
  } catch (err) {
    showToast("Network error while deleting record.", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "<span>Yes, Delete Record</span>";
    }
  }
}

async function deleteDocument(id, filename) {
  promptDeleteDoc(id, filename);
}

// Global click delegation for all delete buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-delete-doc") || (e.target.matches("button.btn-danger") && e.target.closest(".doc-item") ? e.target : null);
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const docItem = btn.closest(".doc-item");
    const docId = btn.getAttribute("data-doc-id") || docItem?.dataset?.id;
    const docName = btn.getAttribute("data-doc-name") || docItem?.querySelector(".doc-name")?.textContent?.trim() || "this record";
    if (docId) {
      promptDeleteDoc(docId, docName);
    }
  }
});

// Explicitly bind to window for inline onclick handlers
window.promptDeleteDoc = promptDeleteDoc;
window.closeDocDeleteModal = closeDocDeleteModal;
window.executeDocDelete = executeDocDelete;
window.deleteDocument = deleteDocument;
window.promptLogout = promptLogout;
window.closeLogoutModal = closeLogoutModal;
window.executeLogout = executeLogout;
window.viewDocumentFile = viewDocumentFile;
window.closeDocViewModal = closeDocViewModal;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.setPrimaryChip = setPrimaryChip;
window.toggleSymptomCard = toggleSymptomCard;
window.updateSeverityLabel = updateSeverityLabel;
window.toggleHistoryDetails = toggleHistoryDetails;
window.submitSymptomForm = submitSymptomForm;
window.askPresetQuestion = askPresetQuestion;
window.sendQuestion = sendQuestion;
window.clearQAHistory = clearQAHistory;
window.showAccountDetailsModal = showAccountDetailsModal;
window.closeAccountDetailsModal = closeAccountDetailsModal;
window.copyAccountId = copyAccountId;

function setupUpload() {
  const zone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("file-input");

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    handleFiles([...e.dataTransfer.files]);
  });
  fileInput.addEventListener("change", () => {
    handleFiles([...fileInput.files]);
    fileInput.value = "";
  });
}

async function handleFiles(files) {
  if (!files.length) return;
  const container = document.getElementById("upload-progress-container");
  container.innerHTML = "";

  // Concurrently process files for maximum speed (Requirement 6)
  const uploadPromises = Array.from(files).map(async (file) => {
    const itemId = `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    container.insertAdjacentHTML("beforeend", `
      <div class="upload-progress-item" id="${itemId}">
        <div class="up-filename">${escHtml(file.name)}</div>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:40%"></div></div>
        <div class="up-status">Uploading & extracting…</div>
      </div>`);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const r = await API.uploadFile("/documents/upload", fd);
      const data = await r.json();
      const item = document.getElementById(itemId);

      if (r.ok) {
        if (item) {
          item.querySelector(".progress-bar").style.width = "100%";
          item.querySelector(".progress-bar").style.background = "var(--success)";
          item.querySelector(".up-status").textContent = "✓ Extracted successfully";
          item.querySelector(".up-status").style.color = "var(--success)";
        }
        showToast(`${file.name} — extracted successfully.`, "success");
        return true;
      } else {
        if (item) {
          item.querySelector(".progress-bar").style.background = "var(--error)";
          item.querySelector(".up-status").textContent = `✗ ${data.error || "Upload failed"}`;
          item.querySelector(".up-status").style.color = "var(--error)";
        }
        showToast(`${file.name} — ${data.error || "Upload failed"}`, "error");
        return false;
      }
    } catch (err) {
      const item = document.getElementById(itemId);
      if (item) {
        item.querySelector(".up-status").textContent = `✗ Network error`;
        item.querySelector(".up-status").style.color = "var(--error)";
      }
      return false;
    }
  });

  await Promise.all(uploadPromises);

  // Invalidate cache and refresh documents & dashboard in parallel
  _cache.docs = null;
  _cache.patientData = null;
  _cache.summariesByType = {};
  await Promise.all([loadDocuments(true), loadDashboard(true)]);
}

// ============================================================
// SUMMARY & ANALYSIS
// ============================================================
let _currentSummaryType = 'comprehensive';

function renderMarkdown(md) {
  return renderStructuredSummary(md);
}

function renderStructuredSummary(md) {
  if (!md) return '';

  const rawLines = md.split('\n');
  let title = '';
  let metaLine = '';
  let subLine = '';
  let bodyStartIndex = 0;

  for (let i = 0; i < Math.min(rawLines.length, 8); i++) {
    const l = rawLines[i].trim();
    if (l.startsWith('# ') && !title) {
      title = l.replace(/^#\s+/, '');
      bodyStartIndex = i + 1;
    } else if (l.includes('**Patient:**') || l.includes('**Generated:**')) {
      metaLine = l;
      bodyStartIndex = i + 1;
    } else if (l.startsWith('*') && l.endsWith('*') && !l.includes('###') && !l.includes('##')) {
      subLine = l.replace(/^\*+|\*+$/g, '');
      bodyStartIndex = i + 1;
    } else if (l === '---') {
      bodyStartIndex = i + 1;
    }
  }

  const remainingText = rawLines.slice(bodyStartIndex).join('\n').trim();

  // Split into sections by heading (## or ###)
  const rawSections = remainingText.split(/(?=^#{2,3}\s+)/m);
  const parsedSections = [];

  for (const s of rawSections) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^#{2,3}\s+(.+)$/m);
    if (match) {
      const heading = match[1].trim();
      const content = trimmed.substring(match[0].length).trim();
      parsedSections.push({ heading, content });
    } else {
      parsedSections.push({ heading: 'Overview & Observations', content: trimmed });
    }
  }

  // Count metrics for quick overview strip
  let diagnosisCount = 0;
  let abnormalLabCount = 0;
  let totalLabCount = 0;
  let vitalCount = 0;
  let medCount = 0;

  for (const sec of parsedSections) {
    const lowerH = sec.heading.toLowerCase();
    if (lowerH.includes('problem') || lowerH.includes('diagnos') || lowerH.includes('condition')) {
      const conditionMatches = sec.content.match(/Identified Condition|Condition|Diagnosis/gi);
      diagnosisCount += conditionMatches ? conditionMatches.length : 1;
    }
    if (lowerH.includes('lab') || lowerH.includes('biomarker') || lowerH.includes('finding')) {
      const lines = sec.content.split('\n');
      for (const l of lines) {
        if (l.trim().startsWith('- ') || l.trim().startsWith('• ') || l.trim().startsWith('* ')) {
          totalLabCount++;
          if (/high|low|critical|elevated/i.test(l)) abnormalLabCount++;
        }
      }
    }
    if (lowerH.includes('vital')) {
      const lines = sec.content.split('\n');
      for (const l of lines) {
        if (l.trim().startsWith('- ') || l.trim().startsWith('• ') || l.trim().startsWith('* ')) vitalCount++;
      }
    }
    if (lowerH.includes('medication') || lowerH.includes('regimen') || lowerH.includes('prescription')) {
      const lines = sec.content.split('\n');
      for (const l of lines) {
        if (l.trim().startsWith('- ') || l.trim().startsWith('• ') || l.trim().startsWith('* ')) medCount++;
      }
    }
  }

  let html = `<div class="summary-container-wrap">`;

  // Quick Metrics Strip
  if (totalLabCount > 0 || vitalCount > 0 || diagnosisCount > 0 || medCount > 0) {
    html += `
      <div class="summary-metrics-strip">
        <div class="summary-metric-tile tile-problem">
          <div class="tile-icon">🩺</div>
          <div class="tile-body">
            <span class="tile-label">Primary Findings</span>
            <span class="tile-value">${diagnosisCount > 0 ? `${diagnosisCount} Identified` : 'Clinical Review'}</span>
          </div>
        </div>
        <div class="summary-metric-tile tile-labs">
          <div class="tile-icon">🧪</div>
          <div class="tile-body">
            <span class="tile-label">Lab Biomarkers</span>
            <span class="tile-value">${totalLabCount > 0 ? `${totalLabCount} Tests (${abnormalLabCount} Flagged)` : 'Evaluated'}</span>
          </div>
        </div>
        <div class="summary-metric-tile tile-vitals">
          <div class="tile-icon">💓</div>
          <div class="tile-body">
            <span class="tile-label">Vitals Monitored</span>
            <span class="tile-value">${vitalCount > 0 ? `${vitalCount} Recorded` : 'Baseline'}</span>
          </div>
        </div>
        <div class="summary-metric-tile tile-meds">
          <div class="tile-icon">💊</div>
          <div class="tile-body">
            <span class="tile-label">Active Regimen</span>
            <span class="tile-value">${medCount > 0 ? `${medCount} Prescriptions` : 'None Listed'}</span>
          </div>
        </div>
      </div>`;
  }

  // Render each section as an individual styled clinical box
  for (const sec of parsedSections) {
    const h = sec.heading;
    const lowerH = h.toLowerCase();
    const content = sec.content;

    // 1. Patient Demographics Profile Box
    if (lowerH.includes('patient') || lowerH.includes('demographic')) {
      html += renderPatientDemoBox(h, content);
    }
    // 2. Clinical Problem & Diagnostic Assessment Box
    else if (lowerH.includes('problem') || lowerH.includes('diagnos') || lowerH.includes('assessment') || lowerH.includes('condition')) {
      html += renderClinicalProblemBox(h, content);
    }
    // 3. Laboratory Findings Box
    else if (lowerH.includes('lab') || lowerH.includes('finding') || lowerH.includes('biomarker')) {
      html += renderLabsBox(h, content);
    }
    // 4. Vital Signs Box
    else if (lowerH.includes('vital')) {
      html += renderVitalsBox(h, content);
    }
    // 5. Medications Box
    else if (lowerH.includes('medication') || lowerH.includes('regimen') || lowerH.includes('prescription')) {
      html += renderMedsBox(h, content);
    }
    // 6. Allergies Box
    else if (lowerH.includes('allerg') || lowerH.includes('alert')) {
      html += renderAllergiesBox(h, content);
    }
    // 7. General Section Box
    else {
      html += renderGeneralSectionBox(h, content);
    }
  }

  html += `</div>`;
  return html;
}

function parseKeyValueLine(line) {
  if (!line) return null;
  const trimmed = line.trim();
  const cleaned = trimmed.replace(/^[-*•]\s*/, '').replace(/^⚠️\s*/, '');

  // Case 1: **Key:** Value
  let m = cleaned.match(/^\*\*([^*:]+):\*\*\s*(.*)/);
  if (m) return { key: m[1].trim(), rest: m[2].trim() };

  // Case 2: **Key**: Value
  m = cleaned.match(/^\*\*([^*]+)\*\*:\s*(.*)/);
  if (m) return { key: m[1].trim(), rest: m[2].trim() };

  // Case 3: Key: Value
  m = cleaned.match(/^([^:*]+):\s*(.*)/);
  if (m) return { key: m[1].trim(), rest: m[2].trim() };

  return null;
}

function renderPatientDemoBox(heading, content) {
  const lines = content.split('\n');
  const items = [];
  for (const l of lines) {
    const parsed = parseKeyValueLine(l);
    if (parsed && parsed.rest && parsed.rest !== 'null') {
      items.push({ label: parsed.key, val: parsed.rest });
    }
  }

  let body = '';
  if (items.length > 0) {
    const labelIcons = {
      'full name': '👤',
      'name': '👤',
      'patient name': '👤',
      'age': '🎂',
      'gender': '⚧',
      'sex': '⚧',
      'date of birth': '📅',
      'dob': '📅',
      'blood group': '🩸',
      'blood type': '🩸',
      'abha id': '🆔',
      'health id': '🆔',
      'address': '📍',
      'contact': '📞',
    };
    body = `
      <div class="summary-demographics-grid">
        ${items.map(it => {
          const icon = labelIcons[it.label.toLowerCase()] || '📋';
          return `
            <div class="summary-demographic-item">
              <span class="demo-label">${icon} ${escHtml(it.label)}</span>
              <span class="demo-val">${escHtml(it.val)}</span>
            </div>`;
        }).join('')}
      </div>`;
  } else {
    body = `<p class="summary-plain-p">${formatGenericContent(content)}</p>`;
  }

  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">👤 Patient Demographic Profile</h3>
        <span class="summary-box-badge">Verified On-File</span>
      </div>
      ${body}
    </div>`;
}

function renderClinicalProblemBox(heading, content) {
  const lines = content.split('\n');
  let intro = '';
  const conditions = [];
  const indicators = [];

  for (const l of lines) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('- **Identified Condition:**') || trimmed.startsWith('• **Identified Condition:**') || trimmed.startsWith('**Identified Condition:**')) {
      conditions.push(trimmed.replace(/^[-*•]?\s*\*\*Identified Condition:\*\*\s*/i, ''));
    } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      indicators.push(trimmed.replace(/^[-*•]\s*/, ''));
    } else if (!intro && !trimmed.startsWith('**') && !trimmed.startsWith('#')) {
      intro = trimmed;
    }
  }

  return `
    <div class="summary-card-box" style="border-left:5px solid #0284c7">
      <div class="summary-box-header">
        <h3 class="summary-box-title">🩺 Clinical Problem &amp; Diagnostic Assessment</h3>
        <span class="summary-box-badge" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd">Clinical Evaluation</span>
      </div>
      <div class="summary-problem-callout">
        <div class="problem-banner-eyebrow">
          <span>🚨</span> Clinical Findings Identified in Records:
        </div>
        <div class="problem-banner-title">
          ${conditions.length ? conditions.map(c => `<div>🩺 <strong>${escHtml(c)}</strong></div>`).join('') : (intro ? escHtml(intro) : 'Evaluation grounded in uploaded diagnostic files.')}
        </div>
        ${intro && conditions.length ? `<p style="font-size:13px;color:#0369a1;margin-bottom:10px">${escHtml(intro)}</p>` : ''}
        ${indicators.length ? `
          <div class="problem-indicators-list">
            ${indicators.map(ind => {
              const flagMatch = ind.match(/Flagged\s+([A-Za-z/]+)/i) || ind.match(/\[([A-Za-z/]+)\]/i);
              const flag = flagMatch ? (flagMatch[1] || flagMatch[2]) : '';
              const flagClass = flag.toLowerCase().includes('high') ? 'flag-High' : flag.toLowerCase().includes('low') ? 'flag-Low' : 'flag-Normal';
              return `
                <div class="problem-indicator-item">
                  <span>${escHtml(ind)}</span>
                  ${flag ? `<span class="flag-badge ${flagClass}">${escHtml(flag)}</span>` : ''}
                </div>`;
            }).join('')}
          </div>` : ''}
      </div>
    </div>`;
}

function renderLabsBox(heading, content) {
  const lines = content.split('\n');
  const labs = [];

  for (const l of lines) {
    const parsed = parseKeyValueLine(l);
    if (parsed) {
      const name = parsed.key;
      const rest = parsed.rest;

      const flagMatch = rest.match(/\[([A-Za-z/]+)\]|\(Flagged\s+([A-Za-z/]+)/i);
      const flag = flagMatch ? (flagMatch[1] || flagMatch[2]) : '';

      const refMatch = rest.match(/\*?\(Ref:?\s*([^\)]+)\)\*?|\(ref:?\s*([^\)]+)\)/i);
      const ref = refMatch ? (refMatch[1] || refMatch[2]) : '';

      let valUnit = rest.replace(/\[.*?\]|\(.*?\)/g, '').replace(/\*+/g, '').trim();

      labs.push({ name, valUnit, flag, ref });
    }
  }

  let body = '';
  if (labs.length > 0) {
    body = `
      <div class="summary-labs-grid">
        ${labs.map(lab => {
          const isHigh = /high|elevated/i.test(lab.flag);
          const isLow = /low/i.test(lab.flag);
          const flagClass = isHigh ? 'flagged-high' : isLow ? 'flagged-low' : 'flagged-normal';
          const badgeClass = isHigh ? 'flag-High' : isLow ? 'flag-Low' : 'flag-Normal';

          return `
            <div class="summary-lab-card ${flagClass}">
              <div class="lab-card-top">
                <span class="lab-card-name">${escHtml(lab.name)}</span>
                ${lab.flag ? `<span class="flag-badge ${badgeClass}">${escHtml(lab.flag)}</span>` : ''}
              </div>
              <div class="lab-card-val-row">
                <span class="lab-card-val">${escHtml(lab.valUnit || '—')}</span>
              </div>
              ${lab.ref ? `<div class="lab-card-ref">Ref: ${escHtml(lab.ref)}</div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  } else {
    body = `<p class="summary-plain-p">${formatGenericContent(content)}</p>`;
  }

  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">🧪 Laboratory Diagnostics &amp; Biomarkers</h3>
        <span class="summary-box-badge">${labs.length ? `${labs.length} Tests Analyzed` : 'Diagnostics'}</span>
      </div>
      ${body}
    </div>`;
}

function renderVitalsBox(heading, content) {
  const lines = content.split('\n');
  const vitals = [];

  for (const l of lines) {
    const parsed = parseKeyValueLine(l);
    if (parsed) {
      const name = parsed.key;
      const rest = parsed.rest;
      const flagMatch = rest.match(/\[([A-Za-z/]+)\]/i);
      const flag = flagMatch ? flagMatch[1] : '';
      const val = rest.replace(/\[.*?\]/g, '').replace(/\*+/g, '').trim();
      vitals.push({ name, val, flag });
    }
  }

  let body = '';
  if (vitals.length > 0) {
    body = `
      <div class="summary-vitals-grid">
        ${vitals.map(v => {
          const isHigh = /high|elevated/i.test(v.flag);
          const flagClass = isHigh ? 'flag-High' : 'flag-Normal';
          return `
            <div class="summary-vital-card">
              <span class="vital-card-name">${escHtml(v.name)}</span>
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">
                <span class="vital-card-val">${escHtml(v.val)}</span>
                ${v.flag ? `<span class="flag-badge ${flagClass}">${escHtml(v.flag)}</span>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  } else {
    body = `<p class="summary-plain-p">${formatGenericContent(content)}</p>`;
  }

  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">💓 Recorded Vital Signs</h3>
        <span class="summary-box-badge">${vitals.length ? `${vitals.length} Vitals` : 'Vitals'}</span>
      </div>
      ${body}
    </div>`;
}

function renderMedsBox(heading, content) {
  const lines = content.split('\n');
  const meds = [];

  for (const l of lines) {
    const parsed = parseKeyValueLine(l);
    if (parsed) {
      meds.push({ name: parsed.key, details: parsed.rest });
    }
  }

  let body = '';
  if (meds.length > 0) {
    body = `
      <div class="summary-meds-grid">
        ${meds.map(m => `
          <div class="summary-med-card">
            <span class="summary-med-icon">💊</span>
            <div class="summary-med-info">
              <span class="summary-med-name">${escHtml(m.name)}</span>
              <span class="summary-med-dose">${escHtml(m.details || 'As prescribed')}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } else {
    body = `<p class="summary-plain-p">${formatGenericContent(content)}</p>`;
  }

  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">💊 Current Medications &amp; Regimen</h3>
        <span class="summary-box-badge">${meds.length ? `${meds.length} Prescriptions` : 'Pharmacotherapy'}</span>
      </div>
      ${body}
    </div>`;
}

function renderAllergiesBox(heading, content) {
  const lines = content.split('\n');
  const allergies = [];

  for (const l of lines) {
    const parsed = parseKeyValueLine(l);
    if (parsed) {
      allergies.push({ allergen: parsed.key, reaction: parsed.rest });
    }
  }

  let body = '';
  if (allergies.length > 0) {
    body = `
      <div class="summary-allergies-grid">
        ${allergies.map(a => `
          <div class="summary-allergy-card">
            <span style="font-size:22px;flex-shrink:0">⚠️</span>
            <div style="display:flex;flex-direction:column;gap:2px">
              <strong style="color:#9a3412;font-size:13.5px">${escHtml(a.allergen)}</strong>
              <span style="font-size:12px;color:#c2410c">${escHtml(a.reaction || 'Adverse hypersensitivity alert')}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } else {
    body = `<p class="summary-plain-p">${formatGenericContent(content)}</p>`;
  }

  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">⚠️ Allergies &amp; Safety Alerts</h3>
        <span class="summary-box-badge" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa">Safety Precautions</span>
      </div>
      ${body}
    </div>`;
}

function renderGeneralSectionBox(heading, content) {
  const cleanHeading = heading.replace(/^#{1,3}\s*/, '');
  return `
    <div class="summary-card-box">
      <div class="summary-box-header">
        <h3 class="summary-box-title">${escHtml(cleanHeading)}</h3>
        <span class="summary-box-badge">Clinical Synthesis</span>
      </div>
      <div style="font-size:13.5px;line-height:1.65;color:var(--text)">
        ${formatGenericContent(content)}
      </div>
    </div>`;
}

function formatGenericContent(text) {
  if (!text) return '';
  let escaped = escHtml(text);
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

  const lines = escaped.split('\n');
  let inList = false;
  const processed = [];
  for (const l of lines) {
    const t = l.trim();
    if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
      if (!inList) {
        processed.push('<ul class="summary-action-list">');
        inList = true;
      }
      processed.push(`<li>${t.substring(2)}</li>`);
    } else {
      if (inList) {
        processed.push('</ul>');
        inList = false;
      }
      if (t) processed.push(`<p class="summary-plain-p">${t}</p>`);
    }
  }
  if (inList) processed.push('</ul>');
  return processed.join('\n');
}

function selectSummaryType(type) {
  _currentSummaryType = type;
  document.querySelectorAll('[data-sumtype]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sumtype === type);
  });
  loadLatestSummary(type);
}

async function loadSummaryPage() {
  await Promise.all([loadLatestSummary(_currentSummaryType), loadPatientDataTables()]);
}

async function loadLatestSummary(type = _currentSummaryType) {
  const summaryEl = document.getElementById("summary-content");
  const genEl = document.getElementById("summary-generated-at");
  const titleEl = document.getElementById("summary-display-title");
  const badgeEl = document.getElementById("summary-type-badge");

  // Instant render from cache if available
  if (_cache.summariesByType[type]) {
    const cached = _cache.summariesByType[type];
    if (titleEl) titleEl.textContent = `📄 ${cached.title || 'Medical Summary'}`;
    if (badgeEl) badgeEl.textContent = cached.summary_type || type;
    summaryEl.innerHTML = renderMarkdown(cached.summary);
    if (cached.generated_at && genEl) genEl.textContent = `Generated: ${new Date(cached.generated_at).toLocaleString()}`;
    return;
  }

  summaryEl.innerHTML = `<div class="loading-overlay"><span class="loader loader-dark"></span> Loading ${type} summary…</div>`;

  try {
    const r = await API.get(`/summary/latest?type=${type}`);
    if (!r.ok) throw new Error();
    const data = await r.json();

    if (data.summary) {
      _cache.summariesByType[type] = data;
      if (titleEl) titleEl.textContent = `📄 ${data.title || 'Medical Summary'}`;
      if (badgeEl) badgeEl.textContent = data.summary_type || type;
      summaryEl.innerHTML = renderMarkdown(data.summary);
      if (data.generated_at && genEl) genEl.textContent = `Generated: ${new Date(data.generated_at).toLocaleString()}`;
    } else if (data.patient_data?.documents?.length > 0) {
      // Auto-generate initial summary immediately so user doesn't wait
      generateSummary();
    } else {
      summaryEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No ${type} summary yet</h3><p>Upload medical reports in Documents tab to generate summaries.</p></div>`;
      if (genEl) genEl.textContent = "";
    }
  } catch (e) {
    summaryEl.innerHTML = `<div class="alert alert-error">Failed to load summary.</div>`;
  }
}

async function generateSummary() {
  const btn = document.getElementById("btn-generate-summary");
  const summaryEl = document.getElementById("summary-content");
  const titleEl = document.getElementById("summary-display-title");
  const badgeEl = document.getElementById("summary-type-badge");

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Generating…';
  summaryEl.innerHTML = `<div class="loading-overlay"><span class="loader loader-dark"></span> AI is analyzing and generating your ${_currentSummaryType} summary…</div>`;

  try {
    const r = await API.post("/summary/generate", { summary_type: _currentSummaryType });
    const data = await r.json();
    if (!r.ok) {
      summaryEl.innerHTML = `<div class="alert alert-error">${data.error || "Generation failed."}</div>`;
      showToast(data.error || "Generation failed.", "error");
      return;
    }
    _cache.summariesByType[_currentSummaryType] = data;
    if (titleEl) titleEl.textContent = `📄 ${data.title || 'Medical Summary'}`;
    if (badgeEl) badgeEl.textContent = data.summary_type || _currentSummaryType;
    summaryEl.innerHTML = renderMarkdown(data.summary);
    document.getElementById("summary-generated-at").textContent = `Generated: ${new Date().toLocaleString()}`;
    showToast(`${data.title || 'Summary'} generated successfully.`, "success");
  } catch (e) {
    summaryEl.innerHTML = `<div class="alert alert-error">Network error.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "♻ Generate / Refresh";
  }
}

async function runAnalysis() {
  const btn = document.getElementById("btn-run-analysis");
  const container = document.getElementById("analysis-container");
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Analyzing…';
  container.innerHTML = `<div class="loading-overlay"><span class="loader loader-dark"></span> Analyzing medical records…</div>`;

  try {
    const r = await API.post("/summary/analyze", {});
    const data = await r.json();
    if (!r.ok) {
      container.innerHTML = `<div class="alert alert-error">${data.error || "Analysis failed."}</div>`;
      return;
    }
    renderAnalysis(data.analysis);
    showToast("Analysis complete.", "success");
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Network error.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "▶ Run Analysis";
  }
}

function renderAnalysis(analysis) {
  const container = document.getElementById("analysis-container");
  const timeline = (analysis.timeline || []);
  const changes = (analysis.changes || []);
  const meds = (analysis.medication_summary || []);
  const missing = (analysis.missing_info || []);

  container.innerHTML = `
    <div class="analysis-grid">
      <div class="analysis-panel">
        <h3>📅 Medical Timeline</h3>
        ${timeline.length ? timeline.map(t => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div>
              <div class="tl-date">${escHtml(t.date || "—")}</div>
              <div class="tl-event">${escHtml(t.event || "")}</div>
            </div>
          </div>`).join("") : "<p style='color:var(--text-muted);font-size:13px'>No timeline data available.</p>"}
      </div>
      <div class="analysis-panel">
        <h3>💊 Medication Summary</h3>
        ${meds.length ? meds.map(m => `
          <div class="med-chip">
            💊 ${escHtml(m.name || "—")}
            ${m.dose ? `<span style="font-weight:400">${escHtml(m.dose)}</span>` : ""}
          </div>`).join("") : "<p style='color:var(--text-muted);font-size:13px'>No medication data available.</p>"}
      </div>
      <div class="analysis-panel">
        <h3>📊 Notable Changes</h3>
        ${changes.length ? changes.map(c => `
          <div style="margin-bottom:10px">
            <strong style="font-size:13px">${escHtml(c.field || "")}</strong>
            <p style="font-size:13px;color:var(--text-muted)">${escHtml(c.observations || "")}</p>
          </div>`).join("") : "<p style='color:var(--text-muted);font-size:13px'>Not enough data to identify changes.</p>"}
      </div>
      <div class="analysis-panel">
        <h3>⚠ Missing Information</h3>
        ${missing.length ? missing.map(m => `<span class="missing-tag">${escHtml(m)}</span>`).join("") : "<p style='color:var(--text-muted);font-size:13px'>No obvious missing information detected.</p>"}
      </div>
    </div>`;
}

async function loadPatientDataTables(forceRefresh = false) {
  if (!forceRefresh && _cache.patientData) {
    renderPatientTables(_cache.patientData);
  }

  try {
    const r = await API.get("/summary/patient-data");
    if (!r.ok) return;
    const data = await r.json();
    _cache.patientData = data;
    renderPatientTables(data);
  } catch (e) {
    console.error("Patient data error:", e);
  }
}

function renderPatientTables(data) {
  // Lab results table
  const labEl = document.getElementById("lab-table-body");
  if (data.lab_results?.length) {
    labEl.innerHTML = data.lab_results.map(l => {
      const flagClass = l.flag ? `flag-${l.flag}` : '';
      const flagBadge = l.flag ? `<span class="flag-badge ${flagClass}">${escHtml(l.flag)}</span>` : '';
      return `
        <tr>
          <td>${escHtml(l.field_name || "—")}</td>
          <td><strong>${escHtml(l.field_value || "—")}</strong> ${flagBadge}</td>
          <td>${escHtml(l.unit || "—")}</td>
          <td>${escHtml(l.reference_range || "—")}</td>
          <td>${escHtml(l.report_date || "—")}</td>
        </tr>`;
    }).join("");
  } else {
    labEl.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No lab results found.</td></tr>`;
  }

  // Vitals
  const vitalsEl = document.getElementById("vitals-table-body");
  if (data.vital_signs?.length) {
    vitalsEl.innerHTML = data.vital_signs.map(v => {
      const flagClass = v.flag ? `flag-${v.flag}` : '';
      const flagBadge = v.flag ? `<span class="flag-badge ${flagClass}">${escHtml(v.flag)}</span>` : '';
      return `
        <tr>
          <td>${escHtml(v.field_name || "—")}</td>
          <td><strong>${escHtml(v.field_value || "—")}</strong> ${flagBadge}</td>
          <td>${escHtml(v.unit || "—")}</td>
          <td>${escHtml(v.report_date || "—")}</td>
        </tr>`;
    }).join("");
  } else {
    vitalsEl.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No vital signs found.</td></tr>`;
  }

  // Diagnoses
  const diagEl = document.getElementById("diagnoses-list");
  if (data.diagnoses?.length) {
    diagEl.innerHTML = `
      <div class="diagnoses-cards-grid">
        ${data.diagnoses.map(d => `
          <div class="diag-card">
            <span class="diag-card-icon">🩺</span>
            <div class="diag-card-body">
              <div class="diag-card-title">${escHtml(d.field_name || d.name || "Diagnosis")}</div>
              <div class="diag-card-sub">${escHtml(d.report_date ? `Reported: ${d.report_date}` : 'Confirmed on medical record')}</div>
            </div>
          </div>
        `).join("")}
      </div>`;
  } else {
    diagEl.innerHTML = `<span style="color:var(--text-muted);font-size:13px">No recorded diagnoses found in uploaded documents.</span>`;
  }

  // Allergies
  const allergyEl = document.getElementById("allergies-list");
  if (data.allergies?.length) {
    allergyEl.innerHTML = `
      <div class="allergies-cards-grid">
        ${data.allergies.map(a => `
          <div class="allergy-card-item">
            <span class="allergy-card-icon">⚠️</span>
            <div class="allergy-card-body">
              <div class="allergy-card-title">${escHtml(a.field_name || a.substance || "Allergy")}</div>
              <div class="allergy-card-sub">${escHtml(a.field_value || a.reaction || 'Known hypersensitivity / allergy')}</div>
            </div>
          </div>
        `).join("")}
      </div>`;
  } else {
    allergyEl.innerHTML = `<span style="color:var(--text-muted);font-size:13px">No allergies recorded in uploaded documents.</span>`;
  }
}

async function downloadPDF() {
  const btn = document.getElementById("btn-download-pdf");
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Generating PDF…';
  showToast("Preparing PDF, please wait…", "info");

  try {
    const headers = {};
    if (API.token) headers["Authorization"] = `Bearer ${API.token}`;
    headers["Content-Type"] = "application/json";

    const r = await fetch("/api/pdf/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ include_analysis: true }),
    });

    if (!r.ok) {
      const err = await r.json();
      showToast(err.error || "PDF generation failed.", "error");
      return;
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medical_summary.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("PDF downloaded.", "success");
  } catch (e) {
    showToast("Network error during PDF generation.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "⬇ Download PDF Report";
  }
}

// ============================================================
// SYMPTOM CHECKER (Requirement 5 & 4)
// ============================================================

function setPrimaryChip(btn, text) {
  document.querySelectorAll(".symptom-chip-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const input = document.getElementById("sym-primary");
  if (input) {
    input.value = text;
    input.focus();
  }
}

function toggleSymptomCard(cb) {
  const card = cb.closest(".symptom-checkbox-card");
  if (card) {
    card.classList.toggle("active", cb.checked);
  }
}

function updateSeverityLabel(val) {
  const label = document.getElementById("severity-label");
  if (!label) return;
  const num = parseInt(val, 10);
  let text = `${num} · Moderate`;
  let cls = "severity-moderate";

  if (num <= 3) {
    text = `${num} · Mild (Tolerable)`;
    cls = "severity-mild";
  } else if (num <= 6) {
    text = `${num} · Moderate (Noticeable)`;
    cls = "severity-moderate";
  } else if (num <= 8) {
    text = `${num} · Severe (Disruptive)`;
    cls = "severity-severe";
  } else {
    text = `${num} · Critical / Emergency`;
    cls = "severity-critical";
  }

  label.textContent = text;
  label.className = `severity-badge-pill ${cls}`;
}

async function submitSymptomForm(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-assess-symptoms");
  const primary = document.getElementById("sym-primary").value.trim();
  const duration = document.getElementById("sym-duration").value;
  const severity = document.getElementById("sym-severity").value;
  const notes = document.getElementById("sym-notes").value.trim();

  // Selected checkboxes
  const associated = [];
  document.querySelectorAll("#associated-symptoms-chips input:checked").forEach(cb => {
    associated.push(cb.value);
  });

  if (!primary) {
    showToast("Please enter your primary symptom.", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Evaluating symptoms with AI…';

  try {
    const r = await API.post("/symptoms/assess", {
      primary_symptom: primary,
      duration,
      severity,
      associated_symptoms: associated,
      notes,
    });

    const data = await r.json();
    if (!r.ok) {
      showToast(data.error || "Symptom assessment failed.", "error");
      return;
    }

    renderSymptomResult(data.report);
    loadSymptomsHistory(true);
    showToast("Symptom evaluation complete.", "success");
  } catch (err) {
    showToast("Network error while evaluating symptoms.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "<span>🩺 Analyze Symptoms with Medical AI</span><span class='btn-arrow'>→</span>";
  }
}

function renderSymptomResult(report) {
  const card = document.getElementById("symptom-result-card");
  const badge = document.getElementById("assessment-urgency-badge");
  const problemEl = document.getElementById("assessment-probable-problem");
  const explanationEl = document.getElementById("assessment-explanation");
  const redFlagsEl = document.getElementById("assessment-red-flags");
  const actionsEl = document.getElementById("assessment-actions");

  const assessment = report.assessment || {};

  // Urgency badge styling
  const urgency = assessment.urgency || "Moderate";
  badge.textContent = urgency;
  badge.className = "badge-pill";
  if (urgency.toLowerCase().includes("mild")) badge.classList.add("badge-success");
  else if (urgency.toLowerCase().includes("moderate")) badge.classList.add("badge-warning");
  else badge.classList.add("badge-danger");

  problemEl.textContent = assessment.probable_problem || "Analysis completed.";
  explanationEl.textContent = assessment.explanation || "";

  // Red flags
  const redFlags = assessment.red_flags || [];
  redFlagsEl.innerHTML = redFlags.length
    ? redFlags.map(rf => `<li>${escHtml(rf)}</li>`).join("")
    : "<li>No immediate life-threatening red flags identified.</li>";

  // Actions
  const actions = assessment.recommended_actions || [];
  actionsEl.innerHTML = actions.length
    ? actions.map(act => `<li>${escHtml(act)}</li>`).join("")
    : "<li>Stay hydrated, rest, and consult a physician if symptoms do not improve.</li>";

  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth" });
}

async function loadSymptomsHistory(forceRefresh = false) {
  const listEl = document.getElementById("symptoms-history-list");
  if (!listEl) return;

  if (!forceRefresh && _cache.symptomsHistory) {
    renderSymptomsHistoryList(_cache.symptomsHistory);
    return;
  }

  try {
    const r = await API.get("/symptoms/history");
    if (!r.ok) return;
    const { reports } = await r.json();
    _cache.symptomsHistory = reports;
    renderSymptomsHistoryList(reports);
  } catch (e) {
    console.error("Symptoms history error:", e);
  }
}

function renderSymptomsHistoryList(reports) {
  const listEl = document.getElementById("symptoms-history-list");
  if (!listEl) return;

  if (!reports || reports.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-icon">🩺</div><p>No previous assessments on record yet. Fill out the form above to check symptoms.</p></div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${reports.map((rep, idx) => {
        const date = new Date(rep.created_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const assessment = rep.assessment || {};
        const urgency = assessment.urgency || "Moderate";
        const urgencyClass = urgency.toLowerCase().includes("mild")
          ? "badge-success"
          : urgency.toLowerCase().includes("moderate")
          ? "badge-warning"
          : "badge-danger";
        const sevNum = parseInt(rep.severity, 10);
        const sevClass = sevNum <= 3 ? "severity-mild" : sevNum <= 6 ? "severity-moderate" : "severity-severe";

        return `
          <div class="symptom-history-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow-sm)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px">
              <div>
                <strong style="color:var(--primary);font-size:15px;display:flex;align-items:center;gap:6px">
                  <span>🩺</span> ${escHtml(rep.primary_symptom)}
                </strong>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                  Evaluated: ${date} · Duration: <strong>${escHtml(rep.duration)}</strong>
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="severity-badge-pill ${sevClass}" style="font-size:11px">Pain ${rep.severity}/10</span>
                <span class="badge-pill ${urgencyClass}" style="font-size:11px">${escHtml(urgency)}</span>
              </div>
            </div>

            ${assessment.probable_problem ? `
              <div style="background:var(--surface-2);border-left:3px solid var(--accent);padding:8px 12px;border-radius:4px;font-size:13px;margin:8px 0">
                <strong>Probable Issue:</strong> ${escHtml(assessment.probable_problem)}
              </div>` : ''}

            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
              <span style="font-size:11.5px;color:var(--text-muted)">
                ${(rep.associated_symptoms || []).length ? `Symptoms: ${(rep.associated_symptoms || []).slice(0, 3).map(escHtml).join(", ")}${rep.associated_symptoms.length > 3 ? ` +${rep.associated_symptoms.length - 3} more` : ''}` : 'No associated symptoms'}
              </span>
              <button type="button" class="btn-secondary btn-sm" onclick="toggleHistoryDetails('hist-detail-${idx}')" style="font-size:11.5px;padding:3px 10px">
                <span>Details ▾</span>
              </button>
            </div>

            <div id="hist-detail-${idx}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:13px">
              <p style="margin-bottom:8px;line-height:1.5"><strong>Explanation:</strong> ${escHtml(assessment.explanation || 'No detailed explanation recorded.')}</p>
              ${(assessment.recommended_actions || []).length ? `
                <div><strong>Recommended Next Steps:</strong>
                  <ul style="padding-left:18px;margin-top:4px;color:#14532d">
                    ${assessment.recommended_actions.map(a => `<li>${escHtml(a)}</li>`).join("")}
                  </ul>
                </div>` : ''}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

function toggleHistoryDetails(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

// ============================================================
// Q&A CHATBOT WITH DOCTOR & PATIENT LOGOS & ENHANCED BOX LAYOUT
// ============================================================

// Doctor Logo (Physician badge with medical cross, stethoscope & white coat)
const DOCTOR_LOGO_SVG = `
<svg class="role-logo-svg doctor-logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Doctor AI">
  <circle cx="18" cy="18" r="17" fill="#0284c7" stroke="#38bdf8" stroke-width="1"/>
  <!-- Head -->
  <circle cx="18" cy="11" r="4.5" fill="#ffffff"/>
  <!-- Doctor Hair / Surgical Cap -->
  <path d="M13.5 10c.8-2 2.5-3.2 4.5-3.2s3.7 1.2 4.5 3.2" stroke="#0369a1" stroke-width="1.2" stroke-linecap="round"/>
  <!-- White Doctor Coat Body -->
  <path d="M9.5 28.5c0-4.5 3.8-7.5 8.5-7.5s8.5 3 8.5 7.5v1.5h-17v-1.5z" fill="#f8fafc"/>
  <!-- Inner shirt / V-neck -->
  <path d="M16 21l2 3.5 2-3.5" fill="#0284c7"/>
  <!-- Stethoscope around neck with chest bell -->
  <path d="M14.2 16v4.5a3.8 3.8 0 0 0 7.6 0V16" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="18" cy="23.2" r="1.3" fill="#0f172a"/>
  <!-- Red Cross Badge on Doctor's Left Pocket -->
  <rect x="22.5" y="21" width="5" height="5" rx="1" fill="#ef4444"/>
  <path d="M25 22.2v2.6M23.7 23.5h2.6" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
</svg>`;

// Patient Logo (Patient profile avatar with vital heartbeat / ECG emblem)
const PATIENT_LOGO_SVG = `
<svg class="role-logo-svg patient-logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Patient">
  <circle cx="18" cy="18" r="17" fill="#0e2439" stroke="#93c5fd" stroke-width="1"/>
  <!-- Head -->
  <circle cx="18" cy="11" r="4.5" fill="#ffffff"/>
  <!-- Hair -->
  <path d="M13.5 10.5c.6-2.2 2.3-3.5 4.5-3.5s3.9 1.3 4.5 3.5" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
  <!-- Patient attire (comfortable soft blue clinic attire) -->
  <path d="M9.5 28.5c0-4.5 3.8-7.5 8.5-7.5s8.5 3 8.5 7.5v1.5h-17v-1.5z" fill="#93c5fd"/>
  <!-- Collar -->
  <path d="M15.5 21l2.5 3.2 2.5-3.2" stroke="#1e3a8a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Vital ECG / Heart Monitor Badge -->
  <circle cx="23.5" cy="22" r="3.2" fill="#10b981"/>
  <path d="M21.5 22h1.1l.6-1.3.8 2.4.6-1.1h1.1" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function formatChatText(text) {
  if (!text) return "";
  let formatted = escHtml(text);
  // Bold markdown
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Format bullet lines and paragraphs cleanly
  const lines = formatted.split("\n");
  let inList = false;
  const processed = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        processed.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      if (!inList) {
        processed.push('<ul class="chat-bullet-list">');
        inList = true;
      }
      processed.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        processed.push("</ul>");
        inList = false;
      }
      processed.push(`<p>${trimmed}</p>`);
    }
  }
  if (inList) processed.push("</ul>");
  return processed.join("");
}

function renderChatEmptyState() {
  return `
    <div class="empty-state chat-empty-state">
      <div class="chat-doctor-welcome-avatar">
        ${DOCTOR_LOGO_SVG}
      </div>
      <h3>Consult with Doctor AI</h3>
      <p>Ask clinical questions about your uploaded medical records, lab trends, diagnoses, or prescriptions. Doctor AI evaluates strictly from your on-file documents.</p>
      <div class="chat-suggestion-chips">
        <button type="button" class="chat-chip-btn" onclick="askPresetQuestion('Summarize my uploaded medical records')">📋 Summarize my records</button>
        <button type="button" class="chat-chip-btn" onclick="askPresetQuestion('Are any of my blood test or lab results abnormal?')">🧪 Abnormal lab values?</button>
        <button type="button" class="chat-chip-btn" onclick="askPresetQuestion('What medications are listed in my reports?')">💊 Review medications</button>
        <button type="button" class="chat-chip-btn" onclick="askPresetQuestion('What clinical diagnoses or findings were noted?')">🩺 Recorded diagnoses?</button>
      </div>
    </div>`;
}

function askPresetQuestion(text) {
  const inputEl = document.getElementById("qa-input");
  if (inputEl) {
    inputEl.value = text;
    sendQuestion();
  }
}

async function loadQAHistory() {
  try {
    const r = await API.get("/qa/history");
    if (!r.ok) return;
    const { history } = await r.json();
    const chatEl = document.getElementById("chat-messages");

    if (!history || history.length === 0) {
      chatEl.innerHTML = renderChatEmptyState();
      return;
    }

    // Show last 20 in chronological order
    const sorted = [...history].reverse().slice(-20);
    chatEl.innerHTML = sorted.map(h => `
      ${chatBubbleHtml("user", h.question, h.created_at)}
      ${chatBubbleHtml("ai", h.answer, h.created_at)}`
    ).join("");
    chatEl.scrollTop = chatEl.scrollHeight;
  } catch (e) {
    console.error("QA history load error:", e);
  }
}

function chatBubbleHtml(role, text, timestamp) {
  const isUser = role === "user";
  const avatarSvg = isUser ? PATIENT_LOGO_SVG : DOCTOR_LOGO_SVG;
  const roleName = isUser ? "Patient" : "Doctor AI (Medical Specialist)";
  const badgeClass = isUser ? "patient-badge" : "doctor-badge";
  const badgeLabel = isUser ? "You" : "Verified Records";
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const formattedBody = formatChatText(text);

  return `
    <div class="chat-bubble ${isUser ? "user" : "ai"}">
      <div class="bubble-avatar ${isUser ? "user-av" : "ai-av"}" title="${roleName}">
        ${avatarSvg}
      </div>
      <div class="bubble-content-wrap">
        <div class="bubble-sender-row">
          <span class="bubble-sender-name">
            ${escHtml(roleName)}
            <span class="sender-badge ${badgeClass}">${badgeLabel}</span>
          </span>
          ${time ? `<span class="bubble-time">${time}</span>` : ""}
        </div>
        <div class="bubble-body">
          ${formattedBody}
        </div>
        ${!isUser ? `
          <div class="bubble-doctor-footer">
            <span class="doc-badge-pill">🩺 Clinical AI</span>
            <span class="doc-ref-text">Grounded in your uploaded medical documents</span>
          </div>` : ""}
      </div>
    </div>`;
}

function appendChatBubble(role, text) {
  const chatEl = document.getElementById("chat-messages");
  // Remove empty state if present
  const emptyState = chatEl.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  chatEl.insertAdjacentHTML("beforeend", chatBubbleHtml(role, text, new Date().toISOString()));
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendQuestion(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById("qa-input");
  const question = inputEl.value.trim();
  if (!question) return;

  const btn = document.getElementById("btn-ask");
  inputEl.value = "";
  btn.disabled = true;

  appendChatBubble("user", question);

  // Thinking indicator with doctor logo and upgraded box layout
  const chatEl = document.getElementById("chat-messages");
  const thinkingId = `thinking-${Date.now()}`;
  chatEl.insertAdjacentHTML("beforeend", `
    <div class="chat-bubble ai thinking" id="${thinkingId}">
      <div class="bubble-avatar ai-av" title="Doctor AI">
        ${DOCTOR_LOGO_SVG}
      </div>
      <div class="bubble-content-wrap">
        <div class="bubble-sender-row">
          <span class="bubble-sender-name">
            Doctor AI (Medical Specialist)
            <span class="sender-badge doctor-badge">Consulting Records</span>
          </span>
        </div>
        <div class="bubble-body thinking-body">
          <div class="thinking-spinner-row">
            <span class="loader loader-dark"></span>
            <span>Doctor AI is evaluating your medical files & formulating answer…</span>
          </div>
        </div>
      </div>
    </div>`);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const r = await API.post("/qa/ask", { question });
    const data = await r.json();
    document.getElementById(thinkingId)?.remove();

    if (r.ok) {
      appendChatBubble("ai", data.answer);
    } else {
      appendChatBubble("ai", data.error || "Sorry, I couldn't process that question.");
    }
  } catch (err) {
    document.getElementById(thinkingId)?.remove();
    appendChatBubble("ai", "Network error. Please check your connection.");
  } finally {
    btn.disabled = false;
    inputEl.focus();
  }
}

async function clearQAHistory() {
  const r = await API.delete("/qa/history");
  if (r.ok) {
    showToast("Conversation cleared.", "success");
    loadQAHistory();
  }
}

// ============================================================
// TABS
// ============================================================
function switchTab(tabGroup, tabId) {
  document.querySelectorAll(`[data-tab-group="${tabGroup}"]`).forEach((el) => {
    el.classList.toggle("active", el.dataset.tabId === tabId);
  });
  document.querySelectorAll(`[data-tab-content="${tabGroup}"]`).forEach((el) => {
    el.classList.toggle("active", el.dataset.tabId === tabId);
  });
}

// ============================================================
// UTILITIES
// ============================================================
function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Check saved session
  const savedToken = localStorage.getItem("med_token");
  const savedUser = localStorage.getItem("med_user");
  if (savedToken && savedUser) {
    API.token = savedToken;
    API.user = JSON.parse(savedUser);
    showApp();
  }

  // OTP input keyboard & paste navigation
  const otpInputs = document.querySelectorAll(".otp-inputs input");
  otpInputs.forEach((inp, idx, all) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "");
      if (inp.value.length >= 1 && idx < all.length - 1) all[idx + 1].focus();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && idx > 0) all[idx - 1].focus();
    });
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
      const digits = text.replace(/\D/g, "").slice(0, 6);
      if (digits) {
        [...digits].forEach((d, i) => {
          if (all[i]) all[i].value = d;
        });
        const targetFocus = Math.min(digits.length, all.length - 1);
        if (all[targetFocus]) all[targetFocus].focus();
      }
    });
  });

  // Modal backdrop click to close
  ['logout-modal', 'doc-view-modal', 'doc-facts-modal', 'doc-delete-modal', 'account-details-modal'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.style.display = 'none';
        }
      });
    }
  });

  // Global escape key to close any active modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['logout-modal', 'doc-view-modal', 'doc-facts-modal', 'doc-delete-modal', 'account-details-modal'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') {
          el.style.display = 'none';
        }
      });
    }
  });

  // Setup upload zone
  setupUpload();

  // Q&A: send on Enter (Shift+Enter for newline)
  const qaInput = document.getElementById("qa-input");
  if (qaInput) {
    qaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
      }
    });
  }
});
