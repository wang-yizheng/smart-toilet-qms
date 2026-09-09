#!/usr/bin/env bash
# ---------------------------------------------------------------
# 数据库每日备份脚本
#
# 用法：
#   ./scripts/backup-db.sh
#
# 定时任务（每天凌晨 2 点执行）：
#   0 2 * * * /workspace/scripts/backup-db.sh >> /var/log/toilet-qms-backup.log 2>&1
#
# 可选环境变量：
#   BACKUP_DIR    备份存放目录（默认项目根目录下 backups/）
#   KEEP_DAYS     备份保留天数（默认 7 天）
#   DATABASE_URL  数据库连接串
# ---------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DATABASE_URL="${DATABASE_URL:-postgres://postgres:Tencent2025@localhost:5432/genie}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/smart-toilet-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$TARGET"
echo "[$(date '+%F %T')] 备份完成：$TARGET ($(du -h "$TARGET" | cut -f1))"

# 清理超过保留天数的历史备份
find "$BACKUP_DIR" -type f -name 'smart-toilet-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] 已清理 $KEEP_DAYS 天前的备份"
