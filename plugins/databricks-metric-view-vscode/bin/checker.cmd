#!/bin/sh
:; CHECKER_BIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd); exec "$CHECKER_BIN_DIR/checker.sh" "$@"
@echo off
call "%~dp0checker-windows.cmd" %*
exit /b %ERRORLEVEL%
