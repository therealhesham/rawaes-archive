<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PendingScan;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ScanUploadController extends Controller
{
    /**
     * Receives a scanned file from a watcher script (office PC).
     * Auth: header "X-Scan-Token" must match SCAN_API_TOKEN env var.
     */
    public function store(Request $request)
    {
        // Token auth
        $token = $request->header('X-Scan-Token');
        $expected = config('services.scan.token');

        if (!$expected || $token !== $expected) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'file' => 'required|file|max:51200|mimes:pdf,jpg,jpeg,png,tif,tiff,bmp',
            'device' => 'nullable|string|max:100',
            'original_name' => 'nullable|string|max:255',
        ]);

        $file = $request->file('file');
        $originalName = $validated['original_name'] ?? $file->getClientOriginalName();
        $path = $file->store('scans/' . now()->format('Y/m/d'), config('filesystems.archive_disk', 'local'));

        $scan = PendingScan::create([
            'original_name'   => $originalName,
            'file_path'       => $path,
            'file_extension'  => strtolower($file->getClientOriginalExtension()),
            'file_size'       => $file->getSize(),
            'mime_type'       => $file->getMimeType(),
            'source'          => 'scanner',
            'source_device'   => $validated['device'] ?? 'unknown',
            'status'          => 'new',
        ]);

        // Log the scan reception (no logged-in user since it's API)
        AuditLog::create([
            'user_id'        => null,
            'user_name'      => 'Scanner [' . ($validated['device'] ?? 'unknown') . ']',
            'ip_address'     => request()->ip(),
            'user_agent'     => 'Scanner Watcher',
            'action'         => 'scan_received',
            'auditable_type' => PendingScan::class,
            'auditable_id'   => $scan->id,
            'description'    => "وصول مسح ضوئي جديد: {$originalName}",
            'created_at'     => now(),
        ]);

        return response()->json([
            'success' => true,
            'id'      => $scan->id,
            'message' => 'تم استلام المستند الممسوح',
        ]);
    }

    /**
     * Health check endpoint for the watcher.
     */
    public function ping(Request $request)
    {
        $token = $request->header('X-Scan-Token');
        $expected = config('services.scan.token');

        if (!$expected || $token !== $expected) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return response()->json(['status' => 'ok', 'time' => now()->toIso8601String()]);
    }
}
