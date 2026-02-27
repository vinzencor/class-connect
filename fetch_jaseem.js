const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function checkOrgs() {
    const headers = { "apikey": apiKey, "Authorization": "Bearer " + apiKey };

    // Look for Jaseem
    const resP = await fetch(url + "/profiles?select=email,full_name,organization_id,branch_id&full_name=ilike.*jaseem*", { headers });
    const profiles = await resP.json();
    console.log("Jaseem profiles:", profiles);
}
checkOrgs();
