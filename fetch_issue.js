const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function check() {
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    // Get Hanna and Meena
    const resProfiles = await fetch(url + "/profiles?select=id,email,full_name,metadata&email=in.(hanna@gmail.com,meenaakshyyy@gmail.com,aslam@gmail.com)", { headers });
    const profiles = await resProfiles.json();
    console.log("Profiles:", profiles);

    // Get class enrollments for these
    const ids = profiles.map(p => p.id);
    const resEnroll = await fetch(url + `/class_enrollments?select=*&student_id=in.(${ids.join(',')})`, { headers });
    const enrollments = await resEnroll.json();
    console.log("Enrollments count:", enrollments.length);
    console.log("Aslam enrollments:", enrollments.filter(e => e.student_id === profiles.find(p => p.email === 'aslam@gmail.com')?.id).length);
    console.log("Hanna enrollments:", enrollments.filter(e => e.student_id === profiles.find(p => p.email === 'hanna@gmail.com')?.id).length);
    console.log("Meena enrollments:", enrollments.filter(e => e.student_id === profiles.find(p => p.email === 'meenaakshyyy@gmail.com')?.id).length);

    // Check class_batches for their batch
    const aslamBatch = profiles.find(p => p.email === 'aslam@gmail.com')?.metadata?.batch_id;
    console.log("Batch ID:", aslamBatch);

    const resCB = await fetch(url + `/class_batches?select=*&batch_id=eq.${aslamBatch}`, { headers });
    const cb = await resCB.json();
    console.log("Class_batches for this batch count:", cb.length);
}
check();
