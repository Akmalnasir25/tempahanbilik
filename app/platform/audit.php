<?php
declare(strict_types=1);

$logs = platform_db()->query('SELECT a.*, s.name AS admin_name FROM platform_audit a LEFT JOIN super_admins s ON s.id = a.admin_id ORDER BY a.id DESC LIMIT 300')->fetchAll();
platform_header('Log Audit', 'audit');
?>
<h1 class="page-title mb-4">Log Audit Platform</h1>
<div class="card">
    <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
            <thead><tr><th>Masa</th><th>Super Admin</th><th>Aktiviti</th><th>Butiran</th><th>IP</th></tr></thead>
            <tbody>
            <?php foreach ($logs as $l): ?>
                <tr>
                    <td class="small text-nowrap"><?= fmt_datetime($l['created_at']) ?></td>
                    <td class="small"><?= e($l['admin_name'] ?? '-') ?></td>
                    <td class="small font-monospace"><?= e($l['action']) ?></td>
                    <td class="small"><?= e($l['details']) ?></td>
                    <td class="xsmall text-body-secondary font-monospace"><?= e($l['ip']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php platform_footer();
