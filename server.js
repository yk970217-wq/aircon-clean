require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 텔레그램 알림
async function sendTelegram(message) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('텔레그램 전송 오류:', e.message);
  }
}

// IP 빠른 조회용 메모리 캐시
const ipCache = new Map();

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 부정클릭 감지 미들웨어
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();

  const ip = getClientIP(req);
  const now = Date.now();
  const last = ipCache.get(ip);

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

  ipCache.set(ip, now);

  // 랜덤 visit_id 생성 후 쿠키 세팅
  const visitId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.cookie('visit_id', visitId, { maxAge: 3600000, httpOnly: false });

  // Supabase에 방문 기록 저장 (비동기)
  supabase.from('visitors').insert([{ ip, path: req.path, visit_id: visitId }]).then();

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 예약 API
app.post('/api/booking', async (req, res) => {
  const { name, phone, address, service, date, memo } = req.body;

  if (!name || !phone || !address || !service || !date) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert([{ name, phone, address, service, date, memo: memo || '' }])
    .select()
    .single();

  if (error) {
    console.error('예약 저장 오류:', error);
    return res.status(500).json({ success: false, message: '예약 저장 중 오류가 발생했습니다.' });
  }

  console.log('새 예약:', data);

  sendTelegram(`📅 <b>새 예약 접수!</b>\n👤 이름: ${name}\n📞 전화: ${phone}\n📍 주소: ${address}\n🔧 서비스: ${service}\n📆 날짜: ${date}${memo ? `\n📝 메모: ${memo}` : ''}`);

  res.json({
    success: true,
    message: '예약이 완료되었습니다. 빠른 시간 내에 연락드리겠습니다.',
    bookingId: data.id
  });
});

// 문의 API
app.post('/api/contact', async (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  const { error } = await supabase
    .from('contacts')
    .insert([{ name, phone, message }]);

  if (error) {
    console.error('문의 저장 오류:', error);
    return res.status(500).json({ success: false, message: '문의 저장 중 오류가 발생했습니다.' });
  }

  console.log('문의 접수:', { name, phone, message });

  sendTelegram(`💬 <b>새 문의 접수!</b>\n👤 이름: ${name}\n📞 전화: ${phone}\n📝 내용: ${message}`);

  res.json({
    success: true,
    message: '문의가 접수되었습니다. 24시간 내에 답변드리겠습니다.'
  });
});

// 대량 견적 문의 API
app.post('/api/bulk-inquiry', async (req, res) => {
  const { phone, count, memo } = req.body;

  if (!phone || !count) {
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력해주세요.' });
  }

  const { error } = await supabase
    .from('bulk_inquiries')
    .insert([{ phone, count: parseInt(count), memo: memo || '' }]);

  if (error) {
    console.error('대량 견적 저장 오류:', error);
    return res.status(500).json({ success: false, message: '견적 문의 저장 중 오류가 발생했습니다.' });
  }

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
  await supabase.from('visitors').update({ stay_seconds }).eq('visit_id', visit_id);
  res.sendStatus(204);
});

// 예약 목록 (관리자용)
app.get('/api/admin/bookings', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ success: false, message: '데이터 조회 오류' });
  }

  res.json(data);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
