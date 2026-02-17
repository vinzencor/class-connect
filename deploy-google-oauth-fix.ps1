# PowerShell script to deploy Google OAuth fix
# Run this script to deploy the fixed Edge Functions

Write-Host "🚀 Deploying Google OAuth Fix..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "supabase/functions/google-oauth-callback")) {
    Write-Host "❌ Error: Please run this script from the class-connect directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Deploying google-oauth-callback..." -ForegroundColor Yellow
npx supabase functions deploy google-oauth-callback

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ google-oauth-callback deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy google-oauth-callback" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Deploying create-google-meet..." -ForegroundColor Yellow
npx supabase functions deploy create-google-meet

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ create-google-meet deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy create-google-meet" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 All Edge Functions deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Open your app and login as admin"
Write-Host "2. Go to Settings → Google Calendar Integration"
Write-Host "3. Click 'Connect Google Calendar'"
Write-Host "4. Verify: No 401 errors!"
Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green

