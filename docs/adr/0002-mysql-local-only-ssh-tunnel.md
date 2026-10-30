# ADR 0002：MySQL 只监听本机，管理经 SSH 隧道

- 状态：已被 [ADR 0023](0023-postgres-local-only-ssh-tunnel.md) 取代
- 原状态：已接受（MySQL 时代）
- 日期：2026-10-21
- 依据：《星芽学园全新系统设计规格》（已由用户逐节确认）

## 背景
旧系统 MySQL 对公网开放 3306，后补 TLS 与白名单，暴露面大。

## 决策
MySQL 8.4 `bind-address=127.0.0.1`、`mysqlx=OFF`、`skip-name-resolve`；只建 `@localhost` 账号（app、migrator），应用经 Unix socket 连接；运维用 `ssh -L 3307:/run/mysqld/mysqld.sock` 访问；无任何远程账号，安全组不开 3306。

## 后果
攻击面最小，无需证书与白名单维护；管理必须先 SSH 登录服务器。

## 未采用的方案
公网/白名单直连 + 双向 TLS（复杂且风险高）。
