<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Sector;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SectorController extends Controller
{
    public function index()
    {
        return Inertia::render('Archive/Sectors/Index', [
            'sectors' => Sector::withCount('documents')->latest()->get(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Archive/Sectors/Form');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'code' => 'required|string|max:20|unique:sectors,code',
            'description' => 'nullable|string',
        ]);

        $sector = Sector::create($validated);
        AuditLog::record('create_sector', $sector, [], $sector->toArray(), "إنشاء قطاع: {$sector->name}");

        return redirect()->route('archive.sectors.index')
            ->with('success', 'تم إنشاء القطاع بنجاح');
    }

    public function show(Sector $sector)
    {
        return redirect()->route('archive.sectors.index');
    }

    public function edit(Sector $sector)
    {
        return Inertia::render('Archive/Sectors/Form', ['sector' => $sector]);
    }

    public function update(Request $request, Sector $sector)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'code' => 'required|string|max:20|unique:sectors,code,' . $sector->id,
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $old = $sector->toArray();
        $sector->update($validated);
        AuditLog::record('update_sector', $sector, $old, $sector->fresh()->toArray(), "تعديل قطاع: {$sector->name}");

        return redirect()->route('archive.sectors.index')
            ->with('success', 'تم تحديث القطاع بنجاح');
    }

    public function destroy(Sector $sector)
    {
        if ($sector->documents()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف قطاع يحتوي على مستندات');
        }
        AuditLog::record('delete_sector', $sector, $sector->toArray(), [], "حذف قطاع: {$sector->name}");
        $sector->delete();

        return redirect()->route('archive.sectors.index')
            ->with('success', 'تم حذف القطاع بنجاح');
    }
}
