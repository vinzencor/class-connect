const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function hunt() {
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    // Find who has attendance
    const resA = await fetch(url + `/attendance?select=student_id`, { headers });
    const attendance = await resA.json();

    const counts = {};
    for (const a of attendance) {
        counts[a.student_id] = (counts[a.student_id] || 0) + 1;
    }

    console.log("Attendance counts by student_id:");
    for (const [id, count] of Object.entries(counts)) {
        console.log(`- ${id}: ${count}`);
        if (count === 7 || count === 6 || count > 0) {
            // Get profile
            const resP = await fetch(url + `/profiles?select=email,full_name,metadata&id=eq.${id}`, { headers });
            const p = await resP.json();
            console.log(`  Profile for ${id}:`, p[0]);
        }
    }
}
hunt();
