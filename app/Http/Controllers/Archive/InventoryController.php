<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\ArchiveDocumentMovement;
use App\Models\InventoryAudit;
use App\Models\InventoryAuditItem;
use App\Models\PhysicalFolder;
use App\Models\PhysicalFolderMovement;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $sectors = Sector::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'name_en']);

        // Physical folders (paper files) for inventory tracking
        $physicalFolders = PhysicalFolder::with(['sector', 'documentFolder'])
            ->orderBy('sector_id')
            ->orderBy('name')
            ->get([
                'id', 'sector_id', 'document_folder_id', 'name',
                'description', 'location',
                'qr_code', 'inventory_code', 'is_active',
                'is_checked_out', 'checked_out_to', 'checked_out_at', 'checked_out_notes',
            ]);

        // System folders tree is used only as optional classification
        $documentFolders = DocumentFolder::with(['sector', 'parent'])
            ->orderBy('sector_id')
            ->orderBy('parent_id')
            ->orderBy('name')
            ->get(['id', 'sector_id', 'parent_id', 'name', 'name_en']);

        return Inertia::render('Archive/Inventory/Index', [
            'sectors' => $sectors,
            'physicalFolders' => $physicalFolders,
            'documentFolders' => $documentFolders,
            'canManage' => (bool) $request->user()?->can('inventory.manage'),
        ]);
    }

    public function storeFolder(Request $request)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        $validated = $request->validate([
            'sector_id' => 'required|exists:sectors,id',
            'document_folder_id' => 'required|exists:document_folders,id',
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
        ]);

        // Ensure the selected system folder belongs to the chosen sector.
        $folderSectorId = DocumentFolder::whereKey($validated['document_folder_id'])->value('sector_id');
        if ($folderSectorId && (int) $folderSectorId !== (int) $validated['sector_id']) {
            abort(422, 'المجلد لا يتبع القطاع المحدد');
        }

        $data = $validated;
        $data['inventory_code'] = $data['inventory_code'] ?? PhysicalFolder::generateInventoryCode();

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $parts = [];
            $cur = DocumentFolder::select(['id', 'name', 'parent_id'])->find($data['document_folder_id']);
            $guard = 0;
            while ($cur && $guard++ < 25) {
                array_unshift($parts, $cur->name);
                $cur = $cur->parent_id ? DocumentFolder::select(['id', 'name', 'parent_id'])->find($cur->parent_id) : null;
            }
            $path = trim(implode(' / ', array_filter($parts)));
            $data['name'] = $path !== '' ? $path : ('ترميز ' . $data['inventory_code']);
        } else {
            $data['name'] = $name;
        }

        $folder = PhysicalFolder::create($data);

        AuditLog::record('create_folder', $folder, [], $folder->toArray(), "إنشاء مجلد (الجرد): {$folder->name}");

        $folder->load(['sector:id,name,name_en', 'documentFolder:id,name,sector_id,parent_id']);

        return response()->json([
            'folder' => [
                'id' => $folder->id,
                'name' => $folder->name,
                'qr_code' => $folder->qr_code,
                'inventory_code' => $folder->inventory_code,
                'description' => $folder->description,
                'location' => $folder->location,
                'sector' => $folder->sector ? [
                    'id' => $folder->sector->id,
                    'name' => $folder->sector->name,
                    'name_en' => $folder->sector->name_en,
                ] : null,
                'document_folder' => $folder->documentFolder ? [
                    'id' => $folder->documentFolder->id,
                    'name' => $folder->documentFolder->name,
                ] : null,
                'is_active' => (bool) $folder->is_active,
                'is_checked_out' => (bool) $folder->is_checked_out,
                'checked_out_to' => $folder->checked_out_to,
                'checked_out_at' => $folder->checked_out_at,
                'checked_out_notes' => $folder->checked_out_notes,
            ],
        ], 201);
    }

    public function lookup(Request $request)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $validated = $request->validate([
            'code' => 'required|string|max:255',
        ]);

        $folder = PhysicalFolder::with(['sector:id,name,name_en', 'documentFolder:id,name,sector_id,parent_id'])
            ->where(function ($q) use ($validated) {
                $q->where('inventory_code', $validated['code'])
                  ->orWhere('qr_code', $validated['code']);
            })
            ->first();

        if (!$folder) {
            return response()->json(['found' => false], 200);
        }

        return response()->json([
            'found' => true,
            'folder' => [
                'id' => $folder->id,
                'name' => $folder->name,
                'sector' => $folder->sector ? [
                    'id' => $folder->sector->id,
                    'name' => $folder->sector->name,
                ] : null,
                'document_folder' => $folder->documentFolder ? [
                    'id' => $folder->documentFolder->id,
                    'name' => $folder->documentFolder->name,
                ] : null,
                'location' => $folder->location,
                'is_active' => (bool) $folder->is_active,
                'is_checked_out' => (bool) $folder->is_checked_out,
                'checked_out_to' => $folder->checked_out_to,
                'checked_out_at' => $folder->checked_out_at,
                'checked_out_notes' => $folder->checked_out_notes,
            ],
        ], 200);
    }

    public function list(Request $request)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $folders = PhysicalFolder::with(['sector:id,name', 'documentFolder:id,name'])
            ->orderBy('sector_id')
            ->orderBy('name')
            ->get([
                'id', 'sector_id', 'document_folder_id', 'name',
                'description', 'location',
                'qr_code', 'inventory_code', 'is_active',
                'is_checked_out', 'checked_out_to', 'checked_out_at', 'checked_out_notes',
            ])
            ->map(function (PhysicalFolder $f) {
                return [
                    'id' => $f->id,
                    'sector_id' => $f->sector_id,
                    'document_folder_id' => $f->document_folder_id,
                    'name' => $f->name,
                    'description' => $f->description,
                    'location' => $f->location,
                    'inventory_code' => $f->inventory_code,
                    'qr_code' => $f->qr_code,
                    'is_active' => (bool) $f->is_active,
                    'is_checked_out' => (bool) $f->is_checked_out,
                    'checked_out_to' => $f->checked_out_to,
                    'checked_out_at' => $f->checked_out_at,
                    'checked_out_notes' => $f->checked_out_notes,
                    'sector' => $f->sector ? ['id' => $f->sector->id, 'name' => $f->sector->name] : null,
                    'document_folder' => $f->documentFolder ? ['id' => $f->documentFolder->id, 'name' => $f->documentFolder->name] : null,
                ];
            });

        return response()->json(['folders' => $folders], 200);
    }

    public function update(Request $request, PhysicalFolder $folder)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        $validated = $request->validate([
            'sector_id' => 'nullable|exists:sectors,id',
            'document_folder_id' => 'nullable|exists:document_folders,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $folder->update($validated);

        AuditLog::record('inventory_update_physical_folder', $folder, [], $folder->toArray(), "تعديل ملف ورقي (الجرد): {$folder->name}");

        $folder->load(['sector:id,name', 'documentFolder:id,name']);

        return response()->json([
            'folder' => [
                'id' => $folder->id,
                'sector_id' => $folder->sector_id,
                'document_folder_id' => $folder->document_folder_id,
                'name' => $folder->name,
                'description' => $folder->description,
                'location' => $folder->location,
                'inventory_code' => $folder->inventory_code,
                'qr_code' => $folder->qr_code,
                'is_active' => (bool) $folder->is_active,
                'is_checked_out' => (bool) $folder->is_checked_out,
                'checked_out_to' => $folder->checked_out_to,
                'checked_out_at' => $folder->checked_out_at,
                'checked_out_notes' => $folder->checked_out_notes,
                'sector' => $folder->sector ? ['id' => $folder->sector->id, 'name' => $folder->sector->name] : null,
                'document_folder' => $folder->documentFolder ? ['id' => $folder->documentFolder->id, 'name' => $folder->documentFolder->name] : null,
            ],
        ], 200);
    }

    public function destroy(Request $request, PhysicalFolder $folder)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        if ($folder->is_checked_out) {
            return response()->json(['message' => 'لا يمكن حذف ملف مُسلّم. قم بالاستلام أولاً.'], 422);
        }

        $snapshot = $folder->toArray();
        $id = $folder->id;
        $name = $folder->name;

        AuditLog::record('inventory_delete_physical_folder', $folder, $snapshot, [], "حذف ملف ورقي (الترميز): {$name}");

        $folder->delete();

        return response()->json(['deleted_id' => $id], 200);
    }

    public function checkout(Request $request, PhysicalFolder $folder)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        $validated = $request->validate([
            'to_person' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'signature' => 'required|string',
        ]);

        if ($folder->is_checked_out) {
            return response()->json(['message' => 'هذا المجلد مُسلّم بالفعل'], 422);
        }

        $folder->forceFill([
            'is_checked_out' => true,
            'checked_out_to' => $validated['to_person'],
            'checked_out_by' => $request->user()?->id,
            'checked_out_at' => now(),
            'checked_out_notes' => $validated['notes'] ?? null,
        ])->save();

        $signaturePath = $this->storeSignatureDataUrl(
            $validated['signature'],
            'signatures/custody/physical-folders/'.now()->format('Y/m')
        );

        PhysicalFolderMovement::create([
            'physical_folder_id' => $folder->id,
            'action' => 'checkout',
            'to_person' => $validated['to_person'],
            'notes' => $validated['notes'] ?? null,
            'signature_path' => $signaturePath,
            'created_by' => $request->user()?->id,
        ]);

        AuditLog::record('inventory_checkout', $folder, [], $folder->toArray(), "تسليم مجلد (الجرد): {$folder->name}");

        return response()->json(['folder' => $folder->fresh()], 200);
    }

    public function checkin(Request $request, PhysicalFolder $folder)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'signature' => 'required|string',
        ]);

        if (!$folder->is_checked_out) {
            return response()->json(['message' => 'هذا المجلد غير مُسلّم حالياً'], 422);
        }

        $signaturePath = $this->storeSignatureDataUrl(
            $validated['signature'],
            'signatures/custody/physical-folders/'.now()->format('Y/m')
        );

        PhysicalFolderMovement::create([
            'physical_folder_id' => $folder->id,
            'action' => 'checkin',
            'to_person' => $folder->checked_out_to,
            'notes' => $validated['notes'] ?? null,
            'signature_path' => $signaturePath,
            'created_by' => $request->user()?->id,
        ]);

        $folder->forceFill([
            'is_checked_out' => false,
            'checked_out_to' => null,
            'checked_out_by' => null,
            'checked_out_at' => null,
            'checked_out_notes' => $validated['notes'] ?? null,
        ])->save();

        AuditLog::record('inventory_checkin', $folder, [], $folder->toArray(), "استلام مجلد (الجرد): {$folder->name}");

        return response()->json(['folder' => $folder->fresh()], 200);
    }

    private function storeSignatureDataUrl(string $dataUrl, string $dir): string
    {
        $dataUrl = trim($dataUrl);
        if (!str_starts_with($dataUrl, 'data:image/png;base64,')) {
            throw ValidationException::withMessages([
                'signature' => 'صيغة التوقيع غير صحيحة (PNG فقط).',
            ]);
        }

        $base64 = substr($dataUrl, strlen('data:image/png;base64,'));
        $binary = base64_decode($base64, true);

        if ($binary === false) {
            throw ValidationException::withMessages([
                'signature' => 'تعذّر قراءة التوقيع.',
            ]);
        }

        if (strlen($binary) > 1024 * 1024) {
            throw ValidationException::withMessages([
                'signature' => 'حجم التوقيع كبير جداً.',
            ]);
        }

        $filename = Str::uuid()->toString().'.png';
        $path = rtrim($dir, '/').'/'.$filename;

        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    public function movements(Request $request)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $validated = $request->validate([
            'q' => 'nullable|string|max:255',
            'action' => 'nullable|in:checkout,checkin',
            'type' => 'nullable|in:physical_folder,document',
            'per_page' => 'nullable|integer|min:5|max:200',
            'page' => 'nullable|integer|min:1',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);
        $q = trim((string) ($validated['q'] ?? ''));
        $action = $validated['action'] ?? null;
        $type = $validated['type'] ?? null;
        $page = (int) ($validated['page'] ?? 1);

        $rows = [];

        if (!$type || $type === 'physical_folder') {
            $q1 = PhysicalFolderMovement::query()
                ->with([
                    'physicalFolder:id,name,inventory_code,sector_id,location',
                    'physicalFolder.sector:id,name',
                    'creator:id,name',
                ])
                ->latest();

            if ($action) $q1->where('action', $action);
            if ($q !== '') {
                $q1->where(function ($sub) use ($q) {
                    $sub->where('to_person', 'like', "%{$q}%")
                        ->orWhere('notes', 'like', "%{$q}%")
                        ->orWhereHas('creator', fn($u) => $u->where('name', 'like', "%{$q}%"))
                        ->orWhereHas('physicalFolder', function ($f) use ($q) {
                            $f->where('name', 'like', "%{$q}%")
                              ->orWhere('inventory_code', 'like', "%{$q}%")
                              ->orWhere('location', 'like', "%{$q}%");
                        });
                });
            }

            foreach ($q1->limit(500)->get() as $m) {
                $rows[] = [
                    'id' => 'pfm:' . $m->id,
                    'type' => 'physical_folder',
                    'action' => $m->action,
                    'to_person' => $m->to_person,
                    'notes' => $m->notes,
                    'signature_url' => $m->signature_path ? Storage::disk('public')->url($m->signature_path) : null,
                    'created_at' => $m->created_at,
                    'created_by' => $m->creator ? ['id' => $m->creator->id, 'name' => $m->creator->name] : null,
                    'subject' => $m->physicalFolder ? [
                        'id' => $m->physicalFolder->id,
                        'name' => $m->physicalFolder->name,
                        'code' => $m->physicalFolder->inventory_code,
                        'location' => $m->physicalFolder->location,
                        'sector' => $m->physicalFolder->sector ? ['id' => $m->physicalFolder->sector->id, 'name' => $m->physicalFolder->sector->name] : null,
                    ] : null,
                ];
            }
        }

        if (!$type || $type === 'document') {
            $q2 = ArchiveDocumentMovement::query()
                ->with([
                    'document:id,title,serial_number,sector_id',
                    'document.sector:id,name',
                    'creator:id,name',
                ])
                ->latest();

            if ($action) $q2->where('action', $action);
            if ($q !== '') {
                $q2->where(function ($sub) use ($q) {
                    $sub->where('to_person', 'like', "%{$q}%")
                        ->orWhere('notes', 'like', "%{$q}%")
                        ->orWhereHas('creator', fn($u) => $u->where('name', 'like', "%{$q}%"))
                        ->orWhereHas('document', function ($d) use ($q) {
                            $d->where('title', 'like', "%{$q}%")
                              ->orWhere('serial_number', 'like', "%{$q}%");
                        });
                });
            }

            foreach ($q2->limit(500)->get() as $m) {
                $rows[] = [
                    'id' => 'dm:' . $m->id,
                    'type' => 'document',
                    'action' => $m->action,
                    'to_person' => $m->to_person,
                    'notes' => $m->notes,
                    'signature_url' => $m->signature_path ? Storage::disk('public')->url($m->signature_path) : null,
                    'created_at' => $m->created_at,
                    'created_by' => $m->creator ? ['id' => $m->creator->id, 'name' => $m->creator->name] : null,
                    'subject' => $m->document ? [
                        'id' => $m->document->id,
                        'name' => $m->document->title,
                        'code' => $m->document->serial_number,
                        'location' => null,
                        'sector' => $m->document->sector ? ['id' => $m->document->sector->id, 'name' => $m->document->sector->name] : null,
                    ] : null,
                ];
            }
        }

        usort($rows, fn($a, $b) => strtotime((string)$b['created_at']) <=> strtotime((string)$a['created_at']));

        $total = count($rows);
        $lastPage = max(1, (int) ceil($total / max(1, $perPage)));
        $page = min(max(1, $page), $lastPage);
        $slice = array_slice($rows, ($page - 1) * $perPage, $perPage);

        return response()->json([
            'movements' => [
                'data' => $slice,
                'current_page' => $page,
                'last_page' => $lastPage,
                'total' => $total,
                'per_page' => $perPage,
            ],
        ], 200);
    }

    public function audits(Request $request)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $audits = InventoryAudit::query()
            ->with(['starter:id,name', 'ender:id,name'])
            ->latest()
            ->paginate((int)($validated['per_page'] ?? 20))
            ->through(function (InventoryAudit $a) {
                return [
                    'id' => $a->id,
                    'title' => $a->title,
                    'status' => $a->status,
                    'started_at' => $a->started_at,
                    'ended_at' => $a->ended_at,
                    'starter' => $a->starter ? ['id' => $a->starter->id, 'name' => $a->starter->name] : null,
                    'ender' => $a->ender ? ['id' => $a->ender->id, 'name' => $a->ender->name] : null,
                    'result' => $a->result,
                ];
            });

        return response()->json(['audits' => $audits], 200);
    }

    public function auditShow(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $counts = InventoryAuditItem::query()
            ->where('audit_id', $audit->id)
            ->selectRaw("status, COUNT(*) as c")
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $summary = [
            'total' => array_sum($counts),
            'pending' => (int)($counts['pending'] ?? 0),
            'found' => (int)($counts['found'] ?? 0),
            'missing' => (int)($counts['missing'] ?? 0),
        ];

        return response()->json([
            'audit' => [
                'id' => $audit->id,
                'title' => $audit->title,
                'status' => $audit->status,
                'started_at' => $audit->started_at,
                'ended_at' => $audit->ended_at,
                'notes' => $audit->notes,
                'result' => $audit->result,
            ],
            'summary' => $summary,
        ], 200);
    }

    public function auditStart(Request $request)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'include_inactive' => 'nullable|boolean',
        ]);

        $audit = InventoryAudit::create([
            'title' => $validated['title'] ?? null,
            'status' => 'running',
            'started_by' => $request->user()?->id,
            'started_at' => now(),
            'notes' => $validated['notes'] ?? null,
        ]);

        $foldersQuery = PhysicalFolder::query()->orderBy('id');
        if (!($validated['include_inactive'] ?? false)) {
            $foldersQuery->where('is_active', true);
        }

        $items = [];
        foreach ($foldersQuery->cursor() as $folder) {
            $items[] = [
                'audit_id' => $audit->id,
                'physical_folder_id' => $folder->id,
                'expected_code' => $folder->inventory_code,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($items) >= 1000) {
                InventoryAuditItem::insert($items);
                $items = [];
            }
        }
        if (!empty($items)) InventoryAuditItem::insert($items);

        return response()->json(['audit' => ['id' => $audit->id]], 201);
    }

    public function auditPause(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);
        if ($audit->status !== 'running') return response()->json(['message' => 'لا يمكن إيقاف هذا الجرد'], 422);
        $audit->update(['status' => 'paused']);
        return response()->json(['ok' => true], 200);
    }

    public function auditResume(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);
        if ($audit->status !== 'paused') return response()->json(['message' => 'لا يمكن استئناف هذا الجرد'], 422);
        $audit->update(['status' => 'running']);
        return response()->json(['ok' => true], 200);
    }

    public function auditFinish(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);
        if ($audit->status === 'completed') return response()->json(['message' => 'الجرد منتهي بالفعل'], 422);

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'mark_pending_missing' => 'nullable|boolean',
        ]);

        if ($validated['mark_pending_missing'] ?? true) {
            InventoryAuditItem::where('audit_id', $audit->id)->where('status', 'pending')->update(['status' => 'missing']);
        }

        $counts = InventoryAuditItem::query()
            ->where('audit_id', $audit->id)
            ->selectRaw("status, COUNT(*) as c")
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $result = [
            'total' => array_sum($counts),
            'pending' => (int)($counts['pending'] ?? 0),
            'found' => (int)($counts['found'] ?? 0),
            'missing' => (int)($counts['missing'] ?? 0),
            'completed_at' => now()->toISOString(),
        ];

        $audit->update([
            'status' => 'completed',
            'ended_by' => $request->user()?->id,
            'ended_at' => now(),
            'notes' => $validated['notes'] ?? $audit->notes,
            'result' => $result,
        ]);

        return response()->json(['result' => $result], 200);
    }

    public function auditScan(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);
        if ($audit->status !== 'running') return response()->json(['message' => 'الجرد غير نشط حالياً'], 422);

        $validated = $request->validate([
            'code' => 'required|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $code = trim($validated['code']);

        $folder = PhysicalFolder::query()
            ->where('inventory_code', $code)
            ->orWhere('qr_code', $code)
            ->first();

        if (!$folder) {
            return response()->json(['found' => false, 'reason' => 'code_not_in_system'], 200);
        }

        $item = InventoryAuditItem::where('audit_id', $audit->id)
            ->where('physical_folder_id', $folder->id)
            ->first();

        if (!$item) {
            return response()->json(['found' => false, 'reason' => 'folder_not_in_audit'], 200);
        }

        $item->update([
            'status' => 'found',
            'scanned_by' => $request->user()?->id,
            'scanned_at' => now(),
            'notes' => $validated['notes'] ?? $item->notes,
        ]);

        return response()->json([
            'found' => true,
            'item' => [
                'id' => $item->id,
                'status' => $item->status,
                'scanned_at' => $item->scanned_at,
            ],
            'folder' => [
                'id' => $folder->id,
                'name' => $folder->name,
                'inventory_code' => $folder->inventory_code,
                'location' => $folder->location,
            ],
        ], 200);
    }

    public function auditItems(Request $request, InventoryAudit $audit)
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $validated = $request->validate([
            'status' => 'nullable|in:pending,found,missing',
            'q' => 'nullable|string|max:255',
            'per_page' => 'nullable|integer|min:10|max:200',
        ]);

        $query = InventoryAuditItem::query()
            ->where('audit_id', $audit->id)
            ->with(['physicalFolder:id,name,inventory_code,location,sector_id,is_checked_out,checked_out_to', 'physicalFolder.sector:id,name', 'scanner:id,name'])
            ->orderBy('id');

        if (!empty($validated['status'])) $query->where('status', $validated['status']);
        $q = trim((string)($validated['q'] ?? ''));
        if ($q !== '') {
            $query->whereHas('physicalFolder', function ($f) use ($q) {
                $f->where('name', 'like', "%{$q}%")
                  ->orWhere('inventory_code', 'like', "%{$q}%")
                  ->orWhere('location', 'like', "%{$q}%");
            });
        }

        $items = $query->paginate((int)($validated['per_page'] ?? 50))->through(function (InventoryAuditItem $i) {
            return [
                'id' => $i->id,
                'status' => $i->status,
                'expected_code' => $i->expected_code,
                'scanned_at' => $i->scanned_at,
                'notes' => $i->notes,
                'scanner' => $i->scanner ? ['id' => $i->scanner->id, 'name' => $i->scanner->name] : null,
                'folder' => $i->physicalFolder ? [
                    'id' => $i->physicalFolder->id,
                    'name' => $i->physicalFolder->name,
                    'inventory_code' => $i->physicalFolder->inventory_code,
                    'location' => $i->physicalFolder->location,
                    'is_checked_out' => (bool) $i->physicalFolder->is_checked_out,
                    'checked_out_to' => $i->physicalFolder->checked_out_to,
                    'sector' => $i->physicalFolder->sector ? ['id' => $i->physicalFolder->sector->id, 'name' => $i->physicalFolder->sector->name] : null,
                ] : null,
            ];
        });

        return response()->json(['items' => $items], 200);
    }

    public function auditItemSetStatus(Request $request, InventoryAudit $audit, InventoryAuditItem $item)
    {
        abort_unless($request->user()?->can('inventory.manage'), 403);

        if ((int) $item->audit_id !== (int) $audit->id) {
            return response()->json(['message' => 'العنصر لا يتبع هذا الجرد'], 422);
        }

        if ($audit->status === 'completed') {
            return response()->json(['message' => 'لا يمكن تعديل عناصر جرد منتهي'], 422);
        }

        $validated = $request->validate([
            'status' => 'required|in:found,missing',
            'notes' => 'nullable|string',
        ]);

        $item->update([
            'status' => $validated['status'],
            'scanned_by' => $request->user()?->id,
            'scanned_at' => now(),
            'notes' => array_key_exists('notes', $validated) ? ($validated['notes'] ?: null) : $item->notes,
        ]);

        AuditLog::record(
            $validated['status'] === 'found' ? 'inventory_audit_item_found' : 'inventory_audit_item_missing',
            $audit,
            [],
            $item->toArray(),
            ($validated['status'] === 'found' ? 'تحديد عنصر جرد كموجود' : 'تحديد عنصر جرد كمفقود') . " (جرد #{$audit->id})"
        );

        return response()->json([
            'ok' => true,
            'item' => [
                'id' => $item->id,
                'status' => $item->status,
                'scanned_at' => $item->scanned_at,
            ],
        ], 200);
    }

    public function auditReportCsv(Request $request, InventoryAudit $audit): StreamedResponse
    {
        abort_unless($request->user()?->can('inventory.view'), 403);

        $filename = "inventory-audit-{$audit->id}.csv";

        return response()->streamDownload(function () use ($audit) {
            $out = fopen('php://output', 'w');

            fputcsv($out, [
                'audit_id',
                'audit_title',
                'audit_status',
                'started_at',
                'ended_at',
                'item_status',
                'folder_name',
                'inventory_code',
                'location',
                'sector',
                'scanned_at',
                'scanned_by',
                'to_person', // for missing in this report it's empty; kept for compatibility
                'notes',
            ]);

            InventoryAuditItem::query()
                ->where('audit_id', $audit->id)
                ->with(['physicalFolder.sector', 'scanner'])
                ->orderBy('id')
                ->chunkById(500, function ($rows) use ($out, $audit) {
                    foreach ($rows as $i) {
                        $folder = $i->physicalFolder;
                        fputcsv($out, [
                            $audit->id,
                            $audit->title,
                            $audit->status,
                            optional($audit->started_at)->toISOString(),
                            optional($audit->ended_at)->toISOString(),
                            $i->status,
                            $folder?->name,
                            $folder?->inventory_code ?? $i->expected_code,
                            $folder?->location,
                            $folder?->sector?->name,
                            optional($i->scanned_at)->toISOString(),
                            $i->scanner?->name,
                            null,
                            $i->notes,
                        ]);
                    }
                });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
