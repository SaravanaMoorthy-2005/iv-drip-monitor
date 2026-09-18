import {integer,sqliteTable,text,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const monitoringWorkspaces=sqliteTable('monitoring_workspaces',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),source:text('source').notNull(),
 version:integer('version').notNull().default(0),writeToken:text('write_token').notNull().default(''),
 payload:text('payload').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const monitoringRecords=sqliteTable('monitoring_records',{
 workspaceId:text('workspace_id').notNull().references(()=>monitoringWorkspaces.id),
 kind:text('kind').notNull(),id:text('id').notNull(),patientId:text('patient_id').notNull().default(''),
 payload:text('payload').notNull(),at:integer('at').notNull(),
},t=>[primaryKey({columns:[t.workspaceId,t.kind,t.id]}),index('monitoring_record_time').on(t.workspaceId,t.kind,t.at)]);
export const telemetryKeys=sqliteTable('telemetry_keys',{
 ownerId:text('owner_id').primaryKey(),hash:text('hash').notNull().unique(),createdAt:integer('created_at').notNull(),
});
