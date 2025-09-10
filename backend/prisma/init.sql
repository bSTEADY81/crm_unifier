-- Database initialization script for CRM Unifier
-- This file is run when the PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Set timezone
SET timezone = 'UTC';

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function for audit logging trigger
CREATE OR REPLACE FUNCTION create_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    action_type TEXT;
    resource_type TEXT;
    resource_id TEXT;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'create';
        resource_id := NEW.id::TEXT;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'update';
        resource_id := NEW.id::TEXT;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'delete';
        resource_id := OLD.id::TEXT;
    END IF;
    
    -- Extract resource type from table name
    resource_type := TG_TABLE_NAME;
    
    -- Insert audit event (simplified version - will be enhanced by application)
    INSERT INTO audit_events (action, resource_type, resource_id, metadata)
    VALUES (action_type, resource_type, resource_id, '{}');
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: Prisma will create the actual tables and triggers
-- This file just ensures the database is ready with extensions