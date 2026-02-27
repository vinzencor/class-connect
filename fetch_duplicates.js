const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function checkDuplicates() {
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    const res = await fetch(url + `/profiles?select=id,email,full_name,metadata&email=eq.aslam@gmail.com`, { headers });
    const aslamProfiles = await res.json();
    console.log("Aslam Profiles:", aslamProfiles);

    for (const p of aslamProfiles) {
        const resA = await fetch(url + `/attendance?select=id&student_id=eq.${p.id}`, { headers });
        const a = await resA.json();
        console.log(`Profile ${p.id} has ${a.length} attendance records`);

        const resE = await fetch(url + `/class_enrollments?select=id&student_id=eq.${p.id}`, { headers });
        const e = await resE.json();
        console.log(`Profile ${p.id} has ${e.length} class_enrollments records`);
    }
}
checkDuplicates();
