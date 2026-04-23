let map;
let markers = [];
let markerIndex = new Map();
let allRows = [];

const mapEl = document.getElementById('map');
const listEl = document.getElementById('list');
const resultCountEl = document.getElementById('resultCount');
const searchInput = document.getElementById('searchInput');
const regionSelect = document.getElementById('regionSelect');
const nightFilter = document.getElementById('nightFilter');
const locateBtn = document.getElementById('locateBtn');

let customOverlay = null;

function initMap() {
  map = new kakao.maps.Map(mapEl, {
    center: new kakao.maps.LatLng(36.5, 127.8),
    level: 13,
  });
  kakao.maps.event.addListener(map, 'click', closeOverlay);
}

function closeOverlay() {
  if (customOverlay) {
    customOverlay.setMap(null);
    customOverlay = null;
  }
}

async function loadData() {
  const response = await fetch(window.APP_CONFIG.dataUrl);
  const rows = await response.json();
  allRows = rows.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
  populateRegionFilter(allRows);
  render(allRows);
}

function populateRegionFilter(rows) {
  const regions = [...new Set(rows.map((r) => extractRegion(r.address)).filter(Boolean))].sort();
  for (const region of regions) {
    const opt = document.createElement('option');
    opt.value = region;
    opt.textContent = region;
    regionSelect.appendChild(opt);
  }
}

function extractRegion(address = '') {
  return address.split(' ')[0] || '';
}

function getTodayHours(row) {
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = DAY_KEYS[new Date().getDay()];

  // 요일별 시간표 우선
  const weekly = row.weekly_hours;
  if (weekly) {
    const slots = weekly[dayKey];
    if (!slots || !slots.length) return '오늘 휴무';
    return slots.map((s) => `${s.open}~${s.close}`).join(', ');
  }

  // 매일 동일 시간표
  const uniform = row.inferred_uniform_hours;
  if (uniform && uniform.daily_open && uniform.daily_close) {
    return `${uniform.daily_open}~${uniform.daily_close}`;
  }

  return '운영시간 미입력';
}

function render(rows) {
  clearMarkers();
  resultCountEl.textContent = `${rows.length}곳`;
  listEl.innerHTML = '';

  const bounds = new kakao.maps.LatLngBounds();

  rows.forEach((row) => {
    const position = new kakao.maps.LatLng(row.lat, row.lng);
    const marker = new kakao.maps.Marker({ position, map });
    markers.push(marker);
    markerIndex.set(String(row.id), marker);
    bounds.extend(position);

    kakao.maps.event.addListener(marker, 'click', () => focusRow(row));

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pharmacy-card';
    card.innerHTML = `
      <strong>${row.display_name || row.name}</strong>
      <div class="meta">${extractRegion(row.address)} ${badgeNight(row.nightEligible)}</div>
      <div class="addr">${row.address || ''}</div>
      <div class="hours">오늘 ${getTodayHours(row)}</div>
      <div class="phone">${row.phone || ''}</div>
    `;
    card.addEventListener('click', () => focusRow(row));
    listEl.appendChild(card);
  });

  if (rows.length) map.setBounds(bounds);
}

function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
  markerIndex.clear();
}

function labelNight(value) {
  if (value === 'full') return '완전 심야';
  if (value === 'partial') return '부분 심야';
  if (value === 'none') return '일반';
  return '정보 없음';
}

function badgeNight(value) {
  const map = {
    full:    ['badge-full',    '완전 심야'],
    partial: ['badge-partial', '부분 심야'],
    none:    ['badge-none',    '일반'],
  };
  const [cls, label] = map[value] || ['badge-unknown', '정보 없음'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function focusRow(row) {
  const marker = markerIndex.get(String(row.id));
  if (!marker) return;
  map.panTo(marker.getPosition());
  closeOverlay();

  const content = document.createElement('div');
  content.style.cssText = `
    position:relative;
    background:#1a1d27;
    border:1px solid #4f7cff;
    border-radius:10px;
    padding:14px 16px;
    max-width:270px;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
    font-family:'Noto Sans KR',sans-serif;
    font-size:13px;
    color:#e8eaf0;
    line-height:1.6;
    margin-bottom:12px;
  `;
  content.innerHTML = `
    <button onclick="window._closeOverlay()" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#8892aa;font-size:16px;cursor:pointer;line-height:1;">×</button>
    <strong style="font-size:14px;font-weight:700;display:block;margin-bottom:6px;color:#fff;padding-right:16px;">${row.display_name || row.name}</strong>
    <div style="color:#a5b4d0;margin-bottom:2px;">${row.address || ''}</div>
    <div style="color:#a5b4d0;margin-bottom:6px;">${row.phone || ''}</div>
    <div style="color:#7da4ff;font-weight:600;">오늘 ${getTodayHours(row)}</div>
  `;

  window._closeOverlay = closeOverlay;

  customOverlay = new kakao.maps.CustomOverlay({
    position: marker.getPosition(),
    content: content,
    yAnchor: 1.15,
    zIndex: 3,
  });
  customOverlay.setMap(map);
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const region = regionSelect.value;
  const night = nightFilter.value;

  const filtered = allRows.filter((row) => {
    const hay = `${row.name || ''} ${row.address || ''}`.toLowerCase();
    const passQ = !q || hay.includes(q);
    const passRegion = !region || extractRegion(row.address) === region;
    const passNight = !night || row.nightEligible === night;
    return passQ && passRegion && passNight;
  });

  render(filtered);
}

searchInput.addEventListener('input', applyFilters);
regionSelect.addEventListener('change', applyFilters);
nightFilter.addEventListener('change', applyFilters);

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const loc = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
    map.setLevel(4);
    map.panTo(loc);
  });
});

initMap();
loadData().catch((err) => {
  listEl.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.<br>${String(err)}</div>`;
});
