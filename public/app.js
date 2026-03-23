// ===== 히어로 키커 타이핑 (반복) =====
(function () {
  const el = document.getElementById('heroKickerType');
  const cursor = document.querySelector('.hero-kicker-cursor');
  if (!el) return;

  const full = '이런 불편함, 익숙해지셨나요?';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAUSE_AFTER_DONE_MS = 2800;
  const GAP_BEFORE_RESTART_MS = 450;
  const START_DELAY_MS = 320;

  if (reduce) {
    el.textContent = full;
    if (cursor) {
      cursor.classList.add('is-done');
      cursor.style.opacity = '0';
      cursor.style.width = '0';
    }
    return;
  }

  let i = 0;
  const baseDelay = 68;

  function restart() {
    if (cursor) cursor.classList.remove('is-done');
    el.textContent = '';
    i = 0;
    window.setTimeout(step, GAP_BEFORE_RESTART_MS);
  }

  function step() {
    el.textContent = full.slice(0, i);
    if (i >= full.length) {
      if (cursor) cursor.classList.add('is-done');
      window.setTimeout(restart, PAUSE_AFTER_DONE_MS);
      return;
    }
    const ch = full[i];
    i += 1;
    let delay = baseDelay;
    if (ch === ' ' || ch === ',' || ch === '?') delay += 150;
    window.setTimeout(step, delay);
  }

  window.setTimeout(step, START_DELAY_MS);
})();

// ===== 왜 클린베어 통계 숫자 카운트업 (반복) =====
(function () {
  const nodes = document.querySelectorAll('.why-stat-num');
  if (!nodes.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION_MS = 1500;
  const PAUSE_MS = 2600;
  const RESET_MS = 350;

  const items = Array.from(nodes).map((el) => {
    const target = Number(el.dataset.target) || 0;
    const comma = el.dataset.format === 'comma';
    const fmt = (n) => (comma ? Math.round(n).toLocaleString('ko-KR') : String(Math.round(n)));
    return { el, target, fmt };
  });

  function setToFinal() {
    items.forEach(({ el, target, fmt }) => {
      el.textContent = fmt(target);
    });
  }

  function setToZero() {
    items.forEach(({ el, fmt }) => {
      el.textContent = fmt(0);
    });
  }

  if (reduce) {
    setToFinal();
    return;
  }

  function runCycle() {
    const t0 = performance.now();
    function frame(now) {
      const raw = Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - Math.pow(1 - raw, 2.75);
      items.forEach(({ el, target, fmt }) => {
        el.textContent = fmt(target * eased);
      });
      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        setToFinal();
        window.setTimeout(() => {
          setToZero();
          window.setTimeout(runCycle, RESET_MS);
        }, PAUSE_MS);
      }
    }
    requestAnimationFrame(frame);
  }

  runCycle();
})();

// ===== 서비스 배너 자동 슬라이더 =====
(function () {
  const slides = document.querySelectorAll('.svc-slide');
  const navBtns = document.querySelectorAll('.svc-nav-btn');
  if (!slides.length) return;

  let current = 0;
  let timer = null;
  const INTERVAL = 15000;

  function goTo(index) {
    slides[current].classList.remove('active');
    navBtns[current].classList.remove('active');
    // 프로그레스 바 리셋
    navBtns[current].style.transition = 'none';
    navBtns[current].style.setProperty('--prog', '0%');

    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    navBtns[current].classList.add('active');

    // 프로그레스 바 애니메이션
    const btn = navBtns[current];
    btn.style.transition = 'none';
    // 강제 리플로우 후 transition 적용
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        btn.style.transition = `all 0.2s`;
      });
    });
  }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), INTERVAL);
  }

  function stopAuto() { clearInterval(timer); }

  navBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      stopAuto();
      goTo(i);
      startAuto();
    });
    btn.addEventListener('mouseenter', stopAuto);
    btn.addEventListener('mouseleave', startAuto);
  });

  document.getElementById('svcBanner')?.addEventListener('mouseenter', stopAuto);
  document.getElementById('svcBanner')?.addEventListener('mouseleave', startAuto);

  goTo(0);
  startAuto();
})();

// ===== 서비스 탭 전환 =====
function switchPhoto(img, newSrc, cb) {
  img.classList.add('switching');
  setTimeout(() => {
    img.src = newSrc;
    img.onload = () => { img.classList.remove('switching'); if (cb) cb(); };
  }, 220);
}

function switchStand(type, btn) {
  btn.closest('.svc-tabs').querySelectorAll('.svc-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  const img   = document.getElementById('standImg');
  const price = document.getElementById('standPrice');
  const desc  = document.getElementById('standDesc');
  if (type === 'home') {
    switchPhoto(img, 'images/svc-stand-home.png');
    price.textContent = '130,000원~';
    desc.textContent  = '가정용 스탠드 에어컨 내부 깊숙이 쌓인 먼지와 곰팡이를 분리세척으로 완벽하게 제거합니다.';
  } else {
    switchPhoto(img, 'images/svc-stand-biz.png');
    price.textContent = '130,000원~';
    desc.textContent  = '업소용 대형 스탠드 에어컨을 전문 분해 후 고압세척합니다. 현장 규모에 맞게 맞춤 견적을 제공합니다.';
  }
}

function switchCeil(type, btn) {
  btn.closest('.svc-tabs').querySelectorAll('.svc-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  const img   = document.getElementById('ceilImg');
  const price = document.getElementById('ceilPrice');
  const desc  = document.getElementById('ceilDesc');
  const map = {
    '1way': { src: 'images/svc-ceil-1way.png', price: '100,000원~',   desc: '1WAY 천장 카세트형 에어컨을 전문 분해 후 고압세척합니다.' },
    '2way': { src: 'images/svc-ceil-2way.png', price: '110,000원~',  desc: '2WAY 천장형 에어컨을 전문 분해 후 고압세척합니다.' },
    '4way': { src: 'images/svc-ceil-4way.png', price: '130,000원~',  desc: '4WAY 카세트형 에어컨을 전문 분해 후 고압세척합니다.' },
  };
  const d = map[type];
  switchPhoto(img, d.src);
  price.textContent = d.price;
  desc.textContent  = d.desc;
}

// ===== 헤더 스크롤 효과 =====
const header = document.getElementById('header');
const scrollTopBtn = document.getElementById('scrollTop');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  if (window.scrollY > 400) {
    scrollTopBtn.classList.add('visible');
  } else {
    scrollTopBtn.classList.remove('visible');
  }
});

// ===== 상단 이동 =====
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== 모바일 메뉴 =====
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
}

// ===== 날짜 최솟값 설정 (오늘 이후만 선택) =====
const dateInput = document.getElementById('date');
if (dateInput) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
}

// ===== 예약 폼 제출 (booking.html 등 폼이 있는 페이지만) =====
const bookingForm = document.getElementById('bookingForm');
const bookingResult = document.getElementById('bookingResult');

if (bookingForm && bookingResult) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = bookingForm.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '처리 중...';
    submitBtn.disabled = true;

    const formData = {
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
      service: document.getElementById('service').value,
      date: document.getElementById('date').value,
      memo: document.getElementById('memo').value,
    };

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      bookingResult.classList.remove('hidden', 'success', 'error');

      if (result.success) {
        bookingResult.classList.add('success');
        bookingResult.innerHTML = `
        <div style="font-size:2rem;margin-bottom:8px">✅</div>
        <strong>${result.message}</strong><br>
        <small style="opacity:0.8;margin-top:4px;display:block">예약번호: #${result.bookingId}</small>
      `;
        bookingForm.reset();
      } else {
        bookingResult.classList.add('error');
        bookingResult.innerHTML = `<div style="font-size:1.5rem;margin-bottom:8px">❌</div>${result.message}`;
      }
    } catch (err) {
      bookingResult.classList.remove('hidden');
      bookingResult.classList.add('error');
      bookingResult.innerHTML = `<div style="font-size:1.5rem;margin-bottom:8px">❌</div>서버 연결에 실패했습니다. 전화로 문의해주세요.<br><a href="tel:0507-1304-6329" style="color:inherit;font-weight:700">📞 0507-1304-6329</a>`;
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      bookingResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// ===== 갤러리 무한 마퀴 (시퀀스 복제 + 한 세트 너비만큼 translate, flex gap 보정) =====
(function () {
  const track = document.getElementById('galleryMarqueeTrack');
  if (!track) return;

  const originals = Array.from(track.querySelectorAll('.gallery-marquee-item'));
  if (originals.length === 0) return;

  originals.forEach((node) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => {
      img.setAttribute('aria-hidden', 'true');
      img.alt = '';
    });
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function measureMarqueeDx() {
    const items = track.querySelectorAll('.gallery-marquee-item');
    const half = items.length / 2;
    if (!half) return;
    const gap = parseFloat(getComputedStyle(track).gap) || 14;
    let dx = 0;
    for (let i = 0; i < half; i++) {
      dx += items[i].getBoundingClientRect().width;
      if (i < half - 1) dx += gap;
    }
    dx += gap;
    track.style.setProperty('--gallery-marquee-dx', `-${dx}px`);
  }

  if (!reduce) {
    const schedule = () => requestAnimationFrame(measureMarqueeDx);
    schedule();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(schedule).observe(track);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule, { once: true });
  }
})();

// ===== 스크롤 애니메이션 =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// 애니메이션 대상 요소들
const animateElements = document.querySelectorAll(
  '.service-card, .why-item, .review-card, .process-step, .guarantee-box'
);

animateElements.forEach((el, index) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = `opacity 0.6s ease ${index * 0.05}s, transform 0.6s ease ${index * 0.05}s`;
  observer.observe(el);
});

// ===== 지점 더보기 =====
function toggleBranchMore() {
  const wrap = document.getElementById('branchMoreWrap');
  const btn = document.getElementById('branchMoreBtn');
  const isHidden = wrap.style.display === 'none';
  wrap.style.display = isHidden ? 'contents' : 'none';
  btn.innerHTML = isHidden ? '접기 <span>−</span>' : '더보기 <span>+</span>';
}

// ===== 지점 필터 =====
(function () {
  const filterBtns = document.querySelectorAll('.branch-filter');
  const cards = document.querySelectorAll('.branch-card');
  const resultCount = document.getElementById('branchResultCount');

  if (!filterBtns.length) return;

  function updateCount(visible) {
    if (resultCount) resultCount.textContent = `${visible}개 지점`;
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const region = btn.dataset.region;
      let count = 0;
      cards.forEach((card) => {
        const match = region === 'all' || card.dataset.region === region;
        card.classList.toggle('hidden', !match);
        if (match) count++;
      });
      updateCount(count);
    });
  });

  updateCount(cards.length);
})();

// ===== 전화번호 자동 하이픈 입력 =====
const phoneInput = document.getElementById('phone');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length >= 7) {
      value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
    } else if (value.length >= 4) {
      value = value.slice(0, 3) + '-' + value.slice(3);
    }
    e.target.value = value;
  });
}

// ===== 왜 클린베어 슬라이더 (넓은 화면 2장씩, 좁은 화면 1장씩) =====
(function () {
  const track = document.getElementById('whyTrack');
  const dotsWrap = document.getElementById('whyDots');
  const prevBtn = document.getElementById('whyPrev');
  const nextBtn = document.getElementById('whyNext');
  if (!track || !dotsWrap) return;

  const cards = track.querySelectorAll('.why-card');
  const total = cards.length;
  if (total === 0) return;

  let current = 0;
  let timer = null;
  const INTERVAL = 4200;
  const mqNarrow = window.matchMedia('(max-width: 600px)');

  function visibleCount() {
    return mqNarrow.matches ? 1 : 2;
  }

  function stepsCount() {
    return Math.max(1, total - visibleCount() + 1);
  }

  function gapPx() {
    const g = getComputedStyle(track).gap;
    const n = parseFloat(g);
    return Number.isFinite(n) ? n : 16;
  }

  function buildDots() {
    dotsWrap.innerHTML = '';
    const steps = stepsCount();
    for (let i = 0; i < steps; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'why-dot';
      b.setAttribute('aria-label', `카드 ${i + 1}번째 묶음`);
      b.dataset.index = String(i);
      b.addEventListener('click', () => {
        stopAuto();
        goTo(i);
        startAuto();
      });
      dotsWrap.appendChild(b);
    }
  }

  function syncDots() {
    dotsWrap.querySelectorAll('.why-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function goTo(idx) {
    const steps = stepsCount();
    current = ((idx % steps) + steps) % steps;
    const cardW = cards[0].getBoundingClientRect().width;
    const gap = gapPx();
    track.style.transform = `translateX(-${current * (cardW + gap)}px)`;
    syncDots();
  }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), INTERVAL);
  }

  function stopAuto() {
    clearInterval(timer);
  }

  function onLayoutChange() {
    const steps = stepsCount();
    current = Math.min(current, steps - 1);
    buildDots();
    requestAnimationFrame(() => goTo(current));
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stopAuto();
      goTo(current - 1);
      startAuto();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stopAuto();
      goTo(current + 1);
      startAuto();
    });
  }

  let tx = 0;
  track.addEventListener('touchstart', (e) => {
    tx = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const diff = tx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      stopAuto();
      goTo(diff > 0 ? current + 1 : current - 1);
      startAuto();
    }
  }, { passive: true });

  mqNarrow.addEventListener('change', () => {
    onLayoutChange();
    startAuto();
  });

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => goTo(current), 120);
  });

  buildDots();
  goTo(0);
  startAuto();
})();

// ===== 고객 후기 — 가로 무한 마퀴(트랙 복제) =====
(function () {
  const inner = document.getElementById('rvMarqueeInner');
  const track = document.getElementById('rvTrack');
  if (!inner || !track) return;
  const clone = track.cloneNode(true);
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  inner.appendChild(clone);
})();

// ===== 평점 요약 배너: 별 1→5 점등 + 숫자 카운트업 + 완료 시 흔들림 =====
(function () {
  const summary = document.getElementById('rvSummaryBanner');
  const sumNumEl = document.getElementById('rvSumNum');
  const reviewsEl = document.getElementById('rvCountReviews');
  const reuseEl = document.getElementById('rvCountReuse');
  const satEl = document.getElementById('rvCountSat');
  if (!summary || !sumNumEl || !reviewsEl || !reuseEl || !satEl) return;

  const stars = summary.querySelectorAll('.rv-star');
  if (stars.length !== 5) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function animateNumber(el, from, to, duration, format) {
    const start = performance.now();
    return new Promise(resolve => {
      function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const v = from + (to - from) * easeOutCubic(p);
        el.textContent = format(v, p >= 1);
        if (p < 1) requestAnimationFrame(frame);
        else {
          el.textContent = format(to, true);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function runStars() {
    return new Promise(resolve => {
      let i = 0;
      function next() {
        if (i < stars.length) {
          stars[i].classList.add('rv-star--lit');
          i += 1;
          setTimeout(next, 42);
        } else resolve();
      }
      next();
    });
  }

  function setFinalValues() {
    const tr = parseFloat(sumNumEl.dataset.target || '4.9', 10);
    const rv = parseInt(reviewsEl.dataset.target || '320', 10);
    const ru = parseInt(reuseEl.dataset.target || '98', 10);
    const st = parseInt(satEl.dataset.target || '100', 10);
    sumNumEl.textContent = Number.isFinite(tr) ? tr.toFixed(1) : '4.9';
    reviewsEl.textContent = String(rv);
    reuseEl.textContent = String(ru);
    satEl.textContent = String(st);
    stars.forEach(s => s.classList.add('rv-star--lit'));
  }

  async function play() {
    stars.forEach(s => s.classList.remove('rv-star--lit'));
    sumNumEl.textContent = '1';
    reviewsEl.textContent = '0';
    reuseEl.textContent = '0';
    satEl.textContent = '0';

    const targetRating = parseFloat(sumNumEl.dataset.target || '4.9', 10);
    const targetReviews = parseInt(reviewsEl.dataset.target || '320', 10);
    const targetReuse = parseInt(reuseEl.dataset.target || '98', 10);
    const targetSat = parseInt(satEl.dataset.target || '100', 10);

    const DURATION_MS = 680;

    await Promise.all([
      runStars(),
      animateNumber(sumNumEl, 1, targetRating, DURATION_MS, (v, done) =>
        (done ? targetRating : v).toFixed(1)),
      animateNumber(reviewsEl, 0, targetReviews, DURATION_MS, (v, done) =>
        String(done ? targetReviews : Math.round(v))),
      animateNumber(reuseEl, 0, targetReuse, DURATION_MS, (v, done) =>
        String(done ? targetReuse : Math.round(v))),
      animateNumber(satEl, 0, targetSat, DURATION_MS, (v, done) =>
        String(done ? targetSat : Math.round(v))),
    ]);

    summary.classList.add('rv-summary--celebrate');
    summary.addEventListener(
      'animationend',
      () => summary.classList.remove('rv-summary--celebrate'),
      { once: true }
    );
  }

  let ran = false;
  function start() {
    if (ran) return;
    ran = true;
    if (reduceMotion) {
      setFinalValues();
      return;
    }
    play();
  }

  const io = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) start();
    },
    { threshold: 0.2 }
  );
  io.observe(summary);

  requestAnimationFrame(() => {
    const r = summary.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) start();
  });
})();
