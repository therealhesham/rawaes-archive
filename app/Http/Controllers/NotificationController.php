<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index()
    {
        $notifications = auth()->user()->notifications()->paginate(30);
        auth()->user()->unreadNotifications->markAsRead();

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
        ]);
    }

    public function unread()
    {
        return response()->json([
            'count' => auth()->user()->unreadNotifications()->count(),
            'recent' => auth()->user()->unreadNotifications()->take(5)->get(),
        ]);
    }

    public function markAsRead(string $id)
    {
        auth()->user()->notifications()->where('id', $id)->update(['read_at' => now()]);
        return back();
    }

    public function markAllAsRead()
    {
        auth()->user()->unreadNotifications->markAsRead();
        return back();
    }

    public function destroy(string $id)
    {
        auth()->user()->notifications()->where('id', $id)->delete();
        return back();
    }
}
