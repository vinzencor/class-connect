const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1/sessions?select=*";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function checkSessions() {
    const res = await fetch(url, { headers: { "apikey": apiKey, "Authorization": "Bearer " + apiKey } });
    const sessions = await res.json();
    console.log("Total Sessions:", sessions.length);
    if (sessions.length > 0) {
        console.log("Latest:", sessions[sessions.length - 1]);
    }
}
checkSessions();
