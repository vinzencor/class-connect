# Deploy Edge Function Script
# Run this in PowerShell from the project root

Write-Host "🚀 Deploying Edge Function..." -ForegroundColor Cyan

# Check if Supabase CLI is installed
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: scoop install supabase" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "supabase\functions\create-student\index.ts")) {
    Write-Host "❌ Edge function not found!" -ForegroundColor Red
    Write-Host "Make sure you're in the project root directory" -ForegroundColor Yellow
    exit 1
}

# Link to project (update YOUR_PROJECT_REF if needed)
$projectRef = "jdbxqjanhjifafjukdzd"
Write-Host "🔗 Linking to project: $projectRef" -ForegroundColor Yellow

try {
    supabase link --project-ref $projectRef
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Project already linked or link failed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Link warning (may already be linked): $_" -ForegroundColor Yellow
}

# Deploy the Edge Function
Write-Host "`n📦 Deploying create-student Edge Function..." -ForegroundColor Cyan

try {
    supabase functions deploy create-student --no-verify-jwt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Edge Function deployed successfully!" -ForegroundColor Green
        Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
        Write-Host "1. Run fix-profiles-fk-constraint.sql in Supabase SQL Editor" -ForegroundColor White
        Write-Host "2. Test student verification in your app" -ForegroundColor White
        Write-Host "3. Check browser console for success messages" -ForegroundColor White
    } else {
        Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
        Write-Host "Check the error messages above" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Deployment error: $_" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "- Make sure you're logged in: supabase login" -ForegroundColor White
    Write-Host "- Check your internet connection" -ForegroundColor White
    Write-Host "- Verify project ref is correct: $projectRef" -ForegroundColor White
}

Write-Host "`n📖 For detailed instructions, see DEPLOY_FIX.md" -ForegroundColor Cyan
