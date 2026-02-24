@echo off

node --loader ts-node/esm --no-warnings=ExperimentalWarning --disable-warning=DEP0180 "%~dp0\dev" %*
