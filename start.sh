#!/bin/bash
cd /Users/macminim2/Scholarlink/backend
node src/server.js > /tmp/sl-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

cd /Users/macminim2/Scholarlink/frontend
npm run dev > /tmp/sl-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "$BACKEND_PID $FRONTEND_PID" > /tmp/sl-pids.txt
echo "Both servers starting..."
sleep 4
echo "=== Backend ===" && cat /tmp/sl-backend.log
echo "=== Frontend ===" && cat /tmp/sl-frontend.log
