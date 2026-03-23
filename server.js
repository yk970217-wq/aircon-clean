require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
if (!supabase && process.env.NODE_ENV !== 'production') {
  console.log('[Supabase] 비활성: SUPABASE_URL 또는 SUPABASE_KEY 없음');
}

// 텔레그램 알림
async function sendTelegram(message) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TG] 비활성: TELEGRAM_TOKEN 또는 TELEGRAM_CHAT_ID 없음');
    }
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    const json = await res.json();
    if (!json.ok) console.error('[TG] API 오류:', json.description || json);
  } catch (e) {
    console.error('[TG] 오류:', e.message);
  }
}

// 동일 IP+경로 빠른 연속 요청용 메모리 캐시 (CSS/JS 등 정적 파일은 제외)
const visitThrottleCache = new Map();

/** 브라우저가 함께 요청하는 정적 리소스 — 부정클릭 카운트에서 제외 */
const STATIC_ASSET_PATH =
  /\.(css|js|mjs|map|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|json|xml|txt)(\?.*)?$/i;

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 부정클릭 감지 미들웨어 (HTML 등 문서만 — 정적 파일은 제외 / 같은 URL만 짧은 간격 제한)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  if (STATIC_ASSET_PATH.test(req.path)) return next();

  const ip = getClientIP(req);
  const now = Date.now();
  const throttleKey = `${ip}|${req.path}`;
  const last = visitThrottleCache.get(throttleKey);

  if (last && (now - last) < 10000) {
    return res.status(429).send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>경고</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a0a;
            font-family: 'Pretendard', sans-serif;
            color: #fff;
          }
          .box {
            text-align: center;
            padding: 60px 40px;
            border-radius: 20px;
            border: 1px solid rgba(255,60,60,0.3);
            background: rgba(255,30,30,0.08);
            max-width: 400px;
          }
          .icon { font-size: 3.5rem; margin-bottom: 20px; }
          h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 12px; color: #ff4444; }
          p { font-size: 0.95rem; color: rgba(255,255,255,0.7); line-height: 1.7; }
          .ip { margin-top: 20px; font-size: 0.8rem; color: rgba(255,255,255,0.35); }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="icon">🚨</div>
          <h1>부정클릭이 감지되었습니다</h1>
          <p>비정상적인 반복 접속이 감지되었습니다.<br>해당 IP는 기록되며 신고될 수 있습니다.</p>
          <p class="ip">접속 IP: ${ip}</p>
        </div>
      </body>
      </html>
    `);
  }

  visitThrottleCache.set(throttleKey, now);

  if (supabase) {
    supabase
      .from('visitors')
      .insert([{ ip, path: req.path }])
      .catch((e) => console.error('[visitors] insert:', e.message));
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 예약 저장용 (실제 운영시 DB로 교체)
const bookings = [];

// 예약 API
app.post('/api/booking', (req, res) => {
  const { name, phone, address, service, date, memo } = req.body;

  if (!name || !phone || !address || !service || !date) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  const booking = {
    id: Date.now(),
    name,
    phone,
    address,
    service,
    date,
    memo: memo || '',
    createdAt: new Date().toISOString(),
    status: '접수완료'
  };

  bookings.push(booking);

  console.log('새 예약:', booking);

  sendTelegram(`📅 <b>새 예약 접수!</b>\n👤 이름: ${name}\n📞 전화: ${phone}\n📍 주소: ${address}\n🔧 서비스: ${service}\n📆 날짜: ${date}${memo ? `\n📝 메모: ${memo}` : ''}`);

  res.json({
    success: true,
    message: '예약이 완료되었습니다. 빠른 시간 내에 연락드리겠습니다.',
    bookingId: booking.id
  });
});

// 문의 API
app.post('/api/contact', (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  console.log('문의 접수:', { name, phone, message, time: new Date().toISOString() });

  sendTelegram(`💬 <b>새 문의 접수!</b>\n👤 이름: ${name}\n📞 전화: ${phone}\n📝 내용: ${message}`);

  res.json({
    success: true,
    message: '문의가 접수되었습니다. 24시간 내에 답변드리겠습니다.'
  });
});

// 대량 견적 문의 API
app.post('/api/bulk-inquiry', (req, res) => {
  const { name, phone, company, type, count, date, address, memo } = req.body;

  if (!name || !phone || !company || !count || !address) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  const inquiry = {
    id: Date.now(),
    name, phone, company, type, count, date,
    address, memo: memo || '',
    createdAt: new Date().toISOString(),
    status: '접수완료'
  };

  console.log('대량 견적 문의:', inquiry);

  sendTelegram(`🏢 <b>대량 견적 문의!</b>\n📞 전화: ${phone}\n🔢 대수: ${count}대${memo ? `\n📝 메모: ${memo}` : ''}`);

  res.json({ success: true, message: '견적 문의가 접수되었습니다.' });
});

// 체류시간 업데이트
app.post('/api/visit/end', express.text({ type: '*/*' }), async (req, res) => {
  let visit_id, stay_seconds;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    visit_id = body.visit_id;
    stay_seconds = body.stay_seconds;
  } catch { return res.sendStatus(204); }

  if (!visit_id || !stay_seconds) return res.sendStatus(204);
  if (!supabase) return res.sendStatus(204);
  try {
    await supabase
      .from('visitors')
      .update({ stay_seconds })
      .eq('visit_id', visit_id);
  } catch (e) {
    console.error('[visitors] update:', e.message);
  }
  res.sendStatus(204);
});

// 예약 목록 (관리자용)
app.get('/api/admin/bookings', (req, res) => {
  res.json(bookings);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
