#!/bin/bash
export PATH="/Users/silvaabe/.nvm/versions/node/v26.4.0/bin:$PATH"
exec /Users/silvaabe/.nvm/versions/node/v26.4.0/bin/node \
  node_modules/.bin/concurrently \
  --names "BE,FE" \
  --prefix-colors "cyan,magenta" \
  "cd backend && /Users/silvaabe/.nvm/versions/node/v26.4.0/bin/node --watch src/index.js" \
  "cd frontend && /Users/silvaabe/.nvm/versions/node/v26.4.0/bin/node node_modules/.bin/vite"
