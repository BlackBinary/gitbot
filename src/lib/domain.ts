import {type Client} from 'pg';

export default class Domain {
	dbClient: Client;

	constructor(client: Client) {
		this.dbClient = client;
	}

	async count(domain = ''): Promise<number> {
		const result = await this.dbClient.query(
			`SELECT COUNT(*) FROM "domains"
			${domain ? 'WHERE "domain" = $1' : ''};`,
			domain ? [domain] : [],
		);
		return result.rows[0].count as number;
	}

	async add(domain: string): Promise<{id: number}> {
		const result = await this.dbClient.query(
			`INSERT INTO "domains" ("domain")
			VALUES ($1)
			ON CONFLICT ("domain")
			DO UPDATE SET "domain" = EXCLUDED."domain"
			RETURNING "id";`,
			[domain],
		);
		return result.rows[0] as {id: number};
	}

	async init(maxUrlLength: number): Promise<void> {
		await this.dbClient.query(`CREATE TABLE IF NOT EXISTS domains (
		id serial PRIMARY KEY,
		domain VARCHAR (${maxUrlLength}) UNIQUE
		);`);
	}
}
