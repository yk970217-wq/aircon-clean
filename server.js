require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

  res.json({ success: true, message: '견적 문의가 접수되었습니다.' });
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
