#!/bin/bash

set -e

cd cdk
npm install
npm run build
npm run cdk deploy
cd -

cd website
rm -rf dist/
mkdir dist/
npm install
npx tailwindcss -i input.css -o dist/output.css --minify
cp -rf public/* dist/
sed -i '' -e "s/VERSION/$(date +%s)/g" dist/index.html

aws s3 sync ./dist s3://getdextop.com
aws cloudfront create-invalidation \
    --distribution-id E3I9B0BMZOFJZW \
    --paths "/*"

cd -
