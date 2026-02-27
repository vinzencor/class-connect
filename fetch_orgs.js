const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function checkOrgs() {
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    const resP = await fetch(url + "/profiles?select=email,full_name,organization_id,branch_id&email=in.(hanna@gmail.com,meenaakshyyy@gmail.com,aslam@gmail.com)", { headers });
    const profiles = await resP.json();
    console.log("Profiles with org and branch:", profiles);

}

checkOrgs();
