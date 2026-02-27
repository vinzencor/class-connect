const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function loginAndFetch(email, password) {
    // 1. Auth to get JWT
    const authRes = await fetch("https://jdbxqjanhjifafjukdzd.supabase.co/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { "apikey": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (!authRes.ok) {
        console.log(`Failed to login for ${email}`);
        return;
    }
    const tokenData = await authRes.json();
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + tokenData.access_token };

    // 2. Get profile
    const pRes = await fetch(url + `/profiles?select=id,metadata&id=eq.${tokenData.user.id}`, { headers });
    const p = await pRes.json();
    const batchId = (p[0].metadata || {}).batch_id || (p[0].metadata || {}).batch;

    // 3. Get generic class batch
    const cbRes = await fetch(url + `/class_batches?select=*&batch_id=eq.${batchId}`, { headers });
    const cb = await cbRes.json();
    const classIds = cb.map(c => c.class_id);

    // 4. Get sessions
    if (classIds.length > 0) {
        const sRes = await fetch(url + `/sessions?select=id,title,start_time&class_id=in.(${classIds.join(',')})`, { headers });
        const sessions = await sRes.json();
        console.log(`${email} sees ${sessions.length} sessions for classes ${classIds.join(',')}.`);
    } else {
        console.log(`${email} has 0 classIds via class_batches for batch ${batchId}`);
    }
}

async function testRLS() {
    // We don't know the passwords, maybe we can't login.
    // Wait, the user has an admin token?
    console.log("Running...");
}
testRLS();
