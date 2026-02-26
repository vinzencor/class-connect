const SUPABASE_URL = 'https://jdbxqjanhjifafjukdzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnhxamFuaGppZmFmanVrZHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODMyMDQsImV4cCI6MjA4NTY1OTIwNH0.16SFC3W9tbnpT_rFV6HjDn-2u02FEeEb9QejyLVUF1g';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
};

async function query(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
    if (!res.ok) { const t = await res.text(); throw new Error(`Query ${table} failed: ${res.status} ${t}`); }
    return res.json();
}

async function insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Insert ${table} failed: ${res.status} ${t}`); }
    return res.json();
}

async function main() {
    // Step 1: Find SSC and NTPC subjects
    const allSubjects = await query('module_subjects', 'select=id,name,organization_id');
    console.log('All subjects:', allSubjects.map(s => `${s.name} (${s.id})`));

    const sscSubject = allSubjects.find(s => s.name.toUpperCase().includes('SSC') && s.name.toUpperCase().includes('REGULAR'));
    const ntpcSubject = allSubjects.find(s => s.name.toUpperCase().includes('NTPC'));

    if (!sscSubject) { console.error('SSC REGULAR COURSE not found!'); return; }
    if (!ntpcSubject) { console.error('NTPC not found!'); return; }

    console.log(`\nSSC Subject: ${sscSubject.name} (${sscSubject.id})`);
    console.log(`NTPC Subject: ${ntpcSubject.name} (${ntpcSubject.id})`);

    // Step 2: Get all groups from SSC
    const sscGroups = await query('module_groups', `subject_id=eq.${sscSubject.id}&order=sort_order.asc`);
    console.log(`\nSSC Groups:`, sscGroups.map(g => `${g.name} (${g.id})`));

    const qaGroup = sscGroups.find(g => g.name.toUpperCase().includes('QA'));
    const raGroup = sscGroups.find(g => g.name.toUpperCase().includes('RA'));

    if (!qaGroup) { console.error('QA group not found in SSC!'); return; }
    if (!raGroup) { console.error('RA group not found in SSC!'); return; }

    console.log(`\nQA Group: ${qaGroup.name} (${qaGroup.id})`);
    console.log(`RA Group: ${raGroup.name} (${raGroup.id})`);

    // Step 3: Get sub-groups for QA and RA
    const qaSubGroups = await query('module_sub_groups', `group_id=eq.${qaGroup.id}&order=sort_order.asc`);
    const raSubGroups = await query('module_sub_groups', `group_id=eq.${raGroup.id}&order=sort_order.asc`);

    console.log(`\nQA Sub-groups (${qaSubGroups.length}):`, qaSubGroups.map(sg => sg.name));
    console.log(`RA Sub-groups (${raSubGroups.length}):`, raSubGroups.map(sg => sg.name));

    // Step 4: Check existing groups in NTPC
    const ntpcGroups = await query('module_groups', `subject_id=eq.${ntpcSubject.id}&order=sort_order.desc`);
    const maxSortOrder = ntpcGroups.length > 0 ? Math.max(...ntpcGroups.map(g => g.sort_order || 0)) : 0;
    console.log(`\nExisting NTPC groups:`, ntpcGroups.map(g => g.name));

    const existingQA = ntpcGroups.find(g => g.name === qaGroup.name);
    const existingRA = ntpcGroups.find(g => g.name === raGroup.name);

    // Step 5: Copy groups
    async function copyGroup(sourceGroup, subGroups, sortOrder) {
        console.log(`\nCopying group: ${sourceGroup.name}...`);

        const [newGroup] = await insert('module_groups', {
            subject_id: ntpcSubject.id,
            organization_id: sourceGroup.organization_id,
            branch_id: sourceGroup.branch_id || null,
            name: sourceGroup.name,
            description: sourceGroup.description,
            sort_order: sortOrder,
        });

        console.log(`  Created group: ${newGroup.name} (${newGroup.id})`);

        if (subGroups && subGroups.length > 0) {
            for (const sg of subGroups) {
                const [newSg] = await insert('module_sub_groups', {
                    group_id: newGroup.id,
                    organization_id: sg.organization_id,
                    branch_id: sg.branch_id || null,
                    name: sg.name,
                    description: sg.description,
                    sort_order: sg.sort_order,
                });
                console.log(`  Created sub-group: ${newSg.name} (${newSg.id})`);
            }
        }
    }

    if (!existingQA) {
        await copyGroup(qaGroup, qaSubGroups, maxSortOrder + 1);
    } else {
        console.log(`\nSkipping QA - "${existingQA.name}" already exists in NTPC`);
    }

    if (!existingRA) {
        await copyGroup(raGroup, raSubGroups, maxSortOrder + 2);
    } else {
        console.log(`\nSkipping RA - "${existingRA.name}" already exists in NTPC`);
    }

    console.log('\n✅ Done! QA and RA modules with submodules copied to NTPC.');
}

main().catch(err => console.error('Error:', err));
