import pg from 'pg';
import { env } from '$env/dynamic/private';

const RAILWAY_URL = env.RAILWAY_DATABASE_URL || '';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
	if (!pool) {
		pool = new pg.Pool({
			connectionString: RAILWAY_URL,
			ssl: { rejectUnauthorized: false },
			max: 5
		});
	}
	return pool;
}

export async function query<T = Record<string, unknown>>(
	text: string,
	params?: unknown[]
): Promise<T[]> {
	const result = await getPool().query(text, params);
	return result.rows as T[];
}
