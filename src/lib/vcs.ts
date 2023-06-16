import {type Client} from 'pg';
import {promises as fs} from 'fs';

export default class Vcs {
	dbClient: Client;

	constructor(client: Client) {
		this.dbClient = client;
	}

	async init(): Promise<void> {
		await this.dbClient.query(`CREATE TABLE IF NOT EXISTS vcs (
		id serial PRIMARY KEY,
    domain_id INT NOT NULL,
		FOREIGN KEY (domain_id) REFERENCES domains (id),
    href VARCHAR (2048) UNIQUE
		);`);
	}

	async add(href: string, domainId: number): Promise<void> {
		await this.dbClient.query('INSERT INTO vcs (href, domain_id) VALUES ($1, $2);', [href, domainId]);
		await fs.appendFile('vcs.txt', `${href}\n`);
	}

	async nextDomain(): Promise<{domain: string; id: number}> {
		const response = await this.dbClient.query(`
    SELECT domain, id FROM domains
    WHERE id NOT IN (SELECT domain_id FROM vcs)
    ORDER BY random()
    LIMIT 1;
    `);

		return response.rows[0] as {domain: string; id: number};
	}
}
