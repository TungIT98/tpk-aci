@echo off
REM ============================================================
REM TKP ACI — Agent Heartbeat Invoker
REM Invokes all agents every 5 minutes for autonomous operation
REM Company: TKP ACI
REM Company ID: fe90b604-364f-480d-be10-6a529971db57
REM Paperclip API: http://127.0.0.1:3100
REM ============================================================

set API=http://127.0.0.1:3100
set COMPANY=fe90b604-364f-480d-be10-6a529971db57

REM --- CEO ---
curl -s -X POST "%API%/api/agents/b0e897a5-cda9-4f37-8e2f-e985cb21ec3d/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [CEO] Heartbeat invoked

REM --- Content Director ---
curl -s -X POST "%API%/api/agents/24ac8a23-d723-4909-bf40-05f4d4fce689/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Content Director] Heartbeat invoked

REM --- Nova ---
curl -s -X POST "%API%/api/agents/b59b05d6-5a79-46ef-ac96-868cbbdc5ebf/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Nova] Heartbeat invoked

REM --- Nova 2 ---
curl -s -X POST "%API%/api/agents/8e06e2ee-45d7-475d-b7b0-381bd5ed6490/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Nova 2] Heartbeat invoked

REM --- Nova 3 ---
curl -s -X POST "%API%/api/agents/305c8b58-b3cf-40f3-8444-395b43a902c6/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Nova 3] Heartbeat invoked

REM --- Production Manager ---
curl -s -X POST "%API%/api/agents/e3aad368-fab1-4da3-b287-3a65802d84ff/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Production Manager] Heartbeat invoked

REM --- SEO Specialist ---
curl -s -X POST "%API%/api/agents/9ff4e340-dd34-4476-9238-da8fdbce0873/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [SEO Specialist] Heartbeat invoked

REM --- Analytics Agent ---
curl -s -X POST "%API%/api/agents/dc1160e2-d472-4cdd-81a7-f79ea4ac8e53/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Analytics Agent] Heartbeat invoked

REM --- Founding Engineer ---
curl -s -X POST "%API%/api/agents/7bb601dc-a0e0-4f37-9a63-1df7be1be013/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Founding Engineer] Heartbeat invoked

REM --- Founding Engineer 2 ---
curl -s -X POST "%API%/api/agents/be3b4d40-f9e0-40ff-a666-c657c29f4995/heartbeat/invoke" -H "Content-Type: application/json" -d "{}" > nul
echo [Founding Engineer 2] Heartbeat invoked

echo.
echo All agents invoked. Next heartbeat in 5 minutes.
echo Press Ctrl+C to stop.
timeout /t 300 > nul
