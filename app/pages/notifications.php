<?php
declare(strict_types=1);

$user = current_user();

if ($open = (int) query('open')) {
    $st = db()->prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?');
    $st->execute([$open, $user['id']]);
    if ($n = $st->fetch()) {
        db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ?')->execute([$n['id']]);
        if ($n['link'] && str_starts_with($n['link'], 'index.php?') && !str_contains($n['link'], '//')) {
            header('Location: ' . $n['link']);
            exit;
        }
    }
    redirect('notifications');
}

if (is_post()) {
    if (input('action') === 'read_all') {
        db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$user['id']]);
        flash('success', 'Semua notifikasi ditanda sebagai dibaca.');
    } elseif (input('action') === 'clear') {
        db()->prepare('DELETE FROM notifications WHERE user_id = ? AND is_read = 1')->execute([$user['id']]);
        flash('success', 'Notifikasi yang telah dibaca dipadam.');
    }
    redirect('notifications');
}

$st = db()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ?');
$st->execute([$user['id']]);
$pg = paginate((int) $st->fetchColumn(), 20);
$st = db()->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT {$pg['limit']} OFFSET {$pg['offset']}");
$st->execute([$user['id']]);
$rows = $st->fetchAll();

render_header('Notifikasi', '');
page_title('Notifikasi', 'Makluman berkaitan tempahan anda.',
    '<form method="post" class="d-flex gap-2">' . csrf_field() . '
        <button name="action" value="read_all" class="btn btn-light"><i class="bi bi-check2-all me-1"></i>Tanda semua dibaca</button>
        <button name="action" value="clear" class="btn btn-light text-danger"><i class="bi bi-trash me-1"></i>Padam yang dibaca</button>
    </form>');
?>
<div class="card">
    <?php if (!$rows): ?>
        <div class="empty-state py-5"><i class="bi bi-bell-slash"></i><p>Tiada notifikasi.</p></div>
    <?php endif; ?>
    <div class="list-group list-group-flush">
        <?php foreach ($rows as $n): ?>
            <a href="<?= url('notifications', ['open' => $n['id']]) ?>" class="list-group-item list-group-item-action d-flex gap-3 py-3<?= $n['is_read'] ? '' : ' notif-unread' ?>">
                <div class="notif-icon"><i class="bi bi-<?= str_contains($n['title'], 'Ditolak') ? 'x-circle text-danger' : (str_contains($n['title'], 'Diluluskan') ? 'check-circle text-success' : 'bell text-primary') ?>"></i></div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between gap-2">
                        <strong><?= e($n['title']) ?></strong>
                        <span class="xsmall text-body-secondary text-nowrap"><?= time_ago($n['created_at']) ?></span>
                    </div>
                    <div class="small text-body-secondary"><?= e($n['message']) ?></div>
                </div>
            </a>
        <?php endforeach; ?>
    </div>
    <?php if ($pg['pages'] > 1): ?><div class="card-footer"><?= pagination_links($pg) ?></div><?php endif; ?>
</div>
<?php render_footer();
