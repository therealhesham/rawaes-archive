<?php

namespace App\Console\Commands;

use App\Models\ArchiveDocument;
use App\Models\User;
use App\Notifications\DocumentExpiringNotification;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('archive:check-expiry {--days=30}')]
#[Description('Scan documents for upcoming expiry and notify users')]
class CheckExpiringDocuments extends Command
{
    public function handle(): int
    {
        $days = (int) $this->option('days');

        $this->info("🔍 فحص المستندات التي تنتهي خلال {$days} يوم...");

        $notified = 0;

        $expired = ArchiveDocument::expired()
            ->where(function ($q) {
                $q->whereNull('expiry_notified_at')
                  ->orWhere('expiry_notified_at', '<', now()->subDays(7));
            })
            ->with('sector')
            ->get();

        $expiring = ArchiveDocument::expiringSoon($days)
            ->where(function ($q) {
                $q->whereNull('expiry_notified_at')
                  ->orWhere('expiry_notified_at', '<', now()->subDays(7));
            })
            ->with('sector')
            ->get();

        $admins = User::role(['super-admin', 'archive-manager'])
            ->where('is_active', true)
            ->get();

        foreach ($expired as $doc) {
            foreach ($admins as $admin) {
                $admin->notify(new DocumentExpiringNotification($doc, 0));
            }
            $doc->update(['status' => 'expired', 'expiry_notified_at' => now()]);
            $notified++;
        }

        foreach ($expiring as $doc) {
            $daysLeft = max(0, (int) now()->diffInDays($doc->expiry_date, false));
            foreach ($admins as $admin) {
                $admin->notify(new DocumentExpiringNotification($doc, $daysLeft));
            }
            $doc->update(['expiry_notified_at' => now()]);
            $notified++;
        }

        $this->info("✅ تم إرسال {$notified} إشعار");

        return Command::SUCCESS;
    }
}
