<?php

namespace App\Console\Commands;

use App\Models\PhysicalFolder;
use Illuminate\Console\Command;

class CleanupUnlinkedPhysicalFolders extends Command
{
    protected $signature = 'inventory:cleanup-unlinked {--force : Actually delete records}';

    protected $description = 'Delete legacy physical_folders that are not linked to system folders (document_folder_id is null)';

    public function handle(): int
    {
        $query = PhysicalFolder::query()->whereNull('document_folder_id');
        $count = (int) $query->count();

        if ($count === 0) {
            $this->info('No unlinked physical folders found.');
            return self::SUCCESS;
        }

        $this->warn("Found {$count} unlinked physical folders (document_folder_id = null).");
        if (!$this->option('force')) {
            $this->line('Dry-run only. Re-run with --force to delete.');
            return self::SUCCESS;
        }

        // Cascades to physical_folder_movements due to FK.
        $deleted = (int) $query->delete();
        $this->info("Deleted {$deleted} physical folders.");

        return self::SUCCESS;
    }
}

