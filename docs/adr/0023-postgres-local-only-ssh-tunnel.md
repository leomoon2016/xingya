# ADR 0023：PostgreSQL 只监听本机，管理经 SSH 隧道

- 状态：已接受
- 日期：2026-10-30
- 取代：[ADR 0002](0002-mysql-local-only-ssh-tunnel.md)
- 依据：[PostgreSQL 重新设计规格](../superpowers/specs/2026-10-30-postgresql-redesign.md)

## 背景

ADR 0002 规定 MySQL 8.4 只绑本机、经 SSH 隧道管理。引擎改为 PostgreSQL 16 后，需保持同一暴露面姿态。

## 决策

- PostgreSQL 16：`listen_addresses` 为空或仅 localhost；优先 Unix socket。
- `pg_hba.conf` 仅允许本机 socket / `127.0.0.1`（及 `::1`）上的 `xingya_app`、`xingya_migrator`；无远程角色；安全组不开 5432。
- 应用经 Unix socket 连接，`TimeZone=UTC`。
- 运维：`ssh -L 5433:<postgres-unix-socket> xingya-ecs`，本机连 `127.0.0.1:5433`。

## 后果

攻击面与 ADR 0002 同级；管理必须先 SSH。备份改为 `pg_dump`（见部署文档）。

## 未采用的方案

公网/白名单直连 + TLS；托管云数据库（超出单机 ECS 范围）。
