<?php
declare(strict_types=1);

$q = query('q');
$where = '1=1';
$params = [];
if ($q !== '') {
    $where .= ' AND (a.action LIKE ? OR a.details LIKE ? OR u.name LIKE ?)';
    array_push($params, "%$q%", "%$q%", "%$q%");
}
$st = db()->prepare("SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE $where");
$st->execute($params);
$pg = paginate((int) $st->fetchColumn(), 40);
$st = db()->prepare("SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE $where ORDER BY a.id DESC LIMIT {$pg['limit']} OFFSET {$pg['offset']}");
$st->execute($params);
$logs = $st->fetchAll();

$labels = [
    'auth.login' => ['Log masuk', 'box-arrow-in-right', 'secondary'], 'auth.logout' => ['Log keluar', 'box-arrow-right', 'secondary'],
    'auth.register' => ['Pendaftaran', 'person-plus', 'info'],
    'booking.create' => ['Tempahan baharu', 'plus-circle', 'primary'], 'booking.update' => ['Tempahan dipinda', 'pencil', 'primary'],
    'booking.approved' => ['Diluluskan', 'check-circle', 'success'], 'booking.rejected' => ['Ditolak', 'x-circle', 'danger'],
    'booking.cancelled' => ['Dibatalkan', 'slash-circle', 'secondary'],
];

render_header('Log Audit', 'admin/audit');
page_title('Log Audit', 'Rekod semua aktiviti penting dalam sistem.');
?>
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <span class="small text-body-secondary"><?= $pg['total'] ?> rekod</span>
        <form method="get"><input type="hidden" name="p" value="admin/audit">
            <div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="<?= e($q) ?>" placeholder="Cari aktiviti…"></div></form>
    </div>
    <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
            <thead><tr><th>Masa</th><th>Pengguna</th><th>Aktiviti</th><th>Butiran</th><th>IP</th></tr></thead>
            <tbody>
            <?php foreach ($logs as $l): [$label, $icon, $color] = $labels[$l['action']] ?? [$l['action'], 'dot', 'secondary']; ?>
                <tr>
                    <td class="small text-nowrap"><?= fmt_datetime($l['created_at']) ?></td>
                    <td class="small"><?= e($l['user_name'] ?? 'Sistem') ?></td>
                    <td class="small text-nowrap"><i class="bi bi-<?= $icon ?> text-<?= $color ?> me-1"></i><?= e($label) ?></td>
                    <td class="small"><?= e($l['details']) ?></td>
                    <td class="xsmall text-body-secondary font-monospace"><?= e($l['ip']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($pg['pages'] > 1): ?><div class="card-footer"><?= pagination_links($pg) ?></div><?php endif; ?>
</div>
<?php render_footer();
