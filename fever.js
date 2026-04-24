// ── 화면 전환 ──
function showScreen(id) {
  ['screen-map','screen-fever'].forEach(sid => {
    document.getElementById(sid).style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = id === 'screen-fever' ? 'flex' : 'block';
  window.scrollTo(0, 0);
}

document.getElementById('feverBtn').addEventListener('click', () => {
  showScreen('screen-fever');
});

document.getElementById('feverBackBtn').addEventListener('click', () => {
  showScreen('screen-map');
  if (typeof kakao !== 'undefined' && map) {
    setTimeout(() => kakao.maps.event.trigger(map, 'resize'), 100);
  }
});

// ── 드럼 피커 데이터 ──
const AGE_OPTIONS = [
  { label: '4개월 미만', val: 'under4m' },
  { label: '4개월',      val: '4m' },
  { label: '6개월',      val: '6m' },
  { label: '8개월',      val: '8m' },
  { label: '10개월',     val: '10m' },
  { label: '12개월',     val: '12m' },
  { label: '만 2세',     val: '2y' },
  { label: '만 3세',     val: '3y' },
  { label: '만 4세',     val: '4y' },
  { label: '만 5세',     val: '5y' },
  { label: '만 6세',     val: '6y' },
  { label: '만 7세',     val: '7y' },
  { label: '만 8세 이상',val: '8y+' },
];

const WEIGHT_OPTIONS = [];
for (let w = 3; w <= 50; w += 0.5) {
  WEIGHT_OPTIONS.push({ label: `${w} kg`, val: w });
}

function createDrum(innerId, drumId, options, defaultIdx) {
  const inner = document.getElementById(innerId);
  const drum  = document.getElementById(drumId);
  const ITEM_H = 40;
  const PAD    = 2;
  let currentIdx = defaultIdx;
  let startY = 0, startOffset = 0, isDragging = false;

  const allItems = [
    ...Array(PAD).fill({ label: '', val: null }),
    ...options,
    ...Array(PAD).fill({ label: '', val: null }),
  ];

  inner.innerHTML = allItems.map((o, i) =>
    `<div class="drum-item${i === currentIdx + PAD ? ' active' : ''}">${o.label}</div>`
  ).join('');

  function setOffset(idx, animate = true) {
    idx = Math.max(0, Math.min(options.length - 1, idx));
    currentIdx = idx;
    inner.style.transition = animate ? 'transform 0.2s ease' : 'none';
    inner.style.transform  = `translateY(${-idx * ITEM_H}px)`;
    inner.querySelectorAll('.drum-item').forEach((el, i) => {
      el.classList.toggle('active', i - PAD === idx);
    });
  }
  setOffset(defaultIdx, false);

  function onStart(e) {
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startOffset = currentIdx;
    inner.style.transition = 'none';
    drum.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const y    = e.touches ? e.touches[0].clientY : e.clientY;
    const diff = Math.round((startY - y) / ITEM_H);
    setOffset(startOffset + diff, false);
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    drum.style.cursor = 'grab';
    setOffset(currentIdx);
  }

  drum.addEventListener('mousedown',  onStart);
  drum.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup',   onEnd);
  window.addEventListener('touchend',  onEnd);

  drum.addEventListener('wheel', e => {
    e.preventDefault();
    setOffset(currentIdx + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  return {
    getValue: () => options[currentIdx].val,
    getLabel: () => options[currentIdx].label,
  };
}

const agePicker    = createDrum('ageInner',    'ageDrum',    AGE_OPTIONS,    2);
const weightPicker = createDrum('weightInner', 'weightDrum', WEIGHT_OPTIONS, 24);

// ── 파일 업로드 ──
let imageBase64 = null;
const fileInput  = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadArea = document.getElementById('uploadArea');

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    imageBase64 = ev.target.result.split(',')[1];
    previewImg.src = ev.target.result;
    previewImg.style.display = 'block';
    analyzeBtn.disabled = false;
    uploadArea.querySelector('.upload-icon').textContent = '✅';
  };
  reader.readAsDataURL(file);
});

uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── 복용량 계산 ──
function calcDosage(type, weightKg) {
  const w = parseFloat(weightKg);
  if (type === 'acetaminophen') {
    return { ml: ((w * 12.5) / 160 * 5).toFixed(1), times: '4회', interval: '4시간', maxDay: '4회' };
  }
  if (type === 'ibuprofen') {
    return { ml: ((w * 10) / 100 * 5).toFixed(1), times: '3회', interval: '6시간', maxDay: '3회' };
  }
  if (type === 'dexibuprofen') {
    return { ml: (w / 2).toFixed(1), times: '3회', interval: '6시간', maxDay: '3회' };
  }
  return null;
}

function checkAgeWarning(type, ageVal) {
  if (ageVal === 'under4m')
    return '⚠️ 4개월 미만 영아에게는 임의로 해열제를 복용시키지 마세요. 반드시 의사와 상담하세요.';
  if ((type === 'ibuprofen' || type === 'dexibuprofen') && (ageVal === '4m' || ageVal === '6m'))
    return '⚠️ 이부프로펜/덱시부프로펜 계열은 생후 6개월 미만에게 사용하지 않습니다.';
  return null;
}

// ── AI 분석 ──
analyzeBtn.addEventListener('click', async () => {
  if (!imageBase64) return;
  const ageVal    = agePicker.getValue();
  const ageLabel  = agePicker.getLabel();
  const weightVal = weightPicker.getValue();

  document.getElementById('feverLoading').style.display = 'block';
  document.getElementById('feverResult').style.display  = 'none';
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '분석 중...';

  const GEMINI_KEY = 'AIzaSyDK5FOd24shWcFiViHxplgkaqg3I9zfHqY';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  const prompt = `이 이미지는 어린이 해열제 제품 사진입니다.
다음 정보를 JSON으로만 답해주세요. 마크다운 없이 JSON만 출력하세요.
{"product_name":"제품명","ingredient_type":"acetaminophen 또는 ibuprofen 또는 dexibuprofen 또는 unknown","ingredient_korean":"성분명 한국어","concentration":"농도(예:160mg/5mL, 없으면 null)","is_liquid":true또는false,"note":"주의사항(없으면 null)"}
판단기준: 타이레놀/세토펜/챔프/어린이타이레놀→acetaminophen, 부루펜/이부프로펜/애드빌→ibuprofen, 맥시부펜/덱시부프로펜/아리부펜→dexibuprofen, 모르면→unknown`;

  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      })
    });
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    showResult(JSON.parse(clean), ageVal, ageLabel, weightVal);
  } catch (e) {
    const el = document.getElementById('feverResult');
    el.innerHTML = `<div class="fever-warning-box fever-warn-red">❌ 분석 중 오류가 발생했어요. 다시 시도해주세요.</div>`;
    el.style.display = 'block';
  } finally {
    document.getElementById('feverLoading').style.display = 'none';
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'AI로 성분 분석하기';
  }
});

function showResult(info, ageVal, ageLabel, weightVal) {
  const resultEl = document.getElementById('feverResult');
  const type   = info.ingredient_type;
  const dosage = (info.is_liquid && type !== 'unknown') ? calcDosage(type, weightVal) : null;
  const ageWarn = checkAgeWarning(type, ageVal);

  const badgeMap = {
    acetaminophen: ['fever-badge-acet','🟢','아세트아미노펜'],
    ibuprofen:     ['fever-badge-ibu', '🔵','이부프로펜'],
    dexibuprofen:  ['fever-badge-dexi','🟣','덱시부프로펜'],
    unknown:       ['fever-badge-unk', '❓','성분 미확인'],
  };
  const [badgeCls, icon, ingLabel] = badgeMap[type] || badgeMap.unknown;

  let html = `
    <div class="fcard-title">✅ 분석 결과</div>
    <span class="fever-badge ${badgeCls}">${icon} ${ingLabel}</span>
    <div class="fever-product-name">${info.product_name || '제품명 미확인'}</div>
    <div class="fever-ingredient">${info.ingredient_korean || ''} ${info.concentration ? '· ' + info.concentration : ''}</div>
  `;

  if (ageWarn) html += `<div class="fever-warning-box fever-warn-red">${ageWarn}</div>`;
  if (!info.is_liquid) html += `<div class="fever-warning-box fever-warn-red">⚠️ 액상형이 아닌 것 같아요.</div>`;

  if (dosage && !ageWarn?.includes('사용하지 않습니다')) {
    html += `
      <div class="fever-child-info">👶 ${ageLabel} · ⚖️ ${weightVal}kg 기준</div>
      <div class="dosage-grid">
        <div class="dosage-box"><div class="dosage-val">${dosage.ml}</div><div class="dosage-unit">mL / 1회</div></div>
        <div class="dosage-box"><div class="dosage-val">${dosage.maxDay}</div><div class="dosage-unit">하루 최대</div></div>
        <div class="dosage-box"><div class="dosage-val">${dosage.interval}</div><div class="dosage-unit">최소 간격</div></div>
      </div>
      <div class="fever-warning-box fever-warn-yellow">
        <strong>⚠️ 복용 전 확인사항</strong>
        • 복용 전 약을 충분히 흔들어주세요<br/>
        • 계량컵이나 주사기로 정확하게 재세요<br/>
        • 최소 복용 간격을 꼭 지켜주세요<br/>
        • 두 가지 해열제 교차 복용 시 간격을 확인하세요
      </div>`;
  } else if (type === 'unknown') {
    html += `<div class="fever-warning-box fever-warn-yellow">❓ 성분을 확인할 수 없어요. 라벨이 잘 보이도록 다시 찍어주세요.</div>`;
  }

  if (info.note) html += `<div class="fever-warning-box fever-warn-yellow"><strong>📝 참고</strong> ${info.note}</div>`;

  resultEl.innerHTML = html;
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
