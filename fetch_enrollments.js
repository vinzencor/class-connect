const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1/class_enrollments?select=*";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function checkEnrollments() {
    const res = await fetch(url, {
        headers: {
            "apikey": apiKey,
            "Authorization": "Bearer " + apiKey
        }
    });
    const enrollments = await res.json();
    console.log("Aslam enrollments:", enrollments.filter(e => e.student_id === "5a719be0-5a2f-4d95-baa0-8ea8f2763bf7"));
    console.log("Meena enrollments:", enrollments.filter(e => e.student_id === "5a1e8ffb-f11b-43d8-b654-ddf44df544ae"));
}
checkEnrollments();
