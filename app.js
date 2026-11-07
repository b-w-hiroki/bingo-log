// app.js — B·log メインアプリ
// ハッシュルーティング + 画面レンダリング + イベント処理

const { uuid, nowIso, formatDate, formatDateTime, escapeHtml, $, $$, el, toast } = Utils;

// ─────────────────────────────────────────────────────────────
// State (現在のシート編集セッションなど)
// ─────────────────────────────────────────────────────────────
const State = {
  pendingPhoto: null,   // 記録モーダル: { blob, key, previewUrl }
  modalSheetId: null,
  modalCellId: null,
  modalChildId: null,
  isChildModal: false,
};

// ─────────────────────────────────────────────────────────────
// Sheet ファクトリ
// ─────────────────────────────────────────────────────────────
function createSheet(location) {
  return {
    id: uuid(),
    locationId: location.id,
    createdAt: nowIso(),
    cells: location.cellTemplates.map((t) => ({
      id: uuid(),
      templateId: t.id,
      label: t.label,
      order: t.order,
      isFree: false,
      status: 'pending',
      recordedAt: null,
      comment: '',
      photoKey: null,
      // Phase 2: 「思い出を広げる」(広げた思い出) を格納
      children: [],
      // Phase 4: 取り込み時にお手本マスのIDを設定
      referenceCell: null,
    })),
    // Phase 3: 認証後にユーザーIDをセット
    ownerId: null,
    // Phase 3: 公開フラグ
    isPublic: false,
    // Phase 4: 取り込み元シートID
    sourceSheetId: null,
    // Phase 3: ソーシャル統計
    stats: { viewCount: 0, copyCount: 0 },
  };
}

function sheetDoneCount(sheet) {
  return sheet.cells.filter((c) => c.status === 'completed').length;
}

function countCompletedChildren(sheets) {
  return sheets.reduce((sum, s) =>
    sum + s.cells.reduce((cs, c) =>
      cs + (c.children || []).filter((ch) => ch.status === 'completed').length, 0), 0);
}

// ─────────────────────────────────────────────────────────────
// Mock Social Records (PoC: 他ユーザーのマス記録)
// templateId → [{ user, recordedAt, comment, photo }]
// ─────────────────────────────────────────────────────────────
const MOCK_RECORDS = {
  'kt-1': [
    { user: 'mayuki', recordedAt: '2026-03-15T10:23:00Z', comment: '朝一で来たら光が最高！ほぼ貸し切り状態でした', photo: true },
    { user: 'k_traveler', recordedAt: '2026-02-10T14:05:00Z', comment: '修学旅行ぶり。やっぱり大迫力だった', photo: false },
    { user: 'nana_kyoto', recordedAt: '2026-04-02T09:15:00Z', comment: '桜との組み合わせが最高だった', photo: true },
  ],
  'kt-2': [
    { user: 'haru_trip', recordedAt: '2026-03-20T11:00:00Z', comment: '快晴で遠くまで見えた！ここだけで1時間いた', photo: true },
    { user: 'sora_3', recordedAt: '2026-01-05T13:30:00Z', comment: '冬の澄んだ空気でめちゃくちゃきれい', photo: true },
  ],
  'kt-3': [
    { user: 'mizu_chan', recordedAt: '2026-03-18T10:45:00Z', comment: '3本全部飲んだ！長寿・恋愛・学業全部欲しい笑', photo: false },
    { user: 'rino_k', recordedAt: '2026-02-28T09:20:00Z', comment: '朝早いと並ばずに飲める。水が冷たくて美味しい', photo: true },
  ],
  'kt-4': [
    { user: 'yuki_walk', recordedAt: '2026-04-10T14:30:00Z', comment: '坂道のお店がいっぱいで全然進めなかった笑', photo: true },
    { user: 'jun_k', recordedAt: '2026-03-25T15:00:00Z', comment: '抹茶アイスを食べ比べ！どれも甘くておいしい', photo: false },
  ],
  'kt-5': [
    { user: 'matcha_lover', recordedAt: '2026-04-08T13:00:00Z', comment: '七味屋のソフト！甘さと辛さのバランスが絶妙', photo: true },
    { user: 'sweets_k', recordedAt: '2026-03-12T14:20:00Z', comment: '清水坂で10種食べ比べした…最高', photo: true },
  ],
  'kt-6': [
    { user: 'love_jinja', recordedAt: '2026-02-20T11:30:00Z', comment: '白い石が遠すぎて見えなかった笑でも楽しい', photo: false },
    { user: 'hana_k', recordedAt: '2026-03-30T13:45:00Z', comment: '友達と2人でチャレンジ！二人とも見えた！！', photo: true },
  ],
  'kt-7': [
    { user: 'sunset_p', recordedAt: '2026-04-05T17:00:00Z', comment: 'ライトアップ前の夕暮れが最高にきれい', photo: true },
    { user: 'yuu_photo', recordedAt: '2026-03-22T17:30:00Z', comment: 'オレンジ色に染まった京都の街並みに感動', photo: true },
  ],
  'kt-8': [
    { user: 'goshuincho', recordedAt: '2026-02-05T10:00:00Z', comment: '御朱印帳1冊目の最後にここを選んだ！感慨深い', photo: false },
    { user: 'jinja_megu', recordedAt: '2026-04-15T11:30:00Z', comment: '限定デザインが可愛すぎた', photo: true },
  ],
  'kt-9': [
    { user: 'tofu_fan', recordedAt: '2026-03-28T12:30:00Z', comment: '奥丹で湯豆腐。出汁がまろやかで最高でした', photo: true },
    { user: 'kyoto_gourmet', recordedAt: '2026-02-18T13:00:00Z', comment: '観光地価格だけど雰囲気込みで満足！', photo: false },
  ],
  'nr-1': [
    { user: 'daibutsu_fan', recordedAt: '2026-03-10T10:30:00Z', comment: 'とにかくでかい！鼻の穴くぐりに挑戦した', photo: true },
    { user: 'nara_trip', recordedAt: '2026-04-01T11:00:00Z', comment: '大仏の顔が思ったより穏やかで驚いた', photo: false },
  ],
  'nr-2': [
    { user: 'shika_love', recordedAt: '2026-03-20T13:00:00Z', comment: '1匹に囲まれたらいつの間にか10匹に…助けて笑', photo: true },
    { user: 'deer_chan', recordedAt: '2026-02-25T14:30:00Z', comment: '鹿がお辞儀してくれた！かわいすぎる', photo: true },
    { user: 'machi_n', recordedAt: '2026-04-12T12:00:00Z', comment: '鹿せんべい持ってたら服ごと食べられた', photo: false },
  ],
  'nr-3': [
    { user: 'jinja_walk', recordedAt: '2026-03-15T15:00:00Z', comment: '朱色の参道が神々しい雰囲気で圧倒された', photo: true },
  ],
  'nr-4': [
    { user: 'tower_fan', recordedAt: '2026-04-05T14:00:00Z', comment: '新緑の季節に見ると映える！', photo: true },
    { user: 'rekishi_k', recordedAt: '2026-02-10T11:00:00Z', comment: '五重塔と空のコントラストが最高', photo: false },
  ],
  'nr-5': [
    { user: 'nara_park_p', recordedAt: '2026-03-25T10:00:00Z', comment: '桜と鹿のコラボが最高の春景色', photo: true },
  ],
  'nr-6': [
    { user: 'food_trip', recordedAt: '2026-04-02T12:00:00Z', comment: '葉の塩気と酢飯のバランスが絶妙！', photo: true },
    { user: 'sushi_fan', recordedAt: '2026-03-08T13:00:00Z', comment: 'ならまちの老舗で食べた！最高でした', photo: false },
  ],
  'nr-7': [
    { user: 'yama_p', recordedAt: '2026-03-30T14:00:00Z', comment: '山頂から見た奈良市街が一望できた', photo: true },
  ],
  'nr-8': [
    { user: 'komachi_walk', recordedAt: '2026-04-08T15:00:00Z', comment: '古い町家が残っていて歩いてるだけで楽しい', photo: true },
    { user: 'nara_fan', recordedAt: '2026-02-20T14:00:00Z', comment: '格子窓のある建物が可愛くて写真撮りまくった', photo: false },
  ],
  'nr-9': [
    { user: 'kinen_p', recordedAt: '2026-03-15T11:00:00Z', comment: '鹿が自分から近づいてきた！奇跡の一枚', photo: true },
    { user: 'shika_selfie', recordedAt: '2026-04-10T13:00:00Z', comment: 'せんべいで釣ったら最高の写真が撮れた', photo: false },
  ],
};

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────
function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw) return { route: 'top', params: [] };
  const parts = raw.split('/');
  return { route: parts[0], params: parts.slice(1) };
}

function navigate(path) {
  location.hash = path.startsWith('#') ? path : '#' + path;
}

const Routes = {};

async function router() {
  closeOverlay();
  const { route, params } = parseHash();
  const handler = Routes[route] || Routes.top;
  await handler(...params);

  // 初回起動オンボーディング (TOP のみ)
  if (route === 'top' && !Storage.getFlag('onboarding_done')) {
    showOnboarding();
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

// ─────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────
function setApp(html) {
  const app = $('#app');
  app.innerHTML = html;
  app.scrollTop = 0;
  window.scrollTo(0, 0);
}

function renderTabbar(active) {
  // active: 'find' | 'mysheets' | 'record' | 'mypage'
  return `
    <nav class="tabbar">
      <button class="tab ${active === 'find' ? 'on' : ''}" data-nav="#top"><span class="glyph">探</span>さがす</button>
      <button class="tab ${active === 'mysheets' ? 'on' : ''}" data-nav="#mysheets"><span class="glyph">▦</span>マイシート</button>
      <button class="tab" disabled><span class="glyph c">＋</span>記録</button>
      <button class="tab ${active === 'mypage' ? 'on' : ''}" data-nav="#mypage"><span class="glyph">人</span>マイページ</button>
    </nav>
  `;
}

function bindTabbar(root = document) {
  $$('.tabbar .tab[data-nav]', root).forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });
}

function simpleHead(title, opts = {}) {
  return `
    <header class="simple-head">
      <button class="back-btn" data-back></button>
      <div class="title">${escapeHtml(title)}</div>
      ${opts.right || ''}
    </header>
  `;
}

function bindBack(root = document, fallback = '#top') {
  $$('[data-back]', root).forEach((b) => {
    b.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else navigate(fallback);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Overlay
// ─────────────────────────────────────────────────────────────
function openOverlay(html) {
  const ov = $('#overlay');
  ov.innerHTML = html;
  return ov;
}
function closeOverlay() {
  const ov = $('#overlay');
  if (ov) ov.innerHTML = '';
  if (State.pendingPhoto && State.pendingPhoto.previewUrl) {
    URL.revokeObjectURL(State.pendingPhoto.previewUrl);
  }
  State.pendingPhoto = null;
  State.modalSheetId = null;
  State.modalCellId = null;
  State.modalChildId = null;
  State.isChildModal = false;
}

// ─────────────────────────────────────────────────────────────
// 01 TOP
// ─────────────────────────────────────────────────────────────
Routes.top = async function renderTop() {
  const sheets = Storage.listSheets();
  // 観光地ごとに「進行中のシート」を最新で1件特定
  const sheetByLoc = new Map();
  for (const s of sheets) {
    if (!sheetByLoc.has(s.locationId)) sheetByLoc.set(s.locationId, s);
  }

  const cards = LOCATIONS.map((l) => {
    const sheet = sheetByLoc.get(l.id);
    const inProgress = !!sheet;
    return `
      <article class="spot-card" data-loc="${l.id}">
        <div class="thumb imgbox"></div>
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="meta">${escapeHtml(l.area)} · ${escapeHtml(l.tag)}</div>
        <div class="cta ${inProgress ? 'outlined' : ''}">${inProgress ? 'シートを見る' : '▶ ビンゴ開始'}</div>
      </article>
    `;
  }).join('');

  setApp(`
    <div class="page">
      <header class="nav-row">
        <div class="logo">B<span class="dot">·</span>log<span class="sub">BINGO LOG</span></div>
        <button class="pill" data-nav="#mysheets">▦ マイシート</button>
      </header>

      <div class="s-search"><span class="mag"></span><span>観光地を検索…</span></div>

      <div class="chips" id="area-chips">
        <span class="chip on">すべて</span>
        <span class="chip">京都</span>
        <span class="chip">奈良</span>
        <span class="chip">大阪</span>
        <span class="chip">神戸</span>
      </div>

      <div class="top-row-h">
        <span class="lbl">観光地</span>
        <span class="sort">並び替え ▾</span>
      </div>

      <div class="top-grid">${cards}</div>
    </div>
    ${renderTabbar('find')}
  `);

  bindTabbar();
  $$('#app [data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  $$('.spot-card').forEach((card) => {
    card.addEventListener('click', () => navigate(`#spot/${card.dataset.loc}`));
  });
  $$('#area-chips .chip').forEach((c) => {
    c.addEventListener('click', () => {
      $$('#area-chips .chip').forEach((x) => x.classList.remove('on'));
      c.classList.add('on');
      toast('絞り込みは v0.2 で導入予定');
    });
  });
};

// ─────────────────────────────────────────────────────────────
// 10 観光地詳細
// ─────────────────────────────────────────────────────────────
Routes.spot = async function renderSpot(locId) {
  const loc = findLocation(locId);
  if (!loc) return navigate('#top');

  const sheets = Storage.listSheets().filter((s) => s.locationId === locId);

  const historyHtml = sheets.length === 0
    ? `<div class="stub-placeholder"><div class="small">この観光地のシートはまだありません</div></div>`
    : `<div class="my-list">${sheets.map(sheetRowHtml).join('')}</div>`;

  setApp(`
    <div class="page">
      ${simpleHead('観光地の詳細')}

      <div class="spot-hero">
        <div class="overlay"></div>
        <div class="name">
          ${escapeHtml(loc.name)}
          <span class="area">${escapeHtml(loc.area)} · ${escapeHtml(loc.subArea)}</span>
        </div>
      </div>

      <div class="spot-tags">
        <span class="t">${escapeHtml(loc.tag)}</span>
        <span class="t">9マス</span>
        <span class="t">片手で記録</span>
      </div>

      <p class="spot-desc">${escapeHtml(loc.description)}</p>

      <div class="spot-start">
        <button class="cta" id="start-bingo">▶ 自分のビンゴを開始する</button>
      </div>

      <div class="spot-history-h">この観光地でのシート (${sheets.length})</div>
      ${historyHtml}
    </div>
    ${renderTabbar('find')}
  `);

  bindBack();
  bindTabbar();
  bindSheetRows();

  $('#start-bingo').addEventListener('click', () => {
    const sheet = createSheet(loc);
    Storage.saveSheet(sheet);
    navigate(`#sheet/${sheet.id}`);
  });
};

// ─────────────────────────────────────────────────────────────
// 02 シート
// ─────────────────────────────────────────────────────────────
Routes.sheet = async function renderSheet(sheetId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return navigate('#top');
  const loc = findLocation(sheet.locationId);
  const done = sheetDoneCount(sheet);
  const total = sheet.cells.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  setApp(`
    <div class="page">
      <header class="sheet-head">
        <button class="back-btn" data-back></button>
        <span class="crumb">マイシート</span>
        <button class="pill ghost" id="share-btn">共有</button>
      </header>

      <div class="sheet-place">
        ${escapeHtml(loc.name)}
        <span class="small">${escapeHtml(loc.area)} · ${escapeHtml(loc.subArea)} / ${formatDate(sheet.createdAt)} 開始</span>
      </div>

      <div class="progress-card">
        <div>
          <div class="pct"><b>${done}</b><span class="div"> / ${total}</span></div>
          <div class="lab">達成マス</div>
        </div>
        <div style="flex:1">
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="lab" style="text-align:right">あと ${total - done} マス！</div>
        </div>
      </div>

      <div class="bingo-grid" id="bingo-grid">
        ${sheet.cells.map(cellHtml).join('')}
      </div>

      <div class="sheet-foot">
        <button class="addbtn" id="mandala-btn"><span class="plus">＋</span> 思い出を広げる</button>
        <button class="iconbtn" id="open-share">⤴</button>
      </div>
    </div>
    ${renderTabbar()}
  `);

  bindBack();
  bindTabbar();

  // 写真サムネ非同期ロード
  for (const c of sheet.cells) {
    if (c.photoKey) {
      const url = await Storage.getPhotoURL(c.photoKey);
      const cellEl = $(`.bingo-cell[data-cell="${c.id}"]`);
      if (cellEl && url) {
        cellEl.classList.remove('no-photo');
        const photoBox = cellEl.querySelector('.photo');
        if (photoBox) photoBox.innerHTML = `<img src="${url}" alt="">`;
      }
    }
  }

  // セルタップで記録モーダル / 詳細
  $$('.bingo-cell').forEach((cellEl) => {
    cellEl.addEventListener('click', () => {
      const cellId = cellEl.dataset.cell;
      const cell = sheet.cells.find((c) => c.id === cellId);
      if (!cell) return;
      if (cell.status === 'completed') {
        navigate(`#cell/${sheet.id}/${cell.id}`);
      } else {
        openRecordModal(sheet.id, cell.id);
      }
    });
  });

  $('#mandala-btn').addEventListener('click', () => navigate(`#mandala/${sheet.id}`));

  // Phase 3: 公開機能
  const shareHandler = () => showSharePanel(sheet);
  $('#share-btn').addEventListener('click', shareHandler);
  $('#open-share').addEventListener('click', shareHandler);

  // 9/9 達成 直後のお祝い演出
  if (done === total && !Storage.getFlag(`celebration_seen_${sheet.id}`)) {
    Storage.setFlag(`celebration_seen_${sheet.id}`, true);
    setTimeout(() => showCelebration(sheet, loc), 400);
  }
};

function cellHtml(cell) {
  const isDone = cell.status === 'completed';
  return `
    <div class="bingo-cell ${isDone ? 'done no-photo' : ''}" data-cell="${cell.id}">
      ${isDone ? `
        <div class="photo"></div>
        <span class="check">✓</span>
        <span class="label-strip">${escapeHtml(cell.label)}</span>
      ` : `
        <span>${escapeHtml(cell.label)}</span>
      `}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 03 マス記録モーダル + 09 撮影警告
// ─────────────────────────────────────────────────────────────
function openRecordModal(sheetId, cellId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return;
  const cell = sheet.cells.find((c) => c.id === cellId);
  if (!cell) return;

  State.modalSheetId = sheetId;
  State.modalCellId = cellId;

  // 撮影警告フラグ: 初回 or 「再表示」設定なら警告を先に
  if (!Storage.getFlag('photo_warning_seen')) {
    showPhotoWarning(() => renderRecordModal(sheet, cell));
  } else {
    renderRecordModal(sheet, cell);
  }
}

function renderRecordModal(sheet, cell) {
  // closeOverlay (from photo warning) が State をリセットするので再設定
  State.modalSheetId = sheet.id;
  State.modalCellId = cell.id;
  State.isChildModal = false;

  const existingPhoto = cell.photoKey;

  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="マス記録">
      <div class="handle"></div>
      <div class="eyebrow">MASU · マスを記録</div>
      <div class="cell-name">
        <span class="lock-ico"></span>
        <span>${escapeHtml(cell.label)}</span>
      </div>

      <label class="photo-slot ${existingPhoto || State.pendingPhoto ? 'has-photo' : ''}" id="photo-slot">
        <input type="file" accept="image/*" capture="environment" id="photo-input" hidden>
        <img class="preview" id="photo-preview" alt="">
        <div class="ph-hint">
          <div class="camera"></div>
          <div><b>＋ 写真を選択</b></div>
          <div style="font-size:11px;color:#999">カメラ起動 / カメラロール</div>
        </div>
      </label>

      <button class="photo-warning-cta" id="show-warning">⚠ 撮影前に確認する</button>

      <div class="field-label">
        <span>コメント</span>
        <span class="count"><span id="cm-count">${(cell.comment || '').length}</span> / 140</span>
      </div>
      <textarea class="field-textarea" id="comment-input" maxlength="140" placeholder="ここに体験を残す…">${escapeHtml(cell.comment || '')}</textarea>

      <div class="modal-buttons">
        <button class="btn" data-dismiss>キャンセル</button>
        <button class="btn primary" id="save-record">保存する</button>
      </div>
    </div>
  `);

  // 既存写真があればプレビュー表示
  if (existingPhoto) {
    Storage.getPhotoURL(existingPhoto).then((url) => {
      const img = $('#photo-preview');
      if (img && url) img.src = url;
    });
  }

  // dismiss
  $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));

  // 文字数カウンタ
  $('#comment-input').addEventListener('input', (e) => {
    $('#cm-count').textContent = e.target.value.length;
  });

  // 撮影警告 (任意で再表示)
  $('#show-warning').addEventListener('click', () => {
    showPhotoWarning(() => {/* close, stay on modal */});
  });

  // 写真選択
  $('#photo-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // 旧 pending 解放
    if (State.pendingPhoto && State.pendingPhoto.previewUrl) {
      URL.revokeObjectURL(State.pendingPhoto.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    State.pendingPhoto = { blob: file, key: uuid(), previewUrl };
    $('#photo-slot').classList.add('has-photo');
    $('#photo-preview').src = previewUrl;
  });

  // 保存
  $('#save-record').addEventListener('click', async () => {
    await saveCellRecord();
  });
}

async function saveCellRecord() {
  if (State.isChildModal) { await saveChildCellRecord(); return; }
  const sheet = Storage.getSheet(State.modalSheetId);
  if (!sheet) return;
  const cell = sheet.cells.find((c) => c.id === State.modalCellId);
  if (!cell) return;

  const comment = $('#comment-input').value.trim();

  // 写真は (a) 既存 (b) 新規 (c) なし
  if (State.pendingPhoto) {
    // 既存写真があれば置き換え
    if (cell.photoKey) {
      try { await Storage.deletePhoto(cell.photoKey); } catch (e) {}
    }
    // Phase 3: Supabase Storage に保存
    await Storage.savePhoto(State.pendingPhoto.key, State.pendingPhoto.blob);
    cell.photoKey = State.pendingPhoto.key;
  }

  // 写真もコメントもなければ「達成」にしない
  const hasContent = cell.photoKey || comment.length > 0;
  if (!hasContent) {
    toast('写真かコメントを1つ以上記録してください');
    return;
  }

  cell.comment = comment;
  cell.status = 'completed';
  cell.recordedAt = nowIso();

  Storage.saveSheet(sheet);
  closeOverlay();
  toast('マスを記録しました');
  // 再描画
  Routes.sheet(sheet.id);
}

function showPhotoWarning(onConfirm) {
  openOverlay(`
    <div class="modal-dim" id="warning-dim"></div>
    <div class="warning-modal" role="dialog" aria-label="撮影前の確認">
      <div class="ico-wrap"><span class="glyph">!</span></div>
      <div class="h">撮影前に<br/><span class="accent">ひと呼吸、周辺を確認</span></div>
      <div class="body">
        写真を撮る前に、<b>周辺の人</b>や<b>個人を特定できる情報</b>が
        写り込まないかを確認してください。
      </div>
      <div class="check-list">
        <div class="item"><div class="mark"></div><div>通行人の顔・特徴的な持ち物</div></div>
        <div class="item"><div class="mark"></div><div>名札・車のナンバー・住所表記</div></div>
        <div class="item"><div class="mark"></div><div>撮影禁止エリアでないか</div></div>
      </div>
      <div class="dismiss-row" id="dismiss-row">
        <div class="box"></div>
        <span>今後この確認を表示しない</span>
      </div>
      <div class="buttons">
        <button class="btn" id="warning-cancel">キャンセル</button>
        <button class="btn primary" id="warning-ok">確認した · 進む</button>
      </div>
    </div>
  `);

  let dismiss = false;
  $('#dismiss-row').addEventListener('click', () => {
    dismiss = !dismiss;
    $('#dismiss-row').classList.toggle('on', dismiss);
  });

  $('#warning-cancel').addEventListener('click', () => {
    closeOverlay();
  });

  $('#warning-ok').addEventListener('click', () => {
    if (dismiss) Storage.setFlag('photo_warning_seen', true);
    closeOverlay();
    onConfirm && onConfirm();
  });
}

// ─────────────────────────────────────────────────────────────
// 07 オンボーディング
// ─────────────────────────────────────────────────────────────
function showOnboarding() {
  openOverlay(`
    <div class="modal-dim"></div>
    <div class="onboarding-sheet" role="dialog" aria-label="ようこそ">
      <div class="onb-eyebrow">FIRST LAUNCH · 1 / 1</div>
      <div class="onb-title">ようこそ、<span class="accent">B·log</span> へ</div>
      <div class="onb-sub">始める前に、3つだけ知っておいてください。設定はあとから変更できます。</div>

      <div class="onb-cards">
        <div class="onb-card">
          <div class="ico">位</div>
          <div class="text">
            <div class="h">近くの観光地を提案するために位置情報を使います</div>
            <div class="b">取得は<b>アプリ利用中のみ</b>。記録には観光地名が紐づきます。</div>
          </div>
        </div>
        <div class="onb-card">
          <div class="ico">写</div>
          <div class="text">
            <div class="h">撮影した写真は端末にのみ保存します</div>
            <div class="b">クラウドへの自動アップロードは<b>ありません</b>。</div>
          </div>
        </div>
        <div class="onb-card warm">
          <div class="ico">!</div>
          <div class="text">
            <div class="h">撮影時のお願い</div>
            <div class="b"><b>周辺の方や個人を特定できる情報</b>が写り込まないか、確認してから撮ってください。</div>
          </div>
        </div>
      </div>

      <div class="onb-buttons">
        <button class="btn" id="onb-later">あとで</button>
        <button class="btn primary" id="onb-start">はじめる →</button>
      </div>
    </div>
  `);

  const finish = () => {
    Storage.setFlag('onboarding_done', true);
    closeOverlay();
  };
  $('#onb-later').addEventListener('click', finish);
  $('#onb-start').addEventListener('click', finish);
}

// ─────────────────────────────────────────────────────────────
// 04 思い出を広げる — 概要 / フォーカス 2モード
// ─────────────────────────────────────────────────────────────
Routes.mandala = async function renderMandala(sheetId, focusCellId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return navigate('#top');
  sheet.cells.forEach((c) => { if (!c.children) c.children = []; });
  const loc = findLocation(sheet.locationId);

  if (focusCellId) {
    const cell = sheet.cells.find((c) => c.id === focusCellId);
    if (!cell || cell.status !== 'completed') return navigate(`#mandala/${sheetId}`);
    await renderMandalaFocus(sheet, loc, cell);
  } else {
    renderMandalaOverview(sheet, loc);
  }
};

function renderMandalaOverview(sheet, loc) {
  const completedCount = sheet.cells.filter((c) => c.status === 'completed').length;
  const totalChildren = countCompletedChildren([sheet]);

  const cellsHtml = sheet.cells.map((c) => {
    const isDone = c.status === 'completed';
    const childCount = (c.children || []).filter((ch) => ch.status === 'completed').length;
    return `
      <div class="mandala-ov-cell ${isDone ? 'done' : ''}" ${isDone ? `data-cell="${c.id}"` : ''}>
        ${isDone && childCount > 0 ? `<span class="ov-badge">${childCount}</span>` : ''}
        ${isDone ? '<span class="ov-chk">✓</span>' : ''}
        <span class="ov-label">${escapeHtml(c.label)}</span>
        ${isDone ? '<span class="ov-tap">タップして広げる →</span>' : ''}
      </div>
    `;
  }).join('');

  setApp(`
    <div class="page">
      <header class="sheet-head">
        <button class="back-btn" data-back></button>
        <span class="crumb">${escapeHtml(loc.name)} / シート</span>
        <button class="pill ghost" id="to-standard">標準ビューへ</button>
      </header>

      <div class="sheet-place" style="padding-bottom:4px">
        思い出を広げる
        <span class="small">想定外の体験を記録して旅を枝分かれさせよう</span>
      </div>

      <div class="mandala-toolbar">
        <span class="pill-sm on">広げる</span>
        <span class="pill-sm" id="toolbar-sheet">シートだけ</span>
        <span class="right">達成 ${completedCount}/9 · 広げた ${totalChildren}</span>
      </div>

      ${completedCount === 0
        ? `<div class="mandala-empty"><span class="me-ico">▦</span><div>まずシートのマスを達成しよう</div><div class="me-sub">達成したマスに思い出を広げられます</div></div>`
        : `<div class="mandala-ov-grid">${cellsHtml}</div>`
      }

      <div class="mandala-foot">
        <span class="hint"></span>
        <button class="pill primary" id="add-derivative">＋ 思い出を加える</button>
      </div>
    </div>
    ${renderTabbar()}
  `);

  bindBack();
  bindTabbar();
  $('#to-standard').addEventListener('click', () => navigate(`#sheet/${sheet.id}`));
  $('#toolbar-sheet').addEventListener('click', () => navigate(`#sheet/${sheet.id}`));

  $$('.mandala-ov-cell.done[data-cell]').forEach((el) => {
    el.addEventListener('click', () => navigate(`#mandala/${sheet.id}/${el.dataset.cell}`));
  });

  $('#add-derivative').addEventListener('click', () => {
    const done = sheet.cells.filter((c) => c.status === 'completed');
    if (done.length === 0) {
      toast('先にマスを達成してから広げましょう');
    } else if (done.length === 1) {
      navigate(`#mandala/${sheet.id}/${done[0].id}`);
    } else {
      openPickParentCellDialog(sheet);
    }
  });
}

async function renderMandalaFocus(sheet, loc, cell) {
  const children = cell.children || [];
  const doneCount = children.filter((ch) => ch.status === 'completed').length;

  const childrenHtml = children.map((ch) => {
    const isDone = ch.status === 'completed';
    return `
      <div class="mandala-child-card ${isDone ? 'done' : 'pending'}" data-child-id="${ch.id}" data-parent-id="${cell.id}">
        <div class="cc-head">
          ${isDone ? '<span class="chk-sm">✓</span>' : '<span class="pending-dot"></span>'}
          <span class="cc-title">${escapeHtml(ch.label)}</span>
          ${isDone && ch.photoKey ? `<span class="cc-photo-badge" id="pb-${ch.id}"></span>` : ''}
        </div>
        ${ch.comment ? `<div class="cc-comment">${escapeHtml(ch.comment)}</div>` : ''}
        <div class="cc-date">${isDone && ch.recordedAt ? formatDate(ch.recordedAt) : '未記録 · タップして記録する'}</div>
      </div>
    `;
  }).join('');

  setApp(`
    <div class="page">
      <header class="sheet-head">
        <button class="back-btn" data-back></button>
        <span class="crumb">思い出を広げる / ${escapeHtml(loc.name)}</span>
        <button class="pill ghost" id="to-standard">標準ビューへ</button>
      </header>

      <div class="mandala-focus-parent">
        <div class="fp-chk">✓</div>
        <div style="flex:1;min-width:0">
          <div class="fp-name">${escapeHtml(cell.label)}</div>
          <div class="fp-sub">${doneCount > 0 ? `${doneCount}件の思い出を記録済` : 'まだ広げた思い出はありません'}</div>
        </div>
        <button class="pill ghost" id="back-to-ov">一覧へ</button>
      </div>

      <div class="mandala-child-list">
        ${childrenHtml}
        <div class="mandala-child-card add" data-add-for="${cell.id}">
          <span class="plus-ico">＋</span>
          <span style="font-size:13px;font-weight:600;color:var(--ink-2)">思い出を追加する</span>
        </div>
      </div>

      <div class="mandala-foot" style="justify-content:flex-end">
        <button class="pill primary" data-add-for="${cell.id}">＋ 追加</button>
      </div>
    </div>
    ${renderTabbar()}
  `);

  // 写真バッジの非同期ロード
  for (const ch of children) {
    if (ch.photoKey && ch.status === 'completed') {
      const url = await Storage.getPhotoURL(ch.photoKey);
      if (url) {
        const badge = $(`#pb-${ch.id}`);
        if (badge) {
          badge.style.cssText = `width:32px;height:32px;border-radius:6px;overflow:hidden;flex:0 0 auto;background:url(${url}) center/cover`;
        }
        const card = $(`.mandala-child-card[data-child-id="${ch.id}"]`);
        if (card) {
          card.style.backgroundImage = `linear-gradient(to right, var(--paper) 55%, transparent), url(${url})`;
          card.style.backgroundSize = 'auto, cover';
          card.style.backgroundPosition = '0 0, right center';
        }
      }
    }
  }

  bindBack();
  bindTabbar();
  $('#to-standard').addEventListener('click', () => navigate(`#sheet/${sheet.id}`));
  $('#back-to-ov').addEventListener('click', () => navigate(`#mandala/${sheet.id}`));

  $$('[data-add-for]').forEach((el) => {
    el.addEventListener('click', () => openAddChildDialog(sheet.id, el.dataset.addFor));
  });

  $$('[data-child-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const child = (cell.children || []).find((ch) => ch.id === el.dataset.childId);
      if (!child) return;
      if (child.status === 'completed') {
        openChildDetail(sheet, cell, child);
      } else {
        openChildRecordModal(sheet.id, cell.id, child.id);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Phase 2: 派生マス (思い出を広げる) 操作
// ─────────────────────────────────────────────────────────────
function openAddChildDialog(sheetId, parentCellId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return;
  const cell = sheet.cells.find((c) => c.id === parentCellId);
  if (!cell) return;
  if (!cell.children) cell.children = [];

  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="思い出を追加">
      <div class="handle"></div>
      <div class="eyebrow">ADD · 思い出を広げる</div>
      <div class="cell-name">
        <span class="lock-ico"></span>
        <span>${escapeHtml(cell.label)}</span>
      </div>
      <div class="field-label">この思い出のタイトル</div>
      <input type="text" class="field-input" id="child-label-input" maxlength="40" placeholder="例: 偶然出会った猫">
      <div class="modal-buttons">
        <button class="btn" data-dismiss>キャンセル</button>
        <button class="btn primary" id="add-child-ok">追加する</button>
      </div>
    </div>
  `);

  $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));
  setTimeout(() => $('#child-label-input') && $('#child-label-input').focus(), 100);

  $('#add-child-ok').addEventListener('click', () => {
    const label = $('#child-label-input').value.trim();
    if (!label) { toast('タイトルを入力してください'); return; }
    const child = { id: uuid(), label, status: 'pending', photoKey: null, comment: '', recordedAt: null };
    cell.children.push(child);
    Storage.saveSheet(sheet);
    closeOverlay();
    navigate(`#mandala/${sheetId}/${parentCellId}`);
  });
}

function openChildRecordModal(sheetId, parentCellId, childId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return;
  const cell = sheet.cells.find((c) => c.id === parentCellId);
  if (!cell) return;
  const child = (cell.children || []).find((ch) => ch.id === childId);
  if (!child) return;

  if (State.pendingPhoto && State.pendingPhoto.previewUrl) URL.revokeObjectURL(State.pendingPhoto.previewUrl);
  State.pendingPhoto = null;
  State.modalSheetId = sheetId;
  State.modalCellId = parentCellId;
  State.modalChildId = childId;
  State.isChildModal = true;

  if (!Storage.getFlag('photo_warning_seen')) {
    showPhotoWarning(() => renderChildRecordModal(sheet, cell, child));
  } else {
    renderChildRecordModal(sheet, cell, child);
  }
}

function renderChildRecordModal(sheet, cell, child) {
  // closeOverlay (from photo warning) が State をリセットするので再設定
  State.modalSheetId = sheet.id;
  State.modalCellId = cell.id;
  State.modalChildId = child.id;
  State.isChildModal = true;

  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="思い出を記録">
      <div class="handle"></div>
      <div class="eyebrow">MEMORY · 思い出を記録</div>
      <div class="cell-name">
        <span class="lock-ico"></span>
        <span>${escapeHtml(child.label)}</span>
      </div>
      <div style="font-size:10px;color:var(--ink-3);margin:-4px 0 10px">← ${escapeHtml(cell.label)}</div>

      <label class="photo-slot ${child.photoKey || State.pendingPhoto ? 'has-photo' : ''}" id="photo-slot">
        <input type="file" accept="image/*" capture="environment" id="photo-input" hidden>
        <img class="preview" id="photo-preview" alt="">
        <div class="ph-hint">
          <div class="camera"></div>
          <div><b>＋ 写真を選択</b></div>
          <div style="font-size:11px;color:#999">カメラ起動 / カメラロール</div>
        </div>
      </label>

      <button class="photo-warning-cta" id="show-warning">⚠ 撮影前に確認する</button>

      <div class="field-label">
        <span>コメント</span>
        <span class="count"><span id="cm-count">${(child.comment || '').length}</span> / 140</span>
      </div>
      <textarea class="field-textarea" id="comment-input" maxlength="140" placeholder="ここに体験を残す…">${escapeHtml(child.comment || '')}</textarea>

      <div class="modal-buttons">
        <button class="btn" data-dismiss>キャンセル</button>
        <button class="btn primary" id="save-record">保存する</button>
      </div>
    </div>
  `);

  if (child.photoKey) {
    Storage.getPhotoURL(child.photoKey).then((url) => {
      const img = $('#photo-preview');
      if (img && url) img.src = url;
    });
  }

  $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));
  $('#comment-input').addEventListener('input', (e) => { $('#cm-count').textContent = e.target.value.length; });
  $('#show-warning').addEventListener('click', () => { showPhotoWarning(() => {}); });

  $('#photo-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (State.pendingPhoto && State.pendingPhoto.previewUrl) URL.revokeObjectURL(State.pendingPhoto.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    State.pendingPhoto = { blob: file, key: uuid(), previewUrl };
    $('#photo-slot').classList.add('has-photo');
    $('#photo-preview').src = previewUrl;
  });

  $('#save-record').addEventListener('click', async () => { await saveCellRecord(); });
}

async function saveChildCellRecord() {
  const sheet = Storage.getSheet(State.modalSheetId);
  if (!sheet) return;
  const cell = sheet.cells.find((c) => c.id === State.modalCellId);
  if (!cell) return;
  const child = (cell.children || []).find((ch) => ch.id === State.modalChildId);
  if (!child) return;

  const comment = $('#comment-input').value.trim();

  if (State.pendingPhoto) {
    if (child.photoKey) { try { await Storage.deletePhoto(child.photoKey); } catch (e) {} }
    await Storage.savePhoto(State.pendingPhoto.key, State.pendingPhoto.blob);
    child.photoKey = State.pendingPhoto.key;
  }

  const hasContent = child.photoKey || comment.length > 0;
  if (!hasContent) { toast('写真かコメントを1つ以上記録してください'); return; }

  child.comment = comment;
  child.status = 'completed';
  child.recordedAt = nowIso();
  Storage.saveSheet(sheet);
  closeOverlay();
  toast('思い出を記録しました');
  navigate(`#mandala/${sheet.id}/${State.modalCellId}`);
}

function openChildDetail(sheet, cell, child) {
  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="思い出の詳細">
      <div class="handle"></div>
      <div class="eyebrow">MEMORY · 記録した思い出</div>
      <div class="cell-name">
        <span>${escapeHtml(child.label)}</span>
      </div>
      <div style="font-size:10px;color:var(--ink-3);margin:-4px 0 10px">← ${escapeHtml(cell.label)}</div>

      <div class="child-photo-box imgbox" id="child-photo-box">
        <span class="stamp">記録済 ✓</span>
      </div>

      <div class="cell-meta" style="margin:8px 0">
        <span>📅 ${formatDateTime(child.recordedAt)}</span>
      </div>

      <div class="cell-section">
        <h4>コメント</h4>
        ${escapeHtml(child.comment || '(コメントなし)')}
      </div>

      <div class="modal-buttons">
        <button class="btn" id="edit-child">編集</button>
        <button class="btn primary" data-dismiss>閉じる</button>
      </div>
    </div>
  `);

  if (child.photoKey) {
    Storage.getPhotoURL(child.photoKey).then((url) => {
      const box = $('#child-photo-box');
      if (box && url) {
        box.classList.add('has-photo');
        box.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="">`);
      }
    });
  }

  $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));
  $('#edit-child').addEventListener('click', () => {
    openChildRecordModal(sheet.id, cell.id, child.id);
  });
}

function openPickParentCellDialog(sheet) {
  const done = sheet.cells.filter((c) => c.status === 'completed');
  const itemsHtml = done.map((c) => `
    <div class="pick-cell-row" data-cell-id="${c.id}">
      <span class="check-badge">✓</span>
      <span>${escapeHtml(c.label)}</span>
      <span style="margin-left:auto;font-size:10px;color:var(--ink-3)">${(c.children || []).length} 個</span>
    </div>
  `).join('');

  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="マスを選択">
      <div class="handle"></div>
      <div class="eyebrow">SELECT · 広げるマスを選択</div>
      <div style="max-height:280px;overflow-y:auto;margin-bottom:8px">
        ${itemsHtml}
      </div>
      <div class="modal-buttons">
        <button class="btn" data-dismiss>キャンセル</button>
      </div>
    </div>
  `);

  $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));
  $$('.pick-cell-row').forEach((row) => {
    row.addEventListener('click', () => {
      closeOverlay();
      navigate(`#mandala/${sheet.id}/${row.dataset.cellId}`);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 05 マイシート一覧
// ─────────────────────────────────────────────────────────────
Routes.mysheets = async function renderMySheets() {
  const sheets = Storage.listSheets();
  const total = sheets.length;
  const complete = sheets.filter((s) => sheetDoneCount(s) === s.cells.length && s.cells.length > 0).length;
  const inProg = sheets.filter((s) => sheetDoneCount(s) > 0 && sheetDoneCount(s) < s.cells.length).length;
  const draft = sheets.filter((s) => sheetDoneCount(s) === 0).length;
  const totalCells = sheets.reduce((acc, s) => acc + sheetDoneCount(s), 0);
  const maxCells = sheets.reduce((acc, s) => acc + s.cells.length, 0);

  const listHtml = sheets.length === 0
    ? `<div class="my-empty">まだシートがありません<br/>TOPから観光地を選んでビンゴを始めよう</div>`
    : `<div class="my-list">${sheets.map(sheetRowHtml).join('')}</div>`;

  setApp(`
    <div class="page">
      <header class="nav-row" style="padding-bottom:6px">
        <div style="font-size:14px;font-weight:700">マイシート</div>
        <button class="pill ghost" id="sort">並び替え</button>
      </header>

      <div class="my-title">あなたの旅、${total}冊</div>
      <div class="my-sub">完成 ${complete} · 進行中 ${inProg} · 下書き ${draft}</div>

      <div class="my-stats">
        <div class="stat"><span class="n"><b>${totalCells}</b><span style="color:#999;font-size:13px">/${maxCells}</span></span><span class="l">達成マス合計</span></div>
        <div class="stat"><span class="n"><b>${complete}</b></span><span class="l">完成シート</span></div>
        <div class="stat"><span class="n"><b>${countCompletedChildren(sheets)}</b></span><span class="l">広げた思い出</span></div>
      </div>

      ${listHtml}
    </div>
    ${renderTabbar('mysheets')}
  `);

  bindTabbar();
  bindSheetRows();

  $('#sort').addEventListener('click', () => toast('並び替えは作成日(降順)のみ対応'));
};

function sheetRowHtml(sheet) {
  const loc = findLocation(sheet.locationId);
  const done = sheetDoneCount(sheet);
  const total = sheet.cells.length;
  const isComplete = done === total && total > 0;
  const pct = total > 0 ? (done / total) * 100 : 0;
  return `
    <div class="my-row ${isComplete ? 'complete' : ''}" data-sheet="${sheet.id}">
      <div class="thumb imgbox"></div>
      <div class="info">
        <div class="name">${escapeHtml(loc ? loc.name : '(unknown)')}</div>
        <div class="meta">${formatDate(sheet.createdAt)}</div>
        <div class="pbar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="ratio">
        <b>${done}</b>/${total}
        <span class="small">マス達成</span>
      </div>
    </div>
  `;
}

function bindSheetRows() {
  $$('.my-row[data-sheet]').forEach((row) => {
    row.addEventListener('click', () => navigate(`#sheet/${row.dataset.sheet}`));
  });
}

// ─────────────────────────────────────────────────────────────
// 06 マス詳細
// ─────────────────────────────────────────────────────────────
Routes.cell = async function renderCellDetail(sheetId, cellId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) return navigate('#top');
  const cell = sheet.cells.find((c) => c.id === cellId);
  if (!cell) return navigate(`#sheet/${sheetId}`);
  const loc = findLocation(sheet.locationId);
  const mockRecs = MOCK_RECORDS[cell.templateId] || [];

  setApp(`
    <div class="page">
      <header class="sheet-head">
        <button class="back-btn" data-back></button>
        <span class="crumb">${escapeHtml(loc.name)} / シート</span>
        <button class="pill ghost">⋯</button>
      </header>

      <div class="cell-photo imgbox" id="cell-photo-box">
        <span class="stamp">達成 ✓</span>
      </div>

      <div class="cell-title">${escapeHtml(cell.label)}</div>
      <div class="cell-meta">
        <span>📅 ${formatDateTime(cell.recordedAt)}</span>
        <span class="dot">·</span>
        <span>📍 ${escapeHtml(loc.area)} · ${escapeHtml(loc.subArea)}</span>
      </div>

      <div class="cell-tabs">
        <button class="tab on" id="tab-mine">自分の記録</button>
        <button class="tab" id="tab-others">
          他の人のこのマス
          ${mockRecs.length > 0 ? `<span class="badge">${mockRecs.length}</span>` : ''}
        </button>
      </div>

      <div id="panel-mine">
        <div class="cell-section">
          <h4>コメント</h4>
          ${escapeHtml(cell.comment || '(コメントなし)')}
        </div>
      </div>

      <div id="panel-others" style="display:none">
        ${mockRecs.length === 0
          ? `<div class="stub-placeholder"><div class="small">まだ他のユーザーの記録がありません</div></div>`
          : `<div class="others-list">${mockRecs.map(mockRecordHtml).join('')}</div>`
        }
      </div>

      <div class="cell-actions">
        <button class="btn" id="edit-cell">編集</button>
        <button class="btn primary" id="back-sheet">シートへ戻る</button>
      </div>
    </div>
    ${renderTabbar()}
  `);

  bindBack();
  bindTabbar();

  if (cell.photoKey) {
    const url = await Storage.getPhotoURL(cell.photoKey);
    const box = $('#cell-photo-box');
    if (box && url) {
      box.classList.add('has-photo');
      box.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="">`);
    }
  }

  $('#tab-mine').addEventListener('click', () => {
    $('#tab-mine').classList.add('on'); $('#tab-others').classList.remove('on');
    $('#panel-mine').style.display = ''; $('#panel-others').style.display = 'none';
  });
  $('#tab-others').addEventListener('click', () => {
    $('#tab-others').classList.add('on'); $('#tab-mine').classList.remove('on');
    $('#panel-mine').style.display = 'none'; $('#panel-others').style.display = '';
  });

  $('#edit-cell').addEventListener('click', () => openRecordModal(sheetId, cellId));
  $('#back-sheet').addEventListener('click', () => navigate(`#sheet/${sheetId}`));
};

function mockRecordHtml(rec) {
  const initial = rec.user[0].toUpperCase();
  return `
    <div class="other-record">
      <div class="or-head">
        <div class="or-avatar">${escapeHtml(initial)}</div>
        <div class="or-info">
          <div class="or-name">@${escapeHtml(rec.user)}</div>
          <div class="or-date">${formatDate(rec.recordedAt)}</div>
        </div>
        ${rec.photo ? '<span class="or-photo-badge">📷 写真あり</span>' : ''}
      </div>
      ${rec.comment ? `<div class="or-comment">${escapeHtml(rec.comment)}</div>` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// A1 認証 (Phase 3 スタブ)
// ─────────────────────────────────────────────────────────────
Routes.auth = async function renderAuth() {
  setApp(`
    <div class="page">
      <div class="auth-wrap">
        <div class="big-logo">B<span class="dot">·</span>log</div>
        <div class="badge">OPTIONAL · あとからでも作れます</div>
      </div>
      <div class="auth-section">
        <div class="h">アカウントを作ると</div>
        <div class="b">
          ・他の人のシートを<b>参考にする</b>ことができます<br/>
          ・自分のシートを<b>公開</b>できます<br/>
          ・記録帳<b>プリント</b>の購入ができます
        </div>
        <button class="auth-btn primary" data-stub="Apple">Appleで続ける</button>
        <button class="auth-btn" data-stub="Google">Googleで続ける</button>
        <button class="auth-btn" data-stub="Email">メールアドレスで作成</button>
        <div class="auth-fine">既にアカウントをお持ちですか？ <u>ログイン</u></div>
      </div>
      <div class="auth-skip" data-nav="#top">このまま記録だけ始める →</div>
    </div>
  `);
  // Phase 3: 認証
  $$('[data-stub]').forEach((b) => b.addEventListener('click', () => toast(`${b.dataset.stub}認証は Phase 3 で実装予定`)));
  $$('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
};

// ─────────────────────────────────────────────────────────────
// A2 マイページ (Phase 3 スタブ + 実シートサムネ)
// ─────────────────────────────────────────────────────────────
Routes.mypage = async function renderMyPage() {
  const sheets = Storage.listSheets();
  const complete = sheets.filter((s) => sheetDoneCount(s) === s.cells.length && s.cells.length > 0).length;
  const cardsHtml = sheets.slice(0, 4).map((s) => {
    const loc = findLocation(s.locationId);
    return `
      <div class="mp-card" data-sheet="${s.id}">
        <div class="th"></div>
        <div class="mt">${escapeHtml(loc ? loc.name : '?')} · ${sheetDoneCount(s)}/${s.cells.length}</div>
      </div>
    `;
  }).join('');

  setApp(`
    <div class="page">
      <header class="nav-row">
        <div style="font-size:14px;font-weight:700;flex:1">マイページ</div>
        <button class="pill ghost" data-nav="#settings">⚙</button>
      </header>

      <div class="mp-hero">
        <div class="mp-avatar"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">@guest</div>
          <div style="font-size:11px;color:#999;font-family:'Caveat',cursive">未ログイン (Phase 3)</div>
          <div style="font-size:10px;color:#555;margin-top:4px">「予定外も全部、旅。」</div>
        </div>
        <button class="pill ghost" data-nav="#auth">編集</button>
      </div>

      <div class="mp-stats">
        <div class="mp-stat"><div class="n">${complete}</div><div class="l">完成シート</div></div>
        <div class="mp-stat"><div class="n">${countCompletedChildren(sheets)}</div><div class="l">広げた思い出</div></div>
        <div class="mp-stat"><div class="n">${new Set(sheets.map((s) => s.locationId)).size}</div><div class="l">観光地</div></div>
        <div class="mp-stat"><div class="n">0</div><div class="l">参考にされた</div></div>
      </div>

      <div class="section-title">シート (${sheets.length})</div>
      <div class="mp-sheets">${cardsHtml || '<div class="stub-placeholder"><div class="small">シートがまだありません</div></div>'}</div>
    </div>
    ${renderTabbar('mypage')}
  `);

  bindTabbar();
  $$('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  $$('.mp-card[data-sheet]').forEach((c) => c.addEventListener('click', () => navigate(`#sheet/${c.dataset.sheet}`)));
};

// ─────────────────────────────────────────────────────────────
// A3 設定 (スタブ)
// ─────────────────────────────────────────────────────────────
Routes.settings = async function renderSettings() {
  const groups = [
    { h: 'アカウント', items: ['プロフィール編集', 'メールアドレス · 認証', 'パスワード変更'] },
    { h: 'プライバシー', items: ['位置情報の利用 · ON', '写真のEXIF情報を保存 · OFF', '公開デフォルト · 非公開'] },
    { h: 'データ', items: ['写真の保管 · 端末ローカルのみ', 'シートをエクスポート (.zip)', 'アカウント削除'] },
    { h: '通知', items: ['プッシュ通知 · ON', '他の人があなたを参考にした時'] },
    { h: 'プレミアム', items: ['現在のプラン · FREE', 'アップグレード'] },
    { h: 'サポート', items: ['ヘルプ', 'お問い合わせ', 'プライバシーポリシー', '利用規約'] },
  ];
  const groupHtml = (g) => `
    <div class="set-h">${g.h}</div>
    <div class="set-card">
      ${g.items.map((it) => `<div class="set-row"><span>${escapeHtml(it)}</span><span class="set-chev">›</span></div>`).join('')}
    </div>
  `;

  setApp(`
    <div class="page">
      ${simpleHead('設定')}
      ${groups.map(groupHtml).join('')}
      <div style="text-align:center;font-size:11px;color:#999;margin:20px 0 40px;font-family:'Caveat',cursive">B·log v0.1 — MVP</div>
    </div>
    ${renderTabbar()}
  `);
  bindBack('#app', '#mypage');
  bindTabbar();
  $$('.set-row').forEach((r) => r.addEventListener('click', () => toast('Phase 3 で実装予定')));
};

// ─────────────────────────────────────────────────────────────
// 法務ページ L1〜L3 (静的)
// ─────────────────────────────────────────────────────────────
Routes.privacy = async function renderPrivacy() {
  setApp(`
    <div class="page">
      ${simpleHead('プライバシーポリシー')}
      <div class="legal-page">
        <p>B·log (以下「本アプリ」) はユーザーの皆様のプライバシーを尊重し、以下のとおりプライバシーポリシーを定めます。</p>
        <h2>1. 収集する情報</h2>
        <p>MVP 版では、入力された観光地名・写真・コメント・タイムスタンプを<b>端末内</b>にのみ保存します。クラウドへの自動送信は行いません。</p>
        <h2>2. 位置情報の利用</h2>
        <p>近くの観光地を提案するためにのみ使用し、外部に送信しません。</p>
        <h2>3. 写真の取り扱い</h2>
        <p>写真は端末の IndexedDB に保存されます。アプリ削除時に消去されます。</p>
        <h2>4. 今後の変更</h2>
        <p>Phase 3 以降、認証・クラウド保存・共有機能を導入する際は、改めて同意を求めます。</p>
      </div>
    </div>
    ${renderTabbar()}
  `);
  bindBack(); bindTabbar();
};

Routes.terms = async function renderTerms() {
  setApp(`
    <div class="page">
      ${simpleHead('利用規約')}
      <div class="legal-page">
        <h2>1. 利用条件</h2>
        <p>本アプリは MVP として個人利用を想定して提供されます。</p>
        <h2>2. 禁止事項</h2>
        <ul>
          <li>他者の肖像権・プライバシーを侵害する写真の保存</li>
          <li>撮影禁止エリアでの撮影</li>
          <li>違法行為・公序良俗に反する利用</li>
        </ul>
        <h2>3. 免責</h2>
        <p>本アプリの利用により生じたいかなる損害についても、運営者は責任を負いません。</p>
        <h2>4. 規約の変更</h2>
        <p>本規約は予告なく改訂される場合があります。</p>
      </div>
    </div>
    ${renderTabbar()}
  `);
  bindBack(); bindTabbar();
};

Routes.tokushoho = async function renderTokushoho() {
  setApp(`
    <div class="page">
      ${simpleHead('特定商取引法に基づく表記')}
      <div class="legal-page">
        <p style="color:#999;font-size:11px">※ Phase 5 (有料機能 / 記録帳プリント注文) 実装時に正式公開します。</p>
        <h2>販売事業者</h2><p>(調整中)</p>
        <h2>代表者</h2><p>(調整中)</p>
        <h2>所在地</h2><p>(調整中)</p>
        <h2>連絡先</h2><p>(調整中)</p>
        <h2>販売価格</h2><p>記録帳プリント: ¥1,980〜 (税込)</p>
        <h2>引渡時期</h2><p>注文確定後 2〜3週間</p>
        <h2>支払方法</h2><p>クレジットカード</p>
        <h2>返品・キャンセル</h2><p>製造開始前のみ可</p>
      </div>
    </div>
    ${renderTabbar()}
  `);
  bindBack(); bindTabbar();
};

// ─────────────────────────────────────────────────────────────
// S1 シェア — 公開URL生成 + コピー
// ─────────────────────────────────────────────────────────────
function showSharePanel(sheet) {
  const loc=findLocation(sheet.locationId);
  openOverlay(`
    <div class="modal-dim" data-dismiss></div>
    <div class="bottom-sheet" role="dialog" aria-label="旅の記録を画像に保存">
      <div class="handle"></div><div class="eyebrow">SAVE · 旅の記録を画像に</div>
      <div class="cell-name">${escapeHtml(loc ? loc.name : 'シート')}</div>
      <p class="share-note">写真とお題を1枚にまとめます。記録はこの端末内に保存されており、URLだけでは他の端末に共有できません。</p>
      <p class="share-note">人物や個人情報が写っていないか、共有前に確認してください。</p>
      <p id="image-export-status" role="status"></p><div id="image-export-preview"></div>
      <div class="modal-buttons"><button class="btn" data-dismiss>閉じる</button><button class="btn primary" id="make-sheet-image">画像を作成</button></div>
    </div>
  `);
  $$('[data-dismiss]',$('#overlay')).forEach(b=>b.addEventListener('click',closeOverlay));
  const button=$('#make-sheet-image'),status=$('#image-export-status'),preview=$('#image-export-preview');
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='画像を作成しています…';
    try {
      const {canvas,missingPhotos}=await SheetImage.create(sheet,loc ? loc.name : '旅の記録',Storage.getPhotoURL);
      if(!button.isConnected)return;
      const image=document.createElement('img');image.src=canvas.toDataURL('image/png');image.alt='旅の記録の保存プレビュー';image.style.width='100%';
      const link=document.createElement('a');link.href=image.src;link.download='bingo-log.png';link.textContent='画像を保存';link.className='btn primary';
      preview.replaceChildren(image,link);
      status.textContent=missingPhotos ? `${missingPhotos}枚の写真を読み込めませんでした。確認してから保存してください。` : '画像を保存できます。保存できない場合は画像を長押ししてください。';button.textContent='画像を作り直す';
    } catch {if(button.isConnected)status.textContent='画像を作成できませんでした。もう一度お試しください。'}
    finally {if(button.isConnected)button.disabled=false}
  });
}

// ─────────────────────────────────────────────────────────────
// S2 公開シート閲覧 (#public/:sheetId)
// ─────────────────────────────────────────────────────────────
Routes.public = async function renderPublicSheet(sheetId) {
  const sheet = Storage.getSheet(sheetId);
  if (!sheet) {
    setApp(`
      <div class="page">
        ${simpleHead('公開シート')}
        <div class="stub-placeholder">
          <div class="big">シートが見つかりません</div>
          <div class="small">リンクが古いか、このデバイスに存在しないシートです</div>
        </div>
        <div style="text-align:center;padding:8px 0 20px">
          <button class="pill primary" data-nav="#top">TOPへ戻る</button>
        </div>
      </div>
      ${renderTabbar('find')}
    `);
    bindBack(); bindTabbar();
    $$('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
    return;
  }

  const loc = findLocation(sheet.locationId);
  const done = sheetDoneCount(sheet);
  const total = sheet.cells.length;

  const cellsHtml = sheet.cells.map((c) => {
    const isDone = c.status === 'completed';
    return `
      <div class="bingo-cell ${isDone ? 'done no-photo' : ''}">
        ${isDone ? `
          <div class="photo"></div>
          <span class="check">✓</span>
          <span class="label-strip">${escapeHtml(c.label)}</span>
        ` : `
          <span>${escapeHtml(c.label)}</span>
        `}
      </div>
    `;
  }).join('');

  setApp(`
    <div class="page">
      ${simpleHead('シートを見る')}

      <div class="pub-meta">
        <div class="pub-avatar-wrap">
          <div class="pub-avatar">T</div>
          <div>
            <div class="pub-name">@traveler</div>
            <div class="pub-date">${formatDate(sheet.createdAt)} 開始</div>
          </div>
        </div>
        <div class="pub-progress">${done}<span style="font-size:13px;color:var(--ink-3)">/${total}</span></div>
      </div>

      <div class="sheet-place">
        ${escapeHtml(loc ? loc.name : '(unknown)')}
        <span class="small">${loc ? escapeHtml(loc.area + ' · ' + loc.subArea) : ''}</span>
      </div>

      <div class="bingo-grid" style="pointer-events:none;margin-bottom:16px">
        ${cellsHtml}
      </div>

      <div class="pub-start-section">
        <div class="pub-start-label">同じコースでビンゴを始めよう</div>
        <button class="pub-start-btn" id="start-from-public">このビンゴを始める →</button>
      </div>
    </div>
    ${renderTabbar('find')}
  `);

  bindBack();
  bindTabbar();

  for (const c of sheet.cells) {
    if (c.photoKey) {
      const url = await Storage.getPhotoURL(c.photoKey);
      const cells = $$('.bingo-grid .bingo-cell');
      const idx = sheet.cells.indexOf(c);
      if (cells[idx] && url) {
        cells[idx].classList.remove('no-photo');
        const photoBox = cells[idx].querySelector('.photo');
        if (photoBox) photoBox.innerHTML = `<img src="${url}" alt="">`;
      }
    }
  }

  $('#start-from-public').addEventListener('click', () => cloneSheetFromPublic(sheet));
};

function cloneSheetFromPublic(sourceSheet) {
  const loc = findLocation(sourceSheet.locationId);
  if (!loc) { toast('観光地データが見つかりません'); return; }

  const existing = Storage.listSheets().filter((s) => s.locationId === loc.id);
  if (existing.length > 0) {
    openOverlay(`
      <div class="modal-dim" data-dismiss></div>
      <div class="bottom-sheet" role="dialog">
        <div class="handle"></div>
        <div class="eyebrow">CONFIRM · シートを追加</div>
        <div class="cell-name"><span>${escapeHtml(loc.name)}</span></div>
        <div style="font-size:12px;color:var(--ink-2);margin-bottom:16px">
          この観光地のシートがすでに ${existing.length} 件あります。<br>新しいシートを追加しますか？
        </div>
        <div class="modal-buttons">
          <button class="btn" data-dismiss>キャンセル</button>
          <button class="btn primary" id="confirm-clone">新しく始める</button>
        </div>
      </div>
    `);
    $$('[data-dismiss]', $('#overlay')).forEach((b) => b.addEventListener('click', closeOverlay));
    $('#confirm-clone').addEventListener('click', () => {
      const newSheet = createSheet(loc);
      newSheet.sourceSheetId = sourceSheet.id;
      Storage.saveSheet(newSheet);
      closeOverlay();
      toast(`${loc.name}のビンゴを開始！`);
      navigate(`#sheet/${newSheet.id}`);
    });
  } else {
    const newSheet = createSheet(loc);
    newSheet.sourceSheetId = sourceSheet.id;
    Storage.saveSheet(newSheet);
    toast(`${loc.name}のビンゴを開始！`);
    navigate(`#sheet/${newSheet.id}`);
  }
}

// ─────────────────────────────────────────────────────────────
// C1 お祝い演出 (9/9 達成時)
// ─────────────────────────────────────────────────────────────
function showCelebration(sheet, loc) {
  const stamps = Array.from({ length: 9 }).map(() => `
    <div class="cell"><span class="stamp">済</span></div>
  `).join('');

  const confetti = Array.from({ length: 14 }).map(() => {
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const colors = ['#d94f3a', '#fde6e1', '#fefdf9'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `<div class="confetti" style="left:${left}%;top:-20px;background:${color};animation-delay:${delay}s"></div>`;
  }).join('');

  openOverlay(`
    <div class="celebration" id="celeb-root">
      ${confetti}
      <div class="bingo-text">BINGO!</div>
      <div class="sub">9 / 9 ACHIEVED</div>
      <div class="place">${escapeHtml(loc.name)}</div>
      <div class="grid">${stamps}</div>
      <button class="btn" id="celeb-continue">振り返りを見る →</button>
    </div>
  `);

  $('#celeb-continue').addEventListener('click', () => {
    closeOverlay();
    toast('サマリー画面は Phase 5 で実装予定');
  });
}

// ─────────────────────────────────────────────────────────────
// 起動時の初期化 — グローバルに開放 (debugStore はすでに storage.js で公開済み)
// ─────────────────────────────────────────────────────────────
window.B = { State, Routes, navigate, createSheet };
