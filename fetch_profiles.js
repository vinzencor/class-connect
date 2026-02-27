const url = "https://jdbxqjanhjifafjukdzd.supabase.co/rest/v1/profiles?select=*";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g";

async function fetchProfiles() {
    const res = await fetch(url + "&role=eq.student", {
        headers: {
            "apikey": apiKey,
            "Authorization": "Bearer " + apiKey
        }
    });
    const profiles = await res.json();
    const aslam = profiles.find(p => p.email === "aslam@gmail.com");
    const meena = profiles.find(p => p.email === "meenaakshyyy@gmail.com");

    console.log("Aslam keys:", Object.keys(aslam).map(k => `${k}: ${JSON.stringify(aslam[k])}`).join('\n'));
    console.log("----");
    console.log("Meena keys:", Object.keys(meena).map(k => `${k}: ${JSON.stringify(meena[k])}`).join('\n'));
}
fetchProfiles();
