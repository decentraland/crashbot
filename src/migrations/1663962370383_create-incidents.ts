/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const tableName = 'incidents'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('severity', ['sev-1','sev-2','sev-3','sev-4','sev-5'])
  pgm.createType('status', ['open', 'closed', 'invalid'])
  pgm.createTable(tableName, {
    id: { type: 'SERIAL', notNull: true },
    update_number: { type: 'SMALLINT', notNull: true},
    modified_by: { type: 'TEXT', notNull: true },
    modified_at: {
      type: 'TIMESTAMP',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    reported_at: { type: 'TIMESTAMP', notNull: true },
    closed_at: { type: 'TIMESTAMP' },
    status: { type: 'status', notNull: true },
    severity: { type: 'severity', notNull: true},
    title: { type: 'TEXT', notNull: true },
    description: { type: 'TEXT', notNull: true },
    point: { type: 'TEXT' },
    contact: { type: 'TEXT' },
    rca_link: { type: 'TEXT' }
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(tableName)
  pgm.dropType('severity')
  pgm.dropType('status')
}
