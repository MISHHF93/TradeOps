-- Expand WorkspacePersona for Commerce OS operating personas
ALTER TYPE "WorkspacePersona" ADD VALUE IF NOT EXISTS 'researcher';
ALTER TYPE "WorkspacePersona" ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE "WorkspacePersona" ADD VALUE IF NOT EXISTS 'administrator';
