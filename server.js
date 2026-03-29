require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function sendTelegramMessage(lines) {
  if (!telegramToken || !telegramChatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: lines.join('\n'),
      }),
    });

    if (!response.ok) {
      console.error('Telegram send failed:', await response.text());
    }
  } catch (error) {
    console.error('Telegram send failed:', error);
  }
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const acceptHeader = req.headers.accept || '';
  const isHtmlRequest = acceptHeader.includes('text/html');
  const isApiRequest = req.path.startsWith('/api');
  const fileExtension = path.extname(req.path);
  const isPageRequest = req.path === '/' || fileExtension === '.html';

  if (req.method === 'GET' && isHtmlRequest && !isApiRequest && isPageRequest) {
    if (supabase) {
      supabase
        .from('visitors')
        .insert([
          {
            ip: getClientIp(req),
            path: req.path || '/',
          },
        ])
        .then(({ error }) => {
          if (error) {
            console.error('Visitor log failed:', error);
          }
        })
        .catch((error) => {
          console.error('Visitor log failed:', error);
        });
    }
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/booking', async (req, res) => {
  const {
    name,
    phone,
    address,
    service,
    date,
    timeSlot,
    count,
    discountRate,
    estimatedPrice,
    memo,
    serviceItems,
  } = req.body;

  if (!name || !phone || !address || !service || !date) {
    return res.status(400).json({
      success: false,
      message: '필수 항목을 모두 입력해주세요.',
    });
  }

  const bookingCount = Math.max(1, parseInt(count, 10) || 1);
  const appliedDiscountRate = Number(discountRate) || 0;

  let itemsLine = null;
  if (Array.isArray(serviceItems) && serviceItems.length > 0) {
    itemsLine = serviceItems
      .map((row) => {
        const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : row.line || '';
        const q = Math.max(1, parseInt(row.qty, 10) || 1);
        return label ? `${label} ×${q}대` : null;
      })
      .filter(Boolean)
      .join(', ');
  }

  const memoLines = [
    timeSlot ? `희망 시간대: ${timeSlot}` : null,
    itemsLine ? `에어컨 내역: ${itemsLine}` : null,
    `대수: ${bookingCount}대`,
    `할인율: ${appliedDiscountRate}%`,
    estimatedPrice ? `예상 견적: ${estimatedPrice}` : null,
    memo ? `요청사항: ${memo}` : null,
  ].filter(Boolean);

  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: '예약 시스템 설정이 아직 완료되지 않았습니다.',
    });
  }

  const { data, error } = await getSupabase()
    .from('bookings')
    .insert([
      {
        name: String(name).trim(),
        phone,
        address,
        service,
        date,
        memo: memoLines.join('\n'),
        time_slot: timeSlot || '',
        count: bookingCount,
        discount_rate: appliedDiscountRate,
        estimated_price: estimatedPrice ? String(estimatedPrice) : '',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Booking insert failed:', error);
    return res.status(500).json({
      success: false,
      message: '예약 처리 중 오류가 발생했습니다.',
    });
  }

  await sendTelegramMessage(
    [
      '[예약 접수]',
      `이름: ${name}`,
      `연락처: ${phone}`,
      `주소: ${address}`,
      `서비스: ${service}`,
      itemsLine ? `에어컨 내역: ${itemsLine}` : '',
      `대수: ${bookingCount}대`,
      `희망 날짜: ${date}`,
      `희망 시간대: ${timeSlot || '-'}`,
      `할인율: ${appliedDiscountRate}%`,
      `예상 견적: ${estimatedPrice || '-'}`,
      `요청사항: ${memo || '-'}`,
      `예약번호: ${data.id}`,
    ].filter((line) => line !== '')
  );

  res.json({
    success: true,
    message: '예약이 완료되었습니다. 빠른 시간 안에 연락드리겠습니다.',
    bookingId: data.id,
  });
});

app.post('/api/contact', async (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({
      success: false,
      message: '필수 항목을 모두 입력해주세요.',
    });
  }

  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: '문의 시스템 설정이 아직 완료되지 않았습니다.',
    });
  }

  const { error } = await getSupabase().from('contacts').insert([{ name, phone, message }]);

  if (error) {
    console.error('Contact insert failed:', error);
    return res.status(500).json({
      success: false,
      message: '문의 처리 중 오류가 발생했습니다.',
    });
  }

  await sendTelegramMessage([
    '[일반 문의 접수]',
    `이름: ${name}`,
    `연락처: ${phone}`,
    `문의내용: ${message}`,
  ]);

  res.json({
    success: true,
    message: '문의가 접수되었습니다. 24시간 내에 답변드리겠습니다.',
  });
});

app.post('/api/bulk-inquiry', async (req, res) => {
  const { phone, count, memo } = req.body;

  if (!phone || !count) {
    return res.status(400).json({
      success: false,
      message: '필수 항목을 모두 입력해주세요.',
    });
  }

  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: '견적 시스템 설정이 아직 완료되지 않았습니다.',
    });
  }

  const { error } = await getSupabase()
    .from('bulk_inquiries')
    .insert([{ phone, count: parseInt(count, 10), memo: memo || '' }]);

  if (error) {
    console.error('Bulk inquiry insert failed:', error);
    return res.status(500).json({
      success: false,
      message: '견적 문의 처리 중 오류가 발생했습니다.',
    });
  }

  await sendTelegramMessage([
    '[대량 견적 문의 접수]',
    `연락처: ${phone}`,
    `수량: ${count}`,
    `메모: ${memo || '-'}`,
  ]);

  res.json({
    success: true,
    message: '견적 문의가 접수되었습니다.',
  });
});

app.get('/api/admin/bookings', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: '관리자 조회 시스템 설정이 아직 완료되지 않았습니다.',
    });
  }

  const { data, error } = await getSupabase()
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      success: false,
      message: '데이터 조회 오류',
    });
  }

  res.json(data);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  if (!hasSupabaseConfig) {
    console.warn('Supabase env vars are missing. API writes are disabled until configured.');
  }
  console.log(`Server running on http://localhost:${PORT}`);
});
