<?php

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo '{"status":"method_not_allowed"}';
    exit;
}

$request = curl_init('https://advisio-tam-evaluation-2026.onrender.com/api/health');
curl_setopt_array($request, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$body = curl_exec($request);
$httpStatus = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
$health = is_string($body) ? json_decode($body, true) : null;

if ($httpStatus === 200 && ($health['status'] ?? null) === 'ok'
    && ($health['mode'] ?? null) === 'evaluation'
    && ($health['database'] ?? null) === 'connected') {
    echo '{"status":"ok","mode":"evaluation","database":"connected"}';
    exit;
}

http_response_code(503);
echo '{"status":"unavailable"}';
