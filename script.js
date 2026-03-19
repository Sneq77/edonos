// --- Smooth scroll ---
function scrollToForm() {
  const target = document.getElementById('kontakt');
  const startPosition = window.pageYOffset;
  const targetPosition = target.getBoundingClientRect().top + startPosition;
  const distance = targetPosition - startPosition;
  const duration = 1000; // 1 sekunda
  let start = null;

  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    const percent = Math.min(progress / duration, 1);
    const ease = percent < 0.5 ? 2 * percent * percent : -1 + (4 - 2 * percent) * percent;
    window.scrollTo(0, startPosition + distance * ease);
    if (progress < duration) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

// ===============================
// Supabase Config
// ===============================
const SUPABASE_URL = "https://supabase.com/dashboard/project/vnwljzkrvwjrhgupomqy/settings/api-keys";
const SUPABASE_KEY = "sb_publishable_UEnhybLATVgudhPkTsM6rg__la-POo7";
let sessionToken = null; // Discord ID użytkownika

// ===============================
// Discord OAuth login
// ===============================
function loginDiscord() {
  const clientId = '1484143164251045928';
  const redirectUri = encodeURIComponent('https://twoja-strona.github.io/oauth-callback.html');
  const scope = 'identify';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  window.location.href = url;
}

// ===============================
// Obsługa callback po OAuth
// ===============================
async function handleDiscordCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  // Wywołanie Supabase Edge Function, która wymienia code na token i zwraca Discord ID
  try {
    const res = await fetch(`https://twoja-funkcja.supabase.co/discord-oauth?code=${code}`);
    const data = await res.json();
    sessionToken = data.discord_id; // Discord ID użytkownika
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('kontakt').style.display = 'block';
    loadReports(); // wczytanie zgłoszeń użytkownika
  } catch (err) {
    console.error('Błąd podczas logowania Discord:', err);
  }
}

// ===============================
// Generowanie ID zgłoszenia
// ===============================
function generateID(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ===============================
// Wysyłka zgłoszenia do Supabase
// ===============================
async function submitForm(e) {
  e.preventDefault();
  const form = document.getElementById('reportForm');
  const title = form.title.value;
  const message = form.message.value;
  const email = form.email.value || null;

  if (!sessionToken) return alert('Zaloguj się przez Discord!');

  const reportID = generateID();

  // 1. Stwórz wpis w reports
  const reportRes = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: sessionToken,
      title: title
    })
  });
  const reportData = await reportRes.json();
  const createdReportID = reportData[0].id;

  // 2. Dodaj pierwszą wiadomość (treść zgłoszenia)
  await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      report_id: createdReportID,
      sender: 'user',
      content: message
    })
  });

  document.getElementById('status').innerText = `Zgłoszenie wysłane! Twój ID: ${reportID}`;
  document.getElementById('chatSection').style.display = 'block';
  form.reset();
  loadReports();
}

// ===============================
// Wczytanie zgłoszeń użytkownika
// ===============================
async function loadReports() {
  if (!sessionToken) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?user_id=eq.${sessionToken}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const reports = await res.json();
  const reportsDiv = document.getElementById('reports');
  reportsDiv.innerHTML = reports.map(r => `<div onclick="loadChat('${r.id}')">${r.title}</div>`).join('');
}

// ===============================
// Chat / odpowiedzi powiązane z ID
// ===============================
let currentReportId = null;
async function loadChat(reportId) {
  currentReportId = reportId;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?report_id=eq.${reportId}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const messages = await res.json();
  document.getElementById('chat').innerHTML = messages.map(m => `<div><b>${m.sender}:</b> ${m.content}</div>`).join('');
}

async function sendReply() {
  const replyMessage = document.getElementById('replyMessage').value;
  if (!currentReportId || !replyMessage) {
    document.getElementById('chatStatus').innerText = 'Wybierz zgłoszenie i wpisz wiadomość!';
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      report_id: currentReportId,
      sender: 'user',
      content: replyMessage
    })
  });

  document.getElementById('chatStatus').innerText = 'Odpowiedź wysłana!';
  document.getElementById('replyMessage').value = '';
  loadChat(currentReportId);
}

// ===============================
// Parallax tła hero
// ===============================
window.addEventListener('scroll', () => {
  const hero = document.querySelector('.hero');
  if (hero) {
    const offset = window.pageYOffset;
    hero.style.backgroundPositionY = offset * 0.5 + "px";
  }
});

// ===============================
// Wywołanie po załadowaniu strony
// ===============================
window.onload = function() {
  handleDiscordCallback();
};
// Po powrocie z Discord OAuth
async function handleDiscordCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  try {
    // Wywołanie Supabase Edge Function, która wymienia code na token i zwraca Discord ID
    const res = await fetch(`https://twoja-funkcja.supabase.co/discord-oauth?code=${code}`);
    const data = await res.json();
    sessionToken = data.discord_id; // Discord ID użytkownika

    // Ukrycie przycisku logowania
    document.getElementById('login-section').style.display = 'none';
    
    // Pokaż przycisk "Zgłoś sprawę" w hero
    const zglośBtn = document.getElementById('zglos');
    if (zglośBtn) zglośBtn.style.display = 'inline-block';

    // Pokaż formularz kontaktowy
    document.getElementById('kontakt').style.display = 'block';
    
    // Wczytaj zgłoszenia użytkownika
    loadReports();
  } catch (err) {
    console.error('Błąd podczas logowania Discord:', err);
  }
}

async function handleDiscordCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  try {
    const res = await fetch(`https://twoja-funkcja.supabase.co/discord-oauth?code=${code}`);
    const data = await res.json();
    sessionToken = data.discord_id; // Discord ID użytkownika

    // Zmień przycisk w hero na "Zgłoś sprawę"
    const heroBtn = document.getElementById('heroButton');
    if (heroBtn) {
      heroBtn.innerText = "Zgłoś sprawę";
      heroBtn.onclick = scrollToForm;
    }

    // Pokaż formularz kontaktowy
    document.getElementById('kontakt').style.display = 'block';
    loadReports(); // wczytanie zgłoszeń użytkownika
  } catch (err) {
    console.error('Błąd podczas logowania Discord:', err);
  }
}
