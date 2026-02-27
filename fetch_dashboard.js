const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";
const aslamId = "5a719be0-5a2f-4d95-baa0-8ea8f2763bf7";
const hannaId = "3fcef416-0515-44a3-b252-0ff1d8522010";

async function fetchForStudent(studentId, name) {
    console.log(`\n--- Fetching Dashboard for ${name} ---`);
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    // 1. Get enrollments
    const resE = await fetch(url + `/class_enrollments?select=class_id&student_id=eq.${studentId}`, { headers });
    const enrollments = await resE.json();
    console.log("Enrollments:", enrollments);

    // 2. Get profile for batch_id
    const resP = await fetch(url + `/profiles?select=metadata&id=eq.${studentId}`, { headers });
    const p = await resP.json();
    const batchId = p[0]?.metadata?.batch_id;
    console.log("Batch ID:", batchId);

    // 3. Get batch classes
    if (batchId) {
        const resB = await fetch(url + `/class_batches?select=class_id&batch_id=eq.${batchId}`, { headers });
        const batchClasses = await resB.json();
        console.log("Batch Classes:", batchClasses);
    }

    // 4. Get attendance stats
    const resA = await fetch(url + `/attendance?select=date,status,class_id&student_id=eq.${studentId}`, { headers });
    const attendance = await resA.json();
    console.log(`Total Attendance Records: ${attendance.length}`);
}

async function check() {
    await fetchForStudent(aslamId, "Aslam");
    await fetchForStudent(hannaId, "Hanna");
}

check();
