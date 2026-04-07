@echo off
REM ================================================
REM TKP ACI - Agent Heartbeat Script
REM Auto-invoke all agents every 5 minutes
REM ================================================

SET COMPANY_ID=fe90b604-364f-480d-be10-6a529971db57
SET API_BASE=http://127.0.0.1:3100/api

ECHO [%date% %time%] Starting TKP ACI agent heartbeats...

REM CEO
curl -s -X POST "%API_BASE%/agents/b0e897a5-cda9-4f37-8e2f-e985cb21ec3d/heartbeat/invoke" > nul
ECHO [CEO] Heartbeat sent

REM Content Director
curl -s -X POST "%API_BASE%/agents/24ac8a23-d723-4909-bf40-05f4d4fce689/heartbeat/invoke" > nul
ECHO [Content Director] Heartbeat sent

REM Nova
curl -s -X POST "%API_BASE%/agents/b59b05d6-5a79-46ef-ac96-868cbbdc5ebf/heartbeat/invoke" > nul
ECHO [Nova] Heartbeat sent

REM Nova 2
curl -s -X POST "%API_BASE%/agents/8e06e2ee-45d7-475d-b7b0-381bd5ed6490/heartbeat/invoke" > nul
ECHO [Nova 2] Heartbeat sent

REM Nova 3
curl -s -X POST "%API_BASE%/agents/305c8b58-b3cf-40f3-8444-395b43a902c6/heartbeat/invoke" > nul
ECHO [Nova 3] Heartbeat sent

REM Production Manager
curl -s -X POST "%API_BASE%/agents/e3aad368-fab1-4da3-b287-3a65802d84ff/heartbeat/invoke" > nul
ECHO [Production Manager] Heartbeat sent

REM SEO Specialist
curl -s -X POST "%API_BASE%/agents/9ff4e340-dd34-4476-9238-da8fdbce0873/heartbeat/invoke" > nul
ECHO [SEO Specialist] Heartbeat sent

REM Analytics Agent
curl -s -X POST "%API_BASE%/agents/dc1160e2-d472-4cdd-81a7-f79ea4ac8e53/heartbeat/invoke" > nul
ECHO [Analytics Agent] Heartbeat sent

REM Founding Engineer
curl -s -X POST "%API_BASE%/agents/7bb601dc-a0e0-4f37-9a63-1df7be1be013/heartbeat/invoke" > nul
ECHO [Founding Engineer] Heartbeat sent

REM Founding Engineer 2
curl -s -X POST "%API_BASE%/agents/be3b4d40-f9e0-40ff-a666-c657c29f4995/heartbeat/invoke" > nul
ECHO [Founding Engineer 2] Heartbeat sent

ECHO [%date% %time%] All heartbeats complete.
