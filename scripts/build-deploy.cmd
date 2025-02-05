@echo off
:: Build and Deploy script
echo Installing dependencies...
npm install @netlify/blobs
call npm install

echo Building project...
set CI=false
call npm run build

echo Installing Netlify CLI...
call npm install -g netlify-cli

echo Deploying to Netlify...
call netlify deploy --prod --dir=dist
