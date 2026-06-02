<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\Sector;
use Illuminate\Http\Request;

class IntegrationMetaController extends Controller
{
    public function bootstrap()
    {
        return response()->json([
            'sectors' => Sector::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'document_types' => DocumentType::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'requires_expiry']),
            'folders' => DocumentFolder::where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'sector_id', 'parent_id', 'name', 'name_en']),
        ]);
    }

    public function sectors()
    {
        return response()->json([
            'data' => Sector::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function documentTypes()
    {
        return response()->json([
            'data' => DocumentType::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'requires_expiry']),
        ]);
    }

    public function folders(Request $request)
    {
        $request->validate([
            'sector_id' => 'nullable|integer|exists:sectors,id',
        ]);

        $q = DocumentFolder::where('is_active', true)->orderBy('sort_order')->orderBy('name');
        if ($request->sector_id) {
            $q->where('sector_id', $request->sector_id);
        }

        return response()->json([
            'data' => $q->get(['id', 'sector_id', 'parent_id', 'name', 'name_en']),
        ]);
    }
}
